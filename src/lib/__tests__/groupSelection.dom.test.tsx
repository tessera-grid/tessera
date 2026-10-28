// @vitest-environment happy-dom
/**
 * Выбор группы целиком в серверной модели строк (ADR 0148; GX4, GX9, GX14): форма среза и
 * его нормализация, срез аргументами модели, выгрузка, инертность клиентской группировки.
 * Запуск: npx vitest run --config vitest.node.config.ts groupSelection
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  setAllSelectionRow,
  setGroupSelected,
  toggleGroupIn,
  toggleRowIn,
  type RowSelectionValue,
} from '../core/rowSelectionAll'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  dataExport,
  type ExportRequest,
  rowExpanding,
  rowGrouping,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import { captureInertWarnings } from './inertWarnings'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  country: string
  city: string
  count?: number
}

interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
}

const COLUMNS = [
  { id: 'country', accessorKey: 'country' },
  { id: 'city', accessorKey: 'city' },
]
const NO_DATA: Item[] = []

let root: Root
let table: any
let calls: Call[]

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>(resolve => {
    calls.push({ request, resolve })
  })

const Grid = ({ plugins }: { plugins: readonly unknown[] }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({
        getRows,
        blockSize: 10,
        getGroupChildCount: (row: Item) => row.count,
      }),
      rowGrouping({ initialGrouping: ['country'] }),
      rowExpanding(),
      ...plugins,
    ] as never,
  })
  return null
}

const source = () =>
  table.getRowSource() as RowSource<{
    id: string
    getIsSelected: () => boolean
  }>

const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

const respond = async (call: Call, rows: Item[]) => {
  await act(async () => call.resolve({ rows, rowCount: rows.length }))
}

const group = (country: string, count?: number): Item => ({
  id: '',
  country,
  city: '',
  count,
})
const item = (id: string, country: string): Item => ({
  id,
  country,
  city: `${country}-city`,
})

/** Корень с группами US и DE; ветка US раскрыта и пришла. */
const mountGroups = async (plugins: readonly unknown[]) => {
  act(() => root.render(<Grid plugins={plugins} />))
  show(0, 9)
  await respond(calls.at(-1)!, [group('US', 2), group('DE', 1)])
  act(() => table.setExpanded({ 'group:["US"]': true }))
  source().count()
  await act(async () => {})
  show(0, 9)
  const branch = calls.find(call => call.request.groupKeys.length === 1)!
  await respond(branch, [item('u1', 'US'), item('u2', 'US')])
}

beforeEach(() => {
  calls = []
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('выбор группы целиком в SSRM (ADR 0148)', () => {
  captureInertWarnings()

  it('GX4: срез { all, except, groups? } с узлами { keys, all, except, groups? } приходит в onRowSelectionChange и задаётся аргументами rowSelectionModel; узел, совпавший с родителем без исключений, удаляется', async () => {
    // Нормализация: снятая строка выбранной группы — исключение её узла; узел без отличий
    // уходит, пустой выбор и выбор без групп — прежней формы.
    const us = toggleGroupIn({}, ['US'], true)
    expect(us).toEqual({
      all: false,
      except: [],
      groups: [{ keys: ['US'], all: true, except: [] }],
    })
    expect(toggleRowIn(us, ['US'], 'u1', false)).toEqual({
      all: false,
      except: [],
      groups: [{ keys: ['US'], all: true, except: ['u1'] }],
    })
    expect(toggleGroupIn(us, ['US'], false)).toEqual({})
    const everything: RowSelectionValue = { all: true, except: [] }
    expect(
      toggleGroupIn(toggleGroupIn(everything, ['DE'], false), ['DE'], true),
    ).toEqual(everything)
    // Подгруппа под выбранной группой: снятие — узел внутри, выбор всей группы его убирает.
    const nested = toggleGroupIn(us, ['US', 'NY'], false)
    expect(nested).toEqual({
      all: false,
      except: [],
      groups: [
        {
          keys: ['US'],
          all: true,
          except: [],
          groups: [{ keys: ['US', 'NY'], all: false, except: [] }],
        },
      ],
    })
    expect(toggleGroupIn(nested, ['US'], true)).toEqual(us)
    // Строка вне групп без группировки — прежние исключения корня.
    expect(toggleRowIn(everything, [], 'r1', false)).toEqual({
      all: true,
      except: ['r1'],
    })

    // На таблице: изменение изнутри — в onRowSelectionChange.
    const changes: RowSelectionValue[] = []
    await mountGroups([
      rowSelection({ onRowSelectionChange: next => changes.push(next) }),
    ])
    act(() => setGroupSelected(table, ['US'], true))
    expect(changes.at(-1)).toEqual(us)
    act(() => setAllSelectionRow(table, 'u2', false, ['US']))
    expect(changes.at(-1)).toEqual({
      all: false,
      except: [],
      groups: [{ keys: ['US'], all: true, except: ['u2'] }],
    })
    expect(source().byId('u1')!.getIsSelected()).toBe(true)
    expect(source().byId('u2')!.getIsSelected()).toBe(false)

    // Срез аргументами модели: строки группы выбраны, группа выбрана целиком.
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    calls = []
    await mountGroups([rowSelection({ rowSelection: us })])
    expect(source().byId('group:["US"]')!.getIsSelected()).toBe(true)
    expect(source().byId('group:["DE"]')!.getIsSelected()).toBe(false)
    expect(source().byId('u1')!.getIsSelected()).toBe(true)
    expect(source().byId('u2')!.getIsSelected()).toBe(true)
  })

  it('GX9: серверная выгрузка получает срез с узлами групп в selection', async () => {
    const exports: ExportRequest[] = []
    await mountGroups([
      rowSelection(),
      dataExport({
        server: true,
        onExport: request => {
          exports.push(request)
        },
      }),
    ])
    act(() => setGroupSelected(table, ['US'], true))
    act(() => setAllSelectionRow(table, 'u1', false, ['US']))
    await act(() => table.exportData({ rows: 'selected' }))
    expect(exports).toHaveLength(1)
    expect(exports[0]!.selection).toEqual({
      all: false,
      except: [],
      groups: [{ keys: ['US'], all: true, except: ['u1'] }],
    })
  })

  it("GX14: в клиентской модели при группировке выбор по-прежнему инертен с причиной 'grouping'", () => {
    const ClientGrid = () => {
      table = useCreateTable({
        columns: COLUMNS as never,
        data: [item('a', 'US'), item('b', 'DE')],
        getRowId: (row: Item) => row.id,
        plugins: [
          rowGrouping({ initialGrouping: ['country'] }),
          rowSelection(),
        ] as never,
      })
      return null
    }
    act(() => root.render(<ClientGrid />))
    const groupRow = table.getRowModel().rows[0]
    expect(groupRow.getIsGrouped()).toBe(true)
    expect(groupRow.getCanSelect()).toBe(false)
    expect(
      table
        .getPluginDiagnostics()
        .find((entry: { id: string }) => entry.id === 'rowSelection'),
    ).toMatchObject({ status: 'inert', reason: 'grouping' })
  })
})

// @vitest-environment happy-dom
/**
 * Перенос строки между группами клиентской группировки (ADR 0186; GM1, GM3): когда активен,
 * стадия модели группировки до итога промиса.
 * Запуск: npx vitest run --config vitest.node.config.ts clientGroupMove
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cellValueOf } from '../core/cellValue'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnSortingModel,
  quickSearchModel,
  rowDragging,
  type RowDragEnd,
  rowExpanding,
  rowGrouping,
} from '../plugins'
import { moveRowToGroup } from '../plugins/rowDragging/groupMove'
import { captureInertWarnings } from './inertWarnings'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  country: string
}

const ITEMS: Item[] = [
  { id: 'a', country: 'US' },
  { id: 'b', country: 'US' },
  { id: 'c', country: 'DE' },
]
const COLUMNS = [
  { id: 'id', accessorKey: 'id' },
  { id: 'country', accessorKey: 'country' },
]

let root: Root
let table: any
let write: (change: (rows: Item[]) => Item[]) => void
let settleMove: ((ok: boolean) => void) | undefined

const promised = () =>
  new Promise<void>((resolve, reject) => {
    settleMove = ok => (ok ? resolve() : reject(new Error('refused')))
  })

const Grid = ({
  onRowDragEnd,
  extra = [],
}: {
  onRowDragEnd?: (end: RowDragEnd) => unknown
  extra?: readonly unknown[]
}) => {
  const [data, setData] = useState(ITEMS)
  write = setData
  table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: [
      rowExpanding({ initialExpanded: true }),
      rowGrouping({ initialGrouping: ['country'] }),
      rowDragging({ onRowDragEnd } as never),
      ...extra,
    ] as never,
  })
  return null
}

const statusOf = (id: string) =>
  (
    table.getPluginDiagnostics() as {
      id: string
      status: string
      reason?: string
    }[]
  ).find(entry => entry.id === id)
const groupRow = (value: string) =>
  table.getRowModel().rowsById[`country:${value}`]
const inGroup = (value: string) =>
  groupRow(value).subRows.map((row: { id: string }) => row.id)
const leaf = (id: string) => table.getRow(id, true)
/** Значение колонки, которое показывает ячейка строки (ADR 0186, §3). */
const shown = (id: string, columnId: string) =>
  cellValueOf(leaf(id).getAllCellsByColumnId()[columnId]).value

beforeEach(() => {
  settleMove = undefined
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('перенос между клиентскими группами (ADR 0186)', () => {
  captureInertWarnings()

  it('GM1: при группировке rowDragging с onRowDragEnd активен, без него инертен с причиной grouping; при сортировке и фильтре инертен с их причинами', () => {
    act(() => root.render(<Grid />))
    expect(statusOf('rowDragging')).toMatchObject({
      status: 'inert',
      reason: 'grouping',
    })
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))

    act(() =>
      root.render(
        <Grid
          onRowDragEnd={() => undefined}
          extra={[columnSortingModel(), quickSearchModel()]}
        />,
      ),
    )
    expect(statusOf('rowDragging')).toMatchObject({ status: 'active' })
    expect(leaf('a').getCanDrag()).toBe(true)
    expect(groupRow('US').getCanDrag()).toBe(false)

    act(() => table.setSorting([{ id: 'id', desc: false }]))
    expect(statusOf('rowDragging')).toMatchObject({ reason: 'sorting' })
    act(() => table.setSorting([]))
    act(() => table.setGlobalFilter('a'))
    expect(statusOf('rowDragging')).toMatchObject({ reason: 'filtering' })
  })

  it('GM3: строка стоит в новой группе до итога промиса; успех снимает стадию, приложение меняет значение в data', async () => {
    const ends: RowDragEnd[] = []
    act(() =>
      root.render(
        <Grid
          onRowDragEnd={end => {
            ends.push(end)
            return promised()
          }}
        />,
      ),
    )
    act(() => moveRowToGroup(table, leaf('a'), groupRow('DE')))
    expect(inGroup('DE').sort()).toEqual(['a', 'c'])
    expect(inGroup('US')).toEqual(['b'])
    expect(ends.at(-1)).toMatchObject({
      rowId: 'a',
      parentId: 'country:DE',
      previousParentId: 'country:US',
      groupValues: { country: 'DE' },
      previousGroupValues: { country: 'US' },
    })
    // Данные приложения не менялись, а ячейка показывает новую группу.
    expect(leaf('a').original.country).toBe('US')
    expect(shown('a', 'country')).toBe('DE')

    await act(async () => {
      write(rows =>
        rows.map(row => (row.id === 'a' ? { ...row, country: 'DE' } : row)),
      )
      settleMove!(true)
    })
    expect(table.atoms.rowMoves.get()).toEqual({})
    expect(inGroup('DE').sort()).toEqual(['a', 'c'])
    expect(leaf('a').original.country).toBe('DE')
    expect(shown('a', 'country')).toBe('DE')

    // Отказ снимает стадию: строка в прежней группе, значение прежнее.
    act(() => moveRowToGroup(table, leaf('b'), groupRow('DE')))
    expect(shown('b', 'country')).toBe('DE')
    await act(async () => settleMove!(false))
    expect(inGroup('US')).toEqual(['b'])
    expect(shown('b', 'country')).toBe('US')
  })
})

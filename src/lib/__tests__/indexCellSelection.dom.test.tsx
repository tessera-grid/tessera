// @vitest-environment happy-dom
/**
 * Выделение ячеек и копирование в серверной модели строк (ADR 0146; XC1, XC6, XC9–XC11,
 * XC16): диапазон по индексам, догрузка строк для буфера, предел, смена списка, канал
 * действий.
 * Запуск: npx vitest run --project unit indexCellSelection
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { copyCellSelection } from '../core/cellSelectionCopy'
import type { DebugAction } from '../core/debugActions'
import { __resetLogger } from '../util/logger'
import type { RowSource } from '../core/rowSource'
import { readServerAction } from '../core/serverActions'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellSelection,
  columnFilteringModel,
  columnSortingModel,
  quickSearchModel,
  rowExpanding,
  rowGroupingModel,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  city: string
}
interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
  reject: (error: Error) => void
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const BLOCK = 10
const NO_DATA: Item[] = []

let root: Root | undefined
let table: any
let calls: Call[]
let actions: DebugAction[]

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
    calls.push({ request, resolve, reject })
  })

const Grid = ({
  data = NO_DATA,
  rowCount,
  plugins,
}: {
  data?: Item[]
  rowCount?: number
  plugins: () => readonly unknown[]
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data,
    rowCount,
    getRowId: (row: Item) => row.id,
    onDebugAction: (action: DebugAction) => actions.push(action),
    plugins: plugins() as never,
  })
  return null
}

const render = (
  plugins: () => readonly unknown[],
  data?: Item[],
  rowCount?: number,
) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Grid, { plugins, data, rowCount })))
}

const server = (extra: readonly unknown[] = [], selection = {}) =>
  render(
    () => [
      serverRowModel({ getRows, blockSize: BLOCK }),
      cellSelection(selection),
      ...extra,
    ],
    undefined,
    1000,
  )

const source = () => table.getRowSource() as RowSource<{ id: string }>
const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

const item = (id: string, at: number): Item => ({
  id,
  name: `N${at}`,
  city: `C${at}`,
})

/** Ответить на запрос строками его диапазона; `count` — итог ветки или списка. */
const answer = async (call = calls.at(-1)!, count?: number) => {
  const { start, end, parentId } = call.request
  const last = count === undefined ? end : Math.min(end, count)
  const prefix = parentId ? `${parentId}.` : 'r'
  await act(async () => {
    call.resolve({
      rows: Array.from({ length: Math.max(0, last - start) }, (_, i) =>
        item(`${prefix}${start + i}`, start + i),
      ),
      ...(count === undefined ? {} : { rowCount: count }),
    })
  })
}

const ranges = () =>
  table.store.get().cellSelection as {
    anchorRowIndex?: number
    focusRowIndex?: number
  }[]

const select = (top: number, bottom: number) =>
  act(() =>
    table.setCellSelection(() => [
      {
        anchorRowIndex: top,
        focusRowIndex: bottom,
        anchorColumnId: 'name',
        focusColumnId: 'city',
      },
    ]),
  )

/** Буфер обмена: записанный текст и таблица. */
const stubClipboard = () => {
  const written: { text: string; html?: string }[] = []
  class Item {
    constructor(readonly data: Record<string, Blob>) {}
  }
  vi.stubGlobal('ClipboardItem', Item)
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: {
      write: async (items: Item[]) => {
        for (const entry of items) {
          written.push({
            text: await entry.data['text/plain']!.text(),
            html: await entry.data['text/html']!.text(),
          })
        }
      },
      writeText: async (text: string) => {
        written.push({ text })
      },
    },
  })
  return written
}

beforeEach(() => {
  calls = []
  actions = []
  __resetLogger()
})
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Выделение и копирование в серверной модели строк (ADR 0146)', () => {
  it('XC1: в SSRM выделение не инертно — диапазон индексами строк и id колонок в срезе; диапазон без индексов не применяется, одно предупреждение', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onCellSelectionChange = vi.fn()
    server([], { onCellSelectionChange })
    show(0, 9)
    await answer()
    const diagnostics = table.getPluginDiagnostics() as {
      id: string
      status: string
    }[]
    expect(diagnostics.filter(d => d.id.startsWith('cellSelection'))).toEqual([
      { id: 'cellSelection', status: 'active' },
    ])

    // Id строк загруженного окна — в индексы; до незагруженной строки 500.
    act(() =>
      table.selectCellRange({
        anchorRowId: 'r2',
        focusRowId: 'r2',
        anchorColumnId: 'name',
        focusColumnId: 'city',
      }),
    )
    act(() => table.extendCellSelection('down'))
    select(2, 500)
    expect(onCellSelectionChange).toHaveBeenLastCalledWith([
      {
        anchorRowIndex: 2,
        focusRowIndex: 500,
        anchorColumnId: 'name',
        focusColumnId: 'city',
      },
    ])
    expect(table.getSelectedCellCount()).toBe(499 * 2)
    expect(source().at(500)).toBeUndefined()

    // Диапазон по id строк серверная модель не применяет.
    for (let i = 0; i < 2; i++) {
      act(() =>
        table.setCellSelection(() => [
          {
            anchorRowId: 'r1',
            focusRowId: 'r3',
            anchorColumnId: 'name',
            focusColumnId: 'city',
          },
        ]),
      )
      expect(table.getCellSelectionBounds()).toEqual([])
    }
    expect(
      warn.mock.calls.filter(([message]) =>
        String(message).includes('anchorRowIndex'),
      ),
    ).toHaveLength(1)
  })

  it('XC6: копирование с незагруженными строками запрашивает их getRows текущей выборки по веткам, мимо кэша и maxBlocks; буфер пишется после ответа', async () => {
    const written = stubClipboard()
    server([
      rowExpanding({ hasChildren: row => row.depth === 0 }),
      columnSortingModel({ initialSorting: [{ id: 'city', desc: true }] }),
    ])
    show(0, 9)
    await answer()
    act(() => table.setExpanded({ r1: true }))
    source().count()
    await act(async () => {})
    // Ветка r1 — 25 строк, загружен её первый блок.
    await answer(
      calls.find(call => call.request.parentId === 'r1'),
      25,
    )
    expect(source().at(2)?.id).toBe('r1.0')
    const asked = calls.length
    // Строки 0…40: корень r0, r1, ветка r1 (25), корни r2… — второй и третий блоки ветки
    // и корни после неё не загружены.
    select(0, 40)
    expect(copyCellSelection(table, { source: 'keyboard' })).toBe('loading')
    const fetched = calls.slice(asked)
    expect(
      fetched.map(c => [c.request.parentId ?? null, c.request.start]),
    ).toEqual(
      expect.arrayContaining([
        ['r1', 10],
        ['r1', 20],
        [null, 10],
      ]),
    )
    // Запросы — текущей выборки, как у окна.
    for (const call of fetched) {
      expect(call.request.sorting).toEqual([{ id: 'city', desc: true }])
    }
    expect(written).toEqual([])
    for (const call of fetched) {
      await answer(call, call.request.parentId ? 25 : undefined)
    }
    await act(async () => {})
    await vi.waitFor(() => expect(written).toHaveLength(1))
    const lines = written[0]!.text.split('\n')
    expect(lines).toHaveLength(41)
    expect(lines[0]).toBe('N0\tC0')
    expect(lines[2]).toBe('N0\tC0')
    expect(lines[12]).toBe('N10\tC10')
    expect(lines[27]).toBe('N2\tC2')
    expect(written[0]!.html).toContain('<table')
    // Мимо кэша: строки не стали загруженными.
    expect(source().at(12)).toBeUndefined()
    expect(source().at(40)).toBeUndefined()
  })

  it('XC9: строк выделения больше maxCopyRows — отказ с причиной без запросов, и в клиентском режиме', async () => {
    stubClipboard()
    server([], { maxCopyRows: 5 })
    show(0, 9)
    await answer()
    const asked = calls.length
    select(0, 7)
    expect(copyCellSelection(table, { source: 'keyboard' })).toBe('refused')
    expect(calls.length).toBe(asked)
    const failed = readServerAction(table).failed
    expect(failed?.kind).toBe('copy')
    expect((failed?.error as Error).message).toBe(
      'The limit is 5 rows. Use export',
    )
    act(() => root!.unmount())
    root = undefined

    // Клиентский режим: тот же предел, буфер события не тронут.
    const data = Array.from({ length: 10 }, (_, i) => item(`c${i}`, i))
    render(() => [cellSelection({ maxCopyRows: 5 })], data)
    act(() =>
      table.selectCellRange({
        anchorRowId: 'c0',
        focusRowId: 'c7',
        anchorColumnId: 'name',
        focusColumnId: 'city',
      }),
    )
    const clipboardData = { setData: vi.fn() }
    expect(
      copyCellSelection(table, { clipboardData, source: 'keyboard' }),
    ).toBe('refused')
    expect(clipboardData.setData).not.toHaveBeenCalled()
    act(() =>
      table.selectCellRange({
        anchorRowId: 'c0',
        focusRowId: 'c4',
        anchorColumnId: 'name',
        focusColumnId: 'city',
      }),
    )
    expect(
      copyCellSelection(table, { clipboardData, source: 'keyboard' }),
    ).toBe('copied')
  })

  it('XC10: сортировка, фильтр, поиск, группировка и refreshRows с purge сбрасывают выделение, refreshRows без purge — нет', async () => {
    server([
      columnSortingModel(),
      columnFilteringModel(),
      quickSearchModel(),
      rowGroupingModel(),
    ])
    show(0, 9)
    await answer()
    const changes: [string, () => void][] = [
      ['сортировка', () => table.setSorting([{ id: 'name', desc: true }])],
      [
        'фильтр',
        () =>
          table.setColumnFilters([
            { id: 'name', value: { operator: 'contains', value: 'N' } },
          ]),
      ],
      ['поиск', () => table.setGlobalFilter('N')],
      ['группировка', () => table.setGrouping(['city'])],
      ['сброс кэша', () => table.refreshRows({ purge: true })],
    ]
    for (const [name, change] of changes) {
      select(1, 3)
      act(change)
      expect(ranges(), name).toEqual([])
    }
    select(1, 3)
    act(() => table.refreshRows())
    expect(ranges()).toHaveLength(1)
  })

  it('XC11: раскрытие, сворачивание и приход строк ветки выше диапазона сдвигают его; внутри диапазона — сбрасывают', async () => {
    server([rowExpanding({ hasChildren: row => row.depth === 0 })])
    show(0, 9)
    await answer()
    select(5, 7)

    // Раскрыли r1 выше диапазона: ветка ещё пуста, затем пришло 4 строки.
    act(() => table.setExpanded({ r1: true }))
    source().count()
    await act(async () => {})
    await answer(
      calls.find(call => call.request.parentId === 'r1'),
      4,
    )
    expect(ranges()[0]).toMatchObject({ anchorRowIndex: 9, focusRowIndex: 11 })

    // Свернули — диапазон на прежних строках.
    act(() => table.setExpanded({}))
    source().count()
    expect(ranges()[0]).toMatchObject({ anchorRowIndex: 5, focusRowIndex: 7 })

    // Раскрыли r9 ниже диапазона — без изменений.
    act(() => table.setExpanded({ r9: true }))
    source().count()
    await answer(
      calls.find(call => call.request.parentId === 'r9'),
      3,
    )
    expect(ranges()[0]).toMatchObject({ anchorRowIndex: 5, focusRowIndex: 7 })

    // Раскрыли r6 — строки встали внутрь диапазона: выделение снято.
    act(() => table.setExpanded({ r9: true, r6: true }))
    source().count()
    await act(async () => {})
    expect(ranges()).toEqual([])
  })

  it('XC16: копирование — действие copy в канале действий: начало, ожидание, итог или причина отказа, отмена', async () => {
    stubClipboard()
    server([], { maxCopyRows: 100 })
    show(0, 9)
    await answer()
    const named = (action: string) =>
      actions.filter(a => a.plugin === 'cellSelection' && a.action === action)

    select(0, 30)
    copyCellSelection(table, { source: 'keyboard' })
    const start = named('copy').at(-1)!
    expect(start).toMatchObject({
      source: 'keyboard',
      detail: { rows: 31, cells: 62 },
    })
    for (const call of calls.slice(1)) await answer(call)
    await vi.waitFor(() => expect(named('copyResolved')).toHaveLength(1))
    expect(named('copyResolved')[0]!.cause).toBe(start.id)

    // Новое выделение отменяет ждущее копирование.
    select(0, 60)
    const asked = calls.length
    copyCellSelection(table, { source: 'pointer' })
    const cancelled = named('copy').at(-1)!
    select(0, 1)
    for (const call of calls.slice(asked)) await answer(call)
    await vi.waitFor(() => expect(named('copyCancelled')).toHaveLength(1))
    expect(named('copyCancelled')[0]!.cause).toBe(cancelled.id)

    // Отказ сервера — причина в итоге.
    select(0, 80)
    const before = calls.length
    copyCellSelection(table, { source: 'keyboard' })
    const refused = named('copy').at(-1)!
    await act(async () => {
      calls[before]!.reject(new Error('Server error: 503'))
    })
    await vi.waitFor(() => expect(named('copyRejected')).toHaveLength(1))
    expect(named('copyRejected')[0]).toMatchObject({
      cause: refused.id,
      detail: { error: 'Server error: 503' },
    })
  })
})

// @vitest-environment happy-dom
/**
 * Строки до сохранения (ADR 0178, §7; DR27, DR28, DR30, DR33, DR41, DR50, DR54–DR55): место новой
 * строки, удаление, пакет со вставками и удалениями, режимы, где строки инертны, копирование
 * диапазона. Диапазон на индексах и смена списка в эффекте коммита (ADR 0152, TG21).
 * Запуск: npx vitest run --config vitest.node.config.ts rowDrafts
 */
import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pluginStateKey, setPluginState } from '../core/definePlugin'
import { applyAllDrafts, type Draft } from '../core/drafts/drafts'
import { readFailures } from '../core/failures/failuresFeature'
import { readFlashes } from '../core/flashes/flashFeature'
import { readHighlights } from '../core/highlights/highlightFeature'
import { rangeOfKey } from '../core/highlights/targetRanges'
import { KEYBOARD_NAVIGATION } from '../core/keyboardNavigation/model'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  cellSelectionModel,
  columnFilteringModel,
  columnSortingModel,
  infiniteScroll,
  paginationModel,
  quickSearchModel,
  rowExpandingModel,
  rowGrouping,
  serverRowModel,
} from '../plugins'
import {
  readEditingState,
  saveEdit,
  startEditSession,
} from '../plugins/cellEditing/session'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string; age: number }

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]
const ROWS: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
}))

let table: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.restoreAllMocks()
})

type Commit = (
  batch: CellEditBatch,
) => CellEditBatchResult | void | Promise<CellEditBatchResult | void>

/** Работа в эффекте дочернего компонента: он идёт раньше эффектов таблицы того же коммита. */
let inChildEffect: (() => void) | undefined
const Child = () => {
  useEffect(() => {
    const work = inChildEffect
    inChildEffect = undefined
    work?.()
  })
  return null
}

const mount = (
  plugins: readonly unknown[],
  options: Record<string, unknown> = {},
) => {
  const Host = () => {
    table = useCreateTable({
      columns: columns as never,
      data: ROWS,
      getRowId: (row: Row) => row.id,
      ...options,
      plugins: plugins as never,
    } as never)
    return createElement(Child)
  }
  root = createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host)))
}

const manual = (onCommitEdits?: Commit) =>
  cellEditing({ saveMode: 'manual', onCommitEdits } as never)

const source = () => table.getRowSource() as RowSource<{ id: string }>
const ids = () =>
  Array.from({ length: source().count() }, (_, i) => source().at(i)?.id)
const drafts = (): Draft[] => table.getDrafts()
const kinds = () => drafts().map(draft => draft.kind)
const add = (values: Partial<Row>, index: number) => {
  let id: string | undefined
  act(() => {
    id = table.addRow(values, { index })
  })
  return id
}

/** Открыть правку возраста строки и сохранить текст, как Enter. */
const edit = (rowId: string, text: string) => {
  const row = source().byId(rowId)
  act(() => startEditSession(table, row as never, { id: 'age' }))
  act(() =>
    saveEdit(
      table,
      { rowId, columnId: 'age' },
      { text },
      table.getHooks().cellEditing,
    ),
  )
}

/** Серверная модель со страницей строк, загруженной в окно. */
const mountServer = async (options: Record<string, unknown> = {}) => {
  mount(
    [
      serverRowModel({
        blockSize: 10,
        maxBlocks: 5,
        getRows: ({ start, end }: { start: number; end: number }) =>
          Promise.resolve({ rows: ROWS.slice(start, end), rowCount: 30 }),
      }),
      manual(batch => ({
        saved: (batch.inserts ?? []).map(item => ({
          rowId: item.rowId,
          row: { id: item.rowId, name: 'Saved', age: 1 },
        })),
      })),
    ],
    { data: [], rowCount: 30, ...options },
  )
  await act(async () => {
    source().observe!({ first: 0, last: 9, fast: false })
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

const saveDrafts = async () => {
  act(() => applyAllDrafts(table))
  for (let i = 0; i < 50 && drafts().length > 0; i++) {
    await act(() => new Promise(resolve => setTimeout(resolve, 20)))
  }
  expect(drafts()).toEqual([])
}

describe('строки до сохранения (ADR 0178, §7)', () => {
  it("DR27: в 'manual' addRow кладёт черновик rowInsert с временным id, строка встаёт на index и держится за строку над ней — сортировка, фильтр, поиск и страница её не двигают и не прячут; в 'auto' вызов инертен с предупреждением", () => {
    mount([
      manual(),
      columnSortingModel(),
      columnFilteringModel(),
      quickSearchModel(),
      paginationModel({ initialPageSize: 10 } as never),
    ])
    const id = add({ name: 'Zed', age: 99 }, 3)!
    expect(id).toBeTruthy()
    expect(kinds()).toEqual(['rowInsert'])
    expect(drafts()[0]!.target).toEqual({ row: id })
    expect(ids()[3]).toBe(id)
    const above = ids()[2]!
    // Сортировка по возрасту вниз: по своему значению строка ушла бы наверх. Страница — на
    // весь список, чтобы строка над новой осталась в нём.
    act(() => table.setPageSize(50))
    act(() => table.setSorting([{ id: 'age', desc: true }]))
    expect(ids().indexOf(id)).toBe(ids().indexOf(above) + 1)
    act(() => table.setSorting([]))
    // Фильтр и поиск, которым новая строка не подходит, её не прячут.
    act(() =>
      table.setColumnFilters([
        { id: 'name', value: { operator: 'contains', value: 'Name 1' } },
      ]),
    )
    expect(ids()).toContain(id)
    act(() => table.setColumnFilters([]))
    act(() => table.setGlobalFilter('Name 2'))
    expect(ids()).toContain(id)
    act(() => table.setGlobalFilter(''))
    act(() => table.setPageSize(10))
    // Другая страница: строки над новой там нет — новая строка на прежнем месте.
    act(() => table.setPageIndex(1))
    expect(ids()[3]).toBe(id)
    act(() => root?.unmount())

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount([cellEditing({ saveMode: 'auto' } as never)])
    expect(add({ name: 'Zed' }, 1)).toBeUndefined()
    expect(drafts()).toEqual([])
    expect(source().count()).toBe(ROWS.length)
    expect(warn.mock.calls.flat().join(' ')).toMatch(/addRow is inert/)
  })

  it('DR28: removeRow кладёт черновик rowDelete — строка на месте, ячейки не правятся; удаление новой строки снимает её черновик; черновики ячеек удалённой строки остаются и в пакет не уходят', () => {
    const batches: CellEditBatch[] = []
    mount([manual(batch => void batches.push(batch))])
    edit('5', '77')
    act(() => table.removeRow('5'))
    expect(drafts().map(d => [d.kind, d.target])).toEqual([
      ['cellValue', { cell: ['5', 'age'] }],
      ['rowDelete', { row: '5' }],
    ])
    expect(ids()[5]).toBe('5')
    // Ячейку удалённой строки не открыть.
    act(() => table.removeRow('6'))
    act(() =>
      startEditSession(table, source().byId('6') as never, { id: 'age' }),
    )
    expect(readEditingState(table).active).toBeNull()
    // Новая строка уходит вместе с черновиком.
    const id = add({ name: 'Zed' }, 1)!
    act(() => table.removeRow(id))
    expect(kinds()).not.toContain('rowInsert')
    expect(ids()).not.toContain(id)
    act(() => applyAllDrafts(table))
    expect(batches).toHaveLength(1)
    expect(batches[0]!.cells).toEqual([])
    expect(batches[0]!.deletes).toEqual([{ rowId: '5' }, { rowId: '6' }])
  })

  it('DR30: пакет onCommitEdits — cells, inserts, deletes; ответ отказывает по целям строк и ячеек и возвращает сохранённую строку временного id; успех снимает черновики, серверная модель пишет строку в кэш на её место', async () => {
    const batches: CellEditBatch[] = []
    let answer: CellEditBatchResult = {}
    mount([manual(batch => (batches.push(batch), answer))])
    edit('1', '50')
    edit('2', '60')
    const id = add({ name: 'Zed', age: 99 }, 3)!
    act(() => table.removeRow('7'))
    answer = {
      refused: [
        { rowId: id, reason: 'Duplicate name' },
        { rowId: '2', columnId: 'age', reason: 'Too old' },
      ],
    }
    act(() => applyAllDrafts(table))
    expect(batches[0]).toEqual({
      cells: [
        expect.objectContaining({ rowId: '1', columnId: 'age', value: 50 }),
        expect.objectContaining({ rowId: '2', columnId: 'age', value: 60 }),
      ],
      inserts: [
        { rowId: id, values: { name: 'Zed', age: 99 }, index: 3, after: '2' },
      ],
      deletes: [{ rowId: '7' }],
    })
    // Отказ строки — отказ на объекте, черновик остаётся; принятое снято.
    expect(drafts().map(d => [d.kind, d.target])).toEqual([
      ['cellValue', { cell: ['2', 'age'] }],
      ['rowInsert', { row: id }],
    ])
    expect(Object.values(readFailures(table)).map(f => f.target)).toEqual(
      expect.arrayContaining([{ row: id }]),
    )
    // Повтор — сервер принял строку и вернул её под id, который выдала таблица (ADR 0181).
    answer = { saved: [{ rowId: id, row: { id, name: 'Zed', age: 99 } }] }
    act(() => table.getDrafts().length && applyAllDrafts(table))
    await act(() => new Promise(resolve => setTimeout(resolve)))
    expect(kinds()).not.toContain('rowInsert')
    act(() => root?.unmount())

    // Серверная модель: сохранённая строка — в кэш на место новой.
    const calls: {
      start: number
      end: number
      resolve: (r: unknown) => void
    }[] = []
    answer = {}
    mount(
      [
        serverRowModel({
          blockSize: 10,
          maxBlocks: 5,
          getRows: ({ start, end }: { start: number; end: number }) =>
            new Promise(resolve =>
              calls.push({
                start,
                end,
                resolve: resolve as (r: unknown) => void,
              }),
            ),
        }),
        manual(batch => {
          batches.push(batch)
          return {
            saved: (batch.inserts ?? []).map(item => ({
              rowId: item.rowId,
              row: { id: item.rowId, name: 'Zed', age: 99 },
            })),
          }
        }),
      ],
      { data: [], rowCount: 30 },
    )
    act(() => source().observe!({ first: 0, last: 9, fast: false }))
    await act(async () => {
      for (const call of calls)
        call.resolve({ rows: ROWS.slice(call.start, call.end), rowCount: 30 })
    })
    const serverId = add({ name: 'Zed', age: 99 }, 2)!
    expect(ids().slice(0, 4)).toEqual(['0', '1', serverId, '2'])
    act(() => table.removeRow('4'))
    act(() => applyAllDrafts(table))
    await act(() => new Promise(resolve => setTimeout(resolve, 150)))
    expect(ids().slice(0, 5)).toEqual(['0', '1', serverId, '2', '3'])
    expect(source().byId('4')).toBeUndefined()
    expect(drafts()).toEqual([])
  })

  it('DR33: строки до сохранения работают в плоском клиентском списке и в серверной модели без группировки; в дереве, группировке и ленте addRow и removeRow инертны с причиной в предупреждении', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const inert = (plugins: unknown[], options = {}) => {
      mount([manual(), ...plugins], options)
      warn.mockClear()
      expect(add({ name: 'Zed' }, 1)).toBeUndefined()
      act(() => table.removeRow('3'))
      expect(drafts()).toEqual([])
      const text = warn.mock.calls.flat().join(' ')
      act(() => root?.unmount())
      return text
    }
    expect(inert([rowExpandingModel()])).toMatch(/addRow is inert \(treeRows\)/)
    expect(inert([rowGrouping({ initialGrouping: ['name'] })])).toMatch(
      /removeRow is inert \(grouping\)/,
    )
    expect(inert([infiniteScroll({ hasMore: true } as never)])).toMatch(
      /addRow is inert \(infiniteScroll\)/,
    )
    // Плоский список — работает.
    mount([manual(), columnSortingModel()])
    expect(add({ name: 'Zed' }, 1)).toBeTruthy()
    act(() => table.removeRow('3'))
    expect(kinds()).toEqual(['rowInsert', 'rowDelete'])
  })

  it('DR41: копирование диапазона берёт значения новой строки из её черновика, в клиентском режиме и в серверной модели; строки ниже новой — свои, без сдвига на неё, в том числе незагруженные', async () => {
    mount([manual(), cellSelectionModel()])
    const id = add({ name: 'Zed', age: 99 }, 2)!
    const range = {
      anchorRowId: '1',
      focusRowId: '2',
      anchorColumnId: 'name',
      focusColumnId: 'age',
    }
    act(() => table.selectCellRange(range))
    expect(table.getSelectedCellRangesData()).toEqual([
      [
        ['Name 1', 21],
        ['Zed', 99],
        ['Name 2', 22],
      ],
    ])
    // Правка новой строки — в копии её новое значение.
    edit(id, '50')
    expect(table.getSelectedCellRangesData()[0][1]).toEqual(['Zed', 50])
    act(() => root?.unmount())

    // Серверная модель: строки для копии грузятся мимо окна — индексы под слоем свои.
    const calls: {
      start: number
      end: number
      resolve: (rows: unknown) => void
    }[] = []
    mount(
      [
        serverRowModel({
          blockSize: 10,
          maxBlocks: 5,
          getRows: ({ start, end }: { start: number; end: number }) =>
            new Promise(resolve =>
              calls.push({
                start,
                end,
                resolve: resolve as (rows: unknown) => void,
              }),
            ),
        }),
        manual(),
        cellSelectionModel(),
      ],
      { data: [], rowCount: 30 },
    )
    act(() => source().observe!({ first: 0, last: 9, fast: false }))
    await act(async () => {
      for (const call of calls.splice(0))
        call.resolve({ rows: ROWS.slice(call.start, call.end), rowCount: 30 })
    })
    const serverId = add({ name: 'Zed', age: 99 }, 2)!
    const loading = source().loadRange!(1, 12, new AbortController().signal)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
      for (const call of calls.splice(0))
        call.resolve({ rows: ROWS.slice(call.start, call.end), rowCount: 30 })
    })
    const rows = (await loading) as ({ id: string } | undefined)[]
    expect(rows.map(row => row?.id)).toEqual([
      '1',
      serverId,
      ...Array.from({ length: 10 }, (_, i) => String(i + 2)),
    ])
  })

  it('DR51: в серверной модели диапазон подсветки и вспышки на индексах следует за новой строкой: выше сдвигается, внутри растёт, откат и сохранение оставляют те же углы', async () => {
    await mountServer()
    const target = {
      range: {
        anchorRowIndex: 3,
        focusRowIndex: 5,
        anchorColumnId: 'name',
        focusColumnId: 'age',
      },
    }
    const spans = (slice: Record<string, unknown>) =>
      Object.keys(slice)
        .map(key => rangeOfKey(key)?.range.rows)
        .filter(Boolean)
    const span = (from: number, to: number) => [{ indexes: [from, to] }]
    const corners = () => {
      const [rows] = spans(readHighlights(table)) as [
        { indexes: [number, number] },
      ]
      return rows.indexes.map(index => source().at(index)?.id)
    }
    act(() => {
      table.highlight(target)
      table.flashOutcome(target, 'reverted')
    })
    expect(spans(readHighlights(table))).toEqual(span(3, 5))

    const above = add({ name: 'Zed', age: 99 }, 1)!
    expect(spans(readHighlights(table))).toEqual(span(4, 6))
    expect(spans(readFlashes(table))).toEqual(span(4, 6))
    expect(corners()).toEqual(['3', '5'])

    const inside = add({ name: 'Yan', age: 98 }, 5)!
    expect(spans(readHighlights(table))).toEqual(span(4, 7))
    expect(corners()).toEqual(['3', '5'])

    act(() => table.removeRow(inside))
    act(() => table.removeRow(above))
    expect(spans(readHighlights(table))).toEqual(span(3, 5))
    expect(corners()).toEqual(['3', '5'])

    add({ name: 'Wen', age: 96 }, 4)
    expect(corners()).toEqual(['3', '5'])
    await saveDrafts()
    expect(corners()).toEqual(['3', '5'])
  })

  it('DR53: транзакция remove серверной модели снимает черновики ячеек и строк удалённых id с onDraftsChange — и загруженных, и незагруженных; id, добавленный той же пачкой, и чужие строки черновики сохраняют; сохранённое удаление не оставляет черновиков своих ячеек', async () => {
    const onDraftsChange = vi.fn()
    await mountServer({ onDraftsChange })
    const settle = () =>
      act(() => new Promise(resolve => setTimeout(resolve, 150)))
    const cell = (rowId: string) => ({
      kind: 'cellValue',
      target: { cell: [rowId, 'age'] },
      value: { value: 1, text: '1' },
    })
    edit('1', '50')
    edit('2', '51')
    edit('3', '52')
    act(() => table.removeRow('2'))
    act(() => table.setDraft(cell('25')))
    expect(kinds().sort()).toEqual([
      'cellValue',
      'cellValue',
      'cellValue',
      'cellValue',
      'rowDelete',
    ])

    onDraftsChange.mockClear()
    await act(async () => {
      table.applyRowTransaction({ remove: ['2', '25'] })
      table.applyRowTransaction({
        remove: ['3'],
        add: [ROWS[3]],
        index: 2,
      })
    })
    await settle()
    expect(drafts().map(draft => draft.target)).toEqual([
      { cell: ['1', 'age'] },
      { cell: ['3', 'age'] },
    ])
    expect(onDraftsChange).toHaveBeenLastCalledWith(drafts())

    // Удаление через пульт: черновик ячейки той же строки в пакет не уходит (DR28).
    edit('4', '53')
    act(() => table.removeRow('4'))
    await saveDrafts()
  })

  it('TG21: диапазон на индексах следует за сменой списка в эффекте того же коммита, что и новый объект таблицы', async () => {
    await mountServer()
    const target = {
      range: {
        anchorRowIndex: 3,
        focusRowIndex: 5,
        anchorColumnId: 'name',
        focusColumnId: 'age',
      },
    }
    const span = () =>
      Object.keys(readHighlights(table))
        .map(key => rangeOfKey(key)?.range.rows)
        .filter(Boolean)
    act(() => table.highlight(target))
    expect(span()).toEqual([{ indexes: [3, 5] }])

    // Подсветка строки — новый объект таблицы, а эффект дочернего компонента сдвигает список.
    const before = table
    act(() => {
      inChildEffect = () => table.addRow({ name: 'Zed', age: 99 }, { index: 1 })
      table.highlight({ row: '20' })
    })
    expect(table).not.toBe(before)
    expect(source().at(1)?.id).not.toBe('1')
    expect(span()).toEqual([{ indexes: [4, 6] }])
  })

  it('DR54: новая и удалённая строка в пакете без ответа не уходят повторно, с какого объекта таблицы ни пришло «Применить всё»', async () => {
    const answers: (() => void)[] = []
    const onCommitEdits = vi.fn(
      () => new Promise<void>(resolve => answers.push(resolve)),
    )
    mount([manual(onCommitEdits)])
    add({ name: 'Zed', age: 99 }, 1)
    act(() => table.removeRow('5'))
    act(() => applyAllDrafts(table))
    expect(onCommitEdits).toHaveBeenCalledTimes(1)

    // Кнопка пульта живёт в новом рендере: у неё другой объект таблицы.
    const before = table
    act(() => table.highlight({ row: '20' }))
    expect(table).not.toBe(before)
    act(() => applyAllDrafts(table))
    expect(onCommitEdits).toHaveBeenCalledTimes(1)

    await act(async () => answers.forEach(resolve => resolve()))
  })

  it('DR52: в серверной модели активная ячейка держит свою строку при новой строке выше, её откате и сохранении', async () => {
    await mountServer({ enableKeyboardNavigation: true })
    const activeRow = () =>
      table.store.get()[pluginStateKey(KEYBOARD_NAVIGATION)].rowIndex
    act(() =>
      setPluginState(table, KEYBOARD_NAVIGATION, {
        rowIndex: 5,
        columnIndex: 0,
      }),
    )
    const added = add({ name: 'Zed', age: 99 }, 1)!
    expect(activeRow()).toBe(6)
    expect(source().at(activeRow())?.id).toBe('5')

    act(() => table.removeRow(added))
    expect(activeRow()).toBe(5)

    add({ name: 'Wen', age: 96 }, 1)
    await saveDrafts()
    expect(source().at(activeRow())?.id).toBe('5')
  })

  it('DR50: в серверной модели диапазон выделения следует за новой строкой, как на клиенте: вставка выше сдвигает, внутри расширяет до тех же углов, откат возвращает; угол без id — тоже', async () => {
    mount(
      [
        serverRowModel({
          blockSize: 10,
          maxBlocks: 5,
          getRows: ({ start, end }: { start: number; end: number }) =>
            Promise.resolve({ rows: ROWS.slice(start, end), rowCount: 30 }),
        }),
        manual(batch => ({
          saved: (batch.inserts ?? []).map(item => ({
            rowId: item.rowId,
            row: { id: item.rowId, name: 'Saved', age: 1 },
          })),
        })),
        cellSelectionModel(),
      ],
      { data: [], rowCount: 30 },
    )
    await act(async () => {
      source().observe!({ first: 0, last: 9, fast: false })
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const COLUMNS = { anchorColumnId: 'name', focusColumnId: 'age' }
    const span = () => {
      const [range] = table.getCellSelectionRanges()
      return [range.minRowIndex, range.maxRowIndex]
    }
    const rowsOfRange = () =>
      [span()[0]!, span()[1]!].map(index => source().at(index)?.id)

    act(() =>
      table.selectCellRange({ anchorRowId: '3', focusRowId: '5', ...COLUMNS }),
    )
    expect(span()).toEqual([3, 5])

    // Выше диапазона: те же строки на новых местах.
    const above = add({ name: 'Zed', age: 99 }, 1)!
    expect(span()).toEqual([4, 6])
    expect(rowsOfRange()).toEqual(['3', '5'])

    // Внутри диапазона: те же углы, новая строка — в нём.
    const inside = add({ name: 'Yan', age: 98 }, 5)!
    expect(span()).toEqual([4, 7])
    expect(rowsOfRange()).toEqual(['3', '5'])
    expect(source().at(5)?.id).toBe(inside)

    // Откат новых строк возвращает диапазон на место.
    act(() => table.removeRow(inside))
    act(() => table.removeRow(above))
    expect(span()).toEqual([3, 5])
    expect(rowsOfRange()).toEqual(['3', '5'])

    // Угол в незагруженной части — без id: его ведёт сдвиг списка.
    act(() =>
      table.selectCellRange({
        anchorRowIndex: 3,
        focusRowIndex: 25,
        ...COLUMNS,
      }),
    )
    expect(span()).toEqual([3, 25])
    const unloaded = add({ name: 'Xan', age: 97 }, 0)!
    expect(span()).toEqual([4, 26])
    act(() => table.removeRow(unloaded))

    // Сохранение новой строки внутри диапазона: строка переходит в кэш, углы те же.
    act(() =>
      table.selectCellRange({ anchorRowId: '3', focusRowId: '5', ...COLUMNS }),
    )
    add({ name: 'Wen', age: 96 }, 4)
    expect(rowsOfRange()).toEqual(['3', '5'])
    act(() => applyAllDrafts(table))
    for (let i = 0; i < 50 && drafts().length > 0; i++) {
      await act(() => new Promise(resolve => setTimeout(resolve, 20)))
    }
    expect(drafts()).toEqual([])
    expect(table.getCellSelectionRanges()).toHaveLength(1)
    expect(rowsOfRange()).toEqual(['3', '5'])
  })
})

describe('Источник строк без новых строк (ADR 0178, §7)', () => {
  it('DR55: без новых строк запрос источника строк не читает снимок всего состояния таблицы — ни при автосохранении, ни при сохранении по кнопке', () => {
    for (const plugin of [cellEditing(), manual()]) {
      mount([plugin])
      const base = source()
      const read = vi.spyOn(table.store, 'get')
      for (let i = 0; i < 50; i++) expect(source()).toBe(base)
      expect(read).not.toHaveBeenCalled()
      read.mockRestore()
      act(() => root?.unmount())
      root = undefined
    }
  })
})

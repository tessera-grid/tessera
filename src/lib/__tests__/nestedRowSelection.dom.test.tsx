// @vitest-environment happy-dom
/**
 * Выбор вложенных строк (ADR 0162; NS1, NS3, NS5–NS7, NS9–NS10): каскад и «только строка» в
 * клиентском режиме и в дереве серверной модели, узлы веток в срезе, «Выбрать всё», счётчик,
 * смена выборки и выгрузка, транзакции и перенос строк.
 * Запуск: npx vitest run --config vitest.node.config.ts nestedRowSelection
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ENGLISH_LABELS } from '../core/localization'
import type { RowSource } from '../core/rowSource'
import {
  isWholeSelection,
  rowSelectionValueOf,
  setAllRowsSelected,
  setRowSelectionValue,
  toggleBranchRowIn,
  type RowSelectionValue,
} from '../core/rowSelectionAll'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnFilteringModel,
  columnSortingModel,
  dataExport,
  type ExportRequest,
  quickSearchModel,
  rowExpanding,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import {
  rowCheckboxOf,
  toggleRowSelection,
} from '../plugins/rowSelection/keyboardActions'
import { SelectedRowsCount } from '../plugins/rowSelection/SelectedRowsCount'
import { isSelectableInList } from '../plugins/rowSelectionModel/selectionHelpers'
import { captureInertWarnings } from './inertWarnings'
import { rowSelectionModelLabels } from '../plugins/rowSelectionModel/labels'
import { rowSelectionLabels } from '../plugins/rowSelection/labels'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  subRows?: Item[]
}

interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
}

type SubRows = boolean | 'self' | undefined

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const BLOCK = 10
const NO_DATA: Item[] = []
/** Транзакции применяются задачей после кадра; запасной таймер — 100 мс. */
const AFTER_FRAME_MS = 150

let root: Root
let table: any
let calls: Call[]
let changes: RowSelectionValue[]

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>(resolve => {
    calls.push({ request, resolve })
  })

/** Дерево серверной модели: корни `r<номер>`, дети — `<родитель>.<номер>`. */
const ServerTree = ({
  subRows,
  total = 1000,
  expandable = (row: Item) => !row.id.includes('.'),
  extra = [],
  counter = false,
}: {
  subRows?: SubRows
  total?: number
  expandable?: (row: Item) => boolean
  extra?: readonly unknown[]
  counter?: boolean
}) => {
  table = useCreateTable({
    rowCount: total,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    dataMode: { export: 'server' },
    plugins: [
      serverRowModel({ getRows, blockSize: BLOCK }),
      rowExpanding({ hasChildren: row => expandable(row.original) }),
      rowSelection({
        subRows,
        onRowSelectionChange: next => changes.push(next),
      }),
      ...extra,
    ] as never,
  })
  return counter ? (
    <SelectedRowsCount
      {...({ table } as Parameters<typeof SelectedRowsCount>[0])}
    />
  ) : null
}

const source = () =>
  table.getRowSource() as RowSource<{
    id: string
    getIsSelected: () => boolean
  }>

const rowOf = (id: string) => source().byId(id) as any

const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

/** Ответить строками диапазона; `count` — итог ветки или списка, если он известен. */
const answer = async (call = calls.at(-1)!, count?: number) => {
  const { start, end, parentId } = call.request
  const last = count === undefined ? end : Math.min(end, count)
  const prefix = parentId ? `${parentId}.` : 'r'
  await act(async () => {
    call.resolve({
      rows: Array.from({ length: Math.max(0, last - start) }, (_, i) => ({
        id: `${prefix}${start + i}`,
        name: `N${start + i}`,
      })),
      ...(count === undefined ? {} : { rowCount: count }),
    })
  })
}

/** Раскрыть ветки и прочесть число строк, как тело на перерисовке. */
const expand = async (expanded: Record<string, boolean>) => {
  act(() => table.setExpanded(expanded))
  source().count()
  await act(async () => {})
}

const branchCall = (parentId: string) =>
  calls.filter(call => call.request.parentId === parentId).at(-1)!

/** Корни пришли, ветки `parents` раскрыты, их строки пришли (по `size` в каждой). */
const mountTree = async (
  props: Parameters<typeof ServerTree>[0],
  parents: string[] = ['r1'],
  size = 3,
) => {
  act(() => root.render(<ServerTree {...props} />))
  show(0, 9)
  await answer(calls.at(-1)!, props.total)
  await expand(Object.fromEntries(parents.map(id => [id, true])))
  show(0, 9 + parents.length * size)
  for (const parent of parents) await answer(branchCall(parent), size)
}

const toggle = (id: string) =>
  act(() => toggleRowSelection(rowOf(id), {}, undefined))

const selected = (id: string) => rowOf(id).getIsSelected() as boolean

/** Клиентское дерево `p → c → g` и корень `q`. */
const CLIENT_DATA: Item[] = [
  {
    id: 'p',
    name: 'P',
    subRows: [{ id: 'c', name: 'C', subRows: [{ id: 'g', name: 'G' }] }],
  },
  { id: 'q', name: 'Q' },
]

const ClientTree = ({ subRows }: { subRows?: SubRows }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: CLIENT_DATA,
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    plugins: [rowExpanding(), rowSelection({ subRows })] as never,
  } as never)
  return null
}

const clientRow = (id: string) => table.getCoreRowModel().rowsById[id]

beforeEach(() => {
  calls = []
  changes = []
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('выбор вложенных строк (ADR 0162)', () => {
  captureInertWarnings()

  it("NS1: subRows: 'self' — флажки у вложенных строк без каскада, в клиентском режиме и в SSRM; true — каскад; без subRows — флажки только у корней", async () => {
    for (const subRows of [undefined, true, 'self'] as const) {
      const name = String(subRows)
      act(() => root.render(<ClientTree subRows={subRows} />))
      expect(isSelectableInList(clientRow('p')), name).toBe(true)
      expect(isSelectableInList(clientRow('c')), name).toBe(!!subRows)
      act(() => clientRow('p').toggleSelected(true))
      expect(clientRow('c').getIsSelected(), name).toBe(subRows === true)
      act(() => root.unmount())
      root = createRoot(document.createElement('div'))

      calls = []
      await mountTree({ subRows })
      expect(isSelectableInList(rowOf('r1')), name).toBe(true)
      expect(isSelectableInList(rowOf('r1.0')), name).toBe(!!subRows)
      toggle('r1')
      expect(selected('r1'), name).toBe(true)
      expect(selected('r1.0'), name).toBe(subRows === true)
      act(() => root.unmount())
      root = createRoot(document.createElement('div'))
    }
  })

  it('NS3: срез — узлы веток { id, all, except, branches? } только при отличии от родителя; узел, совпавший с родителем без исключений, удаляется; без subRows срез прежний', async () => {
    const r1 = toggleBranchRowIn({}, [], 'r1', true, true)
    expect(r1).toEqual({
      all: false,
      except: ['r1'],
      branches: [{ id: 'r1', all: true, except: [] }],
    })
    // Снятая строка выбранной ветки — исключение её узла; узел внутри — ветка этой строки.
    const nested = toggleBranchRowIn(r1, ['r1'], 'r1.0', false, true)
    expect(nested).toEqual({
      all: false,
      except: ['r1'],
      branches: [
        {
          id: 'r1',
          all: true,
          except: ['r1.0'],
          branches: [{ id: 'r1.0', all: false, except: [] }],
        },
      ],
    })
    // Вернули — узел совпал с родителем и ушёл; сняли ветку — пустой выбор прежней формы.
    expect(toggleBranchRowIn(nested, ['r1'], 'r1.0', true, true)).toEqual(r1)
    expect(toggleBranchRowIn(r1, [], 'r1', false, true)).toEqual({})

    // На таблице — то же в onRowSelectionChange.
    await mountTree({ subRows: true })
    toggle('r1')
    expect(changes.at(-1)).toEqual(r1)
    // r1.0 — лист: снятие — исключение узла r1, своей ветки у листа нет.
    toggle('r1.0')
    expect(changes.at(-1)).toEqual(
      toggleBranchRowIn(r1, ['r1'], 'r1.0', false, false),
    )
    expect(changes.at(-1)).toEqual({
      all: false,
      except: ['r1'],
      branches: [{ id: 'r1', all: true, except: ['r1.0'] }],
    })

    // Без subRows и с 'self' — выбранные id, как прежде.
    for (const subRows of [undefined, 'self'] as const) {
      act(() => root.unmount())
      root = createRoot(document.createElement('div'))
      calls = []
      changes = []
      await mountTree({ subRows })
      toggle('r1')
      expect(changes.at(-1), String(subRows)).toEqual({ r1: true })
    }
  })

  it('NS5: «Выбрать всё» ставит all: true и сбрасывает узлы веток; снятие — пустой выбор', async () => {
    await mountTree({ subRows: true })
    toggle('r1')
    toggle('r1.0')
    const branches = rowSelectionValueOf(table)
    expect(branches).toMatchObject({ all: false, branches: [{ id: 'r1' }] })
    // Узлы веток — выбор не полный: флажок шапки ставит всё, а не снимает.
    expect(isWholeSelection(branches as never)).toBe(false)
    expect(
      isWholeSelection({
        all: true,
        except: [],
        branches: [{ id: 'r1', all: false, except: [] }],
      }),
    ).toBe(false)

    act(() => setAllRowsSelected(table, true))
    expect(changes.at(-1)).toEqual({ all: true, except: [] })
    expect(isWholeSelection(rowSelectionValueOf(table) as never)).toBe(true)
    expect(selected('r1.0')).toBe(true)
    act(() => setAllRowsSelected(table, false))
    expect(changes.at(-1)).toEqual({})
    expect(selected('r1')).toBe(false)
  })

  it('NS6: счётчик — при известных размерах веток точный, иначе приблизительный, до короткого блока', async () => {
    const host = document.createElement('div')
    act(() => root.unmount())
    root = createRoot(host)
    // Три корня, раскрыть можно только r1.
    act(() =>
      root.render(
        <ServerTree
          subRows
          counter
          total={3}
          expandable={row => row.id === 'r1'}
        />,
      ),
    )
    show(0, 9)
    await answer(calls.at(-1)!, 3)
    toggle('r1')
    const approximate = rowSelectionModelLabels(
      ENGLISH_LABELS,
    ).selectedRowsAndGroups(
      1,
      rowSelectionModelLabels(ENGLISH_LABELS).selectedBranchesCount(1),
    )
    // Ветка не загружена — её размер неизвестен.
    expect(host.textContent).toBe(approximate)

    // Полный блок ветки без итога — размер всё ещё неизвестен.
    await expand({ r1: true })
    show(0, 30)
    await answer(branchCall('r1'))
    expect(host.textContent).toBe(approximate)

    // Короткий блок — итог ветки известен: строка r1 и 15 её детей.
    show(0, 30)
    const second = branchCall('r1')
    expect(second.request.start).toBe(BLOCK)
    await act(async () => {
      second.resolve({
        rows: Array.from({ length: 5 }, (_, i) => ({
          id: `r1.${BLOCK + i}`,
          name: `N${BLOCK + i}`,
        })),
      })
    })
    expect(host.textContent).toBe(
      rowSelectionLabels(ENGLISH_LABELS).selectedRows(16),
    )
    // Снятая строка ветки — точный счёт на одну меньше.
    toggle('r1.3')
    expect(host.textContent).toBe(
      rowSelectionLabels(ENGLISH_LABELS).selectedRows(15),
    )
  })

  it('NS7: сортировка, фильтр и поиск выбор не сбрасывают; серверная выгрузка получает срез с узлами веток', async () => {
    const exports: ExportRequest[] = []
    await mountTree({
      subRows: true,
      extra: [
        columnSortingModel(),
        columnFilteringModel(),
        quickSearchModel(),
        dataExport({
          onExport: request => {
            exports.push(request)
          },
        }),
      ],
    })
    toggle('r1')
    toggle('r1.1')
    const value = rowSelectionValueOf(table)
    for (const change of [
      () => table.setSorting([{ id: 'name', desc: true }]),
      () =>
        table.setColumnFilters([
          { id: 'name', value: { operator: 'contains', value: 'N' } },
        ]),
      () => table.setGlobalFilter('N'),
    ]) {
      act(change)
      act(() => source().sync!())
      show(0, 9)
      const roots = calls.filter(call => !call.request.parentId).at(-1)!
      await answer(roots)
      // Раскрытие переживает смену выборки (SD42): ветка приходит заново.
      show(0, 12)
      await answer(branchCall('r1'), 3)
      expect(rowSelectionValueOf(table)).toEqual(value)
      expect(selected('r1.0')).toBe(true)
      expect(selected('r1.1')).toBe(false)
    }
    await act(() => table.exportData({ rows: 'selected' }))
    expect(exports.at(-1)!.selection).toEqual(value)
  })

  it("NS9: клиентский режим, subRows: 'self' — выбор строки не выбирает её подстроки; флажок родителя без третьего состояния", () => {
    act(() => root.render(<ClientTree subRows="self" />))
    act(() => clientRow('p').toggleSelected(true))
    expect(clientRow('c').getIsSelected()).toBe(false)
    expect(clientRow('g').getIsSelected()).toBe(false)
    act(() => clientRow('p').toggleSelected(false))
    act(() => clientRow('g').toggleSelected(true))
    expect(clientRow('p').getIsSelected()).toBe(false)
    expect(rowCheckboxOf(clientRow('p'))).toEqual({
      selected: false,
      indeterminate: false,
    })
    // С каскадом тот же выбор ребёнка даёт родителю третье состояние.
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    act(() => root.render(<ClientTree subRows />))
    act(() => clientRow('g').toggleSelected(true))
    expect(rowCheckboxOf(clientRow('p')).indeterminate).toBe(true)
  })

  it('NS10: транзакции и перенос строк — выбор следует за id; удалённые строки выпадают из узлов веток', async () => {
    await mountTree({ subRows: true }, ['r1', 'r2'])
    toggle('r1')
    toggle('r1.1')
    // Перенос выбранной строки ветки в невыбранную ветку: она и её ветка выбраны по-прежнему.
    act(() => {
      expect(source().moveRow!('r1.0', { parentId: 'r2', index: 0 })).toBe(true)
    })
    expect(rowSelectionValueOf(table)).toEqual({
      all: false,
      except: ['r1'],
      branches: [
        { id: 'r1', all: true, except: ['r1.1'] },
        {
          id: 'r2',
          all: false,
          except: ['r1.0'],
          branches: [{ id: 'r1.0', all: true, except: [] }],
        },
      ],
    })
    expect(selected('r1.0')).toBe(true)
    expect(selected('r2.0')).toBe(false)
    expect(selected('r1.2')).toBe(true)

    // Удалили строку-исключение и строку-родителя узла — узлы и исключения ушли.
    act(() => table.applyRowTransaction({ parentId: 'r1', remove: ['r1.1'] }))
    act(() => table.applyRowTransaction({ parentId: 'r2', remove: ['r1.0'] }))
    await act(() => new Promise(resolve => setTimeout(resolve, AFTER_FRAME_MS)))
    expect(rowSelectionValueOf(table)).toEqual({
      all: false,
      except: ['r1'],
      branches: [{ id: 'r1', all: true, except: [] }],
    })
    act(() => setRowSelectionValue(table, {}))
  })
})

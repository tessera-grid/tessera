// @vitest-environment happy-dom
/**
 * Плагины модели и интерфейса (ADR 0120, этап 1; MP4, MP5, MP8, MP9, MP16–MP19): модель —
 * своя запись, явная модель главнее включённой, срез — аргументами плагина.
 * Запуск: npx vitest run --project unit pluginModels
 */
import { act, createElement, useState } from 'react'
import type { ExpandedState } from '@tanstack/react-table'
import { createRoot, type Root } from 'react-dom/client'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'

import { foldEntries, type TesseraFeatureEntry } from '../core/features'
import { __resetLogger } from '../util/logger'
import {
  expandIncludedModels,
  modelArgsMismatchMessage,
} from '../core/pluginModels'
import {
  type UseCreateTableParams,
  useCreateTable,
} from '../core/useCreateTable'
import { resolveAxes } from '../plugins/dataExportModel/settings'
import {
  cellSelection,
  cellSelectionModel,
  columnFiltering,
  columnFilteringModel,
  columnSorting,
  columnSortingModel,
  dataExport,
  dataExportModel,
  pagination,
  paginationModel,
  quickSearch,
  quickSearchModel,
  rowExpanding,
  rowExpandingModel,
  rowGrouping,
  rowGroupingModel,
  rowSelection,
  rowSelectionModel,
} from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Node {
  id: string
  name: string
  subRows?: Node[]
}

const node = (id: string, subRows?: Node[]): Node => ({
  id,
  name: id,
  ...(subRows ? { subRows } : {}),
})
const DATA: Node[] = [
  node('a', [node('a1', [node('a1x')]), node('a2')]),
  node('b'),
  node('c', [node('c1')]),
]
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const ALL = ['a', 'a1', 'a1x', 'a2', 'b', 'c', 'c1']
const ROOTS = ['a', 'b', 'c']
/** Раскрыто всё до `maxDepth: 1` `rowExpanding` по умолчанию. */
const DEPTH_1 = ['a', 'a1', 'a2', 'b', 'c', 'c1']

/** Пары «модель — интерфейс», опции, которые выставляет модель, и её срез. */
const PAIRS = [
  {
    model: rowExpandingModel,
    ui: rowExpanding,
    flags: ['enableExpanding', 'autoResetExpanded'],
    state: { expanded: true },
  },
  {
    model: columnSortingModel,
    ui: columnSorting,
    flags: ['enableSorting'],
    state: { sorting: [{ id: 'name', desc: true }] },
  },
  {
    model: paginationModel,
    ui: pagination,
    flags: ['pagedRows', 'paginateExpandedRows', 'autoResetPageIndex'],
    state: { pagination: { pageIndex: 1, pageSize: 1 } },
  },
  {
    model: columnFilteringModel,
    ui: columnFiltering,
    flags: ['enableColumnFilters', 'filterFromLeafRows'],
    state: { columnFilters: [{ id: 'name', value: 'b' }] },
  },
  {
    model: quickSearchModel,
    ui: quickSearch,
    flags: ['enableGlobalFilter', 'filterFromLeafRows'],
    state: { globalFilter: 'c' },
  },
  {
    model: rowGroupingModel,
    ui: rowGrouping,
    flags: ['enableGrouping', 'groupedColumnMode'],
    state: { grouping: ['name'] },
  },
  {
    model: rowSelectionModel,
    ui: rowSelection,
    flags: [
      'enableRowSelection',
      'enableSubRowSelection',
      'enableRowRangeSelection',
    ],
    state: { rowSelection: { b: true } },
  },
  {
    model: cellSelectionModel,
    ui: cellSelection,
    flags: ['enableCellSelection'],
    state: {},
  },
  {
    model: dataExportModel,
    ui: dataExport,
    flags: ['exportOptions'],
    state: {},
  },
] as const

let root: Root | undefined
let table: any
beforeEach(() => __resetLogger())
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.restoreAllMocks()
})

const Grid = ({
  plugins,
}: {
  plugins: () => readonly TesseraFeatureEntry[]
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Node) => row.id,
    plugins: plugins() as never,
  })
  return null
}

const render = (plugins: () => readonly TesseraFeatureEntry[]) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Grid, { plugins })))
}

const rows = () =>
  (table.getRowModel().rows as { id: string }[]).map(row => row.id)

describe('плагины модели и интерфейса (ADR 0120)', () => {
  it('MP4: опции модели выставляет только модель — перестановка записей не меняет опции таблицы и строки', () => {
    for (const { model, ui, flags, state } of PAIRS) {
      for (const interfaceOn of [true, false]) {
        expect(
          Object.keys(ui({ enabled: interfaceOn }).options ?? {}),
        ).not.toEqual(expect.arrayContaining([...flags]))
        for (const modelOn of [true, false]) {
          const a = model({ enabled: modelOn, ...state } as never)
          const b = ui({ enabled: interfaceOn, ...state } as never)
          const forward = foldEntries([a, b]).options
          const backward = foldEntries([b, a]).options
          for (const flag of flags) {
            expect(backward[flag]).toEqual(forward[flag])
          }
          render(() => [a, b])
          const forwardRows = rows()
          act(() => root!.unmount())
          root = undefined
          render(() => [b, a])
          expect(rows()).toEqual(forwardRows)
          act(() => root!.unmount())
          root = undefined
        }
      }
    }
  })

  it('MP2: плагин интерфейса без явной модели ведёт себя, как с ней: те же опции таблицы и строки, а контролы — у интерфейса', () => {
    /** Значения опций без функций: функции у разных записей — разные ссылки. */
    const plainOptions = (entries: TesseraFeatureEntry[]) =>
      Object.fromEntries(
        Object.entries(foldEntries(entries).options).map(([key, value]) => [
          key,
          typeof value === 'function' ? 'fn' : value,
        ]),
      )
    for (const { model, ui, state } of PAIRS) {
      const alone = ui(state as never)
      expect(plainOptions([alone])).toEqual(
        plainOptions([model(state as never), ui(state as never)]),
      )

      render(() => [ui(state as never)])
      const aloneRows = rows()
      act(() => root!.unmount())
      root = undefined
      render(() => [model(state as never), ui(state as never)])
      expect(rows()).toEqual(aloneRows)
      act(() => root!.unmount())
      root = undefined

      const controls = [
        alone.slots,
        alone.slotActions,
        alone.keyboardActions,
        alone.contextMenuActions,
        alone.column && [alone.column],
      ].flatMap((list): unknown[] => list ?? [])
      expect(controls.length, alone.id).toBeGreaterThan(0)
      expect(model().slots ?? [], alone.id).toEqual([])
      expect(model().slotActions ?? [], alone.id).toEqual([])
      expect(model().column, alone.id).toBeUndefined()
    }
  })

  it('MP5: включённая явная модель главнее включённой интерфейсом — действуют её аргументы, расхождение — предупреждение; выключенная явная уступает модели интерфейса; сужения складываются от всех записей', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(() => [rowExpanding({ initialExpanded: true })])
    expect(rows()).toEqual(DEPTH_1)
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('аргументы модели'),
    )
    act(() => root!.unmount())
    root = undefined

    render(() => [
      rowExpandingModel({ initialExpanded: {} }),
      rowExpanding({ initialExpanded: true }),
    ])
    expect(rows()).toEqual(ROOTS)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'аргументы модели у rowExpanding не действуют: в наборе есть явная rowExpandingModel',
      ),
    )
    act(() => root!.unmount())
    root = undefined

    warn.mockClear()
    render(() => [
      rowExpandingModel({ enabled: false, initialExpanded: {} }),
      rowExpanding({ initialExpanded: true }),
    ])
    expect(rows()).toEqual(DEPTH_1)
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('аргументы модели'),
    )
    act(() => root!.unmount())
    root = undefined

    const folded = foldEntries([
      rowExpandingModel(),
      rowExpanding({ maxDepth: 1 }),
    ])
    expect(folded.narrow.expanded).toHaveLength(2)
    render(() => [
      rowExpandingModel({ expanded: true }),
      rowExpanding({ maxDepth: 1 }),
    ])
    expect(rows()).toEqual(DEPTH_1)
    expect(rows()).not.toEqual(ALL)
  })

  it('MP6: тип state и handlers useCreateTable — только срезы колонок и их колбэки', () => {
    type Params = UseCreateTableParams<{ id: string }, []>
    expectTypeOf<keyof NonNullable<Params['state']>>().toEqualTypeOf<
      'columnVisibility' | 'columnOrder' | 'columnPinning' | 'columnSizing'
    >()
    expectTypeOf<keyof NonNullable<Params['handlers']>>().toEqualTypeOf<
      | 'onColumnVisibilityChange'
      | 'onColumnOrderChange'
      | 'onColumnPinningChange'
      | 'onColumnSizingChange'
    >()
    // @ts-expect-error — срез плагина в state ядра не компилируется
    const state: Params['state'] = { sorting: [] }
    // @ts-expect-error — его колбэк в handlers ядра тоже
    const handlers: Params['handlers'] = { onSortingChange: () => {} }
    expect([state, handlers]).toHaveLength(2)
  })

  it('MP7: срез плагина или его колбэк в state/handlers ядра в обход типов не применяется; в dev — одно предупреждение на срез с плагином и аргументом', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onSortingChange = vi.fn()
    const Host = () => {
      table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: (row: Node) => row.id,
        plugins: [columnSortingModel()],
        state: { sorting: [{ id: 'name', desc: true }] } as never,
        handlers: { onSortingChange, onRowOrderChange: () => {} } as never,
      })
      return null
    }
    root = createRoot(document.createElement('div'))
    act(() => root!.render(createElement(Host)))
    act(() => root!.render(createElement(Host)))
    expect(rows()).toEqual(ROOTS)
    act(() => table.setSorting([{ id: 'name', desc: true }]))
    expect(onSortingChange).not.toHaveBeenCalled()

    const messages = warn.mock.calls.map(([message]) => String(message))
    const about = (text: string) =>
      messages.filter(message => message.includes(text))
    expect(about('state.sorting не применяется')).toHaveLength(1)
    expect(about('state.sorting')[0]).toContain(
      'columnSortingModel или columnSorting',
    )
    expect(about('handlers.onSortingChange не применяется')).toHaveLength(1)
    expect(about('handlers.onRowOrderChange')[0]).toContain(
      'rowDragging({ onRowOrderChange })',
    )
  })

  it('MP17: смены контролируемого среза подряд до перерисовки складываются — колбэк получает значение от предыдущей смены; после перерисовки — снова от значения приложения', () => {
    const onExpandedChange = vi.fn()
    const expanded: Record<string, boolean> = { a: true }
    const plugins = () => [rowExpandingModel({ expanded, onExpandedChange })]
    render(plugins)

    act(() => {
      table.getRow('a').toggleExpanded(false)
      table.getRow('c').toggleExpanded(true)
    })
    // Свёрнутая строка уходит из среза: `a` свернули, `c` раскрыли — в одном такте.
    expect(onExpandedChange).toHaveBeenLastCalledWith({ c: true })

    // Приложение смену не приняло: значение то же — следующая смена от него.
    render(plugins)
    act(() => table.getRow('c').toggleExpanded(true))
    expect(onExpandedChange).toHaveBeenLastCalledWith({ a: true, c: true })
  })

  it('MP8: срез — аргументами модели и интерфейса: внешнее значение применяется до кадра, изменения изнутри уходят в колбэк новым значением; useState приложения передаётся в аргументы', () => {
    for (const factory of [rowExpandingModel, rowExpanding]) {
      const onExpandedChange = vi.fn()
      let expanded: Record<string, boolean> = { a: true }
      const plugins = () => [factory({ expanded, onExpandedChange })]
      render(plugins)
      expect(rows()).toEqual(['a', 'a1', 'a2', 'b', 'c'])

      act(() => table.getRow('c').toggleExpanded())
      expect(onExpandedChange).toHaveBeenLastCalledWith({ a: true, c: true })
      expect(rows()).toEqual(['a', 'a1', 'a2', 'b', 'c'])

      expanded = onExpandedChange.mock.lastCall![0]
      render(plugins)
      expect(rows()).toEqual(['a', 'a1', 'a2', 'b', 'c', 'c1'])
      act(() => root!.unmount())
      root = undefined
    }

    const WithAppState = () => {
      const [expanded, onExpandedChange] = useState<ExpandedState>({})
      table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: (row: Node) => row.id,
        plugins: [rowExpandingModel({ expanded, onExpandedChange })],
      })
      return null
    }
    root = createRoot(document.createElement('div'))
    act(() => root!.render(createElement(WithAppState)))
    expect(rows()).toEqual(ROOTS)
    act(() => table.getRow('c').toggleExpanded())
    expect(rows()).toEqual(['a', 'b', 'c', 'c1'])
  })

  it('MP9: без внешнего значения срез живёт внутри грида с начальным значением initial<Срез>, без него — пустым; сброс в undefined — тоже значение; монтирование срез не меняет и его колбэк не зовёт', () => {
    const onExpandedChange = vi.fn()
    render(() => [
      rowExpandingModel({ initialExpanded: { a: true }, onExpandedChange }),
    ])
    expect(rows()).toEqual(['a', 'a1', 'a2', 'b', 'c'])
    act(() => table.getRow('c').toggleExpanded())
    expect(rows()).toEqual(['a', 'a1', 'a2', 'b', 'c', 'c1'])
    expect(onExpandedChange).toHaveBeenLastCalledWith({ a: true, c: true })
    act(() => root!.unmount())
    root = undefined

    render(() => [rowExpandingModel()])
    expect(rows()).toEqual(ROOTS)
    act(() => table.getRow('a').toggleExpanded())
    expect(rows()).toEqual(['a', 'a1', 'a2', 'b', 'c'])
    act(() => root!.unmount())
    root = undefined

    // Выбор строк — у модели и у интерфейса: монтирование начальный выбор не сбрасывает и
    // колбэк среза не зовёт, ни у начального, ни у внешнего значения.
    for (const plugin of [rowSelectionModel, rowSelection]) {
      const onRowSelectionChange = vi.fn()
      render(() => [
        plugin({ initialRowSelection: { b: true }, onRowSelectionChange }),
      ])
      expect(table.getRow('b').getIsSelected()).toBe(true)
      expect(onRowSelectionChange).not.toHaveBeenCalled()
      act(() => table.getRow('c').toggleSelected(true))
      expect(onRowSelectionChange).toHaveBeenLastCalledWith({
        b: true,
        c: true,
      })
      act(() => root!.unmount())
      root = undefined

      const onControlledChange = vi.fn()
      render(() => [
        plugin({
          rowSelection: { b: true },
          onRowSelectionChange: onControlledChange,
        }),
      ])
      expect(table.getRow('b').getIsSelected()).toBe(true)
      expect(onControlledChange).not.toHaveBeenCalled()
      act(() => root!.unmount())
      root = undefined
    }

    // Сброс среза в `undefined` (значение «нет поиска») — тоже значение среза.
    const onGlobalFilterChange = vi.fn()
    render(() => [
      quickSearchModel({ initialGlobalFilter: 'b', onGlobalFilterChange }),
    ])
    expect(rows()).toEqual(['b'])
    // Очистка поля поиска пишет `undefined`; сброс возвращает к начальному значению.
    act(() => table.setGlobalFilter(undefined))
    expect(rows()).toEqual(ROOTS)
    expect(onGlobalFilterChange).toHaveBeenLastCalledWith(undefined)
    act(() => table.resetGlobalFilter())
    expect(rows()).toEqual(['b'])
    act(() => root!.unmount())
    root = undefined

    // Сброс среза (`resetCellSelection`) возвращает к начальному значению.
    const range = [
      {
        anchorRowId: 'a',
        anchorColumnId: 'name',
        focusRowId: 'b',
        focusColumnId: 'name',
      },
    ]
    render(() => [cellSelectionModel({ initialCellSelection: range })])
    expect(table.atoms.cellSelection.get()).toEqual(range)
    act(() => table.resetCellSelection())
    expect(table.atoms.cellSelection.get()).toEqual(range)
  })

  it('MP10: expanded — аргумент только модели дерева; rowGroupingModel включает модель дерева, и группы раскрываются по её срезу', () => {
    const data = [
      { id: '1', name: 'x', kind: 'a' },
      { id: '2', name: 'y', kind: 'a' },
      { id: '3', name: 'z', kind: 'b' },
    ]
    const columns = [
      { id: 'name', accessorKey: 'name' },
      { id: 'kind', accessorKey: 'kind' },
    ]
    const Host = ({ plugins }: { plugins: () => TesseraFeatureEntry[] }) => {
      table = useCreateTable({
        columns: columns as never,
        data,
        getRowId: row => row.id,
        plugins: plugins() as never,
      })
      return null
    }
    const show = (plugins: () => TesseraFeatureEntry[]) => {
      root ??= createRoot(document.createElement('div'))
      act(() => root!.render(createElement(Host, { plugins })))
    }
    const unmount = () => {
      act(() => root!.unmount())
      root = undefined
    }

    // @ts-expect-error — у группировки нет среза `expanded`
    rowGroupingModel({ expanded: true })
    // @ts-expect-error — у интерфейса группировки тоже
    rowGrouping({ expanded: true })
    for (const entry of [
      rowGroupingModel({ expanded: true } as never),
      rowGrouping({ expanded: true } as never),
    ]) {
      const slices = [entry, entry.model, entry.model?.model].flatMap(
        model => model?.stateSlices ?? [],
      )
      expect(slices.find(slice => slice.key === 'expanded')?.value).toBe(
        undefined,
      )
    }

    show(() => [rowGroupingModel({ initialGrouping: ['kind'] })])
    expect(rows()).toEqual(['kind:a', 'kind:b'])
    act(() => table.getRow('kind:a').toggleExpanded())
    expect(rows()).toEqual(['kind:a', '1', '2', 'kind:b'])
    expect(
      (table.getPluginDiagnostics() as { id: string }[]).map(d => d.id),
    ).toEqual(['rowGroupingModel'])
    unmount()

    show(() => [
      rowExpandingModel({ expanded: true }),
      rowGroupingModel({ initialGrouping: ['kind'] }),
    ])
    expect(rows()).toEqual(['kind:a', '1', '2', 'kind:b', '3'])
  })

  it('MP12: оси выгрузки по сортировке, фильтрам, странице и выбору открываются по активной модели, без плагина интерфейса', () => {
    const axes = () => {
      const { rows, viewBy } = resolveAxes(table)!
      return { rows: rows.map(choice => choice.value), viewBy }
    }
    render(() => [dataExportModel()])
    expect(axes()).toEqual({ rows: ['all'], viewBy: [] })
    act(() => root!.unmount())
    root = undefined

    render(() => [
      dataExportModel(),
      columnSortingModel(),
      columnFilteringModel(),
      quickSearchModel(),
      paginationModel(),
      rowSelectionModel(),
    ])
    expect(axes()).toEqual({
      rows: ['all', 'view', 'page', 'selected'],
      viewBy: ['sorting', 'filtering'],
    })
  })

  it('MP16: getPluginDiagnostics показывает явную модель отдельной записью, а включённую интерфейсом — нет', () => {
    const ids = () =>
      (table.getPluginDiagnostics() as { id: string }[]).map(d => d.id)
    render(() => [rowExpanding()])
    expect(ids()).toEqual(['rowExpanding'])
    act(() => root!.unmount())
    root = undefined

    render(() => [rowExpandingModel(), rowExpanding()])
    expect(ids()).toEqual(['rowExpandingModel', 'rowExpanding'])
  })

  it('MP18: модель несут несколько интерфейсов — действуют аргументы модели того, кто их задал, при любом порядке; разные аргументы у двух — аргументы первого и предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const plugins of [
      () => [rowGrouping(), rowExpanding({ initialExpanded: true })],
      () => [rowExpanding({ initialExpanded: true }), rowGrouping()],
      () => [
        rowExpandingModel({ enabled: false }),
        rowGrouping(),
        rowExpanding({ initialExpanded: true }),
      ],
    ]) {
      render(plugins)
      expect(rows()).toEqual(DEPTH_1)
      act(() => root!.unmount())
      root = undefined
    }
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('аргументы модели'),
    )

    const model = (args: Record<string, unknown>): TesseraFeatureEntry => ({
      id: 'treeModel',
      args,
    })
    const { entries, mismatches } = expandIncludedModels([
      { id: 'first', model: model({ depth: 1 }) },
      { id: 'second', model: model({ depth: 2 }) },
    ])
    expect(entries.map(entry => [entry.id, entry.args])).toEqual([
      ['treeModel', { depth: 1 }],
      ['first', undefined],
      ['second', undefined],
    ])
    expect(mismatches.map(modelArgsMismatchMessage)).toEqual([
      'аргументы модели у second не действуют: treeModel уже включил first со своими аргументами; задайте их у одного интерфейса или явной treeModel',
    ])
  })
})

describe('Срез модели в аргументах интерфейса (ADR 0120)', () => {
  it('MP19: значение среза модели, заданное аргументом интерфейса, не входит в ключ аргументов интерфейса — его смена не пересобирает набор плагинов', () => {
    const pairs: [
      string,
      () => { argsKey?: string },
      () => { argsKey?: string },
    ][] = [
      [
        'rowSelection',
        () => rowSelection({ rowSelection: {} }),
        () => rowSelection({ rowSelection: { a: true } }),
      ],
      [
        'columnSorting',
        () => columnSorting({ sorting: [] }),
        () => columnSorting({ sorting: [{ id: 'a', desc: true }] }),
      ],
      [
        'cellSelection',
        () => cellSelection({ cellSelection: [] }),
        () =>
          cellSelection({
            cellSelection: [
              {
                anchorColumnId: 'a',
                focusColumnId: 'a',
                anchorRowIndex: 0,
                focusRowIndex: 0,
              },
            ] as never,
          }),
      ],
      [
        'pagination',
        () => pagination({ pagination: { pageIndex: 0, pageSize: 10 } }),
        () => pagination({ pagination: { pageIndex: 3, pageSize: 10 } }),
      ],
      [
        'columnFiltering',
        () => columnFiltering({ columnFilters: [] }),
        () => columnFiltering({ columnFilters: [{ id: 'a', value: 'x' }] }),
      ],
      [
        'rowExpanding',
        () => rowExpanding({ expanded: {} }),
        () => rowExpanding({ expanded: { a: true } }),
      ],
      [
        'rowGrouping',
        () => rowGrouping({ grouping: [] }),
        () => rowGrouping({ grouping: ['a'] }),
      ],
    ]
    for (const [name, before, after] of pairs) {
      expect(after().argsKey, name).toBe(before().argsKey)
    }
    // Настройка в ключе остаётся: другая настройка — другой ключ.
    expect(rowSelection({ subRows: true }).argsKey).not.toBe(
      rowSelection({ subRows: false }).argsKey,
    )
  })
})

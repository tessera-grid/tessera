// @vitest-environment happy-dom
/**
 * Плагины модели и интерфейса (ADR 0120, этап 1; MP4, MP5, MP8, MP9, MP16): модель —
 * своя запись, явная модель главнее включённой, срез — аргументами плагина.
 * Запуск: npx vitest run --project unit pluginModels
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { foldEntries, type TesseraFeatureEntry } from '../core/features'
import { useExpandedState } from '../core/createState'
import { __resetLogger } from '../core/logger'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnFiltering,
  columnFilteringModel,
  columnSorting,
  columnSortingModel,
  pagination,
  paginationModel,
  quickSearch,
  quickSearchModel,
  rowExpanding,
  rowExpandingModel,
  rowGrouping,
  rowGroupingModel,
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
    flags: ['enableSorting', 'manualSorting'],
    state: { sorting: [{ id: 'name', desc: true }] },
  },
  {
    model: paginationModel,
    ui: pagination,
    flags: ['manualPagination', 'paginateExpandedRows', 'autoResetPageIndex'],
    state: { pagination: { pageIndex: 1, pageSize: 1 } },
  },
  {
    model: columnFilteringModel,
    ui: columnFiltering,
    flags: ['enableColumnFilters', 'columnFilteringServer'],
    state: { columnFilters: [{ id: 'name', value: 'b' }] },
  },
  {
    model: quickSearchModel,
    ui: quickSearch,
    flags: ['enableGlobalFilter', 'quickSearchServer'],
    state: { globalFilter: 'c' },
  },
  {
    model: rowGroupingModel,
    ui: rowGrouping,
    flags: ['enableGrouping', 'groupedColumnMode'],
    state: { grouping: ['name'] },
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
  state,
}: {
  plugins: () => readonly TesseraFeatureEntry[]
  state?: Record<string, unknown>
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Node) => row.id,
    plugins: plugins() as never,
    ...(state ? { state: state as never } : {}),
  })
  return null
}

const render = (
  plugins: () => readonly TesseraFeatureEntry[],
  state?: Record<string, unknown>,
) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Grid, { plugins, state })))
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
          const a = model({ enabled: modelOn })
          const b = ui({ enabled: interfaceOn })
          const forward = foldEntries([a, b]).options
          const backward = foldEntries([b, a]).options
          for (const flag of flags) {
            expect(backward[flag]).toEqual(forward[flag])
          }
          render(() => [a, b], state)
          const forwardRows = rows()
          act(() => root!.unmount())
          root = undefined
          render(() => [b, a], state)
          expect(rows()).toEqual(forwardRows)
          act(() => root!.unmount())
          root = undefined
        }
      }
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
    render(() => [rowExpandingModel(), rowExpanding({ maxDepth: 1 })], {
      expanded: true,
    })
    expect(rows()).toEqual(DEPTH_1)
    expect(rows()).not.toEqual(ALL)
  })

  it('MP8: срез — аргументами модели и интерфейса: внешнее значение применяется до кадра, изменения изнутри уходят в колбэк новым значением; useExpandedState разворачивается в аргументы', () => {
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

    const WithHelper = () => {
      const state = useExpandedState()
      table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: (row: Node) => row.id,
        plugins: [rowExpandingModel({ ...state })],
      })
      return null
    }
    root = createRoot(document.createElement('div'))
    act(() => root!.render(createElement(WithHelper)))
    expect(rows()).toEqual(ROOTS)
    act(() => table.getRow('c').toggleExpanded())
    expect(rows()).toEqual(['a', 'b', 'c', 'c1'])
  })

  it('MP9: без внешнего значения срез живёт внутри грида с начальным значением initial<Срез>, без него — пустым; сброс в undefined — тоже значение', () => {
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

    // Сброс среза в `undefined` (значение «нет поиска») — тоже значение среза.
    render(() => [quickSearchModel({ initialGlobalFilter: 'b' })])
    expect(rows()).toEqual(['b'])
    act(() => table.resetGlobalFilter())
    expect(rows()).toEqual(ROOTS)
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
})

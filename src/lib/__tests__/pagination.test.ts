/**
 * Headless-проверки плагина pagination (ADR 0038): нарезка страницы, контролируемый
 * срез, инертность серверного режима без итога, страницы по верхнему уровню, сброс
 * страницы при смене порядка строк. PG7 (живой `rowCount`) — `pagination.dom.test.tsx`.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import {
  buildTesseraFeatures,
  foldEntries,
  type TesseraFeatureEntry,
} from '../core/features'
import { columnSorting } from '../plugins/columnSorting'
import { pagination, type PaginationOptions } from '../plugins/pagination'
import { rowExpanding } from '../plugins/rowExpanding'
import { rowGrouping } from '../plugins/rowGrouping'
import { columnFilteringModel } from '../plugins/columnFilteringModel'
import { quickSearchModel } from '../plugins/quickSearchModel'
import { rowGroupingModel } from '../plugins/rowGroupingModel'

interface Item {
  id: string
  name: string
  group: string
  subRows?: Item[]
}

const items = (count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: `Name ${String(index).padStart(4, '0')}`,
    group: index % 2 ? 'odd' : 'even',
  }))

const build = (
  data: Item[],
  paginationOptions: PaginationOptions = {},
  extra: TesseraFeatureEntry[] = [],
  tableOptions: Record<string, unknown> = {},
) => {
  const entries: TesseraFeatureEntry[] = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    pagination(paginationOptions),
    ...extra,
  ]
  const folded = foldEntries(entries)
  const table = constructTable({
    features: buildTesseraFeatures(entries as never),
    data,
    columns: [
      { id: 'name', accessorKey: 'name' },
      { id: 'group', accessorKey: 'group' },
    ],
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows ?? [],
    ...folded.options,
    pluginDiagnostics: folded.pluginDiagnostics,
    ...tableOptions,
  } as never) as any
  return { table, folded }
}

const rowIds = (table: any) =>
  table.getRowModel().rows.map((row: { id: string }) => row.id)

describe('pagination — модель', () => {
  it('PG1: клиентский режим — в модели строк pageSize строк текущей страницы из полного data', () => {
    const { table } = build(items(60), { initialPageSize: 25 })
    expect(rowIds(table)).toHaveLength(25)
    expect(rowIds(table)[0]).toBe('0')

    table.setPageIndex(2)
    expect(rowIds(table)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(50 + i)),
    )
    expect(table.getPageCount()).toBe(3)
    expect(table.getRowCount()).toBe(60)
  })

  it('PG5: срез pagination контролируется state.pagination + onPaginationChange', () => {
    const onPaginationChange = vi.fn()
    const { table } = build(items(60), { initialPageSize: 25 }, [], {
      state: { pagination: { pageIndex: 1, pageSize: 25 } },
      onPaginationChange,
    })
    expect(rowIds(table)[0]).toBe('25')

    table.nextPage()
    expect(onPaginationChange).toHaveBeenCalledTimes(1)
    // Контролируемый срез не меняется сам — страницу двигает владелец state.
    expect(table.atoms.pagination.get()).toEqual({ pageIndex: 1, pageSize: 25 })
  })

  it("PG8: серверный режим без rowCount — diagnose → 'noRowCount'", () => {
    const { table } = build(items(25), {}, [], {
      dataMode: { pagination: 'server' },
      manualPagination: true,
    })
    expect(
      table
        .getPluginDiagnostics()
        .find((d: { id: string }) => d.id === 'pagination'),
    ).toEqual({ id: 'pagination', status: 'inert', reason: 'noRowCount' })

    const counted = build(items(25), { rowCount: 0 }, [], {
      dataMode: { pagination: 'server' },
      manualPagination: true,
    }).table
    expect(
      counted
        .getPluginDiagnostics()
        .find((d: { id: string }) => d.id === 'pagination').status,
    ).toBe('active')
  })

  it('PG9: страницы по верхнему уровню — дети раскрытой строки остаются на странице родителя', () => {
    const tree: Item[] = Array.from({ length: 5 }, (_, p) => ({
      id: `p${p}`,
      name: `Parent ${p}`,
      group: 'g',
      subRows: [0, 1].map(c => ({
        id: `p${p}c${c}`,
        name: `Child ${p}.${c}`,
        group: 'g',
      })),
    }))
    const { table } = build(tree, { initialPageSize: 2 }, [rowExpanding()])
    table.setExpanded(true)

    expect(rowIds(table)).toEqual(['p0', 'p0c0', 'p0c1', 'p1', 'p1c0', 'p1c1'])
    expect(table.getPageCount()).toBe(3)

    table.setPageIndex(2)
    expect(rowIds(table)).toEqual(['p4', 'p4c0', 'p4c1'])
  })

  it('PG10: смена сортировки или группировки возвращает на первую страницу', () => {
    const { table, folded } = build(items(100), { initialPageSize: 10 }, [
      columnSorting(),
      rowGrouping(),
    ])
    const cleanups = folded.setups.map(setup => setup(table))

    table.setPageIndex(3)
    table.setSorting([{ id: 'name', desc: true }])
    expect(table.atoms.pagination.get().pageIndex).toBe(0)

    table.setPageIndex(3)
    table.setGrouping(['group'])
    expect(table.atoms.pagination.get().pageIndex).toBe(0)

    // Смена data (правка, перестановка) страницу не сбрасывает.
    table.setPageIndex(1)
    table.setOptions((prev: object) => ({ ...prev, data: items(100) }))
    table.getRowModel()
    expect(table.atoms.pagination.get().pageIndex).toBe(1)

    // Выключенная модель не подменяет пустой срез новой ссылкой: иначе подписка сброса
    // увидела бы смену порядка, которой не было (ADR 0120).
    const empty: unknown[] = []
    const context = { options: {}, slotActions: {} }
    const narrows = [
      [columnFilteringModel({ enabled: false }), 'columnFilters', empty],
      [quickSearchModel({ enabled: false }), 'globalFilter', undefined],
      [rowGroupingModel({ enabled: false }), 'grouping', empty],
    ] as const
    for (const [entry, key, value] of narrows) {
      expect(entry.narrow![key]!(value, null, context), key).toBe(value)
    }

    cleanups.forEach(cleanup => cleanup?.())
  })
})

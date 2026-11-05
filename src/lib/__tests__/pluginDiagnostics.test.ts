/**
 * Headless-проверка снимка активности плагинов `table.getPluginDiagnostics()`
 * (ADR 0022, PC12–PC14; ADR 0052, ND11).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnDragging } from '../plugins/columnDragging'
import { columnSorting } from '../plugins/columnSorting'
import { rowDragging } from '../plugins/rowDragging'
import { rowGrouping } from '../plugins/rowGrouping'
import { rowSelection } from '../plugins/rowSelection'

const FLAT_COLUMNS = [
  { id: 'cat', accessorKey: 'cat' },
  { id: 'name', accessorKey: 'name' },
]
const NESTED_COLUMNS = [{ id: 'group', header: 'Group', columns: FLAT_COLUMNS }]

const build = (plugins: any[], columns: any[] = FLAT_COLUMNS) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...plugins,
  ]
  const folded = foldEntries(entries)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data: [
      { id: '1', cat: 'a', name: 'X' },
      { id: '2', cat: 'b', name: 'Y' },
    ],
    columns: injectServiceColumns(columns, folded.serviceColumns),
    getRowId: (row: any) => row.id,
    ...folded.options,
    pluginDiagnostics: folded.pluginDiagnostics,
  } as never) as any
}

const statusOf = (table: any, id: string) =>
  table.getPluginDiagnostics().find((d: { id: string }) => d.id === id)

describe('getPluginDiagnostics — снимок активности плагинов', () => {
  it('PC12: снимок перечисляет каждый подключённый плагин; работающий — active, enabled:false — inert с причиной disabled', () => {
    const table = build([rowSelection(), columnSorting({ enabled: false })])
    expect(table.getPluginDiagnostics()).toEqual([
      { id: 'reactivity', status: 'active' },
      { id: 'rowSelection', status: 'active' },
      { id: 'columnSorting', status: 'inert', reason: 'disabled' },
    ])
  })

  it('PC13: встроенные плагины сообщают причину инертности из своих гейтов (grouping / sorting)', () => {
    const grouped = build([rowGrouping(), rowSelection(), rowDragging()])
    grouped.setGrouping(['cat'])
    expect(statusOf(grouped, 'rowSelection').status).toBe('active')
    expect(statusOf(grouped, 'rowDragging').reason).toBe('grouping')
    expect(statusOf(grouped, 'rowGrouping').status).toBe('active')

    const sorted = build([columnSorting(), rowDragging()])
    sorted.setSorting([{ id: 'name', desc: false }])
    expect(statusOf(sorted, 'rowDragging').reason).toBe('sorting')
    expect(sorted.getRowModel().rows[0].getCanDrag()).toBe(false)
  })

  it('ND11: под вложенной шапкой columnDragging и rowDragging не инертны — причины multiLevelHeader нет', () => {
    const nested = build([rowDragging(), columnDragging()], NESTED_COLUMNS)
    expect(statusOf(nested, 'rowDragging')).toEqual({
      id: 'rowDragging',
      status: 'active',
    })
    expect(statusOf(nested, 'columnDragging')).toEqual({
      id: 'columnDragging',
      status: 'active',
    })
  })

  it('PC14: снимок считается на момент вызова — смена состояния сразу меняет статус, без рендера', () => {
    const table = build([columnSorting(), rowDragging()])
    expect(statusOf(table, 'rowDragging').status).toBe('active')

    table.setSorting([{ id: 'name', desc: false }])
    expect(statusOf(table, 'rowDragging').status).toBe('inert')

    table.setSorting([])
    expect(statusOf(table, 'rowDragging').status).toBe('active')
  })
})

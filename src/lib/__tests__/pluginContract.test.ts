/**
 * Контракт встроенного плагина: диагностика (ADR 0036, PQ1, PQ3).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import {
  cellSelection,
  columnSorting,
  contextMenu,
  headerActionMenu,
  rowActionMenu,
  rowActions,
} from '../plugins'
import { builtinPluginEntries } from './builtinPlugins'

const build = (plugins: any[]) => {
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
    data: [{ id: '1', name: 'X' }],
    columns: injectServiceColumns(
      [{ id: 'name', accessorKey: 'name' }],
      folded.serviceColumns,
    ),
    getRowId: (row: any) => row.id,
    ...folded.options,
    slotActions: folded.slotActions,
    contextMenuActions: folded.contextMenuActions,
    actionMenu: folded.actionMenu,
    pluginDiagnostics: folded.pluginDiagnostics,
  } as never) as any
}

const reasonOf = (table: any, id: string) =>
  table.getPluginDiagnostics().find((d: { id: string }) => d.id === id)?.reason

const rowActionEntry = {
  id: 'rowActionFixture',
  slotActions: [
    {
      id: 'open',
      slot: 'actionRowSlot',
      icon: () => null,
      label: () => 'Open',
      onSelect: () => {},
    },
  ],
}

describe('контракт встроенного плагина', () => {
  it('PQ1: каждый встроенный плагин объявляет diagnose', () => {
    const entries = builtinPluginEntries()
    expect(entries.length).toBeGreaterThanOrEqual(16)

    const missing = entries
      .filter(entry => typeof entry.diagnose !== 'function')
      .map(entry => entry.id)
    expect(missing).toEqual([])
  })

  it("PQ3: поверхности без содержимого инертны с причиной 'noActions'", () => {
    const empty = build([
      headerActionMenu(),
      rowActions(),
      rowActionMenu(),
      contextMenu(),
    ])
    expect(reasonOf(empty, 'headerActionMenu')).toBe('noActions')
    expect(reasonOf(empty, 'rowActions')).toBe('noActions')
    expect(reasonOf(empty, 'rowActionMenu')).toBe('noActions')
    expect(reasonOf(empty, 'contextMenu')).toBe('noActions')

    const filled = build([
      columnSorting(),
      headerActionMenu(),
      rowActions(),
      rowActionMenu(),
      rowActionEntry,
      cellSelection(),
      contextMenu(),
    ])
    expect(reasonOf(filled, 'headerActionMenu')).toBeUndefined()
    expect(reasonOf(filled, 'rowActions')).toBeUndefined()
    expect(reasonOf(filled, 'rowActionMenu')).toBeUndefined()
    expect(reasonOf(filled, 'contextMenu')).toBeUndefined()
  })
})

import axe from 'axe-core'
import { describe, expect, test } from 'vitest'

import { builtinPluginEntries } from '../../../__tests__/builtinPlugins'
import { filteringColumns, filteringData } from '../../__mocks__/filteringData'
import type { FeatureToggles } from '../../__mocks__/utils/argsToPlugins'
import { renderGrid } from '../helpers'
import { AXE_OPTIONS } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// PQ4: каждый встроенный плагин проходит axe (ADR 0036). Ключи карты сверяются с
// экспортами `@mstrvtt/tessera/plugins`: новый плагин без записи здесь роняет тест.
// Значение — тумблеры историй с минимальным окружением, без которого у плагина нет UI.

type GridArgs = FeatureToggles & {
  enableToolbar?: boolean
  headerNesting?: 'flat' | 'nested'
  columnsOverride?: typeof filteringColumns
  dataOverride?: typeof filteringData
}

const PLUGIN_ARGS: Record<string, GridArgs> = {
  rowSelection: { enableRowSelection: true },
  rowExpanding: { enableRowExpanding: true, enableGrouping: true },
  rowDragging: { enableRowDragging: true },
  rowGrouping: { enableGrouping: true },
  rowActions: { enableRowActions: true },
  cellEditing: { enableCellEditing: true },
  cellSelection: { enableCellSelection: true },
  contextMenu: { enableContextMenu: true, enableCellSelection: true },
  keyboardNavigation: { enableKeyboardNavigation: true },
  columnSorting: { enableColumnSorting: true },
  columnPinning: { enableColumnPinning: true },
  columnSizing: { enableColumnResizing: true },
  columnDragging: { enableColumnDragging: true },
  columnVisibility: { enableColumnVisibility: true, enableToolbar: true },
  headerActionMenu: {
    enableHeaderActionMenu: true,
    enableColumnSorting: true,
    enableColumnPinning: true,
  },
  rowActionMenu: { enableRowActionMenu: true, enableRowActions: true },
  pagination: { enablePagination: true },
  quickSearch: { enableQuickSearch: true, enableToolbar: true },
  columnFiltering: {
    enableToolbar: true,
    enableColumnFiltering: true,
    columnsOverride: filteringColumns,
    dataOverride: filteringData,
  },
  dataExport: { enableExport: true, enableToolbar: true },
}

// Контекст axe — вся обёртка грида, включая тулбар над таблицей.
const gridWrapper = () => {
  const el = document.querySelector<HTMLElement>('.data-grid-theme')
  if (!el) throw new Error('.data-grid-theme not found')
  return el
}

describe('Контракт плагина: доступность (ADR 0036)', () => {
  test('PQ4: набор проверяемых плагинов совпадает со встроенными', () => {
    const builtin = builtinPluginEntries().map(entry => entry.id)
    expect(Object.keys(PLUGIN_ARGS).sort()).toEqual([...builtin].sort())
  })

  test.each(Object.entries(PLUGIN_ARGS))(
    'PQ4: плагин %s проходит axe без нарушений',
    async (_id, args) => {
      const grid = await renderGrid({ columnCount: 6, dataCount: 10, ...args })
      await waitForGrid()

      const { violations } = await axe.run(gridWrapper(), AXE_OPTIONS)
      expect(violations).toEqual([])
      await grid.unmount()
    },
  )
})

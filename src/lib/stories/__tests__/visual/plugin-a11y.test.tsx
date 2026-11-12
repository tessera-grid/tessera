import axe from 'axe-core'
import { describe, expect, test } from 'vitest'

import { builtinPluginEntries } from '../../../__tests__/builtinPlugins'
import { getData } from '../../__mocks__/data'
import { filteringColumns, filteringData } from '../../__mocks__/filteringData'
import type { FeatureToggles } from '../../__mocks__/utils/argsToPlugins'
import { renderGrid } from '../helpers'
import { AXE_OPTIONS } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// PQ4: каждый встроенный плагин проходит axe (ADR 0036). Ключи карты сверяются с
// экспортами `@tessera-grid/tessera/plugins`: новый плагин без записи здесь роняет тест.
// Значение — тумблеры историй с минимальным окружением, без которого у плагина нет UI.

type GridArgs = FeatureToggles & {
  rowCount?: number
  enableToolbar?: boolean
  headerNesting?: 'flat' | 'nested'
  dataNesting?: 'flat' | 'nested'
  expandAll?: boolean
  columnsOverride?: typeof filteringColumns
  dataOverride?: typeof filteringData
}

const PLUGIN_ARGS: Record<string, GridArgs> = {
  rowSelection: { enableRowSelection: true },
  rowExpanding: { enableRowExpanding: true, enableRowGrouping: true },
  rowExpandingModel: {
    enableRowExpandingModel: true,
    dataNesting: 'nested',
    expandAll: true,
  },
  treeLines: {
    enableTreeLines: true,
    enableRowExpandingModel: true,
    dataNesting: 'nested',
    expandAll: true,
  },
  textWrap: { enableTextWrap: true },
  columnSortingModel: { enableColumnSortingModel: true },
  paginationModel: { enablePaginationModel: true },
  columnFilteringModel: { enableColumnFilteringModel: true },
  quickSearchModel: { enableQuickSearchModel: true },
  rowGroupingModel: { enableRowGroupingModel: true },
  rowSelectionModel: { enableRowSelectionModel: true },
  cellSelectionModel: { enableCellSelectionModel: true },
  dataExportModel: { enableDataExportModel: true },
  rowDragging: { enableRowDragging: true },
  rowGrouping: { enableRowGrouping: true },
  rowActions: { enableRowActions: true },
  cellEditing: { enableCellEditing: true },
  cellErrors: { enableCellErrors: true },
  cellSelection: { enableCellSelection: true },
  contextMenu: { enableContextMenu: true, enableCellSelection: true },
  columnSorting: { enableColumnSorting: true },
  columnPinning: { enableColumnPinning: true },
  columnSizing: { enableColumnSizing: true },
  columnDragging: { enableColumnDragging: true },
  columnVisibility: { enableColumnVisibility: true, enableToolbar: true },
  headerActionMenu: {
    enableHeaderActionMenu: true,
    enableColumnSorting: true,
    enableColumnPinning: true,
  },
  rowActionMenu: { enableRowActionMenu: true, enableRowActions: true },
  pagination: { enablePagination: true },
  backToTop: { enableBackToTop: true, enablePagination: true },
  columnTotals: { enableColumnTotals: true },
  // Кнопка журнала видна только с отказами: сам журнал проверяет JR6 (ADR 0177).
  failureLog: { enableFailureLog: true, enableToolbar: true },
  unsavedChanges: { enableUnsavedChanges: true, enableToolbar: true },
  infiniteScroll: {
    enableInfiniteScroll: true,
    infiniteScrollHasMore: true,
    rowCount: 1000,
    infiniteScrollLoadedCount: true,
  },
  serverRowModel: {
    enableServerRowModel: true,
    serverRowModelBlockSize: 20,
    // Мок-сервер: строки окна из тех же данных, что у историй; остальное — скелеты.
    serverRowModelGetRows: ({ start, end }) => ({
      rows: getData(end).slice(start, end),
      rowCount: 50,
    }),
  },
  quickSearch: { enableQuickSearch: true, enableToolbar: true },
  columnFiltering: {
    enableToolbar: true,
    enableColumnFiltering: true,
    columnsOverride: filteringColumns,
    dataOverride: filteringData,
  },
  dataExport: { enableDataExport: true, enableToolbar: true },
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

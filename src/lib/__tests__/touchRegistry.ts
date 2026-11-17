/**
 * Реестр касаний (ADR 0231, §1, TV1): каждый встроенный плагин — ID требований, которые
 * проверяют его касанием, или причина, почему касание ему не нужно.
 */
export type TouchRow = readonly string[] | { reason: string }

const MODEL = { reason: 'модель без интерфейса: жесты — у плагина интерфейса' }
const VIEW = { reason: 'только вид, без жестов' }

export const TOUCH_REGISTRY: Record<string, TouchRow> = {
  rowSelection: ['TV17'],
  rowSelectionModel: MODEL,
  rowExpanding: ['TV18'],
  rowExpandingModel: MODEL,
  treeLines: VIEW,
  textWrap: VIEW,
  rowDragging: ['TU9', 'TU10', 'NX7', 'TV20'],
  rowGrouping: ['TV19'],
  rowGroupingModel: MODEL,
  rowActions: ['TV21'],
  cellEditing: ['TU2', 'ED13', 'TV9', 'TV10'],
  cellErrors: ['OB10'],
  valueChangeFlash: VIEW,
  cellSelection: ['HN5', 'HN6', 'HN7', 'TV22'],
  cellSelectionModel: MODEL,
  contextMenu: ['TU6', 'TU7', 'TU8', 'TV7'],
  columnSorting: ['TV8', 'TV11'],
  columnSortingModel: MODEL,
  columnPinning: ['TV14'],
  columnSizing: ['TU3', 'TU4', 'RL8', 'RL18'],
  columnDragging: ['TU9', 'TU10', 'CO8', 'TV27'],
  columnVisibility: ['TV15'],
  headerActionMenu: ['TV14', 'TV16'],
  rowActionMenu: ['TV21'],
  pagination: ['TV23'],
  paginationModel: MODEL,
  infiniteScroll: {
    reason: 'лента догружается прокруткой: палец прокручивает нативно (XS9)',
  },
  backToTop: ['TV24'],
  columnTotals: VIEW,
  columnAggregation: ['TV16'],
  failureLog: ['TV25'],
  unsavedChanges: ['TV25'],
  editHistory: ['UD30'],
  serverRowModel: { reason: 'источник строк без своих жестов' },
  columnFiltering: ['TV12'],
  columnFilteringModel: MODEL,
  quickSearch: ['TV13'],
  quickSearchModel: MODEL,
  dataExport: ['TV26'],
  dataExportModel: MODEL,
}

/** Наборы, где касание — настоящее: экран с касаниями и экран с наведением. */
export const TOUCH_TEST_FILES = [
  'src/lib/stories/__tests__/visual/touch.test.tsx',
  'src/lib/stories/__tests__/visual/touch-hybrid.test.tsx',
]

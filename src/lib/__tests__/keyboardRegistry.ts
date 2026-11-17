/**
 * Реестр клавиатуры (ADR 0232, §1, KX1): каждый встроенный плагин — ID требований,
 * которые проверяют его настоящими клавишами, или причина, почему клавиатура ему не нужна.
 */
export type KeyboardRow = readonly string[] | { reason: string }

const MODEL = {
  reason: 'модель без интерфейса: клавиши — у плагина интерфейса',
}
const VIEW = { reason: 'только вид, без своих контролов' }

export const KEYBOARD_REGISTRY: Record<string, KeyboardRow> = {
  rowSelection: ['KX16'],
  rowSelectionModel: MODEL,
  rowExpanding: ['KX16'],
  rowExpandingModel: MODEL,
  treeLines: VIEW,
  textWrap: ['KX9'],
  rowDragging: ['KB4'],
  rowGrouping: ['KX16'],
  rowGroupingModel: MODEL,
  rowActions: ['KX2'],
  cellEditing: ['KX2'],
  cellErrors: ['KX9'],
  valueChangeFlash: VIEW,
  cellSelection: ['KB6'],
  cellSelectionModel: MODEL,
  contextMenu: ['KB14'],
  columnSorting: ['KX2'],
  columnSortingModel: MODEL,
  columnPinning: ['KX16'],
  columnSizing: ['KB2'],
  columnDragging: ['KB3'],
  columnVisibility: ['KX2'],
  headerActionMenu: ['KX2'],
  rowActionMenu: ['KX16'],
  pagination: ['KX16'],
  paginationModel: MODEL,
  infiniteScroll: ['IS11'],
  backToTop: ['BT16'],
  columnTotals: ['KX9'],
  columnAggregation: ['KX16'],
  failureLog: ['KX2'],
  unsavedChanges: ['KX2'],
  editHistory: ['UD13'],
  serverRowModel: ['SD14'],
  columnFiltering: ['KX2'],
  columnFilteringModel: MODEL,
  quickSearch: ['KX2'],
  quickSearchModel: MODEL,
  dataExport: ['KX16'],
  dataExportModel: MODEL,
}

/** Наборы, где путь фичи проходит настоящими клавишами браузера. */
export const KEYBOARD_TEST_FILES = [
  'src/lib/stories/__tests__/visual/keyboard-registry.test.tsx',
  'src/lib/stories/__tests__/visual/keyboard-wcag.test.tsx',
  'src/lib/stories/__tests__/visual/keyboard-focus.test.tsx',
  'src/lib/stories/__tests__/visual/edit-history.test.tsx',
  'src/lib/stories/__tests__/visual/infinite-scroll.test.tsx',
  'src/lib/stories/__tests__/visual/back-to-top.test.tsx',
  'src/lib/stories/__tests__/visual/server-row-model.test.tsx',
]

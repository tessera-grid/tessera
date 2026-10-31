/**
 * Базы стражей слоёв (ADR 0163, §2): нарушения на момент принятия, у каждого — причина и
 * находка аудита 2026-10-31 (`docs/research/architecture-audit-2026-10-31.md`). Базы только
 * сокращаются: исправленное место уходит из базы, иначе страж падает.
 */

const DND_IN_GRID = 'перетаскивание строк и колонок в гриде — находка 2'
const UTIL_IN_CORE = 'утилита ядра в ките, место — util/ — находка 8'
const GRID_KIT = 'компонент грида в плагине, место — кит ui — находка 9'
const BUTTON_VISIBILITY =
  'общий CSS видимости кнопок ячейки лежит в гриде — находка 9'

/** LB1: рёбра в запрещённый слой. */
export const LAYER_EDGES: Record<string, string> = {
  'lib/core/flashes/flashFeature.ts -> lib/ui/buttonStates/useErrorFlash.ts':
    'разбор CSS-времени из кита в ядре — находка 8',
  'lib/core/highlights/highlightFeature.ts -> lib/ui/buttonStates/useErrorFlash.ts':
    'разбор CSS-времени из кита в ядре — находка 8',
  'lib/core/scrollStretch.ts -> lib/ui/buttonStates/useErrorFlash.ts':
    'разбор CSS-времени из кита в ядре — находка 8',
  'lib/core/stubs.ts -> lib/ui/icons/index.ts':
    'тип иллюстрации заглушки из кита в ядре — находка 8',
  'lib/grid/DataGridTable.tsx -> lib/plugins/rowDragging/types.ts': DND_IN_GRID,
  'lib/grid/DndBodyWrapper.tsx -> lib/plugins/rowDragging/dragRows.ts':
    DND_IN_GRID,
  'lib/grid/DndBodyWrapper.tsx -> lib/plugins/rowDragging/expandTimer.ts':
    DND_IN_GRID,
  'lib/grid/DndBodyWrapper.tsx -> lib/plugins/rowDragging/index.ts':
    DND_IN_GRID,
  'lib/grid/DndHeadWrapper.tsx -> lib/plugins/columnDragging/index.ts':
    DND_IN_GRID,
  'lib/grid/DraggableBodyRow.tsx -> lib/plugins/rowDragging/index.ts':
    DND_IN_GRID,
  'lib/plugins/cellEditing/CellEditButton.tsx -> lib/grid/Actions/CellButton.tsx':
    GRID_KIT,
  'lib/plugins/cellEditing/CellEditButton.tsx -> lib/grid/cellControls/CellInvalid.tsx':
    GRID_KIT,
  'lib/plugins/cellErrors/CellErrorMark.tsx -> lib/grid/Actions/CellButton.tsx':
    GRID_KIT,
  'lib/plugins/cellErrors/CellErrorMark.tsx -> lib/grid/cellControls/CellInvalid.tsx':
    GRID_KIT,
  'lib/plugins/columnDragging/ColumnDraggingComponent.tsx -> lib/grid/dnd/index.ts':
    DND_IN_GRID,
  'lib/plugins/columnFiltering/filterHeaderAction.tsx -> lib/grid/cellControls/buttonVisibility.css':
    BUTTON_VISIBILITY,
  'lib/plugins/columnFiltering/registry.ts -> lib/grid/filtering/FilteredRowsCount.tsx':
    'счётчик фильтра в гриде, общий у фильтров и поиска — находка 9',
  'lib/plugins/columnPinning/PinButton.tsx -> lib/grid/cellControls/buttonVisibility.css':
    BUTTON_VISIBILITY,
  'lib/plugins/columnPinning/pinHeaderAction.tsx -> lib/grid/cellControls/buttonVisibility.css':
    BUTTON_VISIBILITY,
  'lib/plugins/columnSizing/ResizeHandler.tsx -> lib/grid/cellControls/buttonVisibility.css':
    BUTTON_VISIBILITY,
  'lib/plugins/columnSizing/ResizeHandler.tsx -> lib/grid/handleMenu/HandleMenu.tsx':
    GRID_KIT,
  'lib/plugins/columnSorting/SortButton.tsx -> lib/grid/cellControls/buttonVisibility.css':
    BUTTON_VISIBILITY,
  'lib/plugins/columnSorting/sortHeaderAction.tsx -> lib/grid/cellControls/buttonVisibility.css':
    BUTTON_VISIBILITY,
  'lib/plugins/columnVisibility/ColumnVisibilityMenu.tsx -> lib/grid/TreeLinesLayer.tsx':
    GRID_KIT,
  'lib/plugins/infiniteScroll/InfiniteErrorRow.tsx -> lib/grid/LoadMoreError.tsx':
    GRID_KIT,
  'lib/plugins/infiniteScroll/InfiniteTail.tsx -> lib/grid/SkeletonBody.tsx':
    GRID_KIT,
  'lib/plugins/infiniteScroll/LoadedRowsCount.tsx -> lib/grid/StatusBar/StatusBarCount.tsx':
    GRID_KIT,
  'lib/plugins/quickSearch/SearchField.tsx -> lib/grid/DataGrid/DataGrid.module.css':
    'CSS-модуль грида в плагине поиска — находка 9',
  'lib/plugins/quickSearch/registry.ts -> lib/grid/filtering/FilteredRowsCount.tsx':
    'счётчик фильтра в гриде, общий у фильтров и поиска — находка 9',
  'lib/plugins/rowDragging/RowDraggingComponent.tsx -> lib/grid/dnd/index.ts':
    DND_IN_GRID,
  'lib/plugins/rowDragging/dropPlace.ts -> lib/grid/dnd/dropParent.ts':
    DND_IN_GRID,
  'lib/plugins/rowDragging/getRowDraggingEvents.ts -> lib/grid/dnd/dropParent.ts':
    DND_IN_GRID,
  'lib/plugins/rowGrouping/GroupButton.tsx -> lib/grid/cellControls/buttonVisibility.css':
    BUTTON_VISIBILITY,
  'lib/plugins/rowGrouping/groupHeaderAction.tsx -> lib/grid/cellControls/buttonVisibility.css':
    BUTTON_VISIBILITY,
  'lib/plugins/rowSelection/SelectedRowsCount.tsx -> lib/grid/StatusBar/StatusBarCount.tsx':
    GRID_KIT,
  'lib/ui/IconButton/useActiveNameCheck.ts -> lib/core/logger.ts': UTIL_IN_CORE,
  'lib/ui/LinearProgress/LinearProgress.tsx -> lib/core/useIsomorphicLayoutEffect.ts':
    UTIL_IN_CORE,
  'lib/ui/Stub/Stub.tsx -> lib/core/useIsomorphicLayoutEffect.ts': UTIL_IN_CORE,
  'lib/ui/Tooltip/Tooltip.tsx -> lib/core/reactVersion.ts': UTIL_IN_CORE,
  'lib/ui/Tooltip/TooltipImpl.tsx -> lib/core/themeVariables/index.ts':
    'тема порталов из ядра в ките — находка 8',
}

const SHARED_CODE = 'код, общий у плагинов, в ядре, место — shared/ — находка 1'
const UTIL_CODE = 'утилита в ядре, место — util/ — находка 1'

/** LB2: модули ядра, которые импортируют только плагины. */
export const CORE_PLUGIN_ONLY: Record<string, string> = {
  'lib/core/clipboard.ts': 'буфер обмена выделения ячеек — находка 3',
  'lib/core/columnDataType.ts':
    'разбор ввода по типу колонки — находки 1 и 16, прожарка dataType',
  'lib/core/definePlugin/channels.ts':
    'часть API definePlugin, плагин берёт модуль мимо definePlugin/index',
  'lib/core/effectiveState.ts':
    'помощники сужения ядра в плагинах — край ADR 0039, шаг 8 аудита',
  'lib/core/expandedRowModel.ts':
    'модель раскрытия — находка 1 и край своих моделей строк (ADR 0070)',
  'lib/core/failedAttempts.ts': SHARED_CODE,
  'lib/core/filteredRowModel.ts':
    'модель фильтрации фильтров и поиска — находка 1 и край ADR 0068',
  'lib/core/idleRowModel.ts':
    'холостые проходы моделей — находка 1 и край ADR 0068',
  'lib/core/oneCommit.ts': UTIL_CODE,
  'lib/core/rowMoves.ts': SHARED_CODE,
  'lib/core/rowsByIdHandover.ts':
    'словарь строк моделей — находка 1 и край ADR 0069',
  'lib/core/scrollGridTo.ts': SHARED_CODE,
  'lib/core/searchColumns.ts': SHARED_CODE,
  'lib/core/serverAggregations.ts': SHARED_CODE,
  'lib/core/servicePresence.ts': SHARED_CODE,
  'lib/core/timeSlice.ts': UTIL_CODE,
  'lib/core/useDebouncedCallback.ts': UTIL_CODE,
  'lib/core/wallTime.ts': 'стенное время дат — находка 16, прожарка dataType',
}

const SERVER_MODES = 'серверные режимы плагинов читает ядро — находки 1 и 5'
const FLAG_PLUGIN = 'плагин-флажок, механика в ядре и гриде — находка 3'

/** LB5: чтения собственных опций плагина вне его цепочки — `файл: ключ`. */
export const FOREIGN_OPTION_READS: Record<string, string> = {
  'lib/core/cellSelectionCopy.ts: cellSelectionMaxCopyRows':
    'копирование выделения в ядре — находки 3 и 4',
  'lib/core/filteredRowModel.ts: columnFilteringTimeZone':
    'пояс дат фильтра в модели ядра — находка 4, timeZone — в useCreateTable',
  'lib/core/keyboardNavigation/gridKeyDown.ts: enableContextMenu': FLAG_PLUGIN,
  'lib/core/keyboardNavigation/model.ts: enableKeyboardNavigation': FLAG_PLUGIN,
  'lib/core/pluginDiagnostics.ts: cellSelectionInteraction':
    'диагностика выделения ячеек в ядре — находки 3 и 13',
  'lib/core/serverActions/index.ts: columnFilteringServer': SERVER_MODES,
  'lib/core/serverActions/index.ts: columnSortingRevertOnReject': SERVER_MODES,
  'lib/core/serverActions/index.ts: paginationRevertOnReject': SERVER_MODES,
  'lib/core/serverActions/index.ts: quickSearchServer': SERVER_MODES,
  'lib/grid/DataGrid.tsx: enableContextMenu': FLAG_PLUGIN,
  'lib/grid/DataGrid.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/DataGridTable.tsx: enableColumnDragging': DND_IN_GRID,
  'lib/grid/DataGridTable.tsx: enableRowDragging': DND_IN_GRID,
  'lib/grid/DataGridTable.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/DndBodyWrapper.tsx: enableRowDragging': DND_IN_GRID,
  'lib/grid/DndHeadWrapper.tsx: enableColumnDragging': DND_IN_GRID,
  'lib/grid/SkeletonBody.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/StickyRows.tsx: stickyBranchRows':
    'липкие строки плагинов рисует грид — находка 3',
  'lib/grid/StickyRows.tsx: stickyGroupRows':
    'липкие строки плагинов рисует грид — находка 3',
  'lib/grid/filtering/FilteredRowsCount.tsx: filteringRowCounts':
    'счётчик фильтра в гриде — находка 9',
  'lib/plugins/dataExportModel/exportData.ts: columnFilteringTimeZone':
    'выгрузка читает пояс фильтра — находка 4, timeZone — в useCreateTable',
  'lib/plugins/infiniteScroll/model.ts: columnFilteringServer':
    'лента читает серверный режим фильтров — находка 5',
  'lib/plugins/infiniteScroll/model.ts: quickSearchServer':
    'лента читает серверный режим поиска — находка 5',
}

/** LB7: модули, которые дополняют `ColumnMeta`. */
export const COLUMN_META_AUGMENTATIONS: Record<string, string> = {}

const CAST_READS = 'опции плагинов и ядра через каст — находки 4 и 7'

/** LB9: приведения `….options` к `any`, `unknown as …` и литералу — число по модулю. */
export const OPTION_CASTS: Record<string, { count: number; reason: string }> = {
  'lib/core/commonFeature.ts': { count: 1, reason: CAST_READS },
  'lib/core/useTableEffects.ts': { count: 1, reason: CAST_READS },
  'lib/grid/DataGrid.tsx': { count: 2, reason: CAST_READS },
  'lib/grid/DataGridTable.tsx': { count: 2, reason: CAST_READS },
  'lib/grid/DndBodyWrapper.tsx': { count: 1, reason: DND_IN_GRID },
  'lib/grid/DndHeadWrapper.tsx': { count: 1, reason: DND_IN_GRID },
  'lib/grid/SkeletonBody.tsx': { count: 1, reason: CAST_READS },
  'lib/plugins/columnDragging/columnDraggingFeature.ts': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/columnFiltering/FilterSummaryPopover.tsx': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/columnPinning/pinHeaderAction.tsx': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/columnSorting/sortHeaderAction.tsx': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/dataExport/ExportPanel.tsx': {
    count: 1,
    reason: '`partialData` ленты в выгрузке — находки 4 и 7',
  },
  'lib/plugins/infiniteScroll/LoadedRowsCount.tsx': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/pagination/PaginationControl.tsx': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/rowDragging/RowDraggingComponent.tsx': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/rowDragging/getRowDraggingEvents.ts': {
    count: 2,
    reason: CAST_READS,
  },
  'lib/plugins/rowDragging/rowDraggingFeature.ts': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/rowExpanding/ExpandAllComponent.tsx': {
    count: 1,
    reason: CAST_READS,
  },
  'lib/plugins/rowExpanding/rowExpandingPendingFeature.ts': {
    count: 1,
    reason: CAST_READS,
  },
}

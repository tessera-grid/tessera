/**
 * Базы стражей слоёв (ADR 0163, §2): нарушения на момент принятия, у каждого — причина и
 * находка аудита 2026-10-31 (`docs/research/architecture-audit-2026-10-31.md`). Базы только
 * сокращаются: исправленное место уходит из базы, иначе страж падает.
 */

const DND_IN_GRID = 'перетаскивание строк и колонок в гриде — находка 2, шаг 5'

/** LB1: рёбра в запрещённый слой. */
export const LAYER_EDGES: Record<string, string> = {
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
  'lib/plugins/columnDragging/ColumnDraggingComponent.tsx -> lib/grid/dnd/index.ts':
    DND_IN_GRID,
  'lib/plugins/columnSizing/ResizeHandler.tsx -> lib/grid/handleMenu/HandleMenu.tsx':
    'меню ручки — у перетаскивания в гриде и у грипа, место — shared/ после шага 5',
  'lib/plugins/infiniteScroll/InfiniteTail.tsx -> lib/grid/SkeletonBody.tsx':
    'хвост ленты рисует строки скелета грида — канал «плагин вносит в тело», шаг 7',
  'lib/plugins/rowDragging/RowDraggingComponent.tsx -> lib/grid/dnd/index.ts':
    DND_IN_GRID,
}

/** LB2: модули ядра, которые импортируют только плагины, — долг: модуль переедет. */
export const CORE_PLUGIN_ONLY: Record<string, string> = {
  'lib/core/clipboard.ts':
    'буфер обмена выделения ячеек — с копированием выделения в ядре, шаг 7',
  'lib/core/columnDataType.ts':
    'разбор ввода по типу колонки — находки 1 и 16, прожарка dataType',
  'lib/core/effectiveState.ts':
    'помощники сужения ядра в плагинах — край ADR 0039, шаг 8 аудита',
  'lib/core/wallTime.ts': 'стенное время дат — находка 16, прожарка dataType',
}

/**
 * LB2: API ядра для плагинов (ADR 0166, §4) — модуль нужен самому ядру и открыт плагинам;
 * извне его читают только плагины и `shared/`.
 */
export const CORE_PLUGIN_API: Record<string, string> = {
  'lib/core/rowChanges.ts':
    'подсказка виртуализатору: пишут модели строк, читает виртуализатор ядра (ADR 0145)',
  'lib/core/rowHierarchy.ts':
    'иерархия строк: объявляют модели дерева и группировки, читает rowDragging, на шаге 7 — грид (ADR 0168)',
  'lib/core/scrollGridTo.ts':
    'прокрутка грида: ею прокручивают ядро и кнопка «наверх» (ADR 0105)',
  'lib/core/servicePresence.ts':
    'показ служебной колонки по условию: ведёт definePlugin, условия задают плагины (ADR 0050)',
}

const SERVER_MODES =
  'серверные режимы плагинов читают ядро и лента — находки 1 и 5, шаг 6 (режим данных)'
const PAGE_MODE =
  'клиентская страница и итог строк — режим данных, находка 5, шаг 6'
const FLAG_PLUGIN = 'плагин-флажок, механика в ядре и гриде — находка 3, шаг 7'
const CELL_SELECTION = 'выделение ячеек в ядре и гриде — находки 3 и 4, шаг 7'
const FEED_CHECKS =
  'лента проверяет клиентскую обработку и серверный режим чужих плагинов — находка 5, шаг 6'

/** LB5: чтения ключей опций плагина вне его семьи и его кода в `shared/` — `файл: ключ`. */
export const FOREIGN_OPTION_READS: Record<string, string> = {
  'lib/core/cellSelectionCopy.ts: cellSelectionMaxCopyRows': CELL_SELECTION,
  'lib/core/keyboardNavigation/cellSelectionSync.ts: enableCellRangeSelection':
    CELL_SELECTION,
  'lib/core/keyboardNavigation/cellSelectionSync.ts: enableCellSelection':
    CELL_SELECTION,
  'lib/core/keyboardNavigation/gridKeyDown.ts: enableContextMenu': FLAG_PLUGIN,
  'lib/core/keyboardNavigation/model.ts: enableExpanding':
    'иерархия строк для treegrid в навигации ядра — находка 3, шаг 7',
  'lib/core/keyboardNavigation/model.ts: enableKeyboardNavigation': FLAG_PLUGIN,
  'lib/core/pagination.ts: manualPagination': PAGE_MODE,
  'lib/core/pagination.ts: paginateExpandedRows': PAGE_MODE,
  'lib/core/pagination.ts: rowCount': PAGE_MODE,
  'lib/core/pluginDiagnostics.ts: cellSelectionInteraction':
    'диагностика выделения ячеек в ядре — находки 3 и 13, шаг 7',
  'lib/core/rowChanges.ts: manualFiltering':
    'подсказка виртуализатору не строится для серверных моделей — режим данных, шаг 6',
  'lib/core/rowChanges.ts: manualSorting':
    'подсказка виртуализатору не строится для серверных моделей — режим данных, шаг 6',
  'lib/core/scrollToRow/scrollToRowFeature.ts: manualPagination': PAGE_MODE,
  'lib/core/scrollToRow/scrollToRowFeature.ts: paginateExpandedRows': PAGE_MODE,
  'lib/core/serverActions/index.ts: columnFilteringServer': SERVER_MODES,
  'lib/core/serverActions/index.ts: manualPagination': SERVER_MODES,
  'lib/core/serverActions/index.ts: manualSorting': SERVER_MODES,
  'lib/core/serverActions/index.ts: quickSearchServer': SERVER_MODES,
  'lib/grid/DataGrid.tsx: enableContextMenu': FLAG_PLUGIN,
  'lib/grid/DataGrid.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/DataGridTable.tsx: enableCellSelection': CELL_SELECTION,
  'lib/grid/DataGridTable.tsx: enableColumnDragging': DND_IN_GRID,
  'lib/grid/DataGridTable.tsx: enableRowDragging': DND_IN_GRID,
  'lib/grid/DataGridTable.tsx: enableRowSelection':
    'выбор строк задаёт роль и aria грида — находка 3, шаг 7',
  'lib/grid/DataGridTable.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/DndBodyWrapper.tsx: enableRowDragging': DND_IN_GRID,
  'lib/grid/DndHeadWrapper.tsx: enableColumnDragging': DND_IN_GRID,
  'lib/grid/LiveRegion.tsx: manualFiltering':
    'объявление итога поиска в серверном режиме — режим данных, шаг 6',
  'lib/grid/SkeletonBody.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/StickyRows.tsx: stickyBranchRows':
    'липкие строки плагинов рисует грид — находка 3, шаг 7',
  'lib/grid/StickyRows.tsx: stickyGroupRows':
    'липкие строки плагинов рисует грид — находка 3, шаг 7',
  'lib/plugins/dataExportModel/exportData.ts: columnFilteringTimeZone':
    'выгрузка читает пояс фильтра — находка 4, timeZone — в useCreateTable, шаг 6',
  'lib/plugins/infiniteScroll/model.ts: columnFilteringServer': FEED_CHECKS,
  'lib/plugins/infiniteScroll/model.ts: enableColumnFilters': FEED_CHECKS,
  'lib/plugins/infiniteScroll/model.ts: enableGlobalFilter': FEED_CHECKS,
  'lib/plugins/infiniteScroll/model.ts: enableSorting': FEED_CHECKS,
  'lib/plugins/infiniteScroll/model.ts: manualSorting': FEED_CHECKS,
  'lib/plugins/infiniteScroll/model.ts: paginateExpandedRows': FEED_CHECKS,
  'lib/plugins/infiniteScroll/model.ts: quickSearchServer': FEED_CHECKS,
  'lib/plugins/serverRowModel/blockStore.ts: rowCount':
    'серверная модель читает итог пагинации — режим данных, шаг 6',
  'lib/plugins/serverRowModel/tree.ts: rowCount':
    'серверная модель читает итог пагинации — режим данных, шаг 6',
  'lib/shared/rowModels/expandedRowModel.ts: manualPagination':
    'модель раскрытия читает серверную пагинацию — режим данных, шаг 6',
}

/** LB7: модули, которые дополняют `ColumnMeta`. */
export const COLUMN_META_AUGMENTATIONS: Record<string, string> = {}

/** LB9: приведения `….options` к `any`, `unknown as …` и литералу — число по модулю. */
export const OPTION_CASTS: Record<string, { count: number; reason: string }> =
  {}

/**
 * Базы стражей слоёв (ADR 0163, §2): нарушения на момент принятия, у каждого — причина и
 * находка аудита 2026-10-31 (`docs/research/architecture-audit-2026-10-31.md`). Базы только
 * сокращаются: исправленное место уходит из базы, иначе страж падает.
 */

const DND_IN_GRID = 'перетаскивание строк и колонок в гриде — находка 2'

/** LB1: рёбра в запрещённый слой. */
export const LAYER_EDGES: Record<string, string> = {
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
  'lib/plugins/columnDragging/ColumnDraggingComponent.tsx -> lib/grid/dnd/index.ts':
    DND_IN_GRID,
  'lib/plugins/columnSizing/ResizeHandler.tsx -> lib/grid/handleMenu/HandleMenu.tsx':
    'меню ручки — у перетаскивания в гриде и у грипа, место — shared/ после шага 5',
  'lib/plugins/infiniteScroll/InfiniteTail.tsx -> lib/grid/SkeletonBody.tsx':
    'хвост ленты рисует строки скелета грида — канал «плагин вносит в тело», шаг 7',
  'lib/plugins/rowDragging/RowDraggingComponent.tsx -> lib/grid/dnd/index.ts':
    DND_IN_GRID,
  'lib/plugins/rowDragging/dropPlace.ts -> lib/grid/dnd/dropParent.ts':
    DND_IN_GRID,
  'lib/plugins/rowDragging/getRowDraggingEvents.ts -> lib/grid/dnd/dropParent.ts':
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
  'lib/core/scrollGridTo.ts':
    'прокрутка грида: ею прокручивают ядро и кнопка «наверх» (ADR 0105)',
  'lib/core/servicePresence.ts':
    'показ служебной колонки по условию: ведёт definePlugin, условия задают плагины (ADR 0050)',
}

const SERVER_MODES = 'серверные режимы плагинов читает ядро — находки 1 и 5'
const FLAG_PLUGIN = 'плагин-флажок, механика в ядре и гриде — находка 3'

/** LB5: чтения собственных опций плагина вне его цепочки — `файл: ключ`. */
export const FOREIGN_OPTION_READS: Record<string, string> = {
  'lib/core/cellSelectionCopy.ts: cellSelectionMaxCopyRows':
    'копирование выделения в ядре — находки 3 и 4',
  'lib/shared/rowModels/filteredRowModel.ts: columnFilteringTimeZone':
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
  'lib/shared/filtering/FilteredRowsCount.tsx: filteringRowCounts':
    'счётчик «показано N из M» фильтров и поиска читает опцию фильтров — находка 4',
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

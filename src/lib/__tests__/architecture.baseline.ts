/**
 * Базы стражей слоёв (ADR 0163, §2): нарушения на момент принятия, у каждого — причина и
 * находка аудита 2026-10-31 (`docs/research/architecture-audit-2026-10-31.md`). Базы только
 * сокращаются: исправленное место уходит из базы, иначе страж падает.
 */

/** LB1: рёбра в запрещённый слой. */
export const LAYER_EDGES: Record<string, string> = {
  'lib/plugins/infiniteScroll/InfiniteTail.tsx -> lib/grid/SkeletonBody.tsx':
    'хвост ленты рисует строки скелета грида — канал «плагин вносит в тело», шаг 7',
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

const FLAG_PLUGIN = 'плагин-флажок, механика в ядре и гриде — находка 3, шаг 7'
const CELL_SELECTION = 'выделение ячеек в ядре и гриде — находки 3 и 4, шаг 7'

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
  'lib/core/pluginDiagnostics.ts: cellSelectionInteraction':
    'диагностика выделения ячеек в ядре — находки 3 и 13, шаг 7',
  'lib/grid/DataGrid.tsx: enableContextMenu': FLAG_PLUGIN,
  'lib/grid/DataGrid.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/DataGridTable.tsx: enableCellSelection': CELL_SELECTION,
  'lib/grid/DataGridTable.tsx: enableRowSelection':
    'выбор строк задаёт роль и aria грида — находка 3, шаг 7',
  'lib/grid/DataGridTable.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/SkeletonBody.tsx: enableTreeLines': FLAG_PLUGIN,
  'lib/grid/StickyRows.tsx: stickyBranchRows':
    'липкие строки плагинов рисует грид — находка 3, шаг 7',
  'lib/grid/StickyRows.tsx: stickyGroupRows':
    'липкие строки плагинов рисует грид — находка 3, шаг 7',
}

/** LB7: модули, которые дополняют `ColumnMeta`. */
export const COLUMN_META_AUGMENTATIONS: Record<string, string> = {}

/** LB9: приведения `….options` к `any`, `unknown as …` и литералу — число по модулю. */
export const OPTION_CASTS: Record<string, { count: number; reason: string }> =
  {}

/**
 * Базы стражей слоёв (ADR 0163, §2): нарушения на момент принятия, у каждого — причина и
 * находка аудита 2026-10-31 (`docs/research/architecture-audit-2026-10-31.md`). Базы только
 * сокращаются: исправленное место уходит из базы, иначе страж падает.
 */

/** LB1: рёбра в запрещённый слой. */
export const LAYER_EDGES: Record<string, string> = {}

/** LB2: модули ядра, которые импортируют только плагины, — долг: модуль переедет. */
export const CORE_PLUGIN_ONLY: Record<string, string> = {
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
    'иерархия строк: выставляют модели дерева и группировки, читают навигация ядра и rowDragging (ADR 0168, ADR 0170)',
  'lib/core/scrollGridTo.ts':
    'прокрутка грида: ею прокручивают ядро и кнопка «наверх» (ADR 0105)',
  'lib/core/servicePresence.ts':
    'показ служебной колонки по условию: ведёт definePlugin, условия задают плагины (ADR 0050)',
}

/** LB5: чтения ключей опций плагина вне его семьи и его кода в `shared/` — `файл: ключ`. */
export const FOREIGN_OPTION_READS: Record<string, string> = {}

/** LB7: модули, которые дополняют `ColumnMeta`. */
export const COLUMN_META_AUGMENTATIONS: Record<string, string> = {}

/** LB9: приведения `….options` к `any`, `unknown as …` и литералу — число по модулю. */
export const OPTION_CASTS: Record<string, { count: number; reason: string }> =
  {}

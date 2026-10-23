import type { StoryProps } from '../../DataGridStory.types'

/**
 * Вложенная шапка со служебными колонками, закреплением, видимостью, меню заголовка и
 * навигацией: колонки `country`, `visits`, служебные — растянутые листья (ADR 0049).
 */
export const SHALLOW_LEAVES = {
  dataNesting: 'nested',
  headerNesting: 'nested',
  enableRowSelection: true,
  enableRowExpanding: true,
  enableRowActions: true,
  enableColumnPinning: true,
  enableColumnVisibility: true,
  enableHeaderActionMenu: true,
  enableKeyboardNavigation: true,
  dataCount: 40,
  containerHeight: '500',
  height: '400',
  maxHeight: '400',
} satisfies Partial<StoryProps>

/** Закрепление под вложенной шапкой: группы верхнего уровня (ADR 0011, CP17–CP19). */
export const PINNING_NESTED = {
  headerNesting: 'nested',
  enableColumnPinning: true,
  dataCount: 40,
  containerHeight: '400',
  height: '300',
  maxHeight: '300',
} satisfies Partial<StoryProps>

/** Закрепление отдельных колонок под вложенной шапкой (ADR 0011, LP1–LP10). */
export const LEAF_PINNING = {
  ...PINNING_NESTED,
  columnPinningLeafPinning: true,
} satisfies Partial<StoryProps>

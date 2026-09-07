import { ColumnSizingState } from '@tanstack/react-table'

/**
 * Итоговый `columnSizing` грида. Порядок спреда задаёт приоритет: авто-слайс
 * плагинов (ширины служебных колонок — плагин пишет его в `setup`,
 * generic-escape ADR 0010) идёт ПОСЛЕДНИМ и побеждает как контролируемый
 * (`externalColumnSizing`), так и внутренний `columnSizing`.
 *
 * Инвариант осознанный (ADR 0013): ширина служебной колонки — во владении
 * плагина (напр. `rowActions({ width })`), а не потребительского `columnSizing`.
 * Служебным колонкам ширину через `columnSizing` не задают: это не ошибка, а
 * контракт, поэтому и без предупреждения.
 */
export const mergeColumnSizing = (
  externalColumnSizing: ColumnSizingState | undefined,
  columnSizing: ColumnSizingState,
  columnAutoSizing: ColumnSizingState,
): ColumnSizingState => ({
  ...(externalColumnSizing ?? columnSizing),
  ...columnAutoSizing,
})

import type { Row } from '../../types'
import type { RowExpandingHooks } from './types'

/** Переключить раскрытие и уведомить `onExpandRow` (общий путь клика и клавиши). */
export const toggleRowExpanded = (
  row: Row<any, any>,
  hooks: Partial<RowExpandingHooks>,
): void => {
  row.getToggleExpandedHandler()()
  hooks.onExpandRow?.(row, !row.getIsExpanded())
}

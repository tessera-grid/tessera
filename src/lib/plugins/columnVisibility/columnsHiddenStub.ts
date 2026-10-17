import {
  ILLUSTRATION_SIZE,
  dataColumnsOf,
  hasVisibleDataColumns,
} from '../../core/stubs'
import type { StubEntry } from '../../core/stubs'
import {
  type VisibilityControlTable,
  setColumnsVisible,
} from './applyVisibility'
import { getShowAll } from './columnTree'

/**
 * Заглушка «все колонки скрыты» (ADR 0123, ES6): колонки есть, но видимых нет — так
 * бывает только по состоянию приложения (CV9); «Show all» возвращает скрытые.
 */
export const COLUMNS_HIDDEN_STUB: StubEntry = {
  id: 'columnsHidden',
  priority: 20,
  placement: 'grid',
  when: ({ table }) =>
    dataColumnsOf(table).length > 0 && !hasVisibleDataColumns(table),
  title: labels => labels.columnsHiddenTitle,
  media: 'emptyState',
  mediaSize: ILLUSTRATION_SIZE,
  action: ({ table }, labels) => ({
    label: labels.showAllColumns,
    run: () => {
      const control = table as VisibilityControlTable
      setColumnsVisible(control, getShowAll(control), true)
    },
    testId: 'columns-hidden-show-all',
  }),
  testId: 'columns-hidden-stub',
}

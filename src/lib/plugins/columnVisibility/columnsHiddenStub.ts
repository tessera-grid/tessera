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
 * Таблицы, где последнюю колонку скрыли из кебаба заголовка: фокус — на кнопку
 * заглушки. Ключ — `store`: он общий у экземпляра и у копий таблицы в контекстах.
 */
const focusRequests = new WeakSet<object>()

const storeOf = (table: unknown) => (table as { store: object }).store

/** Заголовок с меню пропадает вместе с колонкой — фокус примет заглушка (ADR 0133, HA7). */
export const requestStubFocus = (table: unknown) =>
  focusRequests.add(storeOf(table))

/**
 * Заглушка «все колонки скрыты» (ADR 0123, ES6): колонки есть, но видимых нет;
 * «Show all» возвращает скрытые.
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
    focusOnMount: () => focusRequests.delete(storeOf(table)),
  }),
  testId: 'columns-hidden-stub',
}

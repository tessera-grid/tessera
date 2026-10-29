/** Hook-слайс плагина rowExpanding. */
import type { Row } from '../../types'

export interface RowExpandingHooks {
  /**
   * Раскрытие или сворачивание строки. Промис при раскрытии — ожидание (ленивая
   * подгрузка потомков): отказ сворачивает строку обратно (ADR 0041).
   */
  onExpandRow: (
    row: Row<any, any>,
    expanded: boolean,
  ) => void | Promise<unknown>
  /** У строки есть дети, которых нет в `subRows` (ADR 0054). */
  hasChildren?: (row: Row<any, any>) => boolean
  /**
   * Загрузка детей ленивой строки — на каждое раскрытие (ADR 0054). Массив
   * показывается сразу, промис — после ожидания.
   */
  loadChildren?: (
    row: Row<any, any>,
    /** `signal` прерывает отмена раскрытия (ADR 0153, §1). */
    context?: { signal: AbortSignal },
  ) => readonly unknown[] | PromiseLike<readonly unknown[]>
}

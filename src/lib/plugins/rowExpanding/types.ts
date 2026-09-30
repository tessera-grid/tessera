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
}

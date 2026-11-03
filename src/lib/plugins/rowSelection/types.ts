/** Hook-слайс плагина rowSelection. */
import type { Row } from '../../types'

/**
 * Охват «Выбрать всё» в шапке (ADR 0179): строки после фильтров на всех страницах, текущей
 * страницы или все строки данных, и скрытые фильтром.
 */
export type SelectAllScope = 'filtered' | 'currentPage' | 'all'

export interface RowSelectionHooks {
  onSelectRow: (row: Row<any, any>, selected: boolean) => void
  /** Флажок шапки выбрал (`true`) или снял строки охвата `scope`. */
  onSelectAllRows: (selected: boolean, scope: SelectAllScope) => void
  isAllRowsSelected: boolean
}

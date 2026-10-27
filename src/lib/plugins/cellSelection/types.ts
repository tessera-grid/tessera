/** Опции и типы плагина cellSelection. */

import type {
  CellSelectionModelOptions,
  CellSelectionPredicateCell,
} from '../cellSelectionModel/registry'

export type { CellSelectionPredicateCell }

export interface CellSelectionOptions extends Omit<
  CellSelectionModelOptions,
  'enabled' | 'canSelectCell'
> {
  /** `false` — плагин присутствует, но инертен (present-but-disabled). */
  enabled?: boolean
  /** Shift-расширение прямоугольного диапазона. По умолчанию `true`. */
  rangeSelection?: boolean
  /** Протяжка выделения мышью (drag). По умолчанию `true`. */
  dragSelection?: boolean
  /** Ctrl/Cmd — добавление/вычитание отдельного прямоугольника. По умолчанию `true`. */
  multiRange?: boolean
  /** Сужает выбор; сервисные колонки (действия) не выбираются при любом предикате. */
  canSelectCell?: (cell: CellSelectionPredicateCell) => boolean
  /** Больше строк выделения копирование не кладёт в буфер. По умолчанию 10 000. */
  maxCopyRows?: number
}

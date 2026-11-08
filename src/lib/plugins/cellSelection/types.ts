/** Опции и типы плагина cellSelection. */

import type {
  CellSelectionModelOptions,
  CellSelectionPredicateCell,
} from '../cellSelectionModel/registry'

export type { CellSelectionPredicateCell }

/** Для каких указателей показан маркер угла выделения (ADR 0198). По умолчанию — для обоих. */
export interface CellSelectionHandleOptions {
  /** Мышь, тачпад, стилус: квадрат в правом нижнем углу. */
  mouse?: boolean
  /** Палец: круги в противоположных углах. */
  touch?: boolean
}

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
  /**
   * Маркер угла активного диапазона, за который диапазон растягивают (ADR 0198). `false` —
   * маркера нет. По умолчанию — для мыши и пальца.
   */
  handle?: false | CellSelectionHandleOptions
}

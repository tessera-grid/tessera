/** Опции и типы плагина cellSelection. */

/** Ячейка для предиката выбираемости (duck-typed под stock-фичу v9). */
export interface CellSelectionPredicateCell {
  column: {
    getIsActionsColumn: () => boolean
    getIsRowActionsColumn: () => boolean
  }
}

export interface CellSelectionOptions {
  /** `false` — плагин присутствует, но инертен (present-but-disabled). */
  enabled?: boolean
  /** Shift-расширение прямоугольного диапазона. По умолчанию `true`. */
  rangeSelection?: boolean
  /** Протяжка выделения мышью (drag). По умолчанию `true`. */
  dragSelection?: boolean
  /** Ctrl/Cmd — добавление/вычитание отдельного прямоугольника. По умолчанию `true`. */
  multiRange?: boolean
  /**
   * Предикат выбираемости ячейки. По умолчанию исключены сервисные колонки
   * (действия строки/заголовка).
   */
  canSelectCell?: (cell: CellSelectionPredicateCell) => boolean
}

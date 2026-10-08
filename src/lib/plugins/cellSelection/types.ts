/** Опции и типы плагина cellSelection. */

/** Ячейка для предиката выбираемости — подмножество ячейки TanStack v9. */
export interface CellSelectionPredicateCell {
  id: string
  column: {
    id: string
    getIsActionsColumn: () => boolean
    getIsRowActionsColumn: () => boolean
  }
  row: { id: string; original: unknown; depth: number }
  getValue: () => unknown
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
  /** Сужает выбор; сервисные колонки (действия) не выбираются при любом предикате. */
  canSelectCell?: (cell: CellSelectionPredicateCell) => boolean
}

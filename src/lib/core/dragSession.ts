/**
 * Сессия перетаскивания (ADR 0168, §3): срезы, которые пишут плагины перетаскивания, а грид
 * рисует — слот на уровне броска, облако отказа, будущего родителя, линии по проекции,
 * атрибуты контейнера и автопрокрутку за указателем.
 */

/** Срез сессии перетаскивания строки. */
export const ROW_DRAG_SESSION = 'rowDragging'

/** Срез с id перетаскиваемой колонки. */
export const COLUMN_DRAG_SESSION = 'columnDraggingActiveId'

/** Id перетаскиваемой строки или колонки; `null` — сессии нет. */
export type DragActiveId = string | number | null

export interface RowDragSession {
  activeId: DragActiveId
  acceptable: boolean
  /** Сдвиг облака по уровню, px. */
  offsetLeft: number
  /** Превью броска (ADR 0108): индексы в показанных строках и уровень на новом месте. */
  fromIndex: number | null
  overIndex: number | null
  depth: number
}

/** Превью броска строки, которое рисует тело. */
export interface DropPreview {
  activeId: string
  from: number
  to: number
  depth: number
  acceptable: boolean
}

export const rowDragSessionOf = (state: object): RowDragSession | undefined =>
  (state as Record<string, RowDragSession | undefined>)[ROW_DRAG_SESSION]

export const columnDragActiveIdOf = (state: object): DragActiveId =>
  ((state as Record<string, DragActiveId | undefined>)[COLUMN_DRAG_SESSION] ??
    null) as DragActiveId

/** Превью броска, пока тащат строку с известным местом; иначе `null`. */
export const dropPreviewOf = (state: object): DropPreview | null => {
  const drag = rowDragSessionOf(state)
  return drag?.activeId != null &&
    drag.fromIndex != null &&
    drag.overIndex != null
    ? {
        activeId: String(drag.activeId),
        from: drag.fromIndex,
        to: drag.overIndex,
        depth: drag.depth,
        acceptable: drag.acceptable,
      }
    : null
}

/** Индекс строки, стоящей на позиции `position` после переноса `from` → `to`. */
export const indexBeforeMove = (position: number, from: number, to: number) => {
  if (position === to) return from
  if (from < to && position >= from && position < to) return position + 1
  if (from > to && position > to && position <= from) return position - 1
  return position
}

/**
 * Будущий родитель слота (ADR 0109, §4): ближайшая строка выше места броска на
 * уровень меньше, в порядке после переноса. Поиск не уходит выше `lowest` — родитель
 * вне окна не подсвечивается. `-1` — родителя нет.
 */
export const findDropParent = (
  rows: { at: (index: number) => { depth: number } | undefined },
  { from, to, depth }: { from: number; to: number; depth: number },
  lowest: number,
): number => {
  if (depth <= 0) return -1
  for (let position = to - 1; position >= lowest; position--) {
    const index = indexBeforeMove(position, from, to)
    // Незагруженная строка серверной модели: родителя выше не видно (ADR 0159).
    const rowDepth = rows.at(index)?.depth
    if (rowDepth === undefined) return -1
    if (rowDepth < depth) return rowDepth === depth - 1 ? index : -1
  }
  return -1
}

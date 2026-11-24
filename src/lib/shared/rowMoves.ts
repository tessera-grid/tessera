/**
 * Переносы строк в ожидании промиса `onRowDragEnd` (ADR 0112): срез `rowMoves` плагина
 * rowDragging и правки дерева по `id`. Ленивый перенос показывает стадия исходной модели
 * (rowExpanding), итог пишет rowDragging — общий код здесь, вне папок плагинов (IV3).
 */
export interface RowMoveSide {
  /** `undefined` — корень. */
  parentId?: string
  /** Место среди сестёр после переноса. */
  index: number
  /** Дети родителя — ответ `loadChildren` (ADR 0054), а не `data`. */
  lazy: boolean
  /** Id сестёр на новом месте в момент броска: место держится за них, а не за индекс. */
  anchors?: readonly string[]
}

export interface LazyRowMove {
  original: unknown
  from: RowMoveSide
  to: RowMoveSide
}

export interface RowMoveEntry {
  attempt: number
  /** Промис `onRowDragEnd` не выполнен. */
  pending: boolean
  /** Перенос между группами: значения колонок группировки цели (ADR 0186, §3). */
  group?: Readonly<Record<string, unknown>>
  /** Ленивый перенос: виден стадией модели, пока итог не записан. */
  lazy?: LazyRowMove
}

export type RowMoves = Readonly<Record<string, RowMoveEntry>>

/** Ответы `loadChildren` по id строки-родителя (срез `loadedChildren`). */
export type Answers = Readonly<Record<string, readonly unknown[]>>

/** Id строки данных: `getRowId` таблицы с родителем по его id. */
export type RowIdOf = (
  item: unknown,
  index: number,
  parentId?: string,
) => string

const NO_MOVES: RowMoves = {}

/** Есть ленивые переносы: модель строк — со стадией, её индексы не индексы `data`. */
export const hasLazyMoves = (moves: RowMoves) => {
  for (const rowId in moves) if (moves[rowId]!.lazy) return true
  return false
}

export const readRowMoves = (table: unknown): RowMoves =>
  (
    table as { atoms: { rowMoves?: { get: () => RowMoves } } }
  ).atoms.rowMoves?.get() ?? NO_MOVES

export const rowIdOf =
  (table: unknown): RowIdOf =>
  (item, index, parentId) =>
    (
      table as {
        getRowId: (item: unknown, index: number, parent?: unknown) => string
      }
    ).getRowId(
      item,
      index,
      parentId === undefined ? undefined : { id: parentId },
    )

/** Сёстры без строки `rowId`; той же ссылкой, если её нет. */
export const withoutRow = (
  rows: readonly unknown[],
  rowId: string,
  idOf: RowIdOf,
  parentId?: string,
): readonly unknown[] => {
  const at = rows.findIndex((item, i) => idOf(item, i, parentId) === rowId)
  return at < 0 ? rows : rows.filter((_, i) => i !== at)
}

/** Сёстры со строкой на месте `index`; той же ссылкой, если она уже среди них. */
export const withRowAt = (
  rows: readonly unknown[],
  index: number,
  item: unknown,
  rowId: string,
  idOf: RowIdOf,
  parentId?: string,
): readonly unknown[] => {
  if (rows.some((row, i) => idOf(row, i, parentId) === rowId)) {
    return rows
  }
  const next = rows.slice()
  next.splice(Math.min(Math.max(index, 0), rows.length), 0, item)
  return next
}

/**
 * Сёстры со строкой на месте `index` среди сестёр модели (`anchors` — их id без
 * строки): после ближайшей сестры выше, что есть в `rows`, иначе перед ближайшей ниже.
 * Сёстры модели могут включать строки ожидающих переносов, которых в данных нет.
 */
export const withRowNear = (
  rows: readonly unknown[],
  anchors: readonly string[],
  index: number,
  item: unknown,
  rowId: string,
  idOf: RowIdOf,
  parentId?: string,
): readonly unknown[] => {
  const ids = rows.map((row, i) => idOf(row, i, parentId))
  for (let k = Math.min(index, anchors.length) - 1; k >= 0; k--) {
    const at = ids.indexOf(anchors[k]!)
    if (at >= 0) return withRowAt(rows, at + 1, item, rowId, idOf, parentId)
  }
  for (let k = index; k < anchors.length; k++) {
    const at = ids.indexOf(anchors[k]!)
    if (at >= 0) return withRowAt(rows, at, item, rowId, idOf, parentId)
  }
  return withRowAt(rows, index, item, rowId, idOf, parentId)
}

type DataRow = { subRows?: readonly unknown[] }

/**
 * `data` с новыми детьми строки `parentId` (`undefined` — корень): копируется только
 * путь до родителя. Родителя нет — та же ссылка.
 */
export const updateChildren = (
  data: readonly unknown[],
  parentId: string | undefined,
  idOf: RowIdOf,
  update: (children: readonly unknown[]) => readonly unknown[],
): readonly unknown[] => {
  if (parentId === undefined) {
    return update(data)
  }
  const visit = (
    rows: readonly unknown[],
    parent?: string,
  ): readonly unknown[] | undefined => {
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i] as DataRow
      const id = idOf(item, i, parent)
      const children = item.subRows
      const next =
        id === parentId
          ? update(children ?? [])
          : children?.length
            ? visit(children, id)
            : undefined
      if (next === undefined) {
        continue
      }
      if (next === children) {
        return rows
      }
      const copy = rows.slice()
      copy[i] = { ...item, subRows: next }
      return copy
    }
    return undefined
  }
  return visit(data) ?? data
}

/**
 * Данные и ответы с ленивыми переносами (ADR 0112, §2): строка убрана со старого места и
 * стоит на новом. Без переносов — те же ссылки; ответы, которых перенос не коснулся, —
 * прежние ссылки (модель пересобирает только их поддеревья, ADR 0067).
 */
export const applyRowMoves = (
  data: readonly unknown[],
  answers: Answers,
  moves: RowMoves,
  idOf: RowIdOf,
): { data: readonly unknown[]; answers: Answers } => {
  let nextData = data
  let nextAnswers = answers
  const setAnswer = (parentId: string, rows: readonly unknown[]) => {
    if (nextAnswers[parentId] !== rows) {
      nextAnswers = { ...nextAnswers, [parentId]: rows }
    }
  }
  for (const rowId in moves) {
    const move = moves[rowId]!.lazy
    if (!move) {
      continue
    }
    const { from, to, original } = move
    if (from.lazy) {
      const rows = nextAnswers[from.parentId!]
      if (rows) {
        setAnswer(from.parentId!, withoutRow(rows, rowId, idOf, from.parentId))
      }
    } else {
      nextData = updateChildren(nextData, from.parentId, idOf, rows =>
        withoutRow(rows, rowId, idOf, from.parentId),
      )
    }
    if (to.lazy) {
      setAnswer(
        to.parentId!,
        withRowNear(
          nextAnswers[to.parentId!] ?? [],
          to.anchors ?? [],
          to.index,
          original,
          rowId,
          idOf,
          to.parentId,
        ),
      )
    } else {
      nextData = updateChildren(nextData, to.parentId, idOf, rows =>
        withRowNear(
          rows,
          to.anchors ?? [],
          to.index,
          original,
          rowId,
          idOf,
          to.parentId,
        ),
      )
    }
  }
  return { data: nextData, answers: nextAnswers }
}

/** Дети строки `parentId` в `data` (`undefined` — корень); родителя нет — `undefined`. */
export const childrenOf = (
  data: readonly unknown[],
  parentId: string | undefined,
  idOf: RowIdOf,
): readonly unknown[] | undefined => {
  let found: readonly unknown[] | undefined
  updateChildren(data, parentId, idOf, children => {
    found = children
    return children
  })
  return found
}

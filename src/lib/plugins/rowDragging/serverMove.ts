/**
 * Перенос строки в серверной модели (ADR 0159, §2, §6): бросок, меню ручки и клавиши.
 * Строка сразу встаёт на новое место в кэше транзакцией источника, итог тот же;
 * `onRowDragEnd` получает место среди корней списка, отказ промиса возвращает строку.
 */
import { readPluginHooks } from '../../core/definePlugin'
import { type RowSource, rowSourceOf } from '../../core/rowSource'
import { commitRowMove } from './commitRowMove'
import type { RowDraggingHooks } from './types'

/** Источник серверной модели строк, если перенос идёт через него. */
export const serverMoveSource = (table: unknown) => {
  const source = (table as { getRowSource?: () => RowSource }).getRowSource?.()
  return source?.moveRow ? source : undefined
}

/** Край переноса меню ручки: начало или конец списка. */
export type RowMoveEdge = 'start' | 'end'

/**
 * Место строки после переноса меню ручки или клавишей (ADR 0159, §6), сквозным индексом;
 * `undefined` — переносить некуда. «Вверх» и «вниз» — к соседу, края — по итогу: конец
 * списка известен только с итогом.
 */
export const serverMoveTarget = (
  source: RowSource,
  rowId: string,
  to: -1 | 1 | RowMoveEdge,
): number | undefined => {
  const index = source.listIndexOf?.(rowId) ?? -1
  if (index < 0) return undefined
  const roots = source.rootCount?.() ?? source.count()
  const last = roots - 1
  const target =
    to === 'start'
      ? 0
      : to === 'end'
        ? source.rootCountKnown?.() === false
          ? undefined
          : last
        : index + to
  if (target === undefined || target < 0 || target > last) return undefined
  return target === index ? undefined : target
}

/** Перенос меню ручки или клавишей: тот же путь, что бросок. */
export const moveServerRow = (
  table: unknown,
  rowId: string,
  to: -1 | 1 | RowMoveEdge,
) => {
  const source = serverMoveSource(table)
  const target = source && serverMoveTarget(source, rowId, to)
  if (!source || target === undefined) return
  const offset = source.offset?.() ?? 0
  commitServerMove(
    table,
    rowId,
    source.listIndexOf!(rowId) - offset,
    target - offset,
    readPluginHooks<Partial<RowDraggingHooks>>(table as never, 'rowDragging')
      .onRowDragEnd,
  )
}

/**
 * Перенос со строки `from` на место `to` в индексах страницы; на месте `to` строка стоит
 * после переноса.
 */
export const commitServerMove = (
  table: unknown,
  rowId: string,
  from: number,
  to: number,
  onRowDragEnd: RowDraggingHooks['onRowDragEnd'] | undefined,
) => {
  const source = rowSourceOf(table)
  // Место — среди корней всего списка: страница начинается с `offset`.
  const offset = source.offset?.() ?? 0
  const before = source.listIndexOf?.(rowId) ?? offset + from
  const index = offset + to
  // Перенос за окно уносит строку из кэша: откат ставит её по данным (ADR 0159, §2).
  const original = (source.byId(rowId) as { original?: unknown } | undefined)
    ?.original
  commitRowMove(
    table,
    {
      rowId,
      dragIndex: from,
      hoverIndex: to,
      index,
      write: () => source.moveRow?.(rowId, index),
      revert: () => source.moveRow?.(rowId, before, original),
    },
    onRowDragEnd,
  )
}

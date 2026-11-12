/**
 * Флекс-колонки (ADR 0216): свободная ширина области прокрутки делится между колонками по
 * весам `flex` в пределах `minSize`/`maxSize`. Ширины — нижний слой сведения `columnSizing`:
 * пользовательский срез и служебный авто-слой их перекрывают.
 */
import { useSyncExternalStore } from 'react'

import {
  type ColumnSizingState,
  type Updater,
  functionalUpdate,
} from '@tanstack/react-table'

/** Ключ таблицы: `useTable` отдаёт новую копию экземпляра, хранилище — одно. */
const storeOf = (table: unknown) => (table as { store: object }).store

interface ContentMins {
  value: ColumnSizingState
  listeners: Set<() => void>
}

const NO_MINS: ColumnSizingState = {}
const contentMins = new WeakMap<object, ContentMins>()

const contentMinsEntry = (table: unknown) => {
  const store = storeOf(table)
  let entry = contentMins.get(store)
  if (!entry) {
    entry = { value: NO_MINS, listeners: new Set() }
    contentMins.set(store, entry)
  }
  return entry
}

/**
 * Нижние границы флекс-колонок по содержимому (ADR 0217, §3): ставит автоподбор, снимает сброс
 * ширины. Не срез и не опция — грид пересчитывает флекс-ширины по подписке.
 */
export const setFlexContentMins = (
  table: unknown,
  updater: Updater<ColumnSizingState>,
) => {
  const entry = contentMinsEntry(table)
  entry.value = functionalUpdate(updater, entry.value)
  for (const listener of entry.listeners) listener()
}

export const flexContentMinsOf = (table: unknown) =>
  contentMinsEntry(table).value

/** Границы по содержимому; сменились — перерисовка подписчика. */
export const useFlexContentMins = (table: unknown) => {
  const entry = contentMinsEntry(table)
  return useSyncExternalStore(
    listener => {
      entry.listeners.add(listener)
      return () => entry.listeners.delete(listener)
    },
    () => entry.value,
    () => NO_MINS,
  )
}

export interface FlexColumn {
  id: string
  flex: number
  min: number
  max: number
}

/**
 * Деление свободной ширины `free` по весам: колонка, упёршаяся в предел, выходит из деления,
 * остаток делится между остальными (как `flex-grow` в CSS). Ширины целые: остаток округления —
 * последней колонке, не упёршейся в предел.
 */
export const distributeFlex = (
  columns: readonly FlexColumn[],
  free: number,
): ColumnSizingState => {
  const widths: ColumnSizingState = {}
  let active = [...columns]
  let remaining = free
  for (;;) {
    const weight = active.reduce((sum, column) => sum + column.flex, 0)
    if (active.length === 0 || weight <= 0) break
    const share = (column: FlexColumn) =>
      (Math.max(remaining, 0) * column.flex) / weight
    const under = active.filter(column => share(column) < column.min)
    const over = under.length
      ? []
      : active.filter(column => share(column) > column.max)
    const frozen = under.length ? under : over
    if (frozen.length === 0) {
      let left = Math.max(Math.floor(remaining), 0)
      active.forEach((column, index) => {
        const width =
          index === active.length - 1 ? left : Math.floor(share(column))
        widths[column.id] = width
        left -= width
      })
      break
    }
    for (const column of frozen) {
      const width = under.length ? column.min : column.max
      widths[column.id] = width
      remaining -= width
    }
    active = active.filter(column => !frozen.includes(column))
  }
  return widths
}

interface FlexLeaf {
  id: string
  columnDef: { flex?: number; minSize?: number; maxSize?: number }
  getSize: () => number
  getIsActionsColumn?: () => boolean
}

interface FlexTable {
  getVisibleLeafColumns: () => FlexLeaf[]
  getAllLeafColumns: () => FlexLeaf[]
  options: { columnUserSizing?: ColumnSizingState }
}

/** Колонка флекс: вес больше нуля, не служебная (у служебной ширина у плагина, ADR 0013). */
export const isFlexColumn = (column: FlexLeaf) =>
  (column.columnDef.flex ?? 0) > 0 && !column.getIsActionsColumn?.()

/** В наборе есть флекс-колонки. */
export const hasFlexColumns = (table: unknown) =>
  (table as FlexTable).getAllLeafColumns().some(isFlexColumn)

/**
 * Флекс-ширины видимых колонок для области шириной `available`: протянутые пользователем
 * флекс-колонки — фиксированные (ADR 0216, §3); подогнанные по содержимому — не уже его
 * (ADR 0217, §3).
 */
export const computeFlexSizing = (
  table: unknown,
  available: number,
): ColumnSizingState => {
  const t = table as FlexTable
  const user = t.options.columnUserSizing ?? {}
  const contentMin = flexContentMinsOf(table)
  const leaves = t.getVisibleLeafColumns()
  const flexible = leaves.filter(
    column => isFlexColumn(column) && user[column.id] === undefined,
  )
  const fixed = leaves
    .filter(column => !flexible.includes(column))
    .reduce((sum, column) => sum + column.getSize(), 0)
  return distributeFlex(
    flexible.map(column => {
      const max = column.columnDef.maxSize ?? Number.POSITIVE_INFINITY
      return {
        id: column.id,
        flex: column.columnDef.flex!,
        min: Math.min(
          Math.max(column.columnDef.minSize ?? 0, contentMin[column.id] ?? 0),
          max,
        ),
        max,
      }
    }),
    available - fixed,
  )
}

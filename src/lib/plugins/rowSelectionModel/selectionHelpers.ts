/**
 * Общие хелперы rowSelection. Табличного `getCanSomeRowsSelect` нет — читаем
 * группировку из атома и считаем «есть ли выбираемые строки» инлайн.
 */
import type { RowSource } from '../../core/rowSource'

type MinimalTable = {
  atoms: { grouping?: { get: () => unknown[] } }
  getRowSource: () => RowSource<{ getCanSelect: () => boolean }>
}

/** Длина активной группировки (0, если фичи группировки нет). */
export const groupingLength = (table: unknown): number =>
  ((table as MinimalTable).atoms.grouping?.get() ?? []).length

/** Активна ли группировка (владеет выбором → выбор недоступен). */
export const isGroupingActive = (table: unknown): boolean =>
  groupingLength(table) > 0

/** Есть ли хотя бы одна выбираемая строка (v9-замена table.getCanSomeRowsSelect). */
export const getCanSomeRowsSelect = (table: unknown): boolean => {
  const rows = (table as MinimalTable).getRowSource()
  for (let index = 0; index < rows.count(); index++) {
    if (rows.at(index)?.getCanSelect()) return true
  }
  return false
}

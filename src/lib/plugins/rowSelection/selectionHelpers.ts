/**
 * Фаза E — общие хелперы rowSelection для v9.
 * В v9 нет `getState` и нет табличного `getCanSomeRowsSelect` (был Tessera-метод) —
 * читаем группировку из атома и считаем «есть ли выбираемые строки» инлайн.
 */
type MinimalTable = {
  atoms: { grouping?: { get: () => unknown[] } }
  getRowModel: () => { rows: { getCanSelect: () => boolean }[] }
}

/** Длина активной группировки (0, если фичи группировки нет). */
export const groupingLength = (table: unknown): number =>
  ((table as MinimalTable).atoms.grouping?.get() ?? []).length

/** Активна ли группировка (владеет выбором → выбор недоступен, ADR 0022). */
export const isGroupingActive = (table: unknown): boolean =>
  groupingLength(table) > 0

/** Есть ли хотя бы одна выбираемая строка (v9-замена table.getCanSomeRowsSelect). */
export const getCanSomeRowsSelect = (table: unknown): boolean =>
  (table as MinimalTable).getRowModel().rows.some(row => row.getCanSelect())

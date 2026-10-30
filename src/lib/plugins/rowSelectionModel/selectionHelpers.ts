/**
 * Общие хелперы rowSelection. Табличного `getCanSomeRowsSelect` нет — читаем
 * группировку из атома и считаем «есть ли выбираемые строки» инлайн.
 */
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import { groupKeysOf, type RowSource } from '../../core/rowSource'
import type { Row } from '../../types'

type MinimalTable = {
  atoms: { grouping?: { get: () => unknown[] } }
  getRowSource: () => RowSource<{ getCanSelect: () => boolean }>
}

/** Длина активной группировки (0, если фичи группировки нет). */
export const groupingLength = (table: unknown): number =>
  ((table as MinimalTable).atoms.grouping?.get() ?? []).length

/**
 * Активна ли клиентская группировка (владеет выбором → выбор недоступен). Серверная
 * группировка выбирает строки данных (ADR 0144, §5).
 */
export const isGroupingActive = (table: unknown): boolean =>
  groupingLength(table) > 0 && !serverRowModelReason(table)

/** Строка-группа серверной группировки: её флажок выбирает группу целиком (ADR 0148). */
export const isServerGroupRow = (row: Row<any, any>): boolean =>
  !!serverRowModelReason(row.table) &&
  groupingLength(row.table) > 0 &&
  !!(row as { getIsGrouped?: () => boolean }).getIsGrouped?.()

/** Путь групп строки при серверной группировке: у группы — её, у строки данных — родителя. */
export const groupKeysOfRow = (row: Row<any, any>): unknown[] =>
  serverRowModelReason(row.table) && groupingLength(row.table) > 0
    ? groupKeysOf(isServerGroupRow(row) ? row.id : row.parentId)
    : []

/** Флажки у вложенных строк (ADR 0162): каскад (`true`), каждая сама (`'self'`) или нет. */
export const subRowsOf = (table: unknown): boolean | 'self' =>
  (table as { options?: { rowSelectionSubRows?: boolean | 'self' } }).options
    ?.rowSelectionSubRows ?? false

/** Дерево серверной модели с каскадом: выбор строки-родителя ведёт её ветку (ADR 0162, §2). */
export const isBranchCascade = (table: unknown): boolean =>
  !!serverRowModelReason(table) &&
  groupingLength(table) === 0 &&
  subRowsOf(table) === true

/** Предки строки дерева серверной модели от корня (ADR 0162). */
export const rowPathOf = (row: Row<any, any>): readonly string[] =>
  (row.table as { getRowSource?: () => RowSource })
    .getRowSource?.()
    .ancestors?.(row.id) ?? []

/**
 * Флажок у строки: при серверной группировке — у строк данных и групп (ADR 0144, §5;
 * ADR 0148); у вложенных строк — с `subRows` (ADR 0162), а в клиентском каскаде — ещё и по
 * `getCanSelectSubRows`.
 */
export const isSelectableInList = (row: Row<any, any>): boolean => {
  if (row.depth === 0) return true
  const subRows = subRowsOf(row.table)
  if (serverRowModelReason(row.table)) {
    return groupingLength(row.table) > 0 || !!subRows
  }
  return subRows === 'self' || row.getCanSelectSubRows()
}

/** Есть ли хотя бы одна выбираемая строка (v9-замена table.getCanSomeRowsSelect). */
export const getCanSomeRowsSelect = (table: unknown): boolean => {
  const rows = (table as MinimalTable).getRowSource()
  for (let index = 0; index < rows.count(); index++) {
    if (rows.at(index)?.getCanSelect()) return true
  }
  return false
}

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

/**
 * Флажок у строки: в дереве серверной модели — у корней (ADR 0138, §14), при серверной
 * группировке — у строк данных и групп (ADR 0144, §5; ADR 0148), в клиентском дереве — по
 * `getCanSelectSubRows`.
 */
export const isSelectableInList = (row: Row<any, any>): boolean => {
  if (serverRowModelReason(row.table)) {
    return groupingLength(row.table) > 0 || row.depth === 0
  }
  return !(row.depth > 0 && !row.getCanSelectSubRows())
}

/** Есть ли хотя бы одна выбираемая строка (v9-замена table.getCanSomeRowsSelect). */
export const getCanSomeRowsSelect = (table: unknown): boolean => {
  const rows = (table as MinimalTable).getRowSource()
  for (let index = 0; index < rows.count(); index++) {
    if (rows.at(index)?.getCanSelect()) return true
  }
  return false
}

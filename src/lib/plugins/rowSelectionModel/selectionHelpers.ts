/**
 * Общие хелперы rowSelection. Табличного `getCanSomeRowsSelect` нет — читаем
 * группировку из атома и считаем «есть ли выбираемые строки» инлайн.
 */
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import type { RowSource } from '../../core/rowSource'
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

/**
 * Флажок у строки: в дереве серверной модели — у корней (ADR 0138, §14), при серверной
 * группировке — у строк данных (ADR 0144, §5), в клиентском дереве — по `getCanSelectSubRows`.
 */
export const isSelectableInList = (row: Row<any, any>): boolean => {
  if (serverRowModelReason(row.table)) {
    return groupingLength(row.table) > 0
      ? !(row as { getIsGrouped?: () => boolean }).getIsGrouped?.()
      : row.depth === 0
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

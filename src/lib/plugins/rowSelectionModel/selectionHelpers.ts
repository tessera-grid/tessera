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
 * Активна ли клиентская группировка: срез хранит строки данных, флажок группы считается по
 * её листьям (ADR 0185). Серверная группировка держит группы в срезе (ADR 0148).
 */
export const isGroupingActive = (table: unknown): boolean =>
  groupingLength(table) > 0 && !serverRowModelReason(table)

/** Строка-группа клиентской группировки: своего места в срезе у неё нет (ADR 0185). */
export const isClientGroupRow = (row: Row<any, any>): boolean =>
  !!(row as { getIsGrouped?: () => boolean }).getIsGrouped?.() &&
  isGroupingActive(row.table)

export interface ClientGroupState {
  /** Выбраны все, часть или ни один из потомков, доступных для выбора. */
  state: 'all' | 'some' | 'none'
  /** Потомки группы, прошедшие фильтр и доступные для выбора. */
  rows: readonly Row<any, any>[]
}

/** Группы проходятся один раз на значение среза и строку модели: флажки читают их часто. */
const groupStates = new WeakMap<object, WeakMap<object, ClientGroupState>>()
const NO_SELECTION = {}

/** Флажок группы — по её листьям, прошедшим фильтр (ADR 0185, §2). */
export const clientGroupStateOf = (row: Row<any, any>): ClientGroupState => {
  const { atoms } = row.table as unknown as {
    atoms: { rowSelection?: { get: () => object | undefined } }
  }
  const selection = (atoms.rowSelection?.get() ?? NO_SELECTION) as Record<
    string,
    boolean
  >
  let states = groupStates.get(selection)
  if (!states) {
    states = new WeakMap()
    groupStates.set(selection, states)
  }
  const known = states.get(row)
  if (known) return known
  const rows = row
    .getLeafRows()
    .filter(leaf => !isClientGroupRow(leaf) && leaf.getCanSelect())
  const chosen = rows.filter(leaf => selection[leaf.id]).length
  const result: ClientGroupState = {
    rows,
    state: chosen === 0 ? 'none' : chosen === rows.length ? 'all' : 'some',
  }
  states.set(row, result)
  return result
}

/** Строка-группа серверной группировки: её флажок выбирает группу целиком (ADR 0148). */
export const isServerGroupRow = (row: Row<any, any>): boolean =>
  !!serverRowModelReason(row.table) &&
  groupingLength(row.table) > 0 &&
  !!(row as { getIsGrouped?: () => boolean }).getIsGrouped?.()

/** Значения группировки от корня до клиентской строки-группы. */
const clientGroupKeysOf = (row: Row<any, any>): unknown[] => {
  const keys: unknown[] = []
  for (
    let group: Row<any, any> | undefined = row;
    group;
    group = group.getParentRow()
  ) {
    keys.unshift((group as { groupingValue?: unknown }).groupingValue)
  }
  return keys
}

/** Путь групп строки: у группы — её, при серверной группировке у строки данных — родителя. */
export const groupKeysOfRow = (row: Row<any, any>): unknown[] => {
  if (isClientGroupRow(row)) return clientGroupKeysOf(row)
  return serverRowModelReason(row.table) && groupingLength(row.table) > 0
    ? groupKeysOf(isServerGroupRow(row) ? row.id : row.parentId)
    : []
}

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
 * ADR 0148), при клиентской — у строк данных, а у групп кроме `subRows: 'self'` (ADR 0185, §2); у
 * вложенных строк — с `subRows` (ADR 0162), а в клиентском каскаде — ещё и по
 * `getCanSelectSubRows`.
 */
export const isSelectableInList = (row: Row<any, any>): boolean => {
  if (isGroupingActive(row.table)) {
    return !isClientGroupRow(row) || subRowsOf(row.table) !== 'self'
  }
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

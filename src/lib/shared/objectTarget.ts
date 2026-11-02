/**
 * Цель записи журнала отказов и пульта черновиков (ADR 0177, §7; ADR 0178, §8): подпись и
 * переход к ней. Номер строки — по текущему порядку; место вытесненной строки серверной модели
 * помнит сама модель (ADR 0138).
 */
import type { FailureTarget } from '../core/failures/failuresFeature'
import { type FlashOutcome, flashOutcome } from '../core/flashes/flashFeature'
import type { FlashTarget } from '../core/highlights/highlightFeature'
import type { TableLabels } from '../core/localization'

interface LogTable {
  getRowSource: () => { indexOf: (id: string) => number }
  getAllLeafColumns: () => { id: string; columnDef?: { header?: unknown } }[]
  scrollToRow: (
    rowId: string,
    options?: {
      align?: 'center'
      columnId?: string
      expandParents?: boolean
    },
  ) => Promise<boolean>
}

const headerOf = (table: unknown, columnId: string) => {
  const header = (table as LogTable)
    .getAllLeafColumns()
    .find(column => column.id === columnId)?.columnDef?.header
  return typeof header === 'string' ? header : columnId
}

/** Номер строки, начиная с 1, или `undefined`, когда места строки нет. */
const rowNumberOf = (table: unknown, rowId: string) => {
  const index = (table as LogTable).getRowSource().indexOf(rowId)
  return index >= 0 ? index + 1 : undefined
}

/** Подпись цели записи. */
export const objectTargetText = (
  table: unknown,
  target: FailureTarget,
  labels: TableLabels,
): string => {
  if ('cell' in target) {
    const [rowId, columnId] = target.cell
    const row = rowNumberOf(table, rowId)
    const column = headerOf(table, columnId)
    return row === undefined ? column : labels.failureTargetCell(column, row)
  }
  if ('row' in target) {
    const row = rowNumberOf(table, target.row)
    return row === undefined ? '' : labels.failureTargetRow(row)
  }
  if ('column' in target) return headerOf(table, target.column)
  // У процесса подпись записи и есть его имя.
  if ('process' in target) return ''
  return labels.failureTargetTable
}

/** К цели можно перейти: ячейка, строка или колонка. */
export const canShowTarget = (target: FailureTarget) =>
  'cell' in target || 'row' in target || 'column' in target

/** Прокрутить к цели записи и вспыхнуть её (JR3). */
export const showTarget = async (
  table: unknown,
  target: FailureTarget,
  outcome: FlashOutcome = 'reverted',
) => {
  const t = table as LogTable
  if ('cell' in target || 'row' in target) {
    const rowId = 'cell' in target ? target.cell[0] : target.row
    // По центру: у краёв цель закрыли бы поповер журнала и липкие шапка и футер.
    await t.scrollToRow(rowId, {
      align: 'center',
      expandParents: true,
      ...('cell' in target ? { columnId: target.cell[1] } : {}),
    })
  }
  flashOutcome(table, target as FlashTarget, outcome)
}

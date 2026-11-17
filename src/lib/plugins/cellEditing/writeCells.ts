/**
 * Исполнитель записи в ячейки (ADR 0219, §1, §6): вставка, очистка, вырезание, массовая правка
 * и `table.writeCells`. Нередактируемые ячейки пропускаются, текст разбирается по типу колонки,
 * значение проверяет `validate`; годные изменения — один пакет: черновики при сохранении по
 * кнопке, иначе `onCommitEdits` или `onCellEdit` по ячейке. Работа идёт кусками с уступкой
 * главного потока (§10).
 */
import { announceLabel, announcerLabels } from '../../core/announcer'
import type {
  CellWrite,
  CellWriteReport,
  CellWriter,
  CellWriterOptions,
} from '../../core/cellWrites'
import type { CellComponentProps } from '../../core/createSlots'
import { isNumericBase } from '../../core/dataTypeFormat'
import { reportAction } from '../../core/debugActions'
import { readPluginHooks } from '../../core/definePlugin'
import {
  type FailureReport,
  reportFailures,
  resolveCellFailures,
} from '../../core/failures/failuresFeature'
import { actionLabelOf } from '../../core/actions'
import { ENGLISH_LABELS } from '../../core/localization'
import { logWarn } from '../../util/logger'
import { timeSlicer } from '../../util/timeSlice'
import { inferDataType } from './columnDataType'
import { columnOf, editTextOf, parseEditText } from './editValue'
import { cellEditingLabels } from './labels'
import { isDeletedRow, writeDraftRows } from './rowDrafts'
import { checkWriteLimit } from './writeLimit'
import {
  cellKey,
  commitCellPackage,
  nextAttempt,
  isCellPending,
  isEditingCell,
  type PackageCell,
  readEditSession,
  shownValueOf,
  storeCellDrafts,
  submitCells,
  writeActionOf,
} from './session'
import type { CellEditingHooks, SubmittedCell } from './types'

interface WriteRow {
  id: string
  original: unknown
  groupingColumnId?: string
  getIsGrouped?: () => boolean
  getValue: (columnId: string) => unknown
  getAllCellsByColumnId: () => Record<
    string,
    { getContext: () => unknown } | undefined
  >
}

interface WriteColumn {
  accessorFn?: unknown
  getIsActionsColumn: () => boolean
}

interface WriteTable {
  getRowSource: () => { byId: (id: string) => WriteRow | undefined }
  getColumn: (id: string) => WriteColumn | undefined
}

const ID = 'cellEditing'

/** Сверх стольких ячеек без `onCommitEdits` — подсказка в разработке (ADR 0219, WR12). */
const PER_CELL_HINT = 100

const hooksOf = (table: unknown) =>
  readPluginHooks<Partial<CellEditingHooks>>(table as never, ID)

/** Строка-группа клиентской или серверной группировки: в неё не пишут. */
export const isGroupRow = (row: {
  groupingColumnId?: string
  getIsGrouped?: () => boolean
}) => row.groupingColumnId !== undefined || row.getIsGrouped?.() === true

/**
 * Контекст ячейки, в которую можно записать: не служебная колонка с доступом к значению, не
 * строка-группа и не удалённая строка, не ждёт сохранения и не в открытой правке, `canEditCell`.
 */
const writableContext = (
  table: unknown,
  row: WriteRow | undefined,
  columnId: string,
  hooks: Partial<CellEditingHooks>,
): CellComponentProps | undefined => {
  if (!row || isGroupRow(row)) return undefined
  const column = (table as WriteTable).getColumn(columnId)
  if (!column || column.getIsActionsColumn() || !column.accessorFn)
    return undefined
  if (isDeletedRow(table, row.id) || isCellPending(table, row.id, columnId))
    return undefined
  if (isEditingCell(readEditSession(table), row.id, columnId)) return undefined
  const ctx = row.getAllCellsByColumnId()[columnId]?.getContext() as
    CellComponentProps | undefined
  if (!ctx) return undefined
  if (hooks.canEditCell && !hooks.canEditCell(ctx)) return undefined
  return ctx
}

const canWrite = (table: unknown, rowId: string, columnId: string) =>
  !!writableContext(
    table,
    (table as WriteTable).getRowSource().byId(rowId),
    columnId,
    hooksOf(table),
  )

let operations = 0

/** Причина, по которой текст не записан: не разобрался по типу или не прошёл `validate`. */
const invalidReason = (
  table: unknown,
  columnId: string,
  current: unknown,
  text: string,
  message: string | undefined,
) => {
  const labels = cellEditingLabels(announcerLabels(table) ?? ENGLISH_LABELS)
  const base =
    columnOf(table, columnId)?.getDataType()?.base ?? inferDataType(current)
  const reason =
    message ??
    (isNumericBase(base) ? labels.editInvalidNumber : labels.editInvalidValue)
  return labels.writeInvalidReason(reason, text)
}

const write = async (
  table: unknown,
  changes: readonly CellWrite[],
  { source, rows: fetched }: CellWriterOptions,
): Promise<CellWriteReport> => {
  const id = `write-${++operations}`
  const hooks = hooksOf(table)
  const action = writeActionOf(source)
  const rows = (table as WriteTable).getRowSource()
  const cells: PackageCell[] = []
  const invalid: FailureReport[] = []
  let skipped = 0
  // Пакет с ответом сервера: ожидание и его отметки — словарями, собранными кусками (§10).
  const packaged = hooks.saveMode !== 'manual' && !!hooks.onCommitEdits
  const attempt = packaged ? nextAttempt() : 0
  const pending = new Map<string, SubmittedCell>()
  const waves = new Map<string, boolean>()
  const booleans = new Map<string, boolean>()
  const isBoolean = (columnId: string) => {
    let known = booleans.get(columnId)
    if (known === undefined) {
      known = columnOf(table, columnId)?.getDataType()?.base === 'boolean'
      booleans.set(columnId, known)
    }
    return known
  }
  const slice = timeSlicer()
  for (let i = 0; i < changes.length; i++) {
    if (i % 256 === 255) await slice()
    const change = changes[i]!
    const row =
      rows.byId(change.rowId) ??
      (fetched?.get(change.rowId) as WriteRow | undefined)
    const ctx = writableContext(table, row, change.columnId, hooks)
    if (!ctx || !row) {
      skipped++
      continue
    }
    const current = row.getValue(change.columnId)
    let value: unknown
    let text: string
    if ('value' in change) {
      value = change.value
      text = editTextOf(table, change.columnId, value)
    } else {
      text = change.text
      const parsed = parseEditText(table, change.columnId, text, {
        original: row.original,
        current,
      })
      if (!parsed) {
        invalid.push({
          action,
          batch: id,
          target: { cell: [row.id, change.columnId] },
          reason: invalidReason(
            table,
            change.columnId,
            current,
            text,
            undefined,
          ),
        })
        continue
      }
      value = parsed.value
    }
    const message = hooks.validate?.(value, ctx, text)
    if (message) {
      invalid.push({
        action,
        batch: id,
        target: { cell: [row.id, change.columnId] },
        reason: invalidReason(table, change.columnId, current, text, message),
      })
      continue
    }
    cells.push({
      rowId: row.id,
      columnId: change.columnId,
      value,
      text,
      original: current,
    })
    if (packaged) {
      const key = cellKey(row.id, change.columnId)
      pending.set(key, {
        rowId: row.id,
        columnId: change.columnId,
        draft: value,
        text,
        original: current,
        status: 'pending',
        attempt,
      })
      // Булево ждёт своим флажком, без волны (ADR 0176).
      waves.set(key, !isBoolean(change.columnId))
    }
  }

  // Пределы операции (ADR 0223): сверх них ничего не записано.
  const verdict = await checkWriteLimit(
    table,
    cells,
    source,
    hooks.saveMode === 'manual',
  )
  if (verdict !== 'ok')
    return { id, written: 0, skipped, invalid: invalid.length, ...verdict }

  // Новый итог ячейки снимает её прежний отказ; невалидный текст — свой отказ.
  let written: ReadonlySet<string> | ReadonlyMap<string, unknown> = pending
  resolveCellFailures(table, (rowId, columnId) => {
    if (!packaged && written === pending)
      written = new Set(cells.map(cell => cellKey(cell.rowId, cell.columnId)))
    return written.has(cellKey(rowId, columnId))
  })
  reportFailures(table, invalid)
  const report: CellWriteReport = {
    id,
    written: cells.length,
    skipped,
    invalid: invalid.length,
  }
  reportAction(table, {
    ...action,
    detail: { ...report, source },
    source: source === 'api' ? 'api' : 'auto',
  })
  announceLabel(table, all => {
    const labels = cellEditingLabels(all)
    const name = actionLabelOf(table, action, all)
    return [
      labels.announceWritten(name, report.written),
      report.skipped > 0 ? labels.announceWriteSkipped(report.skipped) : '',
      report.invalid > 0 ? labels.announceWriteInvalid(report.invalid) : '',
    ]
      .filter(Boolean)
      .join(', ')
  })

  if (cells.length === 0) return report
  if (hooks.saveMode === 'manual') {
    storeCellDrafts(table, cells, { id, source })
    return report
  }
  if (packaged) {
    commitCellPackage(table, { id, source, cells, pending, waves })
    return report
  }
  if (cells.length > PER_CELL_HINT)
    logWarn(
      table as never,
      `cellEditing: ${cells.length} cells are saved one by one through onCellEdit — set onCommitEdits to save an operation in one call`,
      'cellEditing:perCellWrite',
    )
  submitCells(table, cells, { id, source })
  return report
}

/** Исполнитель записи для канала ядра (ADR 0219, §1). */
export const cellWriter: CellWriter = {
  write,
  canWrite,
  valueOf: shownValueOf,
  writeRows: writeDraftRows,
}

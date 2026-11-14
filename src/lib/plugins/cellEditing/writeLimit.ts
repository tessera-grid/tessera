/**
 * Пределы операции записи (ADR 0223): больше `confirm` ячеек — вопрос на месте плашки ожидания,
 * больше `max` — отказ без записи. В режиме «Применить» считается число черновиков после записи.
 * Запись из кода не спрашивает, шаг истории — тоже: оба знают только отказ.
 */
import { announceLabel, announcerLabels } from '../../core/announcer'
import { registerPending } from '../../core/cancellation'
import { type CellWriteSource, writeLimitsOf } from '../../core/cellWrites'
import { readDrafts } from '../../core/drafts/drafts'
import { ENGLISH_LABELS } from '../../core/localization'
import { readServerAction, writeServerAction } from '../../core/serverActions'
import { logWarn } from '../../util/logger'
import { sameEditValue } from './editValue'
import { ROW_DELETE_DRAFT, ROW_INSERT_DRAFT } from './rowDrafts'
import { CELL_VALUE_DRAFT, cellKey } from './session'

interface LimitCell {
  rowId: string
  columnId: string
  value: unknown
  /** Значение в данных. */
  original: unknown
}

/** Жесты человека спрашивают; код и шаги истории — нет (ADR 0223, §4–§5). */
const asks = (source: CellWriteSource) =>
  source !== 'api' && source !== 'undo' && source !== 'redo'

/** Черновиков ячеек и строк до записи и после неё (LM4): ячейка с черновиком считается раз. */
const draftsAround = (table: unknown, cells: readonly LimitCell[]) => {
  const drafted = new Set<string>()
  let rows = 0
  for (const draft of readDrafts(table)) {
    if (draft.kind === CELL_VALUE_DRAFT && 'cell' in draft.target)
      drafted.add(cellKey(draft.target.cell[0], draft.target.cell[1]))
    else if (draft.kind === ROW_INSERT_DRAFT || draft.kind === ROW_DELETE_DRAFT)
      rows++
  }
  const before = drafted.size + rows
  let after = before
  for (const cell of cells) {
    const has = drafted.has(cellKey(cell.rowId, cell.columnId))
    // Значение из данных снимает черновик, иное — кладёт.
    const clears = sameEditValue(
      table,
      cell.columnId,
      cell.value,
      cell.original,
    )
    if (has && clears) after--
    else if (!has && !clears) after++
  }
  return { before, after }
}

/** Вопрос предела на месте плашки ожидания; крестик, Escape и `cancelPending` — «нет». */
const ask = (table: unknown, count: number) =>
  new Promise<boolean>(resolve => {
    let done = false
    const finish = (yes: boolean) => {
      if (done) return
      done = true
      unregister()
      writeServerAction(table, ({ loadingRows: _rows, ...status }) => ({
        ...status,
        loadingRows: undefined,
      }))
      resolve(yes)
    }
    const unregister = registerPending(table, {
      kind: 'write',
      id: 'write',
      cancel: () => {
        announceLabel(table, all =>
          all.announceActionCancelled(all.actionWrite),
        )
        finish(false)
      },
    })
    writeServerAction(table, status => ({
      ...status,
      loadingRows: {
        kind: 'write',
        since: performance.now(),
        confirm: { count, limit: true, accept: () => finish(true) },
      },
    }))
  })

/** Отказ предела: плашка отказа и объявление с числом ячеек и пределом. */
const refuse = (table: unknown, count: number, max: number) => {
  const labels = announcerLabels(table) ?? ENGLISH_LABELS
  const message = labels.writeOverLimit(count, max)
  writeServerAction(table, status => ({
    ...status,
    failed: {
      kind: 'write',
      attempt: (readServerAction(table).failed?.attempt ?? 0) + 1,
      // Повтор той же операции снова упрётся в предел: плашка без повтора.
      error: new Error(message),
    },
  }))
  announceLabel(table, all => all.writeOverLimit(count, max))
}

/** Итог проверки: `'ok'` — писать, иначе ничего не записано. */
export type LimitVerdict =
  'ok' | { limited: { count: number; max: number } } | { declined: true }

/** Проверить операцию пределами таблицы; жест сверх `confirm` ждёт ответа на вопрос. */
export const checkWriteLimit = async (
  table: unknown,
  cells: readonly LimitCell[],
  source: CellWriteSource,
  manual: boolean,
): Promise<LimitVerdict> => {
  const { confirm, max } = writeLimitsOf(table)
  if (cells.length === 0 || (confirm === Infinity && max === Infinity))
    return 'ok'
  const drafts = manual ? draftsAround(table, cells) : undefined
  const size = drafts ? drafts.after : cells.length
  if (size > max && (!drafts || drafts.after > drafts.before)) {
    if (source === 'api')
      logWarn(
        table as never,
        `cellEditing: writeCells of ${cells.length} cells is refused — more than writeLimits.max (${max}); raise writeLimits to allow it`,
        'cellEditing:writeLimit',
      )
    else refuse(table, cells.length, max)
    return { limited: { count: cells.length, max } }
  }
  // Черновики спрашивают, когда запись переводит их через порог, а не на каждую следующую.
  const crosses = drafts
    ? drafts.before <= confirm && drafts.after > confirm
    : size > confirm
  if (crosses && asks(source) && !(await ask(table, cells.length)))
    return { declined: true }
  return 'ok'
}

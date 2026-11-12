/**
 * Ожидание операции записи выделения и строки её цели (ADR 0219, §2, §7). Ожидание — плашка с
 * отменой на месте ожидания таблицы: хук вставки, вопрос перед вставкой, догрузка строк. Цели в
 * незагруженных строках серверной модели догружаются путём копирования (ADR 0146): `loadRange`
 * мимо кэша окна, кусками, не больше четырёх запросов сразу; строк больше
 * `cellSelectionMaxCopyRows` — отказ с причиной.
 */
import { announceLabel, announcerLabels } from '../../core/announcer'
import {
  type CancelSource,
  cancelPending,
  registerPending,
} from '../../core/cancellation'
import { reportAction } from '../../core/debugActions'
import { rowDraftMarkOf } from '../../core/drafts/drafts'
import { ENGLISH_LABELS, type TableLabels } from '../../core/localization'
import { rowSourceOf } from '../../core/rowSource'
import { readServerAction, writeServerAction } from '../../core/serverActions'
import { parseClipboardText } from './clipboard'
import { DEFAULT_MAX_COPY_ROWS } from './copy'
import { cellSelectionLabels } from './labels'

export interface TargetRow {
  id: string
  groupingColumnId?: string
  getIsGrouped?: () => boolean
}

/** Строка, которая места цели не занимает: группа и удалённая до сохранения. */
export const isPassedRow = (table: unknown, row: TargetRow) =>
  row.groupingColumnId !== undefined ||
  row.getIsGrouped?.() === true ||
  rowDraftMarkOf(table, row.id) === 'deleted'

/** Операция выделения, которая пишет в ячейки и может ждать. */
export type OperationKind = 'paste' | 'fill'

const operationName = (kind: OperationKind, labels: TableLabels) =>
  kind === 'paste' ? labels.actionPaste : labels.actionFill

/** Ожидание операции: плашка с отменой, вопрос `confirm()` и ответ промиса. */
export interface OperationWait {
  signal: AbortSignal
  /** Вопрос «Вставить?» на месте плашки ожидания; отмена — `false`. */
  confirm: () => Promise<boolean>
  /** Дождаться промиса; отмена — `undefined`, отказ — `undefined`. */
  wait: <T>(answer: PromiseLike<T>) => Promise<T | undefined>
  /** Снять ожидание: ответ пришёл или ждать было нечего. */
  close: () => void
}

interface SelectionTable {
  atoms: {
    cellSelection?: {
      subscribe: (listener: () => void) => { unsubscribe: () => void }
    }
  }
}

/**
 * Завести ожидание операции. Отмена — крестик вопроса, «Отмена» плашки, Escape,
 * `table.cancelPending`, новая операция того же вида; с `watchSelection` — ещё и смена
 * выделения: новая выборка серверной модели его сбрасывает (ADR 0146, XC9). Отмена прерывает
 * `signal` и объявляется.
 */
export const startOperationWait = (
  table: unknown,
  kind: OperationKind,
  { text = '', watchSelection = false } = {},
): OperationWait => {
  // В вопросе — одно значение буфера или число его значений (WR42).
  const cells = text ? parseClipboardText(text).flat() : []
  const question = {
    count: cells.length,
    ...(cells.length === 1 ? { value: cells[0]! } : {}),
  }
  const controller = new AbortController()
  let finished = false
  let settle: ((value: unknown) => void) | undefined
  const writeRows = (accept?: () => void) =>
    writeServerAction(table, status => ({
      ...status,
      loadingRows: {
        kind,
        since: status.loadingRows?.since ?? performance.now(),
        ...(accept ? { confirm: { ...question, accept } } : {}),
      },
    }))
  let watch: { unsubscribe: () => void } | undefined
  const close = () => {
    if (finished) return
    finished = true
    watch?.unsubscribe()
    unregister()
    writeServerAction(table, ({ loadingRows: _rows, ...status }) => ({
      ...status,
      loadingRows: undefined,
    }))
  }
  const cancel = (cancelSource: CancelSource | 'auto') => {
    if (finished) return
    controller.abort()
    reportAction(table, {
      plugin: 'cellSelection',
      action: 'cancel',
      detail: { action: kind },
      source: cancelSource,
    })
    announceLabel(table, all =>
      all.announceActionCancelled(operationName(kind, all)),
    )
    close()
    settle?.(undefined)
  }
  const unregister = registerPending(table, { kind, id: kind, cancel })
  writeRows()
  if (watchSelection)
    watch = (table as SelectionTable).atoms.cellSelection?.subscribe(() =>
      cancel('auto'),
    )
  return {
    signal: controller.signal,
    confirm: () =>
      new Promise<boolean>(resolve => {
        if (controller.signal.aborted || finished) {
          resolve(false)
          return
        }
        const accept = () => {
          // Ответ «Вставить»: вопрос уходит, ожидание — прежнее.
          if (!finished) writeRows()
          resolve(true)
        }
        controller.signal.addEventListener('abort', () => resolve(false), {
          once: true,
        })
        writeRows(accept)
      }),
    wait: <T>(answer: PromiseLike<T>) =>
      new Promise<T | undefined>(resolve => {
        if (finished) {
          resolve(undefined)
          return
        }
        settle = resolve as (value: unknown) => void
        answer.then(
          value => {
            if (finished) return
            close()
            resolve(value)
          },
          () => {
            if (finished) return
            close()
            resolve(undefined)
          },
        )
      }),
    close,
  }
}

/** Отказ операции — плашка с причиной и повтором (ADR 0116). */
export const refuseOperation = (
  table: unknown,
  kind: OperationKind,
  error: unknown,
  retry: () => void,
) =>
  writeServerAction(table, status => ({
    ...status,
    failed: {
      kind,
      attempt: (readServerAction(table).failed?.attempt ?? 0) + 1,
      error,
      retry,
    },
  }))

/**
 * Отрезок цели в списке строк: от места `from` — `need` строк, что занимают место цели, или все
 * строки до места `last`.
 */
export type RowSpan = { from: number } & (
  { need: number; last?: undefined } | { last: number; need?: undefined }
)

interface Source {
  count: () => number
  at: (index: number) => TargetRow | undefined
  keyByIndex?: boolean
  loadRange?: (
    first: number,
    last: number,
    signal: AbortSignal,
  ) => Promise<readonly (TargetRow | undefined)[]>
}

/** Строк, которые займёт отрезок: предел операции считает их, а не ячейки. */
const spanRows = (span: RowSpan) =>
  span.need ?? Math.max(0, span.last - span.from + 1)

/** Все строки отрезка уже есть у грида. */
const spanLoaded = (table: unknown, source: Source, span: RowSpan) => {
  const count = source.count()
  if (span.need === undefined) {
    for (let r = span.from; r <= Math.min(span.last, count - 1); r++)
      if (!source.at(r)) return false
    return true
  }
  let taken = 0
  for (let r = span.from; r < count && taken < span.need; r++) {
    const row = source.at(r)
    if (!row) return false
    if (!isPassedRow(table, row)) taken++
  }
  return true
}

/**
 * Догрузить отрезок: кусками по числу недостающих строк — строки-группы и удалённые место не
 * занимают, и за ними нужны новые; список кончился — сколько есть.
 */
const loadSpan = async (
  table: unknown,
  source: Source,
  span: RowSpan,
  signal: AbortSignal,
  into: Map<number, TargetRow>,
) => {
  const count = source.count()
  if (span.need === undefined) {
    const last = Math.min(span.last, count - 1)
    if (last < span.from) return
    const rows = await source.loadRange!(span.from, last, signal)
    rows.forEach((row, k) => row && into.set(span.from + k, row))
    return
  }
  let taken = 0
  let end = span.from - 1
  while (taken < span.need && end < count - 1) {
    const first = end + 1
    end = Math.min(count - 1, end + (span.need - taken))
    const rows = await source.loadRange!(first, end, signal)
    signal.throwIfAborted()
    let any = false
    rows.forEach((row, k) => {
      if (!row) return
      any = true
      into.set(first + k, row)
      if (!isPassedRow(table, row)) taken++
    })
    if (!any) return
  }
}

/** Строка цели по месту в списке; `rows` — догруженные мимо кэша окна, по id. */
export interface TargetRows {
  at: (index: number) => TargetRow | undefined
  rows?: ReadonlyMap<string, unknown>
}

/**
 * Строки цели операции (ADR 0219, §7, WR28): всё есть у грида — `run` сразу; иначе ожидание с
 * отменой, догрузка и `run` после неё. Смена выделения до записи отменяет операцию с
 * объявлением; отказ блока и предел строк — плашка с причиной и повтором. Ответ `run` — итог;
 * отмена и отказ — `undefined`.
 */
export const withTargetRows = async <T>(
  table: unknown,
  kind: OperationKind,
  spans: readonly RowSpan[],
  run: (rows: TargetRows) => T | Promise<T>,
  retry: () => void,
): Promise<T | undefined> => {
  const source = rowSourceOf<TargetRow>(table) as unknown as Source
  if (
    !source.keyByIndex ||
    !source.loadRange ||
    spans.every(span => spanLoaded(table, source, span))
  )
    return run({ at: index => source.at(index) })
  const rows = spans.reduce((sum, span) => sum + spanRows(span), 0)
  const max =
    (table as { options: { cellSelectionMaxCopyRows?: number } }).options
      .cellSelectionMaxCopyRows ?? DEFAULT_MAX_COPY_ROWS
  if (rows > max) {
    const labels = announcerLabels(table) ?? ENGLISH_LABELS
    refuseOperation(
      table,
      kind,
      new Error(cellSelectionLabels(labels).writeTooManyRows(rows, max)),
      retry,
    )
    return undefined
  }
  // Новая операция того же вида главнее ждущей.
  cancelPending(table, { kind })
  const wait = startOperationWait(table, kind, { watchSelection: true })
  const loaded = new Map<number, TargetRow>()
  try {
    for (const span of spans)
      await loadSpan(table, source, span, wait.signal, loaded)
  } catch (error) {
    if (wait.signal.aborted) return undefined
    wait.close()
    refuseOperation(table, kind, error, retry)
    return undefined
  }
  if (wait.signal.aborted) return undefined
  wait.close()
  const byId = new Map<string, unknown>()
  for (const row of loaded.values()) byId.set(row.id, row)
  return run({
    at: index => loaded.get(index) ?? source.at(index),
    rows: byId,
  })
}

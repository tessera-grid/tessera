/**
 * Вставка из буфера в выделение (ADR 0219, §2): буфер раскладывается по видимым строкам и
 * колонкам от выделения и уходит в канал записи ядра; пишет плагин правки. Свой формат — со
 * значениями в типе колонки, иначе текст разбирается по типу.
 */
import { announceLabel } from '../../core/announcer'
import { cancelPending } from '../../core/cancellation'
import { type CellWrite, cellWriterOf, writeCells } from '../../core/cellWrites'
import { reportAction } from '../../core/debugActions'
import { ENGLISH_LABELS } from '../../core/localization'
import { announcerLabels } from '../../core/announcer'
import { rowSourceOf } from '../../core/rowSource'
import { readServerAction, writeServerAction } from '../../core/serverActions'
import { isThenable } from '../../util/thenable'
import { timeSlicer } from '../../util/timeSlice'
import {
  clipboardRows,
  TESSERA_FORMAT,
  tesseraFormatToValues,
} from './clipboard'
import { cellSelectionLabels } from './labels'
import { isPassedRow, startOperationWait, withTargetRows } from './targetRows'
import type { ParseClipboard } from './types'

interface Bounds {
  minRowIndex: number
  maxRowIndex: number
  minColumnIndex: number
  maxColumnIndex: number
}

interface PasteRow {
  id: string
  groupingColumnId?: string
  getIsGrouped?: () => boolean
}

interface PasteTable {
  options: {
    cellSelectionPaste?: boolean
    cellSelectionParseClipboard?: ParseClipboard
  }
  getCellSelectionBounds?: () => Bounds[]
  getCellSelectionColumnIndexes?: () => Record<string, number>
  getColumn: (id: string) => { getIsActionsColumn: () => boolean } | undefined
  setCellSelection?: (updater: (old: unknown[]) => unknown[]) => void
}

/** Буфер одной вставки: значения своего формата или текст для разбора. */
type Clip =
  { kind: 'values'; rows: unknown[][] } | { kind: 'text'; rows: string[][] }

/** Вставка включена: интерфейс выделения, аргумент `paste` и исполнитель записи. */
export const canPaste = (table: unknown) => {
  const t = table as PasteTable
  return t.options.cellSelectionPaste === true && !!cellWriterOf(table)
}

export const columnOrderOf = (t: PasteTable): string[] => {
  const ids: string[] = []
  for (const [id, index] of Object.entries(
    t.getCellSelectionColumnIndexes?.() ?? {},
  ))
    ids[index] = id
  return ids
}

interface Target {
  /** Строки целей по порядку: id и место в списке. */
  rows: { id: string; index: number }[]
  columns: string[]
  /** Строк буфера, которые не вошли: конец списка. */
  rowsCut: number
  /** Высота и ширина записываемого блока — буфер или его повтор. */
  height: number
  width: number
}

/**
 * Размер записываемого блока (WR6): от одной ячейки — размер буфера; кратно — повтор; иначе один
 * раз от левого верхнего угла.
 */
const sizeOf = (bound: Bounds, clipHeight: number, clipWidth: number) => {
  const boundHeight = bound.maxRowIndex - bound.minRowIndex + 1
  const boundWidth = bound.maxColumnIndex - bound.minColumnIndex + 1
  const single = boundHeight === 1 && boundWidth === 1
  const tiles =
    !single && boundHeight % clipHeight === 0 && boundWidth % clipWidth === 0
  return {
    height: tiles ? boundHeight : clipHeight,
    width: tiles ? boundWidth : clipWidth,
  }
}

/**
 * Цели вставки от прямоугольника (WR8, WR9): служебные колонки, строки-группы и удалённые строки
 * места не занимают; список кончился — остаток буфера не вставляется.
 */
const targetOf = (
  table: unknown,
  bound: Bounds,
  columns: readonly string[],
  { height, width }: { height: number; width: number },
  rowAt: (index: number) => PasteRow | undefined,
): Target => {
  const t = table as PasteTable
  const count = rowSourceOf(table).count()

  const targetColumns: string[] = []
  for (
    let c = bound.minColumnIndex;
    c < columns.length && targetColumns.length < width;
    c++
  ) {
    const id = columns[c]
    if (id && !t.getColumn(id)?.getIsActionsColumn()) targetColumns.push(id)
  }

  const rows: { id: string; index: number }[] = []
  for (let r = bound.minRowIndex; r < count && rows.length < height; r++) {
    const row = rowAt(r)
    if (!row) break
    if (isPassedRow(table, row)) continue
    rows.push({ id: row.id, index: r })
  }
  return {
    rows,
    columns: targetColumns,
    rowsCut: Math.max(0, height - rows.length),
    height,
    width,
  }
}

/**
 * Изменения ячеек цели: буфер по кругу, если цель — его повтор; короткая строка — пусто.
 * Кусками с уступкой потока: буфер бывает в сотни тысяч ячеек (ADR 0219, §10).
 */
const changesOf = async (
  target: Target,
  clip: Clip,
  clipWidth: number,
  changes: CellWrite[],
) => {
  const slice = timeSlicer()
  for (let r = 0; r < target.rows.length; r++) {
    if (r % 256 === 255) await slice()
    const row = target.rows[r]!
    const source = clip.rows[r % clip.rows.length]!
    target.columns.forEach((columnId, c) => {
      const item = source[c % clipWidth]
      if (clip.kind === 'values')
        changes.push({ rowId: row.id, columnId, value: item ?? null })
      else changes.push({ rowId: row.id, columnId, text: String(item ?? '') })
    })
  }
}

/** Разобрать текст буфера кусками. */
const parseSliced = async (text: string) => {
  const slice = timeSlicer()
  const rows: string[][] = []
  for (const row of clipboardRows(text)) {
    rows.push(row)
    if (rows.length % 256 === 0) await slice()
  }
  return rows
}

/** Выделение — записанный прямоугольник, опорная ячейка — его левый верхний угол (WR6). */
const selectTarget = (table: unknown, target: Target) => {
  const t = table as PasteTable
  const first = target.rows[0]
  const last = target.rows.at(-1)
  const left = target.columns[0]
  const right = target.columns.at(-1)
  if (!first || !last || !left || !right) return
  const byIndex = rowSourceOf(table).keyByIndex === true
  t.setCellSelection?.(() => [
    byIndex
      ? {
          anchorRowIndex: first.index,
          focusRowIndex: last.index,
          anchorColumnId: left,
          focusColumnId: right,
        }
      : {
          anchorRowId: first.id,
          focusRowId: last.id,
          anchorColumnId: left,
          focusColumnId: right,
        },
  ])
}

/** Разложить буфер по выделению и записать. */
const pasteClip = async (
  table: unknown,
  clip: Clip,
  source: 'keyboard' | 'pointer' | 'api',
) => {
  const t = table as PasteTable
  const bounds = t.getCellSelectionBounds?.() ?? []
  const height = clip.rows.length
  const width = clip.rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (bounds.length === 0 || height === 0 || width === 0) return
  const columns = columnOrderOf(t)
  // Одно значение — во все диапазоны мультивыделения, иначе — в активный (WR7).
  const single = height === 1 && width === 1
  const ranges = single ? bounds : [bounds.at(-1)!]
  const sizes = ranges.map(bound => sizeOf(bound, height, width))
  reportAction(table, {
    plugin: 'cellSelection',
    action: 'paste',
    detail: { rows: height, columns: width },
    source,
  })
  // Цели в незагруженных строках серверной модели — после догрузки (ADR 0219, §7, WR28).
  await withTargetRows(
    table,
    'paste',
    ranges.map((bound, i) => ({
      from: bound.minRowIndex,
      need: sizes[i]!.height,
    })),
    async rows => {
      const targets = ranges.map((bound, i) =>
        targetOf(table, bound, columns, sizes[i]!, rows.at),
      )
      const changes: CellWrite[] = []
      for (const target of targets)
        await changesOf(target, clip, width, changes)
      const cut = targets[0]!.rowsCut
      const pasted = writeCells(table, changes, {
        source: 'paste',
        ...(rows.rows && { rows: rows.rows }),
      })
      if (!pasted) return
      if (!single) selectTarget(table, targets[0]!)
      if (cut > 0)
        announceLabel(table, all =>
          cellSelectionLabels(all).announcePasteCut(height - cut, height),
        )
      await pasted
    },
    () => void pasteClip(table, clip, source),
  )
}

/**
 * Вставить буфер: свой формат главнее текста; хук `parseClipboard` решает сам — его ответ
 * `null` отменяет вставку.
 */
export const pasteData = async (
  table: unknown,
  data: { text: string; html: string; tessera?: string },
  source: 'keyboard' | 'pointer' | 'api',
) => {
  if (!canPaste(table)) return
  const hook = (table as PasteTable).options.cellSelectionParseClipboard
  if (hook) {
    // Новая вставка главнее ждущей: прежний вопрос и ожидание снимаются.
    cancelPending(table, { kind: 'paste' })
    const hookWait = startOperationWait(table, 'paste', { text: data.text })
    const answer = hook(
      { text: data.text, html: data.html },
      { signal: hookWait.signal, confirm: hookWait.confirm },
    )
    let rows: string[][] | null | undefined
    if (isThenable(answer)) rows = await hookWait.wait(answer)
    else {
      hookWait.close()
      rows = answer
    }
    if (!rows) return
    await pasteClip(table, { kind: 'text', rows }, source)
    return
  }
  const values = tesseraFormatToValues(data.tessera)
  if (values) {
    await pasteClip(table, { kind: 'values', rows: values }, source)
    return
  }
  if (!data.text) return
  await pasteClip(
    table,
    { kind: 'text', rows: await parseSliced(data.text) },
    source,
  )
}

/** Ввод в поле — правки, поиска в ячейке: вставка в него, а не в ячейки. */
export const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT')

/** Событие `paste` над телом (ADR 0219, WR1): поле правки и шапку не трогаем. */
export const pasteOnEvent = (event: ClipboardEvent, table: unknown) => {
  if (!canPaste(table) || !event.clipboardData || isTextField(event.target))
    return
  event.preventDefault()
  void pasteData(
    table,
    {
      text: event.clipboardData.getData('text/plain'),
      html: event.clipboardData.getData('text/html'),
      tessera: event.clipboardData.getData(TESSERA_FORMAT),
    },
    'keyboard',
  )
}

/**
 * «Вставить» из меню (WR17): асинхронный Clipboard API — браузер спросит разрешение; отказ —
 * объявление с подсказкой о Ctrl+V.
 */
export const pasteFromMenu = async (table: unknown) => {
  let text: string | undefined
  try {
    text = await navigator.clipboard.readText()
  } catch {
    text = undefined
  }
  if (text === undefined) {
    const labels = announcerLabels(table) ?? ENGLISH_LABELS
    writeServerAction(table, status => ({
      ...status,
      failed: {
        kind: 'paste',
        attempt: (readServerAction(table).failed?.attempt ?? 0) + 1,
        error: new Error(cellSelectionLabels(labels).pasteDenied),
        retry: () => void pasteFromMenu(table),
      },
    }))
    return
  }
  await pasteData(table, { text, html: '' }, 'pointer')
}

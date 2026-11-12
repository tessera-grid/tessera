/**
 * Очистка и вырезание выделения (ADR 0219, §5, WR20): Delete и Backspace пишут пустое значение
 * типа в редактируемые ячейки выделения, Ctrl/Cmd+X — копирует и очищает одной операцией.
 * Пишет плагин правки через канал записи ядра.
 */
import { canWriteCell, type CellWrite, writeCells } from '../../core/cellWrites'
import type { BodyEventTarget } from '../../core/bodyContributions'
import { reportAction } from '../../core/debugActions'
import { rowSourceOf } from '../../core/rowSource'
import { copyCellSelection } from './copy'
import { isInteractive } from './copyEvent'
import { canPaste, isTextField } from './paste'

interface Bounds {
  minRowIndex: number
  maxRowIndex: number
  minColumnIndex: number
  maxColumnIndex: number
}

interface ClearTable {
  getCellSelectionBounds?: () => Bounds[]
  getCellSelectionColumnIndexes?: () => Record<string, number>
}

/** Ячейки выделения по загруженным строкам: каждая — один раз. */
const selectedCells = function* (table: unknown) {
  const t = table as ClearTable
  const ids: string[] = []
  for (const [id, index] of Object.entries(
    t.getCellSelectionColumnIndexes?.() ?? {},
  ))
    ids[index] = id
  const source = rowSourceOf<{ id: string }>(table)
  const seen = new Set<string>()
  for (const bound of t.getCellSelectionBounds?.() ?? []) {
    for (let r = bound.minRowIndex; r <= bound.maxRowIndex; r++) {
      const row = source.at(r)
      if (!row) continue
      for (let c = bound.minColumnIndex; c <= bound.maxColumnIndex; c++) {
        const columnId = ids[c]
        if (!columnId) continue
        const key = `${row.id}\u0000${columnId}`
        if (seen.has(key)) continue
        seen.add(key)
        yield { rowId: row.id, columnId }
      }
    }
  }
}

/** Пунктам меню: в выделении есть ячейка, куда можно записать (WR17); проверка — до первой. */
export const hasWritableSelection = (table: unknown) => {
  if (!canPaste(table)) return false
  for (const cell of selectedCells(table))
    if (canWriteCell(table, cell.rowId, cell.columnId)) return true
  return false
}

/** Записать пустое значение в ячейки выделения: нередактируемые исполнитель пропустит. */
export const clearSelection = (
  table: unknown,
  source: 'clear' | 'cut',
  input: 'keyboard' | 'pointer',
) => {
  if (!canPaste(table)) return
  const changes: CellWrite[] = []
  for (const cell of selectedCells(table)) changes.push({ ...cell, text: '' })
  if (changes.length === 0) return
  reportAction(table, {
    plugin: 'cellSelection',
    action: source,
    detail: { cells: changes.length },
    source: input,
  })
  void writeCells(table, changes, { source })
}

/** Событие `cut` над телом: копия в буфер и очистка одной операцией `cut`. */
export const cutOnEvent = (
  event: ClipboardEvent,
  { table }: BodyEventTarget,
) => {
  if (!isInteractive(table) || !canPaste(table) || isTextField(event.target))
    return
  const result = copyCellSelection(table, {
    clipboardData: event.clipboardData ?? undefined,
    source: 'keyboard',
  })
  if (result !== 'copied') return
  event.preventDefault()
  clearSelection(table, 'cut', 'keyboard')
}

/** Вырезать из меню: копия асинхронным Clipboard API и очистка. */
export const cutFromMenu = (table: unknown) => {
  if (!canPaste(table)) return
  if (copyCellSelection(table, { source: 'pointer' }) !== 'copied') return
  clearSelection(table, 'cut', 'pointer')
}

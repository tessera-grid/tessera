/**
 * Ctrl/Cmd+Enter в поле правки (ADR 0219, §5, WR18): набранное уходит во все ячейки активного
 * диапазона выделения одним пакетом `bulk`. Нередактируемые ячейки, строки-группы и удалённые
 * строки пропускает исполнитель записи.
 */
import type { KeyboardEvent } from 'react'
import {
  keyboardPlatformOf,
  primaryModifier,
} from '../../core/keyboardPlatform'

import { writeCells } from '../../core/cellWrites'
import { reportAction } from '../../core/debugActions'
import { rowSourceOf } from '../../core/rowSource'
import {
  endEditSession,
  isEditingCell,
  readEditSession,
  reportEditEnd,
} from './session'

interface Bounds {
  minRowIndex: number
  maxRowIndex: number
  minColumnIndex: number
  maxColumnIndex: number
}

interface BulkTable {
  getCellSelectionBounds?: () => Bounds[]
  getCellSelectionColumnIndexes?: () => Record<string, number>
}

/** Ячейки активного диапазона, если в нём ячейка правки и он больше неё. */
const rangeCellsOf = (
  table: unknown,
  cell: { rowId: string; columnId: string },
): { rowId: string; columnId: string }[] | undefined => {
  const t = table as BulkTable
  const bound = t.getCellSelectionBounds?.().at(-1)
  const indexes = t.getCellSelectionColumnIndexes?.()
  if (!bound || !indexes) return undefined
  const source = rowSourceOf<{ id: string }>(table)
  const row = source.indexOf(cell.rowId)
  const column = indexes[cell.columnId]
  if (
    column === undefined ||
    row < bound.minRowIndex ||
    row > bound.maxRowIndex ||
    column < bound.minColumnIndex ||
    column > bound.maxColumnIndex ||
    (bound.minRowIndex === bound.maxRowIndex &&
      bound.minColumnIndex === bound.maxColumnIndex)
  )
    return undefined
  const ids: string[] = []
  for (const [id, index] of Object.entries(indexes)) ids[index] = id
  const cells: { rowId: string; columnId: string }[] = []
  for (let r = bound.minRowIndex; r <= bound.maxRowIndex; r++) {
    const target = source.at(r)
    if (!target) continue
    for (let c = bound.minColumnIndex; c <= bound.maxColumnIndex; c++) {
      const columnId = ids[c]
      if (columnId) cells.push({ rowId: target.id, columnId })
    }
  }
  return cells
}

/**
 * Перехват Ctrl/Cmd+Enter в фазе захвата — раньше Enter самого редактора. Ячейка вне
 * диапазона или диапазон из неё одной — обычный Enter редактора.
 */
export const bulkEditOnKey = (
  event: KeyboardEvent,
  table: unknown,
  cell: { rowId: string; columnId: string },
) => {
  if (
    event.key !== 'Enter' ||
    !primaryModifier(event, keyboardPlatformOf(table)) ||
    event.altKey ||
    event.shiftKey
  )
    return
  const session = readEditSession(table)
  if (!isEditingCell(session, cell.rowId, cell.columnId)) return
  const cells = rangeCellsOf(table, cell)
  if (!cells) return
  event.preventDefault()
  event.stopPropagation()
  const text = session!.text
  // Правка закрывается без сохранения ячейки: её значение пишет пакет вместе с прочими.
  endEditSession(table)
  reportEditEnd(table, cell, { result: 'bulk' })
  reportAction(table, {
    plugin: 'cellEditing',
    action: 'bulkEdit',
    detail: { cells: cells.length },
    source: 'keyboard',
  })
  void writeCells(
    table,
    cells.map(item => ({ ...item, text })),
    { source: 'bulk' },
  )
}

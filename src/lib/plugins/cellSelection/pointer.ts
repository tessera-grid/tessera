/**
 * Выделение ячеек мышью (ADR 0029): нажатие и заход в ячейку над телом приходят от корня
 * грида делегированием (ADR 0170, §3).
 */
import type { BodyEventTarget } from '../../core/bodyContributions'
import { reportAction } from '../../core/debugActions'
import { isInteractive } from './copyEvent'

/** Поверхность стоковой фичи на ячейке. */
interface SelectableCell {
  id: string
  getCanSelect?: () => boolean
  getSelectionStartHandler?: () => (event: unknown) => void
  getSelectionExtendHandler?: () => (event: unknown) => void
}

const selectableOf = (target: BodyEventTarget) => {
  const cell = target.cell as SelectableCell | undefined
  if (!cell || !isInteractive(target.table)) return undefined
  if (typeof cell.getCanSelect === 'function' && !cell.getCanSelect()) {
    return undefined
  }
  return cell
}

/**
 * Начало выделения — жест в канале действий (ADR 0125, AL18): начало сейчас, конец — при
 * отпускании кнопки; с Shift — расширение выделения.
 */
const reportStart = (table: unknown, cell: SelectableCell, shift: boolean) => {
  if (shift) {
    reportAction(table, {
      plugin: 'cellSelection',
      action: 'extendSelection',
      detail: { cellId: cell.id },
      source: 'pointer',
    })
    return
  }
  reportAction(table, {
    plugin: 'cellSelection',
    action: 'select',
    detail: { cellId: cell.id },
    source: 'pointer',
    phase: 'start',
  })
  document.addEventListener(
    'mouseup',
    () =>
      reportAction(table, {
        plugin: 'cellSelection',
        action: 'select',
        source: 'pointer',
        phase: 'end',
      }),
    { once: true },
  )
}

export const startSelection = (event: MouseEvent, target: BodyEventTarget) => {
  // Только левой кнопкой: правый клик шлёт mousedown до contextmenu и не должен рвать
  // мультивыбор — выделением по нему владеет контекстное меню (ADR 0030).
  if (event.button !== 0) return
  const cell = selectableOf(target)
  const start = cell?.getSelectionStartHandler?.()
  if (!cell || !start) return
  reportStart(target.table, cell, event.shiftKey)
  start(event)
  // Фокус на ячейку — чтобы нативное copy-событие всплыло к корню.
  target.cellElement?.focus()
}

export const extendSelection = (event: MouseEvent, target: BodyEventTarget) => {
  selectableOf(target)?.getSelectionExtendHandler?.()(event)
}

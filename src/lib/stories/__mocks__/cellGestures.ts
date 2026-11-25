import { stepAction } from '../demos/DemoStory'
import { sleep } from '../demos/guideDemo'

/**
 * Жесты по ячейкам для шагов гайдов и `play`: нажатие, протяжка, правый клик и
 * копирование — событиями DOM, как их шлёт браузер на действия мыши и клавиатуры.
 */

export const cellOf = (root: ParentNode, row: string, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )

export const selectedCells = (root: ParentNode) =>
  root.querySelectorAll('.data-grid__body-cell[data-cell-selected="true"]')
    .length

export const isSelected = (cell: Element | null) =>
  cell?.getAttribute('data-cell-selected') === 'true'

type Modifiers = Pick<MouseEventInit, 'shiftKey' | 'ctrlKey' | 'metaKey'>

const center = (cell: HTMLElement) => {
  const box = cell.getBoundingClientRect()
  return {
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  }
}

const mouse = (target: HTMLElement, type: string, init: MouseEventInit = {}) =>
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...center(target),
      ...init,
    }),
  )

const pointer = (target: HTMLElement, type: string, init: Modifiers = {}) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerType: 'mouse',
      isPrimary: true,
      ...center(target),
      ...init,
    }),
  )

/**
 * Нажатие левой кнопкой по ячейке, как в браузере: указатель, мышь и фокус; `Shift`
 * расширяет диапазон, `Ctrl` добавляет.
 */
export const pressCell = (cell: HTMLElement, modifiers: Modifiers = {}) => {
  pointer(cell, 'pointerdown', modifiers)
  mouse(cell, 'mousedown', modifiers)
  cell.focus()
  pointer(cell, 'pointerup', modifiers)
  mouse(cell, 'mouseup', modifiers)
}

/**
 * Нажатие кнопки мышью, как в браузере: указатель, мышь и `click` со счётчиком нажатий —
 * `click` без него грид считает нажатием с клавиатуры.
 */
export const clickByMouse = (button: HTMLElement) => {
  pointer(button, 'pointerdown')
  mouse(button, 'mousedown', { detail: 1 })
  pointer(button, 'pointerup')
  mouse(button, 'mouseup', { detail: 1 })
  mouse(button, 'click', { detail: 1 })
}

/** Протянуть выделение от ячейки `from` до ячейки `to` с зажатой кнопкой. */
export const dragCells = (
  from: HTMLElement,
  to: HTMLElement,
  modifiers: Modifiers = {},
) => {
  mouse(from, 'mousedown', modifiers)
  // Вход в ячейку React берёт из пары `mouseout`/`mouseover`, как при движении мыши.
  mouse(from, 'mouseout', { ...modifiers, relatedTarget: to })
  mouse(to, 'mouseover', { ...modifiers, relatedTarget: from })
  mouse(to, 'mouseup', modifiers)
}

/** Правый клик по ячейке: нажатие правой кнопкой и `contextmenu` в её центре. */
export const rightClickCell = (cell: HTMLElement) => {
  mouse(cell, 'mousedown', { button: 2, buttons: 2 })
  mouse(cell, 'mouseup', { button: 2 })
  mouse(cell, 'contextmenu', { button: 2 })
}

const clipboardEvent = (
  type: 'copy' | 'cut' | 'paste',
  clipboardData: DataTransfer,
) => {
  const event = new ClipboardEvent(type, {
    bubbles: true,
    cancelable: true,
    clipboardData,
  })
  // Firefox отдаёт обработчикам свой пустой буфер вместо переданного.
  if (event.clipboardData !== clipboardData) {
    Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  }
  return event
}

/** Копирование с клавиатуры: событие `copy` от ячейки; что положено в буфер — в ответе. */
export const copyFrom = (cell: HTMLElement) => {
  const clipboardData = new DataTransfer()
  const event = clipboardEvent('copy', clipboardData)
  cell.dispatchEvent(event)
  return event.clipboardData!
}

/**
 * Вставка с клавиатуры: событие `paste` от ячейки с буфером — текстом, как его кладёт Excel
 * или Google Sheets, или буфером прежнего копирования таблицы (ADR 0219).
 */
export const pasteInto = (cell: HTMLElement, data: string | DataTransfer) => {
  const clipboardData = typeof data === 'string' ? new DataTransfer() : data
  if (typeof data === 'string') clipboardData.setData('text/plain', data)
  cell.dispatchEvent(clipboardEvent('paste', clipboardData))
}

/** Вырезание с клавиатуры: событие `cut` от ячейки; что положено в буфер — в ответе. */
export const cutFrom = (cell: HTMLElement) => {
  const clipboardData = new DataTransfer()
  const event = clipboardEvent('cut', clipboardData)
  cell.dispatchEvent(event)
  return event.clipboardData!
}

/**
 * Клавиша на ячейке в фокусе: `keydown` и `keyup`, как с клавиатуры; `init` — модификаторы и
 * код клавиши (Ctrl+D — `{ code: 'KeyD', ctrlKey: true }`).
 */
export const pressKey = (
  cell: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
) => {
  if (document.activeElement !== cell) cell.focus()
  cell.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  )
  cell.dispatchEvent(
    new KeyboardEvent('keyup', { key, bubbles: true, ...init }),
  )
}

/** Открытое меню таблицы. */
export const openMenu = () =>
  document.querySelector<HTMLElement>('[role="menu"][data-open]')

export const closeMenu = () =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )

/**
 * Довести таблицу до состояния шага: пока `done` не выполнено, делать следующий шаг
 * `act`. Таймером, а не кадрами: в фоновой вкладке кадры стоят.
 */
export const untilDone = <TApp>(
  done: (root: HTMLElement) => boolean,
  act: (root: HTMLElement, app: TApp) => void,
) =>
  stepAction<TApp>(async (root, { signal }, app) => {
    let tries = 0
    await sleep(0)
    while (!signal.aborted && !done(root)) {
      // Гайд показывает нажатие (ADR 0117, SN46): действие ждёт, а не повторяется.
      if (!root.closest('[data-guide-showing]')) {
        if (++tries > 80) return
        act(root, app)
      }
      await sleep(100)
    }
  })

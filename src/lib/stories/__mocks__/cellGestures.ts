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

/** Копирование с клавиатуры: событие `copy` от ячейки; что положено в буфер — в ответе. */
export const copyFrom = (cell: HTMLElement) => {
  const clipboardData = new DataTransfer()
  const event = new ClipboardEvent('copy', {
    bubbles: true,
    cancelable: true,
    clipboardData,
  })
  cell.dispatchEvent(event)
  // Firefox отдаёт обработчикам свой буфер события, а не переданный.
  return event.clipboardData ?? clipboardData
}

/**
 * Вставка с клавиатуры: событие `paste` от ячейки с буфером — текстом, как его кладёт Excel
 * или Google Sheets, или буфером прежнего копирования таблицы (ADR 0219).
 */
export const pasteInto = (cell: HTMLElement, data: string | DataTransfer) => {
  let clipboardData = data
  if (typeof data === 'string') {
    clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', data)
  }
  cell.dispatchEvent(
    new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboardData as DataTransfer,
    }),
  )
}

/** Вырезание с клавиатуры: событие `cut` от ячейки; что положено в буфер — в ответе. */
export const cutFrom = (cell: HTMLElement) => {
  const clipboardData = new DataTransfer()
  const event = new ClipboardEvent('cut', {
    bubbles: true,
    cancelable: true,
    clipboardData,
  })
  cell.dispatchEvent(event)
  return event.clipboardData ?? clipboardData
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

/** Последний запуск шага: в StrictMode вход в шаг выполняется дважды. */
let latestRun = 0

/**
 * Довести таблицу до состояния шага: пока `done` не выполнено, делать следующий шаг
 * `act`. Таймером, а не кадрами: в фоновой вкладке кадры стоят. Новый запуск и уход с
 * шага (возвращённая отмена) останавливают прежний — два цикла мешали бы друг другу.
 */
export const untilDone =
  <TApp>(
    done: (root: HTMLElement) => boolean,
    act: (root: HTMLElement, app: TApp) => void,
  ) =>
  (root: HTMLElement, app: TApp) => {
    const runId = ++latestRun
    let tries = 0
    let left = false
    const run = () => {
      if (left || runId !== latestRun || done(root)) return
      // Гайд показывает нажатие (ADR 0117, SN46): действие ждёт, а не повторяется.
      if (!root.closest('[data-guide-showing]')) {
        if (++tries > 80) return
        act(root, app)
      }
      setTimeout(run, 100)
    }
    setTimeout(run, 0)
    return () => {
      left = true
    }
  }

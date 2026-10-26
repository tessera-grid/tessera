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
 * `act`. Таймером, а не кадрами: в фоновой вкладке кадры стоят. Новый запуск
 * останавливает прежний — два цикла одного шага мешали бы друг другу.
 */
export const untilDone =
  <TApp>(
    done: (root: HTMLElement) => boolean,
    act: (root: HTMLElement, app: TApp) => void,
  ) =>
  (root: HTMLElement, app: TApp) => {
    const runId = ++latestRun
    let tries = 0
    const run = () => {
      if (runId !== latestRun || done(root) || ++tries > 80) return
      act(root, app)
      setTimeout(run, 100)
    }
    setTimeout(run, 0)
  }

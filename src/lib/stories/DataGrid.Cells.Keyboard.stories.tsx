import { useState } from 'react'
import { mod } from './__mocks__/platformKeys'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { openMenu, untilDone } from './__mocks__/cellGestures'
import {
  guideNext,
  headCell,
  rowAt,
  settle,
  until,
  pollUntil,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { typeInto } from './__mocks__/typeGuides'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/** Клавиатурная навигация (ADR 0021): переход по таблице и действия с клавиатуры. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Keyboard',
} satisfies Meta<StoryProps>

export default meta

export const KeyboardPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableKeyboardNavigation',
    'enableColumnSorting',
    'enableColumnPinning',
    'enableRowSelection',
    'enableCellEditing',
    'enableCellSelection',
    'cellSelectionRangeSelection',
    'enableContextMenu',
  ]),
  args: {
    // Стрелки, Home/End и PageUp/PageDown двигают активную ячейку по телу и хедеру
    // колонок; Space выбирает строку, Enter на заголовке сортирует, Enter/F2 открывает
    // правку или кнопки ячейки, Shift+F10 — меню, Tab уводит из таблицы. Много строк и
    // колонок — чтобы переход за окно виртуализации доводил ячейку в вид.
    enableKeyboardNavigation: true,
    enableCellSelection: true,
    enableRowSelection: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enableCellEditing: true,
    enableContextMenu: true,
    columnCount: 40,
    dataCount: 500,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- Действия шагов ------------------------------------------------------------------

const activeOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-kn-cell][data-kn-active="true"]')

/** Фокус на активной ячейке таблицы. */
const focusedActive = (root: ParentNode) => {
  const active = activeOf(root)
  return active && document.activeElement === active ? active : null
}

/** Нажатие клавиши на активной ячейке — как ввод пользователя. */
const press = (root: ParentNode, key: string, init: KeyboardEventInit = {}) => {
  const active = activeOf(root)
  active?.focus({ preventScroll: true })
  active?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code:
        init.code ??
        (/^[a-z]$/i.test(key)
          ? `Key${key.toUpperCase()}`
          : key === '/'
            ? 'Slash'
            : key),
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  )
}

/** Вход в таблицу клавишей Tab: фокус на ячейке с `tabindex="0"`. */
const tabIn = (root: HTMLElement) => {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
  )
  root.querySelector<HTMLElement>('[data-kn-cell][tabindex="0"]')?.focus()
}

const rowIndexOf = (cell: HTMLElement | null) =>
  Number(cell?.closest<HTMLElement>('.data-grid__body-row')?.dataset.index)

const inHead = (cell: HTMLElement | null) =>
  !!cell?.classList.contains('data-grid__head-cell')

/** Кольцо фокуса: у заголовка — псевдоэлемент (контур перекрыл бы грип ширины), у ячейки — контур. */
const hasRing = (cell: HTMLElement) => {
  if (inHead(cell)) return getComputedStyle(cell, '::after').content !== 'none'
  // В покое у ячейки прозрачный контур в 1px; цвет в forced-colors подменяется — по ширине.
  const style = getComputedStyle(cell)
  return (
    style.outlineStyle === 'solid' &&
    style.outlineWidth ===
      style.getPropertyValue('--tsr-comp-focus-ring-width').trim()
  )
}

const expectAtRest = (root: HTMLElement) => {
  expect(root.contains(document.activeElement)).toBe(false)
  expect(
    [...root.querySelectorAll<HTMLElement>('[data-kn-cell]')].filter(hasRing),
  ).toEqual([])
}

const lastColumnId = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('.data-grid__head-cell')]
    .at(-1)
    ?.getAttribute('data-column-id')

// --- S1 ------------------------------------------------------------------------------

const MOVE_ROWS = 500

/** Фокус вне таблицы: клавиатурные шаги идут после нажатия на панель гайда. */
const AT_REST: DemoStoryStep = {
  title: { ru: 'Фокус вне таблицы', en: 'Focus outside the table' },
  hint: {
    ru: 'Приложение включило работу с таблицей с клавиатуры. Фокус пока вне таблицы, ни одна ячейка не обведена.',
    en: 'The app turned on keyboard navigation for the table. Focus is still outside the table, and no cell is outlined.',
  },
}

const MOVE: readonly DemoStoryStep[] = [
  AT_REST,
  {
    title: { ru: 'Фокус в таблице', en: 'Focus in the table' },
    keyboard: true,
    hint: {
      ru: 'Пользователь перешёл в таблицу клавишей Tab. Фокус встал на заголовок первой колонки, он обведён кольцом фокуса.',
      en: 'The user moved into the table with the Tab key. Focus landed on the header of the first column, and the header is outlined with the focus ring.',
    },
    enter: untilDone(
      root => !!focusedActive(root),
      root => tabIn(root),
    ),
  },
  {
    title: {
      ru: 'Переход в конец таблицы',
      en: 'Jump to the end of the table',
    },
    keyboard: true,
    hint: {
      ru: 'Пользователь нажал Ctrl+End. Таблица прокрутилась к последней строке, фокус на её последней ячейке.',
      en: 'The user pressed Ctrl+End. The table scrolled to the last row, and focus is on its last cell.',
    },
    states: ['body.focus'],
    enter: untilDone(
      root => rowIndexOf(focusedActive(root)) === MOVE_ROWS - 1,
      root => (focusedActive(root) ? press(root, 'End', mod()) : tabIn(root)),
    ),
  },
]

/** ADR 0021, S1: пользователь ходит по таблице с клавиатуры. */
export const KeyboardMoving: StoryObj<StoryProps> = {
  name: 'Move around',
  parameters: { scenario: '0021/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Переход по таблице', en: 'Moving around the table' }}
      steps={MOVE}
      args={guideArgs(
        {
          enableKeyboardNavigation: true,
          columnCount: 7,
          dataCount: MOVE_ROWS,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MOVE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expectAtRest(canvas)
    })
    await step(MOVE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(focusedActive(canvas)).not.toBeNull())
      const cell = focusedActive(canvas)!
      expect(cell).toBe(canvas.querySelector('.data-grid__head-cell'))
      expect(hasRing(cell)).toBe(true)
    })
    await step(MOVE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() =>
        expect(rowIndexOf(focusedActive(canvas))).toBe(MOVE_ROWS - 1),
      )
      const cell = focusedActive(canvas)!
      expect(cell.dataset.columnId).toBe(lastColumnId(canvas))
      expect(hasRing(cell)).toBe(true)
      // Первая строка уходит из окна виртуализации кадром позже фокуса.
      await until(() => expect(rowAt(canvas, 0)).toBeNull())
      await settle()
    })
  },
}

// --- S2 ------------------------------------------------------------------------------

const SORT_COLUMN = 'firstName'

const sortOf = (root: HTMLElement) =>
  headCell(root, SORT_COLUMN)?.getAttribute('aria-sort')

const firstSelected = (root: HTMLElement) =>
  rowAt(root, 0)?.getAttribute('aria-selected') === 'true'

/** Фокус на заголовке колонки сортировки: вход Tab в хедер и стрелкой вправо. */
const toSortHeader = (root: HTMLElement) => {
  const active = focusedActive(root)
  if (inHead(active) && active?.dataset.columnId === SORT_COLUMN) return true
  if (!active) tabIn(root)
  else if (!inHead(active)) press(root, 'Home', mod())
  else press(root, 'ArrowRight')
  return false
}

/** Строки отсортированы с клавиатуры: Enter на заголовке. */
const sortByKeyboard = (root: HTMLElement) => {
  if (sortOf(root) === 'ascending') return
  if (toSortHeader(root)) press(root, 'Enter')
}

/** Первая строка выбрана пробелом — после сортировки, стрелкой из заголовка. */
const selectByKeyboard = (root: HTMLElement) => {
  if (sortOf(root) !== 'ascending') sortByKeyboard(root)
  else if (inHead(activeOf(root))) press(root, 'ArrowDown')
  else press(root, ' ')
}

const ACTIONS: readonly DemoStoryStep[] = [
  AT_REST,
  {
    title: { ru: 'Сортировка с заголовка', en: 'Sorting from the header' },
    keyboard: true,
    hint: {
      ru: 'Пользователь перешёл стрелками на заголовок колонки и нажал Enter. Строки отсортированы по этой колонке, заголовок показывает направление сортировки.',
      en: 'The user moved to a column header with the arrow keys and pressed Enter. The rows are sorted by that column, and the header shows the sort direction.',
    },
    states: ['head.sorting'],
    enter: untilDone(
      root => sortOf(root) === 'ascending' && inHead(focusedActive(root)),
      sortByKeyboard,
    ),
  },
  {
    title: { ru: 'Выбор строки пробелом', en: 'Selecting a row with Space' },
    keyboard: true,
    hint: {
      ru: 'Пользователь спустился стрелкой в первую строку и нажал пробел. Строка выбрана, её флажок отмечен.',
      en: 'The user moved down to the first row with an arrow key and pressed Space. The row is selected, and its checkbox is checked.',
    },
    states: ['body.selection'],
    enter: untilDone(firstSelected, selectByKeyboard),
  },
  {
    title: {
      ru: 'Контекстное меню с клавиатуры',
      en: 'Context menu from the keyboard',
    },
    keyboard: true,
    hint: {
      ru: 'Пользователь нажал Shift+F10. У активной ячейки открылось контекстное меню, фокус перешёл в него.',
      en: 'The user pressed Shift+F10. A context menu opened at the active cell, and focus moved into it.',
    },
    states: ['overlay.contextMenu'],
    enter: untilDone(
      () => !!openMenu(),
      root =>
        firstSelected(root)
          ? press(root, 'F10', { shiftKey: true })
          : selectByKeyboard(root),
    ),
  },
]

/** ADR 0021, S2: пользователь сортирует, выбирает строку и открывает меню без мыши. */
export const KeyboardActions: StoryObj<StoryProps> = {
  name: 'Actions without a mouse',
  parameters: { scenario: '0021/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Действия с клавиатуры', en: 'Keyboard actions' }}
      steps={ACTIONS}
      args={guideArgs(
        {
          enableKeyboardNavigation: true,
          enableColumnSorting: true,
          enableRowSelection: true,
          enableCellSelection: true,
          enableContextMenu: true,
          columnCount: 8,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ACTIONS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expectAtRest(canvas)
    })
    await step(ACTIONS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(sortOf(canvas)).toBe('ascending'))
      expect(focusedActive(canvas)).toBe(headCell(canvas, SORT_COLUMN))
      // Направление — на кнопке сортировки заголовка.
      expect(
        headCell(canvas, SORT_COLUMN).querySelector(
          '[data-button-active="true"]',
        ),
      ).not.toBeNull()
    })
    await step(ACTIONS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(firstSelected(canvas)).toBe(true))
      expect(rowIndexOf(focusedActive(canvas))).toBe(0)
      expect(
        rowAt(canvas, 0)
          .querySelector('[role="checkbox"]')
          ?.getAttribute('aria-checked'),
      ).toBe('true')
    })
    await step(ACTIONS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(openMenu()).not.toBeNull())
      await until(() =>
        expect(openMenu()!.contains(document.activeElement)).toBe(true),
      )
      await settle()
      // Меню — у активной ячейки: его угол в пределах ячейки.
      const cell = activeOf(canvas)!.getBoundingClientRect()
      const menu = openMenu()!.getBoundingClientRect()
      expect(menu.left).toBeGreaterThanOrEqual(cell.left)
      expect(menu.left).toBeLessThanOrEqual(cell.right)
      expect(menu.top).toBeGreaterThanOrEqual(cell.top)
      expect(menu.top).toBeLessThanOrEqual(cell.bottom)
    })
  },
}

// --- ADR 0232: клавиатура без grid, фокус, подсказки и сочетания -----------------

const keyOn = (
  target: HTMLElement | null,
  key: string,
  init: KeyboardEventInit = {},
) => {
  if ((key === 'Enter' || key === ' ') && target instanceof HTMLButtonElement) {
    target.focus()
    target.click()
    return
  }
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  if (key === 'Tab') {
    target?.dispatchEvent(event)
    target?.focus()
  } else {
    target?.focus()
    target?.dispatchEvent(event)
  }
}

const tooltipShown = () =>
  [...document.querySelectorAll<HTMLElement>('[data-tooltip-popup]')].some(
    tip => tip.getBoundingClientRect().height > 0,
  )
const shortcutsSheet = () =>
  document.querySelector<HTMLElement>('[data-testid="keyboard-shortcuts"]')
const shortcutsList = () =>
  document.querySelector<HTMLElement>('[data-shortcuts-list]')

const WITHOUT_GRID: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Без навигации по ячейкам', en: 'Without cell navigation' },
    hint: {
      ru: 'Таблица работает в обычном режиме чтения. Все её кнопки остаются доступны с клавиатуры.',
      en: 'The table is in reading mode. All its controls remain available from the keyboard.',
    },
  },
  {
    title: { ru: 'Tab к кнопке', en: 'Tab to the button' },
    keyboard: true,
    hint: {
      ru: 'Пользователь нажимает Tab: кнопка сортировки получает фокус и показывает кольцо. Действие пока не выполнено.',
      en: 'The user presses Tab: the sort button receives focus and shows its ring. The action has not run yet.',
    },
    enter: untilDone(
      root =>
        document.activeElement ===
        headCell(root, SORT_COLUMN).querySelector('.column-sort__button'),
      root =>
        keyOn(
          headCell(root, SORT_COLUMN).querySelector('.column-sort__button'),
          'Tab',
        ),
    ),
  },
  {
    title: { ru: 'Действие с клавиатуры', en: 'Action from the keyboard' },
    keyboard: true,
    states: ['head.sorting'],
    hint: {
      ru: 'Пользователь прошёл кнопки клавишей Tab и нажал Enter. Действие заголовка сработало без режима навигации по ячейкам.',
      en: 'The user moved through the controls with Tab and pressed Enter. The header action worked without cell navigation.',
    },
    enter: untilDone(
      root => sortOf(root) !== 'none',
      root =>
        keyOn(
          headCell(root, SORT_COLUMN).querySelector('.column-sort__button'),
          'Enter',
        ),
    ),
  },
]

/** ADR 0232, S1: таблица без навигации по ячейкам сохраняет клавиатурный путь. */
export const KeyboardWithoutGrid: StoryObj<StoryProps> = {
  name: 'Without cell navigation',
  parameters: { scenario: '0232/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Таблица без стрелок', en: 'Table without cell navigation' }}
      steps={WITHOUT_GRID}
      args={guideArgs(
        {
          enableKeyboardNavigation: false,
          enableColumnSorting: true,
          enableRowSelection: true,
          enableCellEditing: true,
          enablePagination: true,
          columnCount: 6,
          dataCount: 30,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(WITHOUT_GRID[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
      expect(canvasElement.querySelector('[role="table"]')).not.toBeNull()
      expect(canvasElement.querySelector('[role="grid"]')).toBeNull()
    })
    await step(WITHOUT_GRID[1]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      const button = headCell(canvasElement, SORT_COLUMN).querySelector(
        '.column-sort__button',
      )
      await until(() => expect(document.activeElement).toBe(button))
      await settle()
    })
    await step(WITHOUT_GRID[2]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(sortOf(canvasElement)).not.toBe('none'))
      await settle()
    })
  },
}

const FOCUS_IN_VIEW: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Переход к краю таблицы', en: 'Move to the table edge' },
    hint: {
      ru: 'Включены закреплённые колонки, липкие строки и итоги. Пользователь переходит к последней строке клавишами.',
      en: 'Pinned columns, sticky rows and totals are on. The user moves to the last row from the keyboard.',
    },
  },
  {
    title: { ru: 'Фокус на первой ячейке', en: 'Focus on the first cell' },
    keyboard: true,
    states: ['body.focus'],
    hint: {
      ru: 'Tab переводит фокус в таблицу. Перед переходом видно, с какой ячейки начинается действие.',
      en: 'Tab moves focus into the table. Before the jump, the starting cell is visible.',
    },
    enter: untilDone(
      root => !!focusedActive(root),
      root => tabIn(root),
    ),
  },
  {
    title: { ru: 'Ячейка видна целиком', en: 'The cell is fully visible' },
    keyboard: true,
    states: ['body.focus', 'body.pinnedStart'],
    hint: {
      ru: 'Таблица прокрутилась так, что активную ячейку не закрывают шапка, итоги и закреплённые области.',
      en: 'The table scrolled so that the active cell is not covered by the header, totals or pinned areas.',
    },
    enter: untilDone(
      root =>
        rowIndexOf(focusedActive(root)) === 39 &&
        focusedActive(root)?.dataset.columnId === lastColumnId(root),
      root => {
        const target =
          focusedActive(root) ??
          root.querySelector<HTMLElement>('[data-kn-cell][tabindex="0"]')
        keyOn(target, 'End', mod())
      },
    ),
  },
]

/** ADR 0232, S2: переход к активной ячейке оставляет её целиком в видимой области. */
export const KeyboardFocusInView: StoryObj<StoryProps> = {
  name: 'Focus stays in view',
  parameters: { scenario: '0232/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Фокус остаётся видимым', en: 'Focus stays in view' }}
      steps={FOCUS_IN_VIEW}
      args={guideArgs(
        {
          enableKeyboardNavigation: true,
          enableColumnPinning: true,
          initialColumnPinning: { start: ['country'], end: [] },
          enableRowExpanding: true,
          dataNesting: 'nested',
          initialExpanded: true,
          rowExpandingStickyRows: true,
          enableFooter: true,
          columnCount: 8,
          dataCount: 40,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FOCUS_IN_VIEW[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(FOCUS_IN_VIEW[1]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(focusedActive(canvasElement)).not.toBeNull())
      await settle()
    })
    await step(FOCUS_IN_VIEW[2]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(focusedActive(canvasElement)).not.toBeNull())
      await settle()
      const cell = focusedActive(canvasElement)!
      const scroller = canvasElement
        .querySelector('.data-grid__container')!
        .getBoundingClientRect()
      const box = cell.getBoundingClientRect()
      expect(box.top).toBeGreaterThanOrEqual(scroller.top)
      expect(box.bottom).toBeLessThanOrEqual(scroller.bottom)
    })
  },
}

const HINTS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Фокус на кнопке', en: 'Focus on a button' },
    hint: {
      ru: 'Пользователь переходит к кнопке с клавиатуры. Её подпись появляется без наведения указателя.',
      en: 'The user focuses a button from the keyboard. Its label appears without pointer hover.',
    },
  },
  {
    title: { ru: 'Подсказка по фокусу', en: 'Hint from keyboard focus' },
    keyboard: true,
    states: ['overlay.tooltip'],
    hint: {
      ru: 'Подсказка называет действие кнопки и не забирает у неё фокус.',
      en: 'The hint names the button action and does not take focus from it.',
    },
    enter: untilDone(
      root =>
        tooltipShown() &&
        document.activeElement ===
          headCell(root, SORT_COLUMN).querySelector('.column-sort__button'),
      root =>
        keyOn(
          headCell(root, SORT_COLUMN).querySelector('.column-sort__button'),
          'Tab',
        ),
    ),
  },
  {
    title: {
      ru: 'Скрытие без потери фокуса',
      en: 'Dismiss without losing focus',
    },
    keyboard: true,
    hint: {
      ru: 'Escape скрывает подсказку. Кнопка остаётся в фокусе и доступна для следующего действия.',
      en: 'Escape dismisses the hint. The button stays focused and ready for the next action.',
    },
    enter: untilDone(
      root =>
        !tooltipShown() &&
        document.activeElement ===
          headCell(root, SORT_COLUMN).querySelector('.column-sort__button'),
      root => {
        const button = headCell(root, SORT_COLUMN).querySelector<HTMLElement>(
          '.column-sort__button',
        )
        keyOn(button, 'Escape')
        button?.focus()
      },
    ),
  },
]

/** ADR 0232, S3: подсказка показывается по фокусу и скрывается Escape. */
export const KeyboardHints: StoryObj<StoryProps> = {
  name: 'Hints from keyboard focus',
  parameters: { scenario: '0232/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Подсказки с клавиатуры', en: 'Keyboard hints' }}
      steps={HINTS}
      args={guideArgs(
        {
          enableKeyboardNavigation: false,
          enableColumnSorting: true,
          columnCount: 5,
          dataCount: 12,
          height: '320',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(HINTS[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(HINTS[1]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(tooltipShown()).toBe(true))
      expect(document.activeElement).toBe(
        headCell(canvasElement, SORT_COLUMN).querySelector(
          '.column-sort__button',
        ),
      )
      await settle()
    })
    await step(HINTS[2]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(tooltipShown()).toBe(false))
      await until(() =>
        expect(document.activeElement).toBe(
          headCell(canvasElement, SORT_COLUMN).querySelector(
            '.column-sort__button',
          ),
        ),
      )
      await settle()
    })
  },
}

const platformValue = (root: ParentNode) =>
  root
    .querySelector(
      '.data-grid__body-row[data-index="0"] [data-column-id="age"]',
    )
    ?.textContent?.trim()

const PLATFORM: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Сочетания платформы', en: 'Platform shortcuts' },
    hint: {
      ru: 'Таблица настроена на Apple: основной модификатор — Cmd, а не Ctrl. Пользователь правит ячейку и отменяет правку.',
      en: 'The table is set to Apple: the main modifier is Cmd, not Ctrl. The user edits a cell and undoes the edit.',
    },
  },
  {
    title: { ru: 'Правка с клавиатуры', en: 'Edit from the keyboard' },
    keyboard: true,
    states: ['body.editing'],
    hint: {
      ru: 'Enter на активной ячейке открывает поле правки и переводит фокус в него.',
      en: 'Enter on the active cell opens the editor and moves focus into it.',
    },
    enter: untilDone(
      root =>
        document.activeElement ===
        root.querySelector('.data-grid__body-cell input'),
      root => {
        const active = focusedActive(root)
        if (!active) tabIn(root)
        else if (inHead(active)) press(root, 'ArrowDown')
        else if (active.dataset.columnId !== 'age') press(root, 'ArrowRight')
        else {
          root.dataset.platformOriginal = platformValue(root)
          press(root, 'Enter')
        }
      },
    ),
  },
  {
    title: { ru: 'Отмена через Cmd+Z', en: 'Undo with Cmd+Z' },
    keyboard: true,
    states: ['body.focus'],
    hint: {
      ru: 'После ввода значения Cmd+Z вернуло прежнее. Ctrl в этой платформе не заменяет Cmd.',
      en: 'After the value was entered, Cmd+Z restored the previous one. Ctrl does not replace Cmd on this platform.',
    },
    enter: untilDone(
      root =>
        !!root.dataset.platformOriginal &&
        platformValue(root) === root.dataset.platformOriginal &&
        !!focusedActive(root),
      root => {
        const input = root.querySelector<HTMLInputElement>(
          '.data-grid__body-cell input',
        )
        if (input) {
          if (input.value !== '99') typeInto(input, '99')
          else keyOn(input, 'Enter')
          return
        }
        press(root, 'z', { metaKey: true })
      },
    ),
  },
  {
    title: { ru: 'Сочетание у кнопки', en: 'Shortcut on the button' },
    keyboard: true,
    states: ['overlay.tooltip'],
    hint: {
      ru: 'Подсказка кнопки отмены показывает сочетание в привычном виде платформы.',
      en: 'The undo button hint shows the shortcut in the platform notation.',
    },
    enter: untilDone(
      root =>
        tooltipShown() &&
        document.activeElement ===
          root.querySelector('[data-testid="undo-button"]'),
      root => keyOn(root.querySelector('[data-testid="undo-button"]'), 'Tab'),
    ),
  },
]

/** ADR 0232, S4: сочетания Apple и отмена правки через Cmd+Z. */
export const KeyboardPlatform: StoryObj<StoryProps> = {
  name: 'Platform shortcuts',
  parameters: { scenario: '0232/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Сочетания своей платформы', en: 'Platform shortcuts' }}
      steps={PLATFORM}
      args={guideArgs(
        {
          keyboardPlatform: 'apple',
          enableKeyboardNavigation: true,
          enableCellEditing: true,
          enableEditHistory: true,
          columnCount: 5,
          dataCount: 12,
          height: '320',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    const before = () =>
      canvasElement
        .querySelector(
          '.data-grid__body-row[data-index="0"] [data-column-id="age"]',
        )
        ?.textContent?.trim()
    let original = ''
    await step(PLATFORM[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
      original = before() ?? ''
    })
    await step(PLATFORM[1]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() =>
        expect(canvasElement.querySelector('.data-grid__body-cell input')).toBe(
          document.activeElement,
        ),
      )
      await settle()
    })
    await step(PLATFORM[2]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(before()).toBe(original))
      await settle()
    })
    await step(PLATFORM[3]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(tooltipShown()).toBe(true))
      expect(document.activeElement).toBe(
        canvasElement.querySelector('[data-testid="undo-button"]'),
      )
      await settle()
    })
  },
}

const SHORTCUTS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Сводка текущей таблицы', en: 'Shortcuts for this table' },
    hint: {
      ru: 'Сводка собирается из включённых возможностей таблицы. Пользователь открывает её сочетанием платформы.',
      en: 'The sheet is built from the enabled table features. The user opens it with the platform shortcut.',
    },
  },
  {
    title: { ru: 'Фокус на исходной ячейке', en: 'Focus on the source cell' },
    keyboard: true,
    states: ['body.focus'],
    hint: {
      ru: 'Перед открытием сводки фокус стоит на ячейке таблицы. К ней вернётся Escape.',
      en: 'Before the sheet opens, focus is on a table cell. Escape will return to it.',
    },
    enter: untilDone(
      root => !!focusedActive(root),
      root => tabIn(root),
    ),
  },
  {
    title: { ru: 'Открыть сочетанием', en: 'Open with a shortcut' },
    keyboard: true,
    states: ['overlay.shortcuts'],
    hint: {
      ru: 'Cmd+/ или Ctrl+/ открывает список по разделам. Поиск уже в фокусе.',
      en: 'Cmd+/ or Ctrl+/ opens the grouped list. Search is already focused.',
    },
    enter: untilDone(
      () =>
        !!shortcutsSheet() &&
        shortcutsSheet()!.contains(document.activeElement),
      root => (focusedActive(root) ? press(root, '/', mod()) : tabIn(root)),
    ),
  },
  {
    title: { ru: 'Найти действие', en: 'Find an action' },
    keyboard: true,
    states: ['overlay.shortcuts'],
    hint: {
      ru: 'Поиск по названию оставляет только подходящие действия и их сочетания.',
      en: 'Searching by name leaves only matching actions and their shortcuts.',
    },
    enter: untilDone(
      () =>
        !shortcutsList()?.textContent?.includes('Copy') &&
        document.activeElement === shortcutsSheet()?.querySelector('input'),
      root => {
        const input = shortcutsSheet()?.querySelector('input')
        if (input) typeInto(input, 'Undo')
        else if (focusedActive(root)) press(root, '/', mod())
        else tabIn(root)
      },
    ),
  },
  {
    title: { ru: 'Закрыть с возвратом фокуса', en: 'Close and restore focus' },
    keyboard: true,
    hint: {
      ru: 'Escape закрывает сводку и возвращает фокус на ячейку, откуда она была открыта.',
      en: 'Escape closes the sheet and returns focus to the cell that opened it.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (!shortcutsSheet()) {
        tabIn(root)
        press(root, '/', mod())
        await pollUntil(() => !!shortcutsSheet(), signal)
      }
      keyOn(document.activeElement as HTMLElement, 'Escape')
      await pollUntil(() => !shortcutsSheet() && !!focusedActive(root), signal)
    }),
  },
]

/** ADR 0232, S5: сводка сочетаний открывается, фильтруется и возвращает фокус. */
export const KeyboardShortcutsSheet: StoryObj<StoryProps> = {
  name: 'Shortcuts sheet',
  parameters: { scenario: '0232/S5', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Сочетания клавиш', en: 'Keyboard shortcuts' }}
      steps={SHORTCUTS}
      args={guideArgs(
        {
          enableKeyboardNavigation: true,
          enableCellSelection: true,
          enableContextMenu: true,
          enableRowSelection: true,
          enableEditHistory: true,
          columnCount: 6,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SHORTCUTS[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(SHORTCUTS[1]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(focusedActive(canvasElement)).not.toBeNull())
      await settle()
    })
    await step(SHORTCUTS[2]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(shortcutsSheet()).not.toBeNull())
      await until(() =>
        expect(shortcutsSheet()!.contains(document.activeElement)).toBe(true),
      )
      await settle()
    })
    await step(SHORTCUTS[3]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => {
        expect(shortcutsList()?.textContent ?? '').toContain('Undo')
        expect(shortcutsList()?.textContent ?? '').not.toContain('Copy')
        expect(document.activeElement).toBe(
          shortcutsSheet()!.querySelector('input'),
        )
      })
      await settle()
    })
    await step(SHORTCUTS[4]!.title.ru, async () => {
      await guideNext(canvasElement)
      await waitForRows(canvasElement)
      await until(() => expect(shortcutsSheet()).toBeNull())
      await settle()
      await until(() => expect(focusedActive(canvasElement)).not.toBeNull())
    })
  },
}

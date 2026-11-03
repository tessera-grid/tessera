import { useState } from 'react'
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
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
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
const AT_REST: GuideStoryStep = {
  title: 'Фокус вне таблицы',
  hint: 'Приложение включило работу с таблицей с клавиатуры. Фокус пока вне таблицы, ни одна ячейка не обведена.',
}

const MOVE: readonly GuideStoryStep[] = [
  AT_REST,
  {
    title: 'Фокус в таблице',
    keyboard: true,
    hint: 'Пользователь перешёл в таблицу клавишей Tab. Фокус встал на заголовок первой колонки, он обведён кольцом фокуса.',
    enter: untilDone(
      root => !!focusedActive(root),
      root => tabIn(root),
    ),
  },
  {
    title: 'Переход в конец таблицы',
    keyboard: true,
    hint: 'Пользователь нажал Ctrl+End. Таблица прокрутилась к последней строке, фокус на её последней ячейке.',
    states: ['body.focus'],
    enter: untilDone(
      root => rowIndexOf(focusedActive(root)) === MOVE_ROWS - 1,
      root =>
        focusedActive(root)
          ? press(root, 'End', { ctrlKey: true })
          : tabIn(root),
    ),
  },
]

/** ADR 0021, S1: пользователь ходит по таблице с клавиатуры. */
export const KeyboardMoving: StoryObj<StoryProps> = {
  name: 'Move around',
  parameters: { scenario: '0021/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Переход по таблице"
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
    await step(MOVE[0]!.title, async () => {
      await waitForRows(canvas)
      expectAtRest(canvas)
    })
    await step(MOVE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(focusedActive(canvas)).not.toBeNull())
      const cell = focusedActive(canvas)!
      expect(cell).toBe(canvas.querySelector('.data-grid__head-cell'))
      expect(hasRing(cell)).toBe(true)
    })
    await step(MOVE[2]!.title, async () => {
      await guideNext(canvas)
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
  else if (!inHead(active)) press(root, 'Home', { ctrlKey: true })
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

const ACTIONS: readonly GuideStoryStep[] = [
  AT_REST,
  {
    title: 'Сортировка с заголовка',
    keyboard: true,
    hint: 'Пользователь перешёл стрелками на заголовок колонки и нажал Enter. Строки отсортированы по этой колонке, заголовок показывает направление сортировки.',
    states: ['head.sorting'],
    enter: untilDone(
      root => sortOf(root) === 'ascending' && inHead(focusedActive(root)),
      sortByKeyboard,
    ),
  },
  {
    title: 'Выбор строки пробелом',
    keyboard: true,
    hint: 'Пользователь спустился стрелкой в первую строку и нажал пробел. Строка выбрана, её флажок отмечен.',
    states: ['body.selection'],
    enter: untilDone(firstSelected, selectByKeyboard),
  },
  {
    title: 'Контекстное меню с клавиатуры',
    keyboard: true,
    hint: 'Пользователь нажал Shift+F10. У активной ячейки открылось контекстное меню, фокус перешёл в него.',
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
    <GuideStory
      title="Действия с клавиатуры"
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
    await step(ACTIONS[0]!.title, async () => {
      await waitForRows(canvas)
      expectAtRest(canvas)
    })
    await step(ACTIONS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(sortOf(canvas)).toBe('ascending'))
      expect(focusedActive(canvas)).toBe(headCell(canvas, SORT_COLUMN))
      // Направление — на кнопке сортировки заголовка.
      expect(
        headCell(canvas, SORT_COLUMN).querySelector(
          '[data-button-active="true"]',
        ),
      ).not.toBeNull()
    })
    await step(ACTIONS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(firstSelected(canvas)).toBe(true))
      expect(rowIndexOf(focusedActive(canvas))).toBe(0)
      expect(
        rowAt(canvas, 0)
          .querySelector('[role="checkbox"]')
          ?.getAttribute('aria-checked'),
      ).toBe('true')
    })
    await step(ACTIONS[3]!.title, async () => {
      await guideNext(canvas)
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

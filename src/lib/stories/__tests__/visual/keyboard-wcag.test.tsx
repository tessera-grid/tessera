import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { DEFAULT_LABELS } from '../../../core/localization'
import { COLUMN_EXPANDING_ID } from '../../../plugins/rowExpanding'
import * as stories from '../../DataGrid.stories'

// Соответствие WCAG 2.1.1: каждое требование — свой именованный тест `KB<n>`
// (таблица требований в docs/decisions/0031-wcag-keyboard.md). Ввод — реальные
// CDP-клавиши, состояние читается из DOM и вычисленных стилей.

const composed = composeStories(stories)

const HEAD_CELL = '.data-grid__head-cell'
const HIDDEN_BUTTON = '.cell__button--hidden'
const BODY_ROW = '.data-grid__body-row'
const BODY_CELL = '.data-grid__body-cell'
const SELECTED = `${BODY_CELL}[data-cell-selected='true']`

const PIN_BUTTON = '.column-pin__button'

const headCellById = (id: string) =>
  document.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)!

const active = () => document.activeElement as HTMLElement
const press = (keys: string) => userEvent.keyboard(keys)
const opacityOf = (cell: Element) =>
  getComputedStyle(cell.querySelector(HIDDEN_BUTTON)!).opacity

/** Грид после внешней кнопки: вход в грид по Tab, указатель — вне грида. */
async function renderFromOutside() {
  await render(
    <>
      <button id="before-grid">before</button>
      <composed.KeyboardNavigation />
    </>,
  )
  await expect
    .poll(
      () => document.querySelectorAll(`${HEAD_CELL} ${HIDDEN_BUTTON}`).length,
    )
    .toBeGreaterThan(1)
  const before = document.getElementById('before-grid')!
  await userEvent.hover(before)
  before.focus()
}

describe('WCAG 2.1.1 (Keyboard)', () => {
  test('KB1: hover-кнопки видимы при клавиатурном фокусе на ячейке и на самой кнопке', async () => {
    await renderFromOutside()

    // Вход по Tab, затем вверх в строку заголовков (кламп на ней).
    await press('{Tab}{ArrowUp}{ArrowUp}')
    await expect.poll(() => active().getAttribute('role')).toBe('columnheader')
    for (let i = 0; i < 10 && !active().querySelector(HIDDEN_BUTTON); i++) {
      await press('{ArrowRight}')
    }
    const cell = active()
    expect(cell.querySelector(HIDDEN_BUTTON)).not.toBeNull()

    await expect.poll(() => opacityOf(cell)).toBe('1')
    const neighbour = Array.from(
      document.querySelectorAll<HTMLElement>(HEAD_CELL),
    ).find(other => other !== cell && other.querySelector(HIDDEN_BUTTON))!
    expect(opacityOf(neighbour)).toBe('0')

    // Режим действия (F2: Enter на заголовке — сортировка): фокус на кнопке
    // внутри ячейки — кнопка остаётся видимой.
    await press('{F2}')
    await expect
      .poll(() => cell.contains(active()) && active() !== cell)
      .toBe(true)
    await expect.poll(() => opacityOf(cell)).toBe('1')

    await press('{Escape}')
    await expect.poll(() => active()).toBe(cell)

    // Ячейка тела с hover-кнопкой (правка cellEditing) — так же видна при фокусе.
    await press('{ArrowDown}')
    await expect.poll(() => active().closest(BODY_ROW)).toBeTruthy()
    for (let i = 0; i < 20 && !active().querySelector(HIDDEN_BUTTON); i++) {
      await press('{ArrowRight}')
    }
    const bodyCell = active()
    expect(bodyCell.querySelector(HIDDEN_BUTTON)).not.toBeNull()
    await expect.poll(() => opacityOf(bodyCell)).toBe('1')
  })

  test('KB6: Ctrl+Shift+стрелка расширяет выделение до края, Ctrl+A выделяет все ячейки', async () => {
    const dataCount = 6
    await render(
      <composed.KeyboardNavigation dataCount={dataCount} columnCount={4} />,
    )
    await expect
      .poll(() => document.querySelectorAll(`${BODY_ROW} ${BODY_CELL}`).length)
      .toBeGreaterThan(3)
    const anchor = document.querySelector<HTMLElement>(
      `${BODY_ROW}[data-index='1'] ${BODY_CELL}[data-cell-selectable]`,
    )!
    const columnId = anchor.getAttribute('data-column-id')
    await userEvent.click(anchor)
    await expect.poll(() => active()).toBe(anchor)

    // Вниз до края: строки 1…последняя в колонке якоря.
    await press('{Control>}{Shift>}{ArrowDown}{/Shift}{/Control}')
    await expect
      .poll(() => document.querySelectorAll(SELECTED).length)
      .toBe(dataCount - 1)
    document
      .querySelectorAll(SELECTED)
      .forEach(cell =>
        expect(cell.getAttribute('data-column-id')).toBe(columnId),
      )
    expect(
      document
        .querySelector(
          `${BODY_ROW}[data-index='${dataCount - 1}'] ${BODY_CELL}[data-column-id='${columnId}']`,
        )!
        .getAttribute('data-cell-selected'),
    ).toBe('true')
    expect(active()).toBe(anchor)

    // Ctrl+A: выделены все выбираемые ячейки, текст страницы не выделен.
    await press('{Control>}a{/Control}')
    const selectable = document.querySelectorAll(
      `${BODY_CELL}[data-cell-selectable]`,
    )
    await expect
      .poll(() => document.querySelectorAll(SELECTED).length)
      .toBe(selectable.length)
    expect(window.getSelection()?.toString()).toBe('')
  })

  test('KB5: заголовки групп вложенной шапки в навигации — группа закрепляется с клавиатуры', async () => {
    await render(<composed.HeaderGroupsPinning enableKeyboardNavigation />)
    await expect.poll(() => headCellById('name')).toBeTruthy()

    // Группа `name` (rowSpan 2) — над листом `firstName`; выше неё строк нет.
    const leaf = headCellById('firstName')
    leaf.focus()
    await expect.poll(() => active()).toBe(leaf)
    await press('{ArrowUp}')
    await expect.poll(() => active()).toBe(headCellById('name'))
    await press('{ArrowUp}')
    expect(active()).toBe(headCellById('name'))
    await press('{ArrowDown}')
    await expect.poll(() => active()).toBe(leaf)

    // Режим действия на группе: pin-кнопка → «Pin left» — всё клавишами.
    await press('{ArrowUp}{F2}')
    const group = headCellById('name')
    const pin = group.querySelector<HTMLElement>(PIN_BUTTON)!
    for (let i = 0; i < 5 && !pin.contains(active()); i++) {
      await press('{Tab}')
    }
    expect(pin.contains(active())).toBe(true)
    await press('{Enter}')
    const item = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find(el => el.textContent?.trim() === 'Pin left')
    await expect.poll(item).toBeTruthy()
    // Меню, открытое с клавиатуры, держит фокус на пункте; стрелкой — до «Pin left».
    await expect.poll(() => active().getAttribute('role')).toBe('menuitem')
    for (let i = 0; i < 5 && active() !== item(); i++) {
      await press('{ArrowDown}')
    }
    expect(active()).toBe(item())
    await press('{Enter}')
    await expect
      .poll(() => headCellById('name').getAttribute('data-cell-pinned'))
      .toBe('left')
  })

  test('KB2: ширина колонки меняется с клавиатуры через фокусируемый separator', async () => {
    await render(<composed.KeyboardNavigation enableColumnResizing />)
    await expect
      .poll(() => document.querySelector(`${HEAD_CELL} [role="separator"]`))
      .toBeTruthy()

    const separator = document.querySelector<HTMLElement>(
      `${HEAD_CELL} [role="separator"]`,
    )!
    const cell = separator.closest<HTMLElement>(HEAD_CELL)!
    const width = () => cell.getBoundingClientRect().width
    const valueNow = () => Number(separator.getAttribute('aria-valuenow'))

    expect(separator.getAttribute('aria-label')).toBe(
      DEFAULT_LABELS.resizeColumn,
    )
    const min = Number(separator.getAttribute('aria-valuemin'))
    const max = Number(separator.getAttribute('aria-valuemax') ?? Infinity)
    const initial = valueNow()
    const initialWidth = width()
    const grown = Math.min(initial + 10, max)

    // Ячейка заголовка → режим действия (F2) → Tab до ручки.
    cell.focus()
    await press('{F2}')
    for (let i = 0; i < 8 && active() !== separator; i++) {
      await press('{Tab}')
    }
    expect(active()).toBe(separator)

    await press('{ArrowRight}')
    await expect.poll(valueNow).toBe(grown)
    await expect
      .poll(() => Math.round(width() - initialWidth))
      .toBe(grown - initial)

    await press('{Shift>}{ArrowLeft}{/Shift}')
    await expect.poll(valueNow).toBe(Math.max(grown - 50, min))

    await press('{Home}')
    await expect.poll(valueNow).toBe(initial)
    expect(active()).toBe(separator)
  })

  test('KB3: Alt+Shift+←/→ на заголовке переставляют колонку, фокус следует за ней', async () => {
    await render(<composed.ColumnDragging enableKeyboardNavigation />)
    const movable = () =>
      Array.from(document.querySelectorAll<HTMLElement>(HEAD_CELL))
        .filter(cell => cell.querySelector('.drag__handler--column'))
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )
    await expect.poll(() => movable().length).toBeGreaterThan(1)

    const [first, second] = movable().map(cell =>
      cell.getAttribute('data-column-id'),
    )
    const left = (id: string | null) =>
      headCellById(id!).getBoundingClientRect().left
    headCellById(first!).focus()
    await expect.poll(() => active()).toBe(headCellById(first!))

    await press('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
    await expect.poll(() => left(first) > left(second)).toBe(true)
    await expect.poll(() => active().getAttribute('data-column-id')).toBe(first)

    await press('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}')
    await expect.poll(() => left(first) < left(second)).toBe(true)
    expect(active().getAttribute('data-column-id')).toBe(first)
  })

  test('KB4: Alt+Shift+↑/↓ на ячейке переставляют строку, фокус следует за ней', async () => {
    await render(<composed.RowDragging enableKeyboardNavigation />)
    const rowAt = (index: number) =>
      document.querySelector<HTMLElement>(`${BODY_ROW}[data-index='${index}']`)
    await expect.poll(() => rowAt(1)).toBeTruthy()
    expect(rowAt(0)!.getAttribute('aria-expanded')).not.toBe('true')

    const moved = rowAt(0)!.getAttribute('data-row-id')
    const other = rowAt(1)!.getAttribute('data-row-id')
    const indexOf = (id: string | null) =>
      Number(
        document
          .querySelector(`${BODY_ROW}[data-row-id='${id}']`)
          ?.getAttribute('data-index'),
      )
    rowAt(0)!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()

    await press('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}')
    await expect.poll(() => indexOf(moved) > indexOf(other)).toBe(true)
    await expect
      .poll(() => active().closest(BODY_ROW)?.getAttribute('data-row-id'))
      .toBe(moved)

    await press('{Alt>}{Shift>}{ArrowUp}{/Shift}{/Alt}')
    await expect.poll(() => indexOf(moved)).toBe(0)
    await expect
      .poll(() => active().closest(BODY_ROW)?.getAttribute('data-row-id'))
      .toBe(moved)
  })

  test('KB7: групповая строка rowGrouping раскрывается и сворачивается с клавиатуры', async () => {
    await render(
      <composed.RowGrouping
        enableKeyboardNavigation
        enableRowExpanding
        initialGrouping={['gender']}
      />,
    )
    const groupRow = () =>
      document.querySelector<HTMLElement>(
        `${BODY_ROW}[data-group-row='true'][data-index='0']`,
      )
    await expect.poll(groupRow).toBeTruthy()
    expect(groupRow()!.getAttribute('aria-expanded')).toBe('false')
    const rowCount = () => document.querySelectorAll(BODY_ROW).length
    const collapsed = rowCount()

    groupRow()!
      .querySelector<HTMLElement>(
        `[data-column-id^='${COLUMN_EXPANDING_ID}'][data-kn-cell]`,
      )!
      .focus()
    await press('{Enter}')
    await expect
      .poll(() => groupRow()!.getAttribute('aria-expanded'))
      .toBe('true')
    await expect.poll(rowCount).toBeGreaterThan(collapsed)

    await press('{Enter}')
    await expect
      .poll(() => groupRow()!.getAttribute('aria-expanded'))
      .toBe('false')
    await expect.poll(rowCount).toBe(collapsed)
  })

  test('KB8: из редактора, меню и контекстного меню фокус возвращается в грид, Tab уводит из него', async () => {
    await render(
      <>
        <composed.KeyboardNavigation />
        <button id="after-grid">after</button>
      </>,
    )
    const cell = () =>
      document.querySelector<HTMLElement>(
        `${BODY_ROW}[data-index='2'] ${BODY_CELL}[data-column-id='age']`,
      )!
    await expect.poll(cell).toBeTruthy()
    const leaveGrid = async (from: HTMLElement) => {
      await expect.poll(() => active()).toBe(from)
      await press('{Tab}')
      await expect.poll(() => active().id).toBe('after-grid')
    }

    // Редактор cellEditing: Escape — на ячейку.
    cell().focus()
    await press('{Enter}')
    await expect.poll(() => active().tagName).toBe('INPUT')
    await press('{Escape}')
    await leaveGrid(cell())

    // Контекстное меню: Escape — меню закрыто, фокус на ячейке.
    cell().focus()
    await press('{Shift>}{F10}{/Shift}')
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    await press('{Escape}')
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
    await leaveGrid(cell())

    // Поповер закрепления в заголовке: Escape закрывает его и возвращает фокус
    // на ячейку заголовка.
    const head = headCellById('age')
    head.focus()
    await press('{F2}')
    const pin = head.querySelector<HTMLElement>(PIN_BUTTON)!
    for (let i = 0; i < 5 && !pin.contains(active()); i++) {
      await press('{Tab}')
    }
    await press('{Enter}')
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    await press('{Escape}')
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
    await leaveGrid(head)
  })

  test('KB10: аудит — каждый интерактивный контрол грида со всеми плагинами достижим с клавиатуры', async () => {
    await render(
      <composed.AllFeatures
        enableKeyboardNavigation
        enableColumnSorting
        enableColumnResizing
        enableColumnPinning
        enableColumnDragging
        enableGrouping
        enableRowSelection
        enableRowExpanding
        enableRowDragging
        enableRowActions
        enableCellEditing
        enableCellSelection
        enableContextMenu
        enableFooter
        columnCount={8}
        dataCount={20}
      />,
    )
    await expect
      .poll(() => document.querySelectorAll(`${BODY_ROW} ${BODY_CELL}`).length)
      .toBeGreaterThan(3)

    const root = document.querySelector<HTMLElement>('[role="grid"]')!
    const controls = Array.from(
      root.querySelectorAll<HTMLElement>(
        [
          'button',
          'input',
          'select',
          'textarea',
          'a[href]',
          '[role="button"]',
          '[role="checkbox"]',
          '[role="switch"]',
          '[role="separator"]',
          '[contenteditable="true"]',
        ].join(','),
      ),
    ).filter(
      el =>
        !el.hasAttribute('disabled') &&
        el.getAttribute('aria-disabled') !== 'true' &&
        // Скрытые зеркала контролов (нативный input у Base UI Checkbox).
        !el.closest('[aria-hidden="true"]'),
    )
    expect(controls.length).toBeGreaterThan(0)

    // Контрол живёт в ячейке навигации (достижим режимом действия) и не выключен
    // из обхода Tab.
    const unreachable = controls
      .filter(el => !el.closest('[data-kn-cell]') || el.tabIndex < 0)
      .map(el => el.outerHTML.slice(0, 120))
    expect(unreachable).toEqual([])
  })
})

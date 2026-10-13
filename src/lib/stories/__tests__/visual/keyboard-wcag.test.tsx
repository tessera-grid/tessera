import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { DEFAULT_LABELS } from '../../../core/localization'
import { COLUMN_EXPANDING_ID } from '../../../plugins/rowExpanding'
import { composed } from '../stories'

// Соответствие WCAG 2.1.1: каждое требование — свой именованный тест `KB<n>`
// (таблица требований в docs/decisions/0031-wcag-keyboard.md). Ввод — реальные
// CDP-клавиши, состояние читается из DOM и вычисленных стилей.

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

    // Группа `name` — верхняя строка над растянутым листом `firstName`.
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

  test('HS10: растянутый лист шапки — стрелки проходят его за один шаг; без навигации кебаб достижим Tab и открывается Enter', async () => {
    // С keyboardNavigation: `visits` растянут на две нижние строки под `info`.
    const nav = await render(<composed.HeaderGroupsShallowLeaves />)
    await expect.poll(() => headCellById('visits')).toBeTruthy()
    const gender = headCellById('gender')
    gender.focus()
    await expect.poll(() => active()).toBe(gender)
    await press('{ArrowRight}')
    await expect.poll(() => active()).toBe(headCellById('visits'))
    await press('{ArrowUp}')
    await expect.poll(() => active()).toBe(headCellById('info'))
    await press('{ArrowDown}')
    await expect.poll(() => active()).toBe(headCellById('visits'))
    await nav.unmount()

    // Без плагина: Tab идёт по строкам шапки — от кебаба группы `more-info` до кебаба
    // растянутого `visits` в той же строке; Enter открывает меню.
    await render(
      <composed.HeaderGroupsShallowLeaves enableKeyboardNavigation={false} />,
    )
    await expect.poll(() => headCellById('visits')).toBeTruthy()
    const kebab = (id: string) =>
      headCellById(id).querySelector<HTMLElement>(
        '[aria-label="Column options"]',
      )!
    kebab('more-info').focus()
    for (let i = 0; i < 10 && active() !== kebab('visits'); i++) {
      await press('{Tab}')
    }
    expect(active()).toBe(kebab('visits'))
    await press('{Enter}')
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role="menuitem"]')].map(item =>
          item.textContent?.trim(),
        ),
      )
      .toContain('Hide column')
  })

  test('KB2: ширина колонки меняется с клавиатуры через фокусируемый separator', async () => {
    await render(<composed.KeyboardNavigation enableColumnSizing />)
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
    // на кнопку-триггер, следующий Escape — на ячейку заголовка.
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
    await expect.poll(() => pin.contains(active())).toBe(true)
    await press('{Escape}')
    await leaveGrid(head)
  })

  test('KB10: аудит — каждый интерактивный контрол грида со всеми плагинами достижим с клавиатуры', async () => {
    await render(
      <composed.AllFeatures
        enableKeyboardNavigation
        enableColumnSorting
        enableColumnSizing
        enableColumnPinning
        enableColumnDragging
        enableRowGrouping
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

    const root = document.querySelector<HTMLElement>(
      '[role="grid"], [role="treegrid"]',
    )!
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

  // --- KB11–KB14: клавиатуры без F-ряда и блока навигации ----------------------

  /** Ячейка тела строки `index` в колонке `columnId`, с клавиатурной модальностью. */
  const focusBodyCell = async (index: number, columnId: string) => {
    const cell = () =>
      document.querySelector<HTMLElement>(
        `${BODY_ROW}[data-index='${index}'] ${BODY_CELL}[data-column-id='${columnId}']`,
      )
    await expect.poll(cell).toBeTruthy()
    cell()!.focus()
    await press('{ArrowRight}{ArrowLeft}')
    await expect
      .poll(() => active().getAttribute('data-column-id'))
      .toBe(columnId)
  }
  const colIndex = () => Number(active().getAttribute('aria-colindex'))
  const rowOf = (el: HTMLElement) =>
    el.closest('[role="row"]')?.getAttribute('aria-rowindex')

  test('KB11: Ctrl+стрелки прыгают к краям строки и колонки, как Home/End и Ctrl+Home/End', async () => {
    await render(<composed.A11yGrid />)
    await focusBodyCell(2, 'firstName')
    const colcount = Number(
      document.querySelector('[role="grid"]')!.getAttribute('aria-colcount'),
    )

    await press('{Control>}{ArrowRight}{/Control}')
    await expect.poll(colIndex).toBe(colcount)
    await press('{Control>}{ArrowLeft}{/Control}')
    await expect.poll(colIndex).toBe(1)

    await focusBodyCell(2, 'firstName')
    await press('{Control>}{ArrowUp}{/Control}')
    await expect.poll(() => active().getAttribute('role')).toBe('columnheader')
    expect(active().getAttribute('data-column-id')).toBe('firstName')

    await press('{Control>}{ArrowDown}{/Control}')
    await expect
      .poll(() => active().getAttribute('role'))
      .not.toBe('columnheader')
    expect(active().getAttribute('data-column-id')).toBe('firstName')
    const bottom = rowOf(active())
    // Та же строка, что у Ctrl+End, — последняя.
    await press('{Control>}{End}{/Control}')
    await expect.poll(() => rowOf(active())).toBe(bottom)
  })

  test('KB12: Ctrl+Enter входит к кнопкам заголовка, не сортируя', async () => {
    await render(<composed.A11yGrid />)
    await expect.poll(() => headCellById('country')).toBeTruthy()
    const head = headCellById('country')
    head.focus()
    await press('{ArrowRight}{ArrowLeft}')
    await expect.poll(active).toBe(head)
    const sort = head.getAttribute('aria-sort')

    await press('{Control>}{Enter}{/Control}')
    await expect.poll(() => active().tagName).toBe('BUTTON')
    expect(head.contains(active())).toBe(true)
    expect(head.getAttribute('aria-sort')).toBe(sort)

    await press('{Escape}')
    await expect.poll(active).toBe(head)
  })

  test('KB13: Alt+↑/↓ сдвигают на экран, как PageUp/PageDown', async () => {
    await render(<composed.A11yGrid />)
    await focusBodyCell(0, 'country')
    const start = rowOf(active())

    await press('{PageDown}')
    await expect.poll(() => rowOf(active())).not.toBe(start)
    const paged = rowOf(active())
    await press('{PageUp}')
    await expect.poll(() => rowOf(active())).toBe(start)

    await press('{Alt>}{ArrowDown}{/Alt}')
    await expect.poll(() => rowOf(active())).toBe(paged)
    await press('{Alt>}{ArrowUp}{/Alt}')
    await expect.poll(() => rowOf(active())).toBe(start)
  })

  test('KB14: Ctrl+Shift+Enter открывает контекстное меню активной ячейки, как Shift+F10', async () => {
    await render(<composed.A11yGrid />)
    await focusBodyCell(1, 'country')

    await press('{Control>}{Shift>}{Enter}{/Shift}{/Control}')
    await expect
      .poll(() =>
        document.querySelector('[role="menu"]')?.getAttribute('aria-label'),
      )
      .toBe(DEFAULT_LABELS.contextMenu)

    await press('{Escape}')
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
  })
})

import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../DataGrid.stories'
import { getScroller } from '../helpers'
import { cssVar, nextFrame } from './core-helpers'

// Плагин keyboardNavigation: каждое требование — свой именованный тест `KN<n>`
// (таблица требований в docs/decisions/0021-keyboard-navigation.md, правило
// именования — ADR 0009). Истории гоняются реальным вводом (`userEvent` — CDP-клавиши
// и клики), состояние читается из DOM-контракта: роль контейнера/ячеек, roving
// `tabindex`, `data-kn-active`, `document.activeElement`, `data-index` строки,
// `data-column-id` ячейки.

const composed = composeStories(stories)

type StoryArgs = Partial<Parameters<typeof composed.KeyboardNavigation>[0]>

const NAV_CELL = '[data-kn-cell]'
const BODY_ROW = '.data-grid__body-row'
const BODY_CELL = '.data-grid__body-cell'
const HEAD_CELL = '.data-grid__head-cell'

// --- DOM helpers --------------------------------------------------------------

const gridRoot = () =>
  document.querySelector<HTMLElement>('[role="grid"], [role="table"]')!

const active = () => document.activeElement as HTMLElement

/** Индекс строки тела ячейки (`data-index`) или `-1` для заголовка. */
const rowIndexOf = (cell: Element) => {
  const row = cell.closest(BODY_ROW)
  return row ? Number(row.getAttribute('data-index')) : -1
}

const columnIdOf = (cell: Element) => cell.getAttribute('data-column-id')

const bodyCellAt = (rowIndex: number, columnId: string) =>
  document.querySelector<HTMLElement>(
    `${BODY_ROW}[data-index='${rowIndex}'] ${BODY_CELL}[data-column-id='${columnId}']`,
  )!

/** Ячейки строки (тела или заголовка) в визуальном порядке слева направо. */
const cellsLeftRight = (rowIndex: number) => {
  const selector =
    rowIndex < 0
      ? HEAD_CELL
      : `${BODY_ROW}[data-index='${rowIndex}'] ${BODY_CELL}`
  return Array.from(document.querySelectorAll<HTMLElement>(selector))
    .filter(cell => cell.hasAttribute('data-kn-cell'))
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
}

const tabStops = () =>
  Array.from(document.querySelectorAll<HTMLElement>(NAV_CELL)).filter(
    cell => cell.tabIndex === 0,
  )

/** Видимая часть тела: между низом sticky-шапки и нижним краем клиентской области. */
const bodyViewport = () => {
  const scroller = getScroller()
  const rect = scroller.getBoundingClientRect()
  const head = document
    .querySelector('.data-grid__head')!
    .getBoundingClientRect()
  return {
    top: head.bottom,
    bottom: rect.top + scroller.clientTop + scroller.clientHeight,
    left: rect.left + scroller.clientLeft,
    right: rect.left + scroller.clientLeft + scroller.clientWidth,
  }
}

const press = (keys: string) => userEvent.keyboard(keys)

// --- Render -------------------------------------------------------------------

async function renderNavigation(args: StoryArgs = {}) {
  const screen = await render(<composed.KeyboardNavigation {...args} />)
  await expect
    .poll(() => document.querySelectorAll(`${BODY_ROW} ${BODY_CELL}`).length)
    .toBeGreaterThan(3)
  return screen
}

/** Сфокусировать ячейку тела `(row, n-я слева)` кликом и дождаться активации. */
async function focusBodyCell(rowIndex: number, position: number) {
  const cell = cellsLeftRight(rowIndex)[position]
  await userEvent.click(cell)
  await expect.poll(() => active()).toBe(cell)
  return cell
}

describe('Клавиатурная навигация (keyboardNavigation)', () => {
  test('KN1: с плагином контейнер — role="grid", ячейки тела — gridcell; без него — table/cell', async () => {
    const screen = await renderNavigation()
    expect(gridRoot().getAttribute('role')).toBe('grid')
    document
      .querySelectorAll(BODY_CELL)
      .forEach(cell => expect(cell.getAttribute('role')).toBe('gridcell'))
    await screen.unmount()

    await renderNavigation({ enableKeyboardNavigation: false })
    expect(gridRoot().getAttribute('role')).toBe('table')
    document
      .querySelectorAll(BODY_CELL)
      .forEach(cell => expect(cell.getAttribute('role')).toBe('cell'))
  })

  test('KN3: область прокрутки достижима с клавиатуры (axe scrollable-region-focusable)', async () => {
    await renderNavigation()

    const { violations } = await axe.run(getScroller().parentElement!, {
      runOnly: { type: 'rule', values: ['scrollable-region-focusable'] },
    })
    expect(violations).toEqual([])
  })

  test('KN4: стрелки двигают активную ячейку на соседнюю, на краях — кламп', async () => {
    await renderNavigation()
    const start = await focusBodyCell(1, 1)

    await press('{ArrowRight}')
    await expect.poll(() => active()).toBe(cellsLeftRight(1)[2])
    await press('{ArrowDown}')
    await expect
      .poll(() => active())
      .toBe(bodyCellAt(2, columnIdOf(cellsLeftRight(1)[2])!))
    await press('{ArrowUp}{ArrowLeft}')
    await expect.poll(() => active()).toBe(start)

    // Левый край: дальше первой колонки не уходит.
    await press('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    await expect.poll(() => active()).toBe(cellsLeftRight(1)[0])
    // Верхний край: из заголовка выше не уходит.
    await press('{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}')
    await expect.poll(() => active().getAttribute('role')).toBe('columnheader')
    expect(active()).toBe(cellsLeftRight(-1)[0])
  })

  test('KN5: Home/End — края строки, Ctrl+Home/Ctrl+End — края сетки', async () => {
    const dataCount = 60
    await renderNavigation({ dataCount })
    await focusBodyCell(3, 2)

    await press('{End}')
    await expect
      .poll(() => active().getAttribute('data-last-cell-in-row'))
      .toBe('true')
    expect(rowIndexOf(active())).toBe(3)

    await press('{Home}')
    await expect
      .poll(() => active().getAttribute('data-first-cell-in-row'))
      .toBe('true')
    expect(rowIndexOf(active())).toBe(3)

    await press('{Control>}{End}{/Control}')
    await expect.poll(() => rowIndexOf(active())).toBe(dataCount - 1)
    expect(active().getAttribute('data-last-cell-in-row')).toBe('true')

    await press('{Control>}{Home}{/Control}')
    await expect.poll(() => active().getAttribute('role')).toBe('columnheader')
    expect(active().getAttribute('data-first-header-in-row')).toBe('true')
  })

  test('KN6: PageDown/PageUp сдвигают на видимую высоту тела в строках', async () => {
    await renderNavigation()
    const start = await focusBodyCell(0, 1)
    const { top, bottom } = bodyViewport()
    const rowHeight = start.getBoundingClientRect().height
    const pageRows = Math.floor((bottom - top) / rowHeight)

    await press('{PageDown}')
    await expect.poll(() => rowIndexOf(active())).toBe(pageRows)
    await press('{PageDown}')
    await expect.poll(() => rowIndexOf(active())).toBe(pageRows * 2)
    await press('{PageUp}')
    await expect.poll(() => rowIndexOf(active())).toBe(pageRows)
    expect(columnIdOf(active())).toBe(columnIdOf(start))
  })

  test('KN7: roving tabindex — ровно одна ячейка грида tabindex=0, прочие -1', async () => {
    await renderNavigation()

    // До взаимодействия единственный tab-stop — первая ячейка заголовка.
    expect(tabStops()).toEqual([cellsLeftRight(-1)[0]])
    document
      .querySelectorAll<HTMLElement>(NAV_CELL)
      .forEach(cell => expect([0, -1]).toContain(cell.tabIndex))

    await focusBodyCell(2, 2)
    await press('{ArrowDown}')
    await expect.poll(() => rowIndexOf(active())).toBe(3)
    expect(tabStops()).toEqual([active()])
    expect(active().getAttribute('data-kn-active')).toBe('true')
  })

  test('KN8: переход за пределы окна доводит ячейку в видимую область и фокусирует её', async () => {
    const dataCount = 500
    await renderNavigation({ dataCount })
    await focusBodyCell(0, 1)

    await press('{Control>}{End}{/Control}')
    await expect.poll(() => rowIndexOf(active())).toBe(dataCount - 1)
    await nextFrame()

    const rect = active().getBoundingClientRect()
    const view = bodyViewport()
    expect(rect.top).toBeGreaterThanOrEqual(view.top - 1)
    expect(rect.bottom).toBeLessThanOrEqual(view.bottom + 1)
    expect(rect.left).toBeGreaterThanOrEqual(view.left - 1)
    expect(rect.right).toBeLessThanOrEqual(view.right + 1)

    // Обратно к заголовку: горизонталь возвращается к первой колонке.
    await press('{Control>}{Home}{/Control}')
    await expect.poll(() => active().getAttribute('role')).toBe('columnheader')
    expect(active().getBoundingClientRect().left).toBeGreaterThanOrEqual(
      view.left - 1,
    )
  })

  test('KN9: сфокусированная ячейка не размонтируется вне вьюпорта', async () => {
    await renderNavigation()
    const cell = await focusBodyCell(0, 2)
    const scroller = getScroller()

    scroller.scrollTop = scroller.scrollHeight
    scroller.scrollLeft = scroller.scrollWidth
    for (let i = 0; i < 6; i++) {
      await nextFrame()
    }

    // Окно ушло далеко, но активная строка/колонка запинованы в виртуализаторе.
    expect(document.querySelector(`${BODY_ROW}[data-index='40']`)).toBeNull()
    expect(cell.isConnected).toBe(true)
    expect(active()).toBe(cell)
  })

  test('KN10: после прокрутки колесом и возврата активная ячейка сохраняет фокус и позицию', async () => {
    await renderNavigation()
    const cell = await focusBodyCell(1, 2)
    const scroller = getScroller()

    for (let i = 0; i < 10; i++) {
      scroller.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 800, bubbles: true }),
      )
      scroller.scrollTop += 800
      await nextFrame()
    }
    scroller.scrollTop = 0
    for (let i = 0; i < 6; i++) {
      await nextFrame()
    }

    expect(active()).toBe(cell)
    expect(cell.tabIndex).toBe(0)
    await press('{ArrowDown}')
    await expect.poll(() => active()).toBe(bodyCellAt(2, columnIdOf(cell)!))
  })

  test('KN14: при enabled:false плагин инертен — role="table", ни tabindex, ни data-kn-cell', async () => {
    await renderNavigation({
      enableKeyboardNavigation: false,
      enableCellSelection: false,
    })

    expect(gridRoot().getAttribute('role')).toBe('table')
    expect(document.querySelectorAll(NAV_CELL)).toHaveLength(0)
    expect(
      document.querySelectorAll(
        `${HEAD_CELL}[tabindex], ${BODY_CELL}[tabindex]`,
      ),
    ).toHaveLength(0)
  })

  test('KN15: клик по ячейке делает её активной — навигация продолжается с неё', async () => {
    await renderNavigation()
    const cell = cellsLeftRight(4)[3]

    await userEvent.click(cell)
    await expect.poll(() => cell.getAttribute('data-kn-active')).toBe('true')
    expect(cell.tabIndex).toBe(0)

    await press('{ArrowRight}')
    await expect.poll(() => active()).toBe(cellsLeftRight(4)[4])
  })

  test('KN16: строка заголовка в модели — ↑ с первой строки тела в заголовок, ↓ обратно', async () => {
    await renderNavigation()
    const start = await focusBodyCell(0, 2)

    await press('{ArrowUp}')
    await expect.poll(() => active().getAttribute('role')).toBe('columnheader')
    expect(columnIdOf(active())).toBe(columnIdOf(start))

    await press('{ArrowDown}')
    await expect.poll(() => active()).toBe(start)
  })

  test('KN17: активная ячейка, сфокусированная с клавиатуры, несёт контур фокуса по токену', async () => {
    await renderNavigation({ enableCellSelection: false })
    await focusBodyCell(1, 1)

    await press('{ArrowRight}')
    await expect.poll(() => active()).toBe(cellsLeftRight(1)[2])

    const cell = active()
    const style = getComputedStyle(cell)
    expect(cell.matches(':focus-visible')).toBe(true)
    expect(style.outlineStyle).toBe('solid')
    expect(style.outlineWidth).toBe(cssVar('--tsr-comp-focus-ring-width'))
  })

  test('KN18: при cellSelection стрелка схлопывает выделение в новую активную ячейку', async () => {
    await renderNavigation()
    await focusBodyCell(2, 2)

    await press('{ArrowRight}')
    await expect
      .poll(() => active().getAttribute('data-cell-selected'))
      .toBe('true')
    expect(
      document.querySelectorAll(`${BODY_CELL}[data-cell-selected='true']`),
    ).toHaveLength(1)
  })

  test('KN19: при cellSelection Shift+стрелка расширяет диапазон от активной ячейки', async () => {
    await renderNavigation()
    const anchor = await focusBodyCell(2, 2)

    await press('{Shift>}{ArrowRight}{ArrowDown}{/Shift}')
    await expect
      .poll(
        () =>
          document.querySelectorAll(`${BODY_CELL}[data-cell-selected='true']`)
            .length,
      )
      .toBe(4)
    // Активная ячейка (якорь) не сдвинулась.
    expect(active()).toBe(anchor)
    expect(anchor.getAttribute('data-cell-focused')).toBe('true')
  })
})

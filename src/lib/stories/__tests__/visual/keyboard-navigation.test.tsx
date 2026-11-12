import axe from 'axe-core'
import { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import type { ActiveCell } from '../../../core/keyboardNavigation'
import { StoryComponent } from '../../DataGridStory'
import type { StoryProps } from '../../DataGridStory.types'
import { normalizeArgs } from '../../__mocks__/utils/normalizeArgs'
import { composed } from '../stories'
import { getScroller, humanClick } from '../helpers'
import { cssVar, nextFrame } from './core-helpers'

// Плагин keyboardNavigation: каждое требование — свой именованный тест `KN<n>`
// (таблица требований в docs/decisions/0021-keyboard-navigation.md, правило
// именования — ADR 0009). Истории гоняются реальным вводом (`userEvent` — CDP-клавиши
// и клики), состояние читается из DOM-контракта: роль контейнера/ячеек, roving
// `tabindex`, `data-kn-active`, `document.activeElement`, `data-index` строки,
// `data-column-id` ячейки.

type StoryArgs = Partial<Parameters<typeof composed.KeyboardPlayground>[0]>

const NAV_CELL = '[data-kn-cell]'
const BODY_ROW = '.data-grid__body-row'
const BODY_CELL = '.data-grid__body-cell'
const HEAD_CELL = '.data-grid__head-cell'

// --- DOM helpers --------------------------------------------------------------

const gridRoot = () =>
  document.querySelector<HTMLElement>(
    '[role="grid"], [role="treegrid"], [role="table"]',
  )!

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
  const screen = await render(<composed.KeyboardPlayground {...args} />)
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

/**
 * Грид между двумя внешними кнопками — чтобы наблюдать уход фокуса по Tab. Грид истории
 * без её консоли и тулбара: их кнопки стояли бы между гридом и соседом.
 */
async function renderWithNeighbours() {
  const screen = await render(
    <>
      <button id="before-grid">before</button>
      <StoryComponent
        {...normalizeArgs(composed.KeyboardPlayground.args as StoryProps)}
        // «Настройки вида» ставят тулбар — свою остановку Tab (TB11); здесь — уход из тела.
        enableToolbar={false}
      />
      <button id="after-grid">after</button>
    </>,
  )
  await expect
    .poll(() => document.querySelectorAll(`${BODY_ROW} ${BODY_CELL}`).length)
    .toBeGreaterThan(3)
  return screen
}

/** Инлайн-ввод редактора cellEditing. */
const EDIT_INPUT = '.data-grid__body-cell input'

const headCellOf = (columnId: string) =>
  document.querySelector<HTMLElement>(
    `${HEAD_CELL}[data-column-id='${columnId}']`,
  )!

/** Позиция колонки слева направо в строке тела. */
const columnPosition = (rowIndex: number, columnId: string) =>
  cellsLeftRight(rowIndex).findIndex(cell => columnIdOf(cell) === columnId)

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
    // Контур — по :focus-visible или по признаку клавиатурного ввода (Firefox, CB5).
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

  test('KN28: стрелка на невыбираемую ячейку (служебная колонка, шапка) снимает выделение ячеек', async () => {
    await renderNavigation({ enableRowSelection: true })
    const selected = () =>
      document.querySelectorAll(`${BODY_CELL}[data-cell-selected='true']`)
        .length
    const toFirstDataCell = async () => {
      const [, firstData] = cellsLeftRight(2)
      firstData.focus()
      await press('{ArrowDown}{ArrowUp}')
      await expect.poll(selected).toBe(1)
    }

    // Служебная колонка выбора слева от первой колонки данных.
    await toFirstDataCell()
    await press('{ArrowLeft}')
    await expect
      .poll(() => active().getAttribute('data-actions-column-cell'))
      .toBe('true')
    await expect.poll(selected).toBe(0)
    await press('{ArrowDown}')
    expect(selected()).toBe(0)

    // Шапка.
    await toFirstDataCell()
    await press('{Control>}{ArrowUp}{/Control}')
    await expect.poll(() => active().getAttribute('role')).toBe('columnheader')
    await expect.poll(selected).toBe(0)
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

  // --- Срез 2: один tab-stop, режим действия, действия плагинов ------------------

  test('KN2: Tab/Shift+Tab с ячейки уводят фокус из грида', async () => {
    await renderWithNeighbours()
    await focusBodyCell(2, 2)

    await press('{Tab}')
    await expect.poll(() => active().id).toBe('after-grid')

    await focusBodyCell(2, 2)
    await press('{Shift>}{Tab}{/Shift}')
    await expect.poll(() => active().id).toBe('before-grid')
  })

  test('KN20: вход в грид с клавиатуры попадает на активную ячейку', async () => {
    await renderWithNeighbours()
    const cell = await focusBodyCell(3, 3)

    document.getElementById('before-grid')!.focus()
    await press('{Tab}')
    await expect.poll(() => active()).toBe(cell)

    document.getElementById('after-grid')!.focus()
    await press('{Shift>}{Tab}{/Shift}')
    await expect.poll(() => active()).toBe(cell)
  })

  test('KN11: Enter/F2 на ячейке с виджетом фокусирует виджет, Escape — обратно на ячейку', async () => {
    await renderNavigation()
    // Ячейка колонки выбора: собственного действия на Enter нет — режим действия.
    // Фокус программный: клик в центр ячейки попал бы прямо в чекбокс.
    const cell = cellsLeftRight(1)[0]
    cell.focus()
    await expect.poll(() => active()).toBe(cell)

    await press('{Enter}')
    await expect.poll(() => active().getAttribute('role')).toBe('checkbox')
    expect(cell.contains(active())).toBe(true)

    await press('{Escape}')
    await expect.poll(() => active()).toBe(cell)

    await press('{F2}')
    await expect.poll(() => active().getAttribute('role')).toBe('checkbox')
  })

  test('KN21: в режиме действия Tab/Shift+Tab ходят по виджетам ячейки по кругу', async () => {
    await renderNavigation()
    const head = headCellOf('firstName')
    head.focus()
    const widgets = () =>
      Array.from(head.querySelectorAll<HTMLElement>('button'))
    expect(widgets().length).toBeGreaterThan(1)

    await press('{F2}')
    await expect.poll(() => active()).toBe(widgets()[0])
    await press('{Tab}')
    await expect.poll(() => active()).toBe(widgets()[1])
    for (let i = 2; i < widgets().length; i++) {
      await press('{Tab}')
    }
    await press('{Tab}')
    await expect.poll(() => active()).toBe(widgets()[0])
    await press('{Shift>}{Tab}{/Shift}')
    await expect.poll(() => active()).toBe(widgets().at(-1))
    expect(head.contains(active())).toBe(true)
  })

  test('KN22: исчезнувший сфокусированный виджет возвращает фокус на свою ячейку', async () => {
    await renderNavigation()
    const cell = await focusBodyCell(2, columnPosition(2, 'age'))

    await press('{Enter}')
    await expect.poll(() => active().matches(EDIT_INPUT)).toBe(true)
    // Коммит закрывает редактор — поле исчезает из DOM.
    await press('{Enter}')
    await expect.poll(() => active().hasAttribute('data-kn-cell')).toBe(true)
    expect(columnIdOf(active())).toBe('age')
    expect(rowIndexOf(active())).toBe(rowIndexOf(cell))
  })

  test('KN12: Space на ячейке тела переключает выбор строки и зовёт onSelectRow', async () => {
    const onSelectRow = vi.fn()
    await renderNavigation({ onSelectRow })
    const cell = await focusBodyCell(1, 2)
    const row = () => cell.closest(BODY_ROW)!

    await press('[Space]')
    await expect.poll(() => row().getAttribute('data-selected')).toBe('true')
    expect(onSelectRow).toHaveBeenCalledTimes(1)
    expect(active()).toBe(cell)

    await press('[Space]')
    await expect.poll(() => row().getAttribute('data-selected')).toBe('false')
    expect(onSelectRow).toHaveBeenCalledTimes(2)
  })

  test('KN23: при активном rowSelection или cellSelection сетка несёт aria-multiselectable', async () => {
    const screen = await renderNavigation({ enableCellSelection: false })
    expect(gridRoot().getAttribute('aria-multiselectable')).toBe('true')
    await screen.unmount()

    await renderNavigation({
      enableRowSelection: false,
      enableCellSelection: false,
    })
    expect(gridRoot().hasAttribute('aria-multiselectable')).toBe(false)
  })

  test('KN13: Enter на сортируемом заголовке меняет сортировку', async () => {
    await renderNavigation()
    const head = headCellOf('age')
    const before = head.getAttribute('aria-sort')
    head.focus()

    await press('{Enter}')
    await expect
      .poll(() => headCellOf('age').getAttribute('aria-sort'))
      .not.toBe(before)
    expect(active()).toBe(headCellOf('age'))
  })

  test('KN24: Enter на ячейке колонки раскрытия раскрывает и сворачивает строку', async () => {
    await render(<composed.RowExpandingPlayground enableKeyboardNavigation />)
    await expect
      .poll(() => document.querySelectorAll(`${BODY_ROW} ${BODY_CELL}`).length)
      .toBeGreaterThan(3)
    const expanderCell = () =>
      document.querySelector<HTMLElement>(
        `${BODY_ROW}[data-index='0'] ${BODY_CELL}[data-column-id^='actionColumn__rowExpanding']`,
      )!
    const row = () => document.querySelector(`${BODY_ROW}[data-index='0']`)!
    expect(row().getAttribute('aria-expanded')).toBe('false')

    expanderCell().focus()
    await press('{Enter}')
    await expect.poll(() => row().getAttribute('aria-expanded')).toBe('true')
    await press('{Enter}')
    await expect.poll(() => row().getAttribute('aria-expanded')).toBe('false')
  })

  test('KN25: Enter/F2 на редактируемой ячейке открывают редактор', async () => {
    await renderNavigation()
    await focusBodyCell(2, columnPosition(2, 'age'))

    await press('{Enter}')
    await expect.poll(() => active().matches(EDIT_INPUT)).toBe(true)
    await press('{Escape}')
    await expect.poll(() => columnIdOf(active())).toBe('age')

    await press('{F2}')
    await expect.poll(() => active().matches(EDIT_INPUT)).toBe(true)
  })

  test('KN30: фокус, пришедший до конца нажатия указателя, не перенаправляется — правка по кнопке не закрывается сразу', async () => {
    await renderNavigation()
    const cell = () => bodyCellAt(0, 'age')
    await userEvent.hover(cell())
    // Кнопку отпускают не в той же задаче, что нажали: редактор получает фокус по
    // click — уже после сброса пометки «фокус от указателя» на mousedown.
    await humanClick(cell().querySelector<HTMLElement>('.cell__button button')!)

    await expect.poll(() => active().matches(EDIT_INPUT)).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(active().matches(EDIT_INPUT)).toBe(true)
    expect(cell().querySelector('input')).toBe(active())
  })

  test('KN26: Shift+F10 открывает контекстное меню у активной ячейки', async () => {
    await renderNavigation()
    const cell = await focusBodyCell(3, 2)

    await press('{Shift>}{F10}{/Shift}')
    const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
    await expect.poll(() => menu()).not.toBeNull()
    const cellRect = cell.getBoundingClientRect()
    const menuRect = menu()!.getBoundingClientRect()
    // Меню открыто у ячейки (от её центра), а не в углу экрана. По горизонтали
    // Base UI может сдвинуть меню, чтобы оно поместилось во вьюпорт, — поэтому
    // проверяем перекрытие с ячейкой, а не точку старта.
    expect(menuRect.left).toBeLessThanOrEqual(cellRect.right)
    expect(menuRect.right).toBeGreaterThanOrEqual(cellRect.left)
    expect(menuRect.top).toBeGreaterThanOrEqual(cellRect.top)
    expect(menuRect.top).toBeLessThanOrEqual(cellRect.bottom)

    await press('{Escape}')
    await expect.poll(() => menu()).toBeNull()
  })
})

// Хост с активной ячейкой у приложения (KN31): activeCell в useState,
// onActiveCellChange пишет её обратно.
const NAV_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'rank', accessorKey: 'rank', header: 'Rank' },
]
const NAV_DATA = [
  { id: '1', name: 'A', rank: 1 },
  { id: '2', name: 'B', rank: 2 },
  { id: '3', name: 'C', rank: 3 },
]
const navControl: { set?: (next: ActiveCell) => void } = {}

const ControlledNavigation = ({
  onActiveCellChange,
}: {
  onActiveCellChange: (next: ActiveCell) => void
}) => {
  const [activeCell, setActiveCell] = useState<ActiveCell>()
  navControl.set = setActiveCell
  const table = useCreateTable({
    columns: NAV_COLUMNS,
    data: NAV_DATA,
    enableKeyboardNavigation: true,
    activeCell,
    onActiveCellChange: next => {
      onActiveCellChange(next)
      setActiveCell(next)
    },
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Клавиатурная навигация — активная ячейка у приложения', () => {
  test('KN31: приложение ставит активную ячейку через activeCell; перемещение стрелкой приходит в onActiveCellChange', async () => {
    const onActiveCellChange = vi.fn()
    await render(
      <ControlledNavigation onActiveCellChange={onActiveCellChange} />,
    )
    await expect.poll(() => tabStops().length).toBe(1)

    navControl.set!({ rowIndex: 1, columnIndex: 1 })
    await expect.poll(() => tabStops()[0]).toBe(bodyCellAt(1, 'rank'))
    expect(onActiveCellChange).not.toHaveBeenCalled()

    tabStops()[0].focus()
    await press('{ArrowUp}')
    await expect.poll(() => tabStops()[0]).toBe(bodyCellAt(0, 'rank'))
    expect(onActiveCellChange).toHaveBeenLastCalledWith({
      rowIndex: 0,
      columnIndex: 1,
    })
  })
})

// Экземпляр таблицы — её store: React-адаптер отдаёт новый объект на каждый рендер.
const navToggle: { set?: (on: boolean) => void; stores: Set<unknown> } = {
  stores: new Set(),
}

const ToggledNavigation = () => {
  const [enabled, setEnabled] = useState(false)
  navToggle.set = setEnabled
  const table = useCreateTable({
    columns: NAV_COLUMNS,
    data: NAV_DATA,
    enableKeyboardNavigation: enabled,
  })
  navToggle.stores.add(table.store)
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Клавиатурная навигация — опция ядра (ADR 0170)', () => {
  test('CH1: enableKeyboardNavigation на лету меняет роль грида, tabindex ячеек и обработку клавиш без пересоздания таблицы', async () => {
    navToggle.stores.clear()
    await render(<ToggledNavigation />)
    await expect.poll(() => gridRoot()?.getAttribute('role')).toBe('table')
    const root = gridRoot()
    // StrictMode на React 18 создаёт таблицу на монтировании дважды: важно, что дальше новых нет.
    const created = navToggle.stores.size
    expect(document.querySelectorAll(NAV_CELL)).toHaveLength(0)

    navToggle.set!(true)
    await expect.poll(() => gridRoot().getAttribute('role')).toBe('grid')
    expect(gridRoot()).toBe(root)
    await expect.poll(() => tabStops().length).toBe(1)
    await humanClick(bodyCellAt(0, 'name'))
    await press('{ArrowDown}')
    await expect.poll(active).toBe(bodyCellAt(1, 'name'))
    expect(tabStops()).toEqual([bodyCellAt(1, 'name')])

    navToggle.set!(false)
    await expect.poll(() => gridRoot().getAttribute('role')).toBe('table')
    expect(gridRoot()).toBe(root)
    expect(document.querySelectorAll(NAV_CELL)).toHaveLength(0)
    // Клавиши навигация обрабатывает только на своих ячейках: их больше нет.
    expect(document.querySelector('[data-kn-active]')).toBeNull()
    await press('{ArrowDown}')
    expect(document.querySelector('[data-kn-active]')).toBeNull()
    expect(navToggle.stores.size).toBe(created)
  })
})

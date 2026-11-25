import { useState } from 'react'
import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { humanClick, revealedHandleWidth, settledCenter } from '../helpers'

import { Stories, renderGrid } from '../helpers'
import { composed } from '../stories'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  resolveColor,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { pinViaPopover } from './column-pinning-helpers'
import { tableLabels } from '../labels'
import { scrollLayer } from '../../../core/scrollStretch'
import { EDGE_ZONE } from '../../../shared/edgeScroll'
import { useCreateTable } from '../../../core/useCreateTable'
import { setInputModality } from '../../../core/inputModality'
import { DataGrid } from '../../../grid/DataGrid'
import { columnSorting } from '../../../plugins/columnSorting'
import {
  cellEditing,
  editHistory,
  columnFiltering,
  dataExport,
  columnPinning,
  columnSizing,
  headerActionMenu,
  rowSelection,
  rowExpanding,
  rowGrouping,
  rowDragging,
  rowActions,
  rowActionMenu,
  cellSelection,
  contextMenu,
  pagination,
  backToTop,
  failureLog,
  unsavedChanges,
  columnVisibility,
  columnAggregation,
  quickSearch,
  exportFormats,
  columnTotals,
} from '../../../plugins'
import { columnSizingLabels } from '../../../plugins/columnSizing/labels'
import { cellSelectionLabels } from '../../../plugins/cellSelection/labels'
import type { RowAction } from '../../../core/headerActions'
import { definePlugin } from '../../../core/definePlugin'
import { dataExportLabels } from '../../../plugins/dataExport/labels'
import { backToTopLabels } from '../../../plugins/backToTop/labels'
import { paginationLabels } from '../../../plugins/pagination/labels'
import { rowExpandingLabels } from '../../../plugins/rowExpanding/labels'
import { rowSelectionLabels } from '../../../plugins/rowSelection/labels'
import { columnAggregationLabels } from '../../../plugins/columnAggregation/labels'
import { columnVisibilityLabels } from '../../../plugins/columnVisibility/labels'
import { quickSearchLabels } from '../../../plugins/quickSearch/labels'
import { columnDraggingLabels } from '../../../plugins/columnDragging/labels'
import { rowDraggingLabels } from '../../../plugins/rowDragging/labels'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { columnPinningLabels } from '../../../plugins/columnPinning/labels'
import { contextMenuLabels } from '../../../plugins/contextMenu/labels'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'
import { overflowColumns, overflowData } from '../../__mocks__/overflowColumns'
import { Bubble } from '../../../ui/Bubble'
import { PopupEntry } from '../../../ui/Popup/PopupEntry'

// Касания (ADR 0086, TU1–TU12, TU14): проект `touch` в `npm test` — Chromium без
// наведения и с грубым указателем — и проект `mobile` в `test:engines` (iPhone, Pixel).
// Жесты пальцем по шагам Playwright умеет только через CDP — в Chromium.

interface Point {
  x: number
  y: number
}

const touch = commands as unknown as {
  realTap: (at: Point) => Promise<void>
  realSwipe: (from: Point, to: Point, steps?: number) => Promise<void>
  realTouchDown: (fingers: Point[]) => Promise<void>
  realTouchMove: (from: Point, to: Point, steps?: number) => Promise<void>
  realTouchUp: () => Promise<void>
  realMouseDown: (at: Point) => Promise<void>
  realMouseUp: () => Promise<void>
}

const chromium = server.browser === 'chromium'

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'
const BODY_ROW = '.data-grid__body-row'
const HANDLE = '.drag__handler--column'
const GRIP = '.resize__handler--column'
/** Ожидание долгого нажатия с запасом (ADR 0086, §5). */
const LONG_PRESS_WAIT_MS = 700

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
/**
 * Нажатие на пункт списка с поиском: эмуляция iPhone в Playwright на этом пункте не синтезирует
 * `click` из тапа (touchend есть, click нет), проверить можно только на устройстве.
 */
const tapOption = async (option: HTMLElement) => {
  if (server.browser === 'webkit') option.click()
  else await touch.realTap(await settledCenter(() => option))
}

const center = (el: Element): Point => {
  const box = el.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}
const menus = () => document.querySelectorAll('[role="menu"]')
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const closeMenu = async () => {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )
  menu()?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )
  await expect.poll(() => menus().length).toBe(0)
}
const headById = (id: string) =>
  document.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)!
const rowAt = (index: number) =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-index='${index}']`)!
const cellOf = (row: HTMLElement, columnId: string) =>
  row.querySelector<HTMLElement>(`${BODY_CELL}[data-column-id='${columnId}']`)!
/** Колонка данных мока — не служебная и не закреплённая. */
const dataColumn = () => 'firstName'
const headOrder = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`${HEAD_CELL}[data-column-id]`),
  )
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    .map(cell => cell.getAttribute('data-column-id'))
const rowOrder = () =>
  Array.from(document.querySelectorAll<HTMLElement>(BODY_ROW))
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )
    .map(row => row.getAttribute('data-row-id'))
/** Скрытая кнопка видна: непрозрачна и раскрыта по ширине. */
const shown = (el: Element) => {
  const style = getComputedStyle(el)
  return Number(style.opacity) === 1 && el.getBoundingClientRect().width > 1
}
/** Скрытые кнопки ячейки и строки внутри элемента. */
const hiddenButtons = (scope: Element) =>
  Array.from(
    scope.querySelectorAll('.cell__button--hidden, .row__button--hidden'),
  )

/** Скрытые кнопки строки и её ячейки `columnId` — их проявляет касание ячейки. */
const touchedButtons = (row: HTMLElement, columnId: string) => [
  ...Array.from(row.querySelectorAll('.row__button--hidden')),
  ...Array.from(
    cellOf(row, columnId).querySelectorAll('.cell__button--hidden'),
  ),
]

/** Коснуться текста ячейки — левой части, не кнопок; ячейку сперва в окно. */
const tapCell = async (row: HTMLElement, columnId: string) => {
  const cell = cellOf(row, columnId)
  // К левому краю: справа может лежать закреплённая колонка.
  cell.scrollIntoView({ block: 'nearest', inline: 'start' })
  await new Promise(resolve => requestAnimationFrame(resolve))
  const box = cell.getBoundingClientRect()
  await touch.realTap({ x: box.left + 8, y: box.top + box.height / 2 })
}

/** Дождаться конца раскрытия кнопок (ADR 0076): замер посреди него видит узкую обёртку. */
const settle = async (scope: Element) => {
  await new Promise(resolve => requestAnimationFrame(resolve))
  await Promise.all(
    scope
      .getAnimations({ subtree: true })
      .filter(
        animation => animation.effect?.getTiming().iterations !== Infinity,
      )
      .map(animation => animation.finished.catch(() => undefined)),
  )
}

const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('Касания (ADR 0086)', () => {
  test('TU1: без наведения действия headerActionMenu, включая активные, — в кебабе с bubble; кебаб, ручка и грип видимы; без меню кнопки остаются инлайн', async () => {
    const screen = await renderGrid({
      columnCount: 6,
      dataCount: 20,
      enableColumnSorting: true,
      enableColumnFiltering: true,
      enableColumnPinning: true,
      enableColumnDragging: true,
      enableColumnSizing: true,
      enableHeaderActionMenu: true,
    })
    await waitForGrid()
    expect(matchMedia('(hover: none)').matches).toBe(true)
    const head = headById(dataColumn())
    const buttons = hiddenButtons(head)
    expect(buttons.length).toBeGreaterThan(1)
    await expect.poll(() => buttons.filter(b => !shown(b)).length).toBe(0)
    expect(head.querySelector('[data-action-menu]')).not.toBeNull()
    expect(head.querySelector(HANDLE)).not.toBeNull()
    expect(head.querySelector(GRIP)).not.toBeNull()
    for (const selector of [
      '.column-sort__button',
      '.column-filter__button',
      '.column-pin__button',
    ]) {
      expect(head.querySelector(selector), selector).toBeNull()
    }

    const kebab = head.querySelector<HTMLElement>('[data-action-menu]')!
    await touch.realTap(center(kebab))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    const sort = [
      ...menu()!.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
    ].find(item =>
      item.textContent?.includes(
        columnSortingLabels(tableLabels).sortAscending,
      ),
    )!
    await touch.realTap(center(sort))
    await expect.poll(() => head.getAttribute('aria-sort')).toBe('ascending')
    expect(head.querySelector('.column-sort__button')).toBeNull()
    await expect
      .poll(() => {
        const bubble = head.querySelector(
          '[data-action-menu] [data-active-indicator]',
        )
        return !!bubble && getComputedStyle(bubble).opacity === '1'
      })
      .toBe(true)

    await screen.unmount()
    renderGrid({
      columnCount: 6,
      dataCount: 20,
      enableColumnSorting: true,
      enableColumnFiltering: true,
      enableColumnPinning: true,
    })
    await waitForGrid()
    const withoutMenu = hiddenButtons(headById(dataColumn()))
    expect(withoutMenu.length).toBeGreaterThan(1)
    await expect
      .poll(() => withoutMenu.filter(button => !shown(button)).length)
      .toBe(0)
  })

  for (const keyboard of [false, true]) {
    test(`TU2: без наведения кнопки тела видны у тронутой ячейки и строки, касание другой ячейки переносит их (keyboardNavigation ${keyboard ? 'вкл' : 'выкл'})`, async () => {
      renderGrid({
        columnCount: 6,
        dataCount: 20,
        enableRowDragging: true,
        enableCellEditing: true,
        enableKeyboardNavigation: keyboard,
      })
      await waitForGrid()
      // У колонки age есть скрытая кнопка правки ячейки.
      const column = 'age'
      const [first, second] = [rowAt(1), rowAt(3)]
      const firstButtons = touchedButtons(first, column)
      const secondButtons = touchedButtons(second, column)
      expect(firstButtons.length).toBeGreaterThan(0)
      expect(firstButtons.some(shown)).toBe(false)

      await tapCell(first, column)
      await expect
        .poll(() => touchedButtons(first, column).filter(b => !shown(b)).length)
        .toBe(0)
      // Значок ручки строки монтируется касанием (ADR 0149, §4) — кнопок стало больше одной.
      expect(touchedButtons(first, column).length).toBeGreaterThan(1)
      expect(secondButtons.some(shown)).toBe(false)

      await tapCell(second, column)
      await expect
        .poll(
          () => touchedButtons(second, column).filter(b => !shown(b)).length,
        )
        .toBe(0)
      await expect
        .poll(() => touchedButtons(first, column).some(shown))
        .toBe(false)
    })
  }

  test('TU3: палец тянет грип за любую точку обёртки — ширина меняется, грид и страница не прокручиваются', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    renderGrid({ columnCount: 12, dataCount: 20, enableColumnSizing: true })
    await waitForGrid()
    // Колонка, чей грип далеко от правого края: палец не заходит в краевую зону, где грип
    // прокручивает таблицу (ADR 0197, RL18).
    const area = scroller().getBoundingClientRect()
    const edge = area.left + scroller().clientLeft + scroller().clientWidth
    const head = [
      ...document.querySelectorAll<HTMLElement>(`${HEAD_CELL}[data-column-id]`),
    ].find(cell => {
      const zone = cell.querySelector(GRIP)?.getBoundingClientRect()
      return zone !== undefined && zone.left + 83 < edge - EDGE_ZONE
    })!
    const grip = head.querySelector<HTMLElement>(GRIP)!
    const width = () => head.getBoundingClientRect().width
    const initial = width()
    const box = grip.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    // Левый край обёртки — вдали от полоски грипа у правого края.
    const from = { x: box.left + 3, y: box.top + box.height / 2 }
    const scrollLeft = scroller().scrollLeft
    const pageX = window.scrollX
    await touch.realTouchDown([from])
    await touch.realTouchMove(from, { x: from.x + 80, y: from.y })
    await touch.realTouchUp()
    await expect.poll(width).toBeGreaterThan(initial + 50)
    expect(scroller().scrollLeft).toBe(scrollLeft)
    expect(window.scrollX).toBe(pageX)
    expect(menu()).toBeNull()
  })

  test('TU4: касание грипа без сдвига открывает меню ширины', async () => {
    renderGrid({ columnCount: 6, dataCount: 20, enableColumnSizing: true })
    await waitForGrid()
    const grip = headById(dataColumn()).querySelector<HTMLElement>(GRIP)!
    await touch.realTap(center(grip))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    expect(menu()!.textContent).toContain(
      columnSizingLabels(tableLabels).widenColumn,
    )
    await closeMenu()
  })

  test('TU5: без наведения полоска грипа видна всегда', async () => {
    renderGrid({ columnCount: 6, dataCount: 20, enableColumnSizing: true })
    await waitForGrid()
    const grip = headById(dataColumn()).querySelector<HTMLElement>(GRIP)!
    const strip = grip.querySelector<HTMLElement>('[role="separator"]')!
    await expect.poll(() => shown(grip)).toBe(true)
    expect(strip.getBoundingClientRect().height).toBeGreaterThanOrEqual(16)
  })

  test('RL8: при касании линия границы видна только пока палец тянет грип; черта своего цвета не меняет', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    renderGrid({ columnCount: 6, dataCount: 20, enableColumnSizing: true })
    await waitForGrid()
    const grip = () => headById(dataColumn()).querySelector<HTMLElement>(GRIP)!
    const stroke = () =>
      getComputedStyle(grip().querySelector('[role="separator"]')!)
        .borderTopColor
    const line = () =>
      document.querySelector('[data-column-resize-line]:not([hidden])')
    const idle = resolveColor(grip(), 'var(--tsr-comp-control-color)')
    expect(stroke()).toBe(idle)
    expect(line()).toBeNull()

    const from = center(grip())
    await touch.realTouchDown([from])
    try {
      // Влево: граница остаётся в узком окне.
      await touch.realTouchMove(from, { x: from.x - 30, y: from.y })
      await expect.poll(line).not.toBeNull()
      expect(stroke()).toBe(idle)
    } finally {
      await touch.realTouchUp()
    }
    await expect.poll(line).toBeNull()
    expect(stroke()).toBe(idle)
    expect(menu()).toBeNull()
  })

  test('RL18: палец, протянувший грип к правому краю, прокручивает таблицу, граница остаётся под пальцем', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    renderGrid({ columnCount: 12, dataCount: 20, enableColumnSizing: true })
    await waitForGrid()
    const head = () => headById(dataColumn())
    const area = scroller().getBoundingClientRect()
    const right = area.left + scroller().clientLeft + scroller().clientWidth
    const from = center(head().querySelector(GRIP)!)
    const edge = { x: right - 1, y: from.y }
    await touch.realTouchDown([from])
    try {
      await touch.realTouchMove(from, edge)
      await expect.poll(() => scroller().scrollLeft).toBeGreaterThan(40)
      // Палец ушёл из краевой зоны: прокрутка стоит, граница — под пальцем.
      const back = { x: right - 90, y: from.y }
      await touch.realTouchMove(edge, back)
      await expect
        .poll(() => Math.abs(head().getBoundingClientRect().right - back.x))
        .toBeLessThanOrEqual(1)
    } finally {
      await touch.realTouchUp()
    }
  })

  const renderContextMenu = async (withActions = true) => {
    const screen = await renderGrid({
      columnCount: 6,
      dataCount: 20,
      enableContextMenu: true,
      // Пункты без cellSelection: тот сам гасит выделение текста ячеек.
      actionsDemo: withActions ? 'async' : 'none',
    })
    await waitForGrid()
    return { cell: cellOf(rowAt(2), dataColumn()), screen }
  }

  test('TU6: удержание касания 500 мс открывает контекстное меню в точке касания; нативный contextmenu того же касания второго меню не открывает', async ({
    skip,
  }) => {
    skip(!chromium, 'удержание пальца — CDP Chromium')
    const { cell } = await renderContextMenu()
    const at = center(cell)
    await touch.realTouchDown([at])
    // Android шлёт свой contextmenu посреди удержания — он гасится.
    await wait(100)
    const native = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: at.x,
      clientY: at.y,
    })
    cell.dispatchEvent(native)
    expect(native.defaultPrevented).toBe(true)
    await wait(150)
    expect(menu()).toBeNull()
    await wait(LONG_PRESS_WAIT_MS)
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    await touch.realTouchUp()
    await wait(100)
    expect(menus().length).toBe(1)
    const box = menu()!.getBoundingClientRect()
    // Меню у пальца: от точки касания до меню не дальше 40px (позиционер сдвигает
    // меню от края окна).
    const gap = Math.hypot(
      Math.max(box.left - at.x, 0, at.x - box.right),
      Math.max(box.top - at.y, 0, at.y - box.bottom),
    )
    expect(gap).toBeLessThan(40)
    await closeMenu()
  })

  test('TU7: ожидание долгого нажатия отменяют сдвиг больше 10px, прокрутка, второй палец и отпускание раньше срока', async ({
    skip,
  }) => {
    skip(!chromium, 'удержание пальца — CDP Chromium')
    const { cell } = await renderContextMenu()
    const at = center(cell)
    const expectNoMenu = async (gesture: string) => {
      await wait(LONG_PRESS_WAIT_MS)
      expect(menu(), gesture).toBeNull()
      await touch.realTouchUp()
      await wait(50)
    }

    // Контроль: то же удержание без помех меню открывает.
    await touch.realTouchDown([at])
    await wait(LONG_PRESS_WAIT_MS)
    await expect.poll(menu).toBeTruthy()
    await touch.realTouchUp()
    await closeMenu()

    await touch.realTouchDown([at])
    await touch.realTouchMove(at, { x: at.x + 16, y: at.y }, 2)
    await expectNoMenu('сдвиг')

    await touch.realTouchDown([at])
    scroller().scrollTop += 40
    await expectNoMenu('прокрутка')
    scroller().scrollTop = 0

    await touch.realTouchDown([at])
    await wait(50)
    await touch.realTouchDown([at, { x: at.x, y: at.y + 60 }])
    await expectNoMenu('второй палец')

    await touch.realTouchDown([at])
    await wait(200)
    await touch.realTouchUp()
    await wait(LONG_PRESS_WAIT_MS)
    expect(menu(), 'отпускание').toBeNull()
  })

  test('TU8: пока у контекстного меню есть пункты, ячейки тела не дают выноску iOS и выделение текста; без пунктов — дают', async () => {
    const selectable = (el: Element) => {
      const style = getComputedStyle(el)
      return (
        style.getPropertyValue('user-select') ||
        style.getPropertyValue('-webkit-user-select')
      )
    }
    const callout = (el: Element) =>
      getComputedStyle(el).getPropertyValue('-webkit-touch-callout')

    const { cell: withActions, screen } = await renderContextMenu(true)
    await expect.poll(() => selectable(withActions)).toBe('none')
    if (CSS.supports('-webkit-touch-callout', 'none')) {
      expect(callout(withActions)).toBe('none')
    }

    await screen.unmount()
    const { cell: without } = await renderContextMenu(false)
    expect(selectable(without)).not.toBe('none')
    if (CSS.supports('-webkit-touch-callout', 'none')) {
      expect(callout(without)).not.toBe('none')
    }
  })

  test('TU9: колонку и строку тянут после удержания 250 мс; ранний сдвиг больше 8 px отменяет ожидание; свайп по ячейке прокручивает грид', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    renderGrid({
      columnCount: 8,
      dataCount: 40,
      enableColumnDragging: true,
      enableRowDragging: true,
    })
    await waitForGrid()
    const overlay = () =>
      document.querySelector(
        '.data-grid-head__cell--overlay, .data-grid__body-row--overlay, [data-dnd-overlay]',
      )
    const drag = async (from: Point, to: Point) => {
      await touch.realTouchDown([from])
      try {
        await wait(300)
        await touch.realTouchMove(from, to, 16)
        await wait(50)
      } finally {
        await touch.realTouchUp()
      }
    }
    const premature = async (from: Point, to: Point) => {
      await touch.realTouchDown([from])
      try {
        await touch.realTouchMove(from, to, 1)
        await wait(300)
        expect(overlay()).toBeNull()
      } finally {
        await touch.realTouchUp()
      }
      await wait(100)
      expect(menu()).toBeNull()
    }

    const columns = headOrder()
    const first = headById(dataColumn())
    const columnHandle = first.querySelector<HTMLElement>(HANDLE)!
    const from = center(columnHandle)
    await premature(from, { x: from.x + 20, y: from.y })
    expect(headOrder()).toEqual(columns)
    await drag(from, {
      x: from.x + first.getBoundingClientRect().width * 1.6,
      y: from.y,
    })
    await expect.poll(headOrder).not.toEqual(columns)

    // Протяжка колонки докручивает грид вправо — ручки строк вернуть в окно.
    scroller().scrollLeft = 0
    await wait(100)
    const rows = rowOrder()
    // Ручки строк возвращаются, когда перенос колонки завершён: на React 18 — позже.
    await expect.poll(() => rowAt(1).querySelector(HANDLE)).not.toBeNull()
    const rowHandle = rowAt(1).querySelector<HTMLElement>(HANDLE)!
    const start = center(rowHandle)
    await premature(start, { x: start.x, y: start.y + 20 })
    expect(rowOrder()).toEqual(rows)
    await drag(start, { x: start.x, y: start.y + rowAt(1).offsetHeight * 2.6 })
    await expect.poll(rowOrder).not.toEqual(rows)
    // Анимация броска строки.
    await expect
      .poll(() =>
        document.querySelector(
          '.data-grid__body-row--overlay, [data-dnd-overlay]',
        ),
      )
      .toBeNull()
    await wait(300)

    const columnsBefore = headOrder()
    // Строка на каждом индексе — свайп порядок не меняет.
    const byIndex = () =>
      new Map(
        Array.from(document.querySelectorAll<HTMLElement>(BODY_ROW)).map(
          row => [
            row.getAttribute('data-index'),
            row.getAttribute('data-row-id'),
          ],
        ),
      )
    const rowsBefore = byIndex()
    // Колонка, оставшаяся в окне после перестановки.
    const cell = cellOf(rowAt(4), 'country')
    const swipeFrom = {
      x: cell.getBoundingClientRect().left + 10,
      y: center(cell).y,
    }
    await touch.realSwipe(swipeFrom, { x: swipeFrom.x, y: swipeFrom.y - 200 })
    await expect.poll(() => scroller().scrollTop).toBeGreaterThan(80)
    // Инерция свайпа: касание посреди неё только останавливает прокрутку.
    let last = -1
    await expect
      .poll(async () => {
        const now = scroller().scrollTop
        const still = now === last
        last = now
        await wait(150)
        return still
      })
      .toBe(true)
    expect(headOrder()).toEqual(columnsBefore)
    const rowsAfter = byIndex()
    const common = [...rowsAfter.keys()].filter(index => rowsBefore.has(index))
    expect(common.length).toBeGreaterThan(0)
    for (const index of common) {
      expect(rowsAfter.get(index)).toBe(rowsBefore.get(index))
    }
  })

  test('TU10: касание ручки колонки и строки без сдвига открывает меню перестановки', async () => {
    renderGrid({
      columnCount: 6,
      dataCount: 20,
      enableColumnDragging: true,
      enableRowDragging: true,
    })
    await waitForGrid()
    const columnHandle =
      headById(dataColumn()).querySelector<HTMLElement>(HANDLE)!
    await touch.realTap(center(columnHandle))
    await expect
      .poll(menu, { timeout: 5000, message: 'ручка колонки' })
      .toBeTruthy()
    expect(menu()!.textContent).toContain(
      columnDraggingLabels(tableLabels).moveRight,
    )
    await closeMenu()

    const rowHandle = rowAt(2).querySelector<HTMLElement>(HANDLE)!
    await touch.realTap(center(rowHandle))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    expect(menu()!.textContent).toContain(
      rowDraggingLabels(tableLabels).moveDown,
    )
    await closeMenu()
  })

  test('TU11: при грубом указателе зона нажатия каждой цели — во всю высоту ячейки и не меньше 24px в ширину, зоны соседей не пересекаются, вид целей прежний', async () => {
    renderGrid({
      columnCount: 5,
      dataCount: 6,
      initialExpanded: true,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableColumnSizing: true,
      enableColumnDragging: true,
      enableRowDragging: true,
      enableRowExpanding: true,
      enableRowSelection: true,
      enableCellEditing: true,
      enableRowActions: true,
    })
    await waitForGrid()
    expect(matchMedia('(pointer: coarse)').matches).toBe(true)
    // Кнопки тела видны у тронутой строки — тронуть строку 1.
    const row = rowAt(1)
    await tapCell(row, 'age')
    await expect
      .poll(() => touchedButtons(row, 'age').filter(b => !shown(b)).length)
      .toBe(0)

    const TARGET =
      'button, [role="button"], [role="checkbox"], .resize__handler--column'
    // Строка 0 — корень дерева с флажком и шевроном, строка 1 — тронутая.
    const scopes = [document.querySelector('.data-grid__head')!, rowAt(0), row]
    /** Цели в окне и имена тех, чья зона не на всю высоту ячейки. */
    const zones = () => {
      const targets = scopes
        .flatMap(scope =>
          Array.from(scope.querySelectorAll<HTMLElement>(TARGET)),
        )
        .filter(el => !el.parentElement?.closest(TARGET))
        .filter(el => {
          const r = el.getBoundingClientRect()
          if (r.width <= 1 || r.height <= 1) return false
          // Цель видна целиком: не уходит под закреплённую колонку (как в TS1).
          const y = r.top + r.height / 2
          return [r.left + 3, r.left + r.width / 2, r.right - 3].every(x =>
            el.contains(document.elementFromPoint(x, y)),
          )
        })
      const failures = targets.flatMap(el => {
        const r = el.getBoundingClientRect()
        const cell = el
          .closest(`${HEAD_CELL}, ${BODY_CELL}`)!
          .getBoundingClientRect()
        const name = `${el.getAttribute('aria-label') ?? el.className} (${el.closest('[data-column-id]')?.getAttribute('data-column-id')})`
        // Полоса шириной 24px на всю высоту ячейки, пересекающая цель: хотя бы одно
        // положение целиком принадлежит цели — соседи её зону не перекрывают.
        const BAND = 24
        const lefts: number[] = []
        const [from, to] = [r.left, r.right - BAND].sort((a, b) => a - b)
        for (let left = from; left <= to; left += 2) lefts.push(left)
        const ys: number[] = []
        for (let y = cell.top + 2; y <= cell.bottom - 2; y += 4) ys.push(y)
        const owned = lefts.some(left =>
          [left + 1, left + BAND / 2, left + BAND - 1].every(x =>
            ys.every(y => el.contains(document.elementFromPoint(x, y))),
          ),
        )
        return owned ? [] : [name]
      })
      return { targets, failures }
    }

    // Кнопка правки тронутой ячейки age в окне.
    await settle(row)
    const atAge = zones()
    expect(
      atAge.targets.some(el =>
        el.matches(`[aria-label="${cellEditingLabels(tableLabels).editCell}"]`),
      ),
    ).toBe(true)
    expect(atAge.failures).toEqual([])

    // Служебные колонки (флажок, ручка, раскрытие) — у левого края.
    scroller().scrollLeft = 0
    await expect
      .poll(
        () =>
          rowAt(1).querySelector(HANDLE) &&
          rowAt(0).querySelector('[role="checkbox"]'),
      )
      .toBeTruthy()
    const atStart = zones()
    const kinds = (selector: string) =>
      atStart.targets.filter(el => el.matches(selector)).length
    expect(kinds('[role="checkbox"]')).toBeGreaterThan(1)
    expect(kinds(HANDLE)).toBeGreaterThan(1)
    expect(kinds(GRIP)).toBeGreaterThan(0)
    expect(atStart.failures).toEqual([])

    // Вид прежний: рамка чекбокса и иконка ручки 16×16.
    const checkbox = rowAt(0).querySelector<HTMLElement>('[role="checkbox"]')!
    expect(checkbox.getBoundingClientRect().height).toBe(16)
    const icon = document.querySelector<HTMLElement>(
      `${BODY_ROW} ${HANDLE} svg`,
    )!
    expect(icon.getBoundingClientRect().height).toBe(16)
  })

  test('TU12: состояния без наведения — кнопки шапки, кнопки тронутой ячейки, полоска грипа — проходят axe с color-contrast в обеих темах', async () => {
    renderGrid({
      columnCount: 5,
      dataCount: 8,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableColumnSizing: true,
      enableColumnDragging: true,
      enableRowDragging: true,
      enableRowSelection: true,
      enableCellEditing: true,
      enableRowActions: true,
      enableHeaderActionMenu: true,
    })
    await waitForGrid()
    const row = rowAt(1)
    await tapCell(row, 'age')
    await expect
      .poll(() => touchedButtons(row, 'age').filter(b => !shown(b)).length)
      .toBe(0)
    await inBothThemes(async () => {
      const { violations } = await axe.run(
        document.querySelector<HTMLElement>('[role="table"]')!,
        {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        },
      )
      expect(violations).toEqual([])
    })
  })

  test('TU14: история «Touch» — плагины с целями под палец, кнопки шапки видны, контекстное меню с пунктами', async () => {
    render(<Stories.TouchPlayground />)
    await waitForGrid()
    expect(document.querySelector(GRIP)).toBeTruthy()
    expect(document.querySelector(`${BODY_ROW} ${HANDLE}`)).toBeTruthy()
    expect(document.querySelector(`${BODY_ROW} [role="checkbox"]`)).toBeTruthy()
    const head = headById(dataColumn())
    await expect
      .poll(() => hiddenButtons(head).filter(b => !shown(b)).length)
      .toBe(0)
    const cell = cellOf(rowAt(1), dataColumn())
    expect(
      getComputedStyle(cell).getPropertyValue('-webkit-user-select') ||
        getComputedStyle(cell).userSelect,
    ).toBe('none')
    // Грид умещается в окно телефона.
    expect(scroller().getBoundingClientRect().width).toBeLessThanOrEqual(
      window.innerWidth,
    )
  })
})

describe('Касания — бросок в свёрнутые группы (ADR 0109)', () => {
  test('NX7: пауза пальцем над свёрнутой группой раскрывает её, как мышью', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    const screen = await render(
      // Дерево истории «Tree lines» со свёрнутыми группами: «Collapsed groups» — гайд.
      <composed.RowDraggingTreeLines
        initialExpanded={undefined}
        containerHeight={760}
        height={700}
        maxHeight={700}
      />,
    )
    const rowById = (id: string) =>
      document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-id='${id}']`)
    await expect.poll(() => rowById('node-3')).not.toBeNull()
    try {
      const source = rowById('row-0')!
      const from = center(source.querySelector<HTMLElement>(HANDLE)!)
      // Сдвиг вправо с запасом: текст облака дальше отступа ребёнка.
      const shift =
        2 *
        (cellOf(source, 'country').getBoundingClientRect().left -
          source.getBoundingClientRect().left)
      const group = rowById('node-1')!.getBoundingClientRect()
      const to = { x: from.x + shift, y: group.top + group.height / 2 + 6 }
      await touch.realTouchDown([from])
      await wait(300)
      await touch.realTouchMove(from, to, 16)
      // Палец стоит: пауза раскрывает группу.
      await expect
        .poll(() => rowById('node-1-0'), { timeout: 3000 })
        .not.toBeNull()
      await touch.realTouchUp()
      await expect
        .poll(() =>
          Array.from(document.querySelectorAll<HTMLElement>(BODY_ROW))
            .sort(
              (a, b) =>
                a.getBoundingClientRect().top - b.getBoundingClientRect().top,
            )
            .map(row => row.dataset.rowId)
            .slice(2, 5),
        )
        .toEqual(['node-1', 'row-0', 'node-1-0'])
    } finally {
      await screen.unmount()
    }
  })
})

describe('Ручка колонки на касаниях (ADR 0114)', () => {
  test('CO8: на касаниях ручка колонки раскрыта всегда; у узла закреплённой зоны ручки нет; облако перетаскивания показывает ручку раскрытой', async () => {
    renderGrid({
      columnCount: 6,
      dataCount: 20,
      enableColumnDragging: true,
      enableColumnPinning: true,
    })
    await waitForGrid()
    const head = headById(dataColumn())
    const handle = head.querySelector<HTMLElement>(HANDLE)!
    expect(handle.tagName).toBe('BUTTON')
    await settle(head)
    expect(shown(handle.parentElement!)).toBe(true)
    expect(handle.parentElement!.getBoundingClientRect().width).toBe(
      revealedHandleWidth(handle),
    )

    // Облако перетаскивания — ручка в нём раскрыта. Жест пальцем по шагам — CDP Chromium.
    if (chromium) {
      const from = center(handle)
      await touch.realTouchDown([from])
      try {
        await wait(300)
        await touch.realTouchMove(from, { x: from.x + 60, y: from.y }, 6)
        const overlay = () =>
          document.querySelector<HTMLElement>('.data-grid-head__cell--overlay')
        await expect.poll(overlay).not.toBeNull()
        const cloud = overlay()!.querySelector<HTMLElement>(HANDLE)!
        expect(shown(cloud.parentElement!)).toBe(true)
      } finally {
        await touch.realTouchUp()
      }
    }

    // Закреплённый узел ручки не получает.
    await pinViaPopover(
      headById('lastName'),
      columnPinningLabels(tableLabels).pinLeft,
    )
    const pinned = () =>
      document.querySelector(
        `${HEAD_CELL}[data-column-id='lastName'][data-cell-pinned='left']`,
      )
    await expect.poll(pinned).not.toBeNull()
    expect(pinned()!.querySelector(HANDLE)).toBeNull()
  })
})

// Растяжка высоты (ADR 0142, XS9): касание прокручивает растянутую область нативно.
describe('Касания в растянутой области', () => {
  test('XS9: касание — нативная прокрутка; после остановки строки на своих местах под шапкой', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    const getRows = ({ start, end }: { start: number; end: number }) => ({
      rows: Array.from({ length: end - start }, (_, k) => ({
        id: `xs-${start + k}`,
      })),
    })
    await renderGrid({
      columnCount: 5,
      dataCount: 0,
      enableServerRowModel: true,
      rowCount: 1_000_000,
      serverRowModelGetRows: getRows,
    })
    await expect
      .poll(() => document.querySelector(`${BODY_ROW}[data-row-id]`))
      .not.toBeNull()
    const layer = scrollLayer(scroller())
    expect(layer.stretched).toBe(true)
    scroller().scrollTop =
      (scroller().scrollHeight - scroller().clientHeight) / 2
    await expect
      .poll(() => document.querySelectorAll(`${BODY_ROW}[data-row-id]`).length)
      .toBeGreaterThan(3)
    const before = layer.top()
    const from = center(scroller())
    await touch.realSwipe(from, { x: from.x, y: from.y - 200 })
    let last = -1
    await expect
      .poll(async () => {
        const now = layer.top()
        const still = now === last
        last = now
        await wait(150)
        return still
      })
      .toBe(true)
    expect(layer.top()).toBeGreaterThan(before)
    // Строки — на месте виртуальной позиции: верх строки = шапка + её начало − позиция.
    const head = document
      .querySelector<HTMLElement>('.data-grid__head')!
      .getBoundingClientRect()
    const area = scroller().getBoundingClientRect()
    const rows = [
      ...document.querySelectorAll<HTMLElement>(`${BODY_ROW}[data-row-id]`),
    ].filter(row => {
      const box = row.getBoundingClientRect()
      return box.bottom > head.bottom && box.top < area.bottom
    })
    expect(rows.length).toBeGreaterThan(3)
    expect(head.top - area.top).toBe(0)
    for (const row of rows) {
      const box = row.getBoundingClientRect()
      const expected =
        head.height + Number(row.dataset.index) * box.height - layer.top()
      expect(Math.abs(box.top - area.top - expected)).toBeLessThanOrEqual(1)
    }
  })
})

describe('«Стоп» на касаниях (ADR 0153)', () => {
  test('CA7: сенсорный экран (pointer: coarse): у занятой кнопки «стоп» виден сразу', async () => {
    // «Стоп» — у кнопки процесса вне таблицы, выгрузки (ADR 0177, §2).
    const signals: AbortSignal[] = []
    const ExportGrid = () => {
      const table = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
        data: [{ id: '1', name: 'Bob' }],
        // Выгрузку собирает сервер: `onExport` с промисом и `signal`.
        dataMode: 'server',
        plugins: [
          dataExport({
            allow: { rows: ['all'], columns: ['all'], formats: ['csv'] },
            onExport: (...args: unknown[]) => {
              signals.push((args.at(-1) as { signal: AbortSignal }).signal)
              return new Promise<void>(() => {})
            },
          }),
        ],
      })
      return (
        <div style={{ width: 400, height: 200 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    const screen = await render(<ExportGrid />)
    try {
      await waitForGrid()
      const button = () =>
        document.querySelector<HTMLElement>('[data-testid="export-button"]')!
      // Тулбар — ленивый модуль (ADR 0061).
      await expect
        .poll(() => document.querySelector('[data-testid="export-button"]'))
        .not.toBeNull()
      expect(matchMedia('(pointer: coarse)').matches).toBe(true)
      await touch.realTap(await settledCenter(button))
      await expect.poll(() => signals.length).toBe(1)
      await expect
        .poll(() => button().hasAttribute('data-cancel-armed'))
        .toBe(true)
      const stop = button().querySelector<HTMLElement>('[data-cancel-icon]')!
      expect(getComputedStyle(stop).display).toBe('flex')
      expect(shown(stop)).toBe(true)

      await touch.realTap(center(button()))
      await expect.poll(() => signals[0]!.aborted).toBe(true)
    } finally {
      await screen.unmount()
    }
  })
})

// Включённые действия уходят в кебаб последними (ADR 0156, KA4): смена включённости ряд
// не перестраивает, пока заголовок тронут, — мышью, клавиатурой и касанием.

interface RowApi {
  setSorting: (value: { id: string; desc: boolean }[]) => void
  setColumnSizing: (value: Record<string, number>) => void
}

let rowApi: RowApi

const ROW_DATA = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  city: i % 2 ? 'Rome' : 'Paris',
}))

const RowGrid = () => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name' },
      { id: 'city', accessorKey: 'city', header: 'City' },
    ] as never,
    data: ROW_DATA,
    getRowId: (row: (typeof ROW_DATA)[number]) => row.id,
    plugins: [
      columnPinning(),
      columnSorting(),
      columnFiltering(),
      columnSizing(),
      // Три действия и кебаб пунктов подгонки ширины (ADR 0217) — ниже порога.
      headerActionMenu({ threshold: 5 }),
    ] as never,
  })
  rowApi = table as unknown as RowApi
  return (
    <div style={{ width: 700, height: 360 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Включённые действия в ряду заголовка (ADR 0156)', () => {
  test('KA4: мышь и клавиатура держат ряд, пока указатель или фокус в заголовке; на touch активные действия остаются в кебабе с bubble', async () => {
    const screen = await render(<RowGrid />)
    await waitForGrid()
    const nameHead = () =>
      document.querySelector<HTMLElement>(
        `${HEAD_CELL}[data-column-id="name"]`,
      )!
    const sortButton = () =>
      nameHead().querySelector<HTMLElement>('.column-sort__button')!
    const row = () =>
      [
        ...nameHead().querySelectorAll<HTMLElement>(
          '.column-sort__button, .column-pin__button, .column-group__button, .column-filter__button, [data-action-menu]',
        ),
      ].map(button =>
        button.hasAttribute('data-action-menu')
          ? 'menu'
          : (button.className.match(/column-(\w+)__button/)?.[1] ?? '?'),
      )
    const sorted = () => nameHead().getAttribute('aria-sort') ?? 'none'
    const frame = () => new Promise(requestAnimationFrame)
    /** Сортировка ходит по кругу: снять — одно или два нажатия. */
    const untilOff = async (press: () => Promise<unknown>) => {
      for (let i = 0; i < 3 && sorted() !== 'none'; i++) {
        const before = sorted()
        await press()
        await expect.poll(sorted).not.toBe(before)
      }
      expect(sorted()).toBe('none')
    }
    const originalMatchMedia = window.matchMedia.bind(window)
    const mediaMock = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(query =>
        query === '(pointer: coarse)'
          ? ({ matches: false } as MediaQueryList)
          : originalMatchMedia(query),
      )
    setInputModality('pointer')
    try {
      // Ширина на одну кнопку и кебаб.
      for (let width = 140; width <= 300; width += 5) {
        rowApi.setColumnSizing({ name: width })
        await frame()
        await frame()
        if (row().length === 2 && row().includes('menu')) break
      }
      expect(row()).toEqual(['pin', 'menu'])
      const sortOn = async () => {
        rowApi.setSorting([{ id: 'name', desc: false }])
        await expect.poll(row).toEqual(['sort', 'menu'])
      }

      // Мышь.
      await sortOn()
      await userEvent.hover(nameHead())
      await humanClick(sortButton())
      await expect.poll(sorted).toBe('none')
      expect(row()).toEqual(['sort', 'menu'])
      await humanClick(sortButton())
      await expect.poll(sorted).not.toBe('none')
      await untilOff(() => humanClick(sortButton()))
      expect(row()).toEqual(['sort', 'menu'])
      await userEvent.hover(document.body, { position: { x: 1, y: 1 } })
      await expect.poll(row).toEqual(['pin', 'menu'])

      // Клавиатура: фокус остаётся на кнопке, ряд ждёт ухода фокуса.
      await sortOn()
      sortButton().focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(sorted).toBe('none')
      expect(row()).toEqual(['sort', 'menu'])
      expect(document.activeElement).toBe(sortButton())
      await userEvent.keyboard('{Enter}')
      await expect.poll(sorted).not.toBe('none')
      await untilOff(() => userEvent.keyboard('{Enter}'))
      expect(row()).toEqual(['sort', 'menu'])
      for (
        let i = 0;
        i < 5 && nameHead().contains(document.activeElement);
        i++
      ) {
        await userEvent.keyboard('{Tab}')
      }
      expect(nameHead().contains(document.activeElement)).toBe(false)
      await expect.poll(row).toEqual(['pin', 'menu'])

      // Касание: активные действия остаются в кебабе и после ухода с заголовка.
      ;(document.activeElement as HTMLElement | null)?.blur()
      await sortOn()
      if (!chromium) return
      mediaMock.mockRestore()
      setInputModality('touch')
      await expect.poll(row).toEqual(['menu'])
      const bubbleOpacity = () =>
        getComputedStyle(
          nameHead().querySelector(
            '[data-action-menu] [data-active-indicator]',
          )!,
        ).opacity
      await expect.poll(bubbleOpacity).toBe('1')
      const cell = document.querySelector<HTMLElement>(
        `${BODY_CELL}[data-column-id="city"]`,
      )!
      await touch.realTap(center(cell))
      await expect.poll(row).toEqual(['menu'])
      await expect.poll(bubbleOpacity).toBe('1')
    } finally {
      mediaMock.mockRestore()
      await screen.unmount()
    }
  })
})

describe('Редакторы по типу пальцем (ADR 0175)', () => {
  test('ED13: касания — календарь, поле с поиском и список с флажками правятся пальцем', async () => {
    const saved: unknown[] = []
    const EditGrid = () => {
      const table = useCreateTable({
        columns: [
          {
            id: 'day',
            accessorKey: 'day',
            header: 'Day',
            dataType: 'dateString',
          },
          {
            id: 'status',
            accessorKey: 'status',
            header: 'Status',
            dataType: 'select',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
            ],
          },
          {
            id: 'tags',
            accessorKey: 'tags',
            header: 'Tags',
            dataType: 'multiSelect',
            options: [
              { value: 'new', label: 'New' },
              { value: 'sale', label: 'Sale' },
            ],
          },
        ] as never,
        data: [{ id: 'r1', day: '2026-03-15', status: 'draft', tags: ['new'] }],
        plugins: [
          cellEditing({ onCellEdit: commit => void saved.push(commit.value) }),
        ],
      })
      return (
        <div style={{ height: 400 }}>
          <DataGrid table={table} />
        </div>
      )
    }
    const screen = await render(<EditGrid />)
    await waitForGrid()
    // Строку — заново: после сохранения её узел может смениться.
    const row = () => rowAt(0)
    const openEdit = async (columnId: string) => {
      await tapCell(row(), columnId)
      const button = () =>
        cellOf(row(), columnId).querySelector<HTMLElement>(
          '.cell__button button',
        )
      await expect.poll(() => button() && shown(button()!)).toBe(true)
      // Кнопка раскрывается по ширине — касание в её центр после конца раскрытия.
      await settle(cellOf(row(), columnId))
      await touch.realTap(center(button()!))
    }
    try {
      await openEdit('day')
      const day = () =>
        document.querySelector<HTMLElement>(
          '[data-testid="edit-date"] [data-day="2026-03-20"] button',
        )
      await expect.poll(day).not.toBeNull()
      await touch.realTap(center(day()!))
      await expect.poll(() => saved.at(-1)).toBe('2026-03-20')

      await openEdit('status')
      const active = () =>
        document.querySelector<HTMLElement>(
          '[data-testid="edit-options"] [data-value="active"]',
        )
      await expect.poll(active).not.toBeNull()
      await tapOption(active()!)
      await expect.poll(() => saved.at(-1)).toBe('active')

      await openEdit('tags')
      const sale = () =>
        document.querySelector<HTMLElement>(
          '[data-testid="edit-multiselect"] [data-value="sale"] [role="checkbox"]',
        )
      await expect.poll(sale).not.toBeNull()
      await touch.realTap(center(sale()!))
      await expect.poll(() => sale()?.getAttribute('aria-checked')).toBe('true')
      await tapCell(row(), 'day')
      await expect.poll(() => saved.at(-1)).toEqual(['new', 'sale'])
    } finally {
      await screen.unmount()
    }
  })
})

// Треугольник отказа ячейки на касаниях (ADR 0177, OB10): кнопка в углу открывает поповер
// нажатием, касанием и Enter, касание угла булевой ячейки флажок не переключает.

interface IssueRow {
  id: string
  name: string
  inStock: boolean
}

const ISSUE_DATA: IssueRow[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  inStock: i % 2 === 0,
}))

let issueTable: {
  trackCellAction: (
    target: unknown,
    promise: Promise<unknown>,
    options?: { retry?: () => unknown },
  ) => Promise<unknown>
}
let issueEdits = 0

const IssueGrid = () => {
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 240 },
      {
        id: 'inStock',
        accessorKey: 'inStock',
        header: 'In stock',
        dataType: 'boolean',
        size: 120,
      },
    ] as never,
    data: ISSUE_DATA,
    getRowId: (row: IssueRow) => row.id,
    plugins: [
      cellEditing({
        canEditCell: ctx => ctx.column.id === 'inStock',
        onCellEdit: () => {
          issueEdits++
          return Promise.reject(new Error('Server said no'))
        },
      }),
    ] as never,
  })
  issueTable = table as never
  return (
    <div style={{ width: 500, height: 360 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Треугольник отказа ячейки на касаниях (ADR 0177)', () => {
  test('OB10: треугольник — кнопка с зоной 24×24; нажатие, касание и Enter открывают поповер с причиной, «Сбросить изменение» и «Повторить», если источник умеет повторять; касание угла не переключает флажок булевой ячейки', async () => {
    issueEdits = 0
    const screen = await render(<IssueGrid />)
    try {
      await waitForGrid()
      const cell = (id: string, column: string) =>
        cellOf(
          document.querySelector<HTMLElement>(
            `${BODY_ROW}[data-row-id='${id}']`,
          )!,
          column,
        )
      const issue = (id: string, column: string) =>
        cell(id, column).querySelector<HTMLElement>('button[data-cell-issue]')
      const box = () =>
        cell('r1', 'inStock').querySelector<HTMLElement>('[role="checkbox"]')!
      const popover = () =>
        document.querySelector<HTMLElement>(
          '[data-testid="cell-issue-popover"]',
        )
      const actionsOf = () =>
        [...popover()!.querySelectorAll<HTMLElement>('[data-action]')].map(
          el => el.dataset.action,
        )
      const close = async () => {
        await userEvent.keyboard('{Escape}')
        await expect.poll(popover).toBeNull()
      }

      // Отказ встроенного флажка: треугольник в углу ячейки.
      const before = box().getAttribute('aria-checked')
      await touch.realTap(center(box()))
      await expect.poll(() => issue('r1', 'inStock')).not.toBeNull()
      await expect.poll(() => box().getAttribute('aria-checked')).toBe(before)
      const zone = issue('r1', 'inStock')!.getBoundingClientRect()
      expect(Math.min(zone.width, zone.height)).toBeGreaterThanOrEqual(24)

      // Касание угла: поповер с причиной, «Повторить» и «Сбросить»; флажок не переключён.
      const edits = issueEdits
      await touch.realTap({ x: zone.right - 3, y: zone.top + 3 })
      await expect.poll(popover).not.toBeNull()
      expect(popover()!.textContent).toContain('Server said no')
      expect(actionsOf()).toEqual(['discard', 'retry'])
      expect(box().getAttribute('aria-checked')).toBe(before)
      expect(issueEdits).toBe(edits)
      await close()

      // Нажатие.
      await humanClick(issue('r1', 'inStock')!)
      await expect.poll(popover).not.toBeNull()
      await close()

      // Enter на кнопке треугольника.
      issue('r1', 'inStock')!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(popover).not.toBeNull()
      expect(actionsOf()).toEqual(['discard', 'retry'])
      await close()

      // Источник без повтора — только «Сбросить»; с повтором — и «Повторить».
      void issueTable
        .trackCellAction(
          { cell: ['r2', 'name'] },
          Promise.reject(new Error('No')),
        )
        .catch(() => {})
      void issueTable
        .trackCellAction(
          { cell: ['r3', 'name'] },
          Promise.reject(new Error('No')),
          { retry: () => {} },
        )
        .catch(() => {})
      await expect.poll(() => issue('r3', 'name')).not.toBeNull()
      await touch.realTap(center(issue('r2', 'name')!))
      await expect.poll(popover).not.toBeNull()
      expect(actionsOf()).toEqual(['discard'])
      await close()
      await touch.realTap(center(issue('r3', 'name')!))
      await expect.poll(popover).not.toBeNull()
      expect(actionsOf()).toEqual(['discard', 'retry'])
      await close()
    } finally {
      await screen.unmount()
    }
  })
})

describe('Маркеры выделения пальцем (ADR 0198, этап 2)', () => {
  const contrastCommands = commands as unknown as {
    moreContrast: (active: boolean) => Promise<void>
    forcedColors: (active: boolean) => Promise<void>
  }
  const mouse = commands as unknown as {
    realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
    realMouseUp: () => Promise<void>
  }
  afterEach(async () => {
    await contrastCommands.moreContrast(false)
    await contrastCommands.forcedColors(false)
    document.documentElement.classList.remove('dark')
  })

  const renderSelection = async (args: Record<string, unknown> = {}) => {
    const screen = await renderGrid({
      enableCellSelection: true,
      columnCount: 6,
      dataCount: 30,
      // Окно узкое: углы колонки имени — вне краевых зон автопрокрутки.
      defaultColumn: { size: 90 },
      ...args,
    })
    await waitForGrid()
    return screen
  }
  /** Ячейка данных строки `row` по месту `column` среди колонок данных. */
  const cellAt = (row: number, column: number) =>
    [
      ...rowAt(row).querySelectorAll<HTMLElement>(
        `${BODY_CELL}[data-column-id]:not([data-actions-column-cell="true"])`,
      ),
    ].sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )[column]!
  const handleOf = (corner: 'start' | 'end') =>
    document.querySelector<HTMLElement>(
      `[data-range-handle="${corner}"]:not([hidden])`,
    )
  const selectedCount = () =>
    document.querySelectorAll(`${BODY_CELL}[data-cell-selected]`).length
  const focusedAt = () => {
    const focused = document.querySelector<HTMLElement>('[data-cell-focused]')
    return `${focused?.closest(BODY_ROW)?.getAttribute('data-index')}:${focused?.dataset.columnId}`
  }
  const idOf = (row: number, column: number) =>
    `${row}:${cellAt(row, column).dataset.columnId}`
  /** Центр маркера — в углу ячейки. */
  const expectAt = async (corner: 'start' | 'end', cell: () => HTMLElement) => {
    await expect
      .poll(() => {
        const handle = handleOf(corner)
        if (!handle) return Infinity
        const at = center(handle)
        const box = cell().getBoundingClientRect()
        const x = corner === 'end' ? box.right : box.left
        const y = corner === 'end' ? box.bottom : box.top
        return Math.max(Math.abs(at.x - x), Math.abs(at.y - y))
      })
      .toBeLessThanOrEqual(1)
  }
  /** Протянуть круг пальцем к ячейке. */
  const dragCircle = async (corner: 'start' | 'end', to: HTMLElement) => {
    const from = center(handleOf(corner)!)
    await touch.realTouchDown([from])
    await expect
      .poll(() => handleOf(corner)?.hasAttribute('data-dragging'))
      .toBe(true)
    await touch.realTouchMove(from, center(to), 10)
    await touch.realTouchUp()
  }

  test('HN5: касание: тап выделяет ячейку и показывает круги в левом верхнем и правом нижнем углу; протяжка круга двигает его угол, противоположный на месте и становится опорной ячейкой', async ({
    skip,
  }) => {
    skip(!chromium, 'протяжка пальцем — CDP Chromium')
    const screen = await renderSelection()
    try {
      await touch.realTap(center(cellAt(3, 0)))
      await expect.poll(selectedCount).toBe(1)
      for (const corner of ['start', 'end'] as const) {
        await expect.poll(() => handleOf(corner)).not.toBeNull()
        expect(handleOf(corner)!.getAttribute('data-selection-handle')).toBe(
          'circle',
        )
        await expectAt(corner, () => cellAt(3, 0))
      }

      // Правый нижний круг вниз: левый верхний угол на месте и опорный.
      await dragCircle('end', cellAt(5, 0))
      await expect.poll(selectedCount).toBe(3)
      await expectAt('start', () => cellAt(3, 0))
      await expectAt('end', () => cellAt(5, 0))
      expect(focusedAt()).toBe(idOf(3, 0))

      // Левый верхний круг вверх: правый нижний угол на месте и становится опорным.
      await dragCircle('start', cellAt(2, 0))
      await expect.poll(selectedCount).toBe(4)
      await expectAt('start', () => cellAt(2, 0))
      await expectAt('end', () => cellAt(5, 0))
      await expect.poll(focusedAt).toBe(idOf(5, 0))
    } finally {
      await screen.unmount()
    }
  })

  test('HN6: касание: движение пальца по телу прокручивает, долгое нажатие на ячейку открывает контекстное меню; нажатие на круг не прокручивает и не запускает долгое нажатие', async ({
    skip,
  }) => {
    skip(!chromium, 'удержание и протяжка пальцем — CDP Chromium')
    const screen = await renderSelection({ enableContextMenu: true })
    try {
      const scroller = () =>
        document.querySelector<HTMLElement>('.data-grid__container')!
      await expect
        .poll(() => scroller().querySelector('[data-portions-pending]'))
        .toBeNull()
      // Диапазон — предусловие этого теста; выделение коротким тапом проверяет HN5.
      await userEvent.click(cellAt(2, 1))
      await expect.poll(selectedCount).toBe(1)
      await touch.realTap(await settledCenter(() => cellAt(2, 1)))
      await expect
        .poll(() => handleOf('end')?.getAttribute('data-selection-handle'))
        .toBe('circle')

      // Удержание круга: ни прокрутки, ни меню, выделение то же.
      const held = center(handleOf('end')!)
      const before = scroller().scrollTop
      await touch.realTouchDown([held])
      await wait(LONG_PRESS_WAIT_MS)
      await touch.realTouchUp()
      await wait(100)
      expect(menu()).toBeNull()
      expect(scroller().scrollTop).toBe(before)
      expect(selectedCount()).toBe(1)

      // Палец по телу прокручивает; круги едут вместе с ячейкой.
      await touch.realSwipe(center(cellAt(7, 1)), center(cellAt(3, 1)))
      await expect.poll(() => scroller().scrollTop).toBeGreaterThan(before)
      expect(selectedCount()).toBeLessThanOrEqual(1)

      // Долгое нажатие на ячейку — контекстное меню.
      const target = await settledCenter(() => cellAt(6, 0))
      await touch.realTouchDown([target])
      await wait(LONG_PRESS_WAIT_MS)
      await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
      await touch.realTouchUp()
      await closeMenu()
    } finally {
      await screen.unmount()
    }
  })

  test('HN7: вид маркера — по вводу, которым сделано выделение: касание — круги, мышь — квадрат, на одном устройстве попеременно', async () => {
    const screen = await renderSelection()
    try {
      await touch.realTap(center(cellAt(2, 1)))
      await expect.poll(() => handleOf('start')).not.toBeNull()
      expect(handleOf('end')!.getAttribute('data-selection-handle')).toBe(
        'circle',
      )

      // Мышь: один квадрат в правом нижнем углу.
      await mouse.realDragHold(center(cellAt(3, 0)), center(cellAt(4, 1)), 4)
      await mouse.realMouseUp()
      await expect
        .poll(() => handleOf('end')?.getAttribute('data-selection-handle'))
        .toBe('square')
      expect(handleOf('start')).toBeNull()
      await expectAt('end', () => cellAt(4, 1))

      // Снова палец — снова круги.
      await touch.realTap(center(cellAt(5, 1)))
      await expect
        .poll(() => handleOf('end')?.getAttribute('data-selection-handle'))
        .toBe('circle')
      await expect.poll(() => handleOf('start')).not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('HN21: круги не ниже 3:1 к заливке выделения и к фону в обеих темах и в повышенном контрасте; в forced-colors — Highlight', async () => {
    const screen = await renderSelection()
    try {
      await touch.realTap(center(cellAt(2, 1)))
      await expect.poll(() => handleOf('start')).not.toBeNull()
      const marks = () =>
        (['start', 'end'] as const).map(
          corner => handleOf(corner)!.firstElementChild as HTMLElement,
        )
      const check = async () => {
        for (const mark of marks()) {
          const color = toRgba(getComputedStyle(mark).backgroundColor)
          expect(
            contrast(color, effectiveBg(cellAt(2, 1))),
          ).toBeGreaterThanOrEqual(3)
          expect(
            contrast(color, effectiveBg(cellAt(4, 0))),
          ).toBeGreaterThanOrEqual(3)
        }
      }
      await inBothThemes(check)
      await contrastCommands.moreContrast(true)
      await inBothThemes(check)
      await contrastCommands.moreContrast(false)
      await contrastCommands.forcedColors(true)
      for (const mark of marks()) {
        await expect
          .poll(() => getComputedStyle(mark).backgroundColor)
          .toBe(resolveColor(mark, 'Highlight'))
      }
    } finally {
      await screen.unmount()
    }
  })
})

describe('Отмена и повтор касанием (ADR 0222)', () => {
  test('UD30: кнопки «Отменить» и «Повторить» в тулбаре нажимаются касанием', async () => {
    let api: any
    const Host = () => {
      const [rows, setRows] = useState(
        Array.from({ length: 5 }, (_, i) => ({ id: String(i), price: i })),
      )
      api = useCreateTable({
        columns: [
          {
            id: 'price',
            accessorKey: 'price',
            header: 'Price',
            dataType: 'number',
          },
        ] as never,
        data: rows,
        getRowId: (row: { id: string }) => row.id,
        plugins: [
          cellEditing({
            onCellEdit: () => {},
            onCommitEdits: (batch: {
              cells: readonly { rowId: string; value: unknown }[]
            }) =>
              setRows(prev =>
                prev.map(row => {
                  const cell = batch.cells.find(item => item.rowId === row.id)
                  return cell ? { ...row, price: cell.value as number } : row
                }),
              ),
          } as never),
          editHistory(),
        ] as never,
      })
      return (
        <div style={{ width: 400, height: 400 }}>
          <DataGrid table={api as never} height={360} />
        </div>
      )
    }
    const screen = await render(<Host />)
    try {
      await waitForGrid()
      const price = () => api.getRowSource().byId('1').getValue('price')
      await api.writeCells([{ rowId: '1', columnId: 'price', value: 99 }], {
        source: 'paste',
      })
      await expect.poll(price).toBe(99)
      const button = (id: string) =>
        document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
      await touch.realTap(await settledCenter(() => button('undo-button')))
      await expect.poll(price).toBe(1)
      await touch.realTap(await settledCenter(() => button('redo-button')))
      await expect.poll(price).toBe(99)
    } finally {
      await screen.unmount()
    }
  })
})

describe('Подсказка точки пальцем (ADR 0224)', () => {
  const HINT = 'What the dot means'
  const hintShown = () =>
    [...document.querySelectorAll('[data-tooltip-popup]')].some(
      el => el.textContent?.trim() === HINT,
    )

  test('MH3: касание — удержание области точки 500 мс без сдвига показывает подсказку и не нажимает пункт; короткое касание нажимает пункт; следующее касание закрывает подсказку', async ({
    skip,
  }) => {
    skip(!chromium, 'удержание пальца — CDP Chromium')
    const onShow = vi.fn()
    const screen = await render(
      <div
        className="data-grid-theme"
        style={{ width: 320, padding: 16, paddingBottom: 200 }}
      >
        <PopupEntry
          mark={<Bubble size="dot" tone="draft" />}
          markHint={HINT}
          label="Price · row 3"
          onShow={onShow}
        />
        <p data-testid="elsewhere" style={{ height: 80 }}>
          Elsewhere
        </p>
      </div>,
    )
    try {
      const strip = await vi.waitFor(() => {
        const found = document.querySelector<HTMLElement>(
          '[data-popup-entry-mark-hint]',
        )
        if (!found) throw new Error('нет полосы')
        return found
      })
      const at = center(strip)
      // Удержание: подсказка, отпускание пункт не нажимает.
      await touch.realTouchDown([at])
      await wait(LONG_PRESS_WAIT_MS)
      await expect.poll(hintShown).toBe(true)
      await touch.realTouchUp()
      await wait(200)
      expect(onShow).not.toHaveBeenCalled()
      expect(hintShown()).toBe(true)
      // Следующее касание мимо закрывает подсказку.
      await touch.realTap(
        center(document.querySelector('[data-testid="elsewhere"]')!),
      )
      await expect.poll(hintShown).toBe(false)
      // Короткое касание — нажатие пункта, без подсказки.
      await touch.realTap(at)
      await expect.poll(() => onShow.mock.calls.length).toBe(1)
      await wait(LONG_PRESS_WAIT_MS)
      expect(hintShown()).toBe(false)
      // Сдвиг больше 10px отменяет удержание.
      await touch.realTouchDown([at])
      await touch.realTouchMove(at, { x: at.x, y: at.y + 16 }, 2)
      await wait(LONG_PRESS_WAIT_MS)
      expect(hintShown()).toBe(false)
      await touch.realTouchUp()
    } finally {
      await screen.unmount()
    }
  })
})

describe('Касание каждой фичи (ADR 0231)', () => {
  /** Тексты подсказок на экране. */
  const openTips = () =>
    [...document.querySelectorAll('[data-tooltip-popup][data-open]')].map(
      element => element.textContent ?? '',
    )
  /** Удержание пальца дольше долгого нажатия. */
  const hold = async (el: Element) => {
    await touch.realTouchDown([center(el)])
    await wait(LONG_PRESS_WAIT_MS)
  }
  const release = async () => {
    await touch.realTouchUp()
    await wait(100)
  }
  const titleOf = (text: string) =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '.data-grid__cell-wrapper-title',
      ),
    ].find(element => element.textContent === text)!
  const LONG_NAME = 'Bartholomew Montgomery-Fitzgerald'
  const SHORT_CITY = 'Saint Petersburg'

  test('TV6: удержание иконочной кнопки пальцем 500 мс без сдвига показывает её подсказку, касание без удержания нажимает; долгое нажатие на кнопке в ячейке контекстное меню не открывает', async ({
    skip,
  }) => {
    skip(!chromium, 'удержание пальца — CDP Chromium')
    renderGrid({
      columnCount: 6,
      dataCount: 20,
      enableColumnSorting: true,
      enableCellEditing: true,
      enableContextMenu: true,
      actionsDemo: 'async',
    })
    await waitForGrid()
    const row = rowAt(2)
    await tapCell(row, 'age')
    const edit = () =>
      cellOf(row, 'age').querySelector<HTMLElement>(
        `[aria-label="${cellEditingLabels(tableLabels).editCell}"]`,
      )!
    await settle(row)
    await hold(edit())
    try {
      await expect
        .poll(openTips, { timeout: 2000 })
        .toContain(cellEditingLabels(tableLabels).editCell)
      expect(menu(), 'кнопка в ячейке — не меню ячейки').toBeNull()
    } finally {
      await release()
    }
    expect(menu()).toBeNull()

    const headCell = headById(dataColumn())
    const sort = headCell.querySelector<HTMLElement>(
      'button.column-sort__button, .column-sort__button button',
    )!
    const name = sort.getAttribute('aria-label')!
    const sortState = () => headCell.getAttribute('aria-sort')
    const before = sortState()
    // Прокрутка закрывает подсказку, открытую удержанием.
    scroller().scrollLeft = 0
    await expect.poll(openTips).toEqual([])

    await hold(sort)
    try {
      await expect.poll(openTips, { timeout: 2000 }).toContain(name)
    } finally {
      await release()
    }
    expect(sortState(), 'удержание не нажимает').toBe(before)

    await touch.realTap(center(sort))
    await expect.poll(sortState).not.toBe(before)
  })

  test('TV7: касание: у ячейки с обрезанным текстом первый пункт контекстного меню «Показать полностью» показывает подсказку с полным текстом; у необрезанной пункта нет; без контекстного меню удержание обрезанной ячейки показывает подсказку', async ({
    skip,
  }) => {
    skip(!chromium, 'удержание пальца — CDP Chromium')
    const label = contextMenuLabels(tableLabels).showFullText
    const items = () =>
      [...(menu()?.querySelectorAll('[role="menuitem"]') ?? [])].map(
        item => item.textContent?.trim() ?? '',
      )
    const withMenu = await render(
      <composed.DataGridPlayground
        columnsOverride={overflowColumns}
        dataOverride={overflowData}
        containerHeight="560"
        height="460"
        enableContextMenu
        actionsDemo="async"
      />,
    )
    await waitForGrid()
    await hold(titleOf(LONG_NAME))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    await release()
    await expect.poll(() => items()[0]).toBe(label)
    await touch.realTap(
      center(
        [...menu()!.querySelectorAll('[role="menuitem"]')].find(
          item => item.textContent?.trim() === label,
        )!,
      ),
    )
    await expect.poll(openTips, { timeout: 2000 }).toContain(LONG_NAME)
    await touch.realTap(center(document.querySelector(HEAD_CELL)!))
    await expect.poll(openTips, { timeout: 2000 }).not.toContain(LONG_NAME)

    // Колонка города — у правого края узкого экрана: в окно.
    titleOf(SHORT_CITY).scrollIntoView({ block: 'nearest', inline: 'center' })
    await wait(100)
    await hold(titleOf(SHORT_CITY))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    await release()
    expect(items()).not.toContain(label)
    await closeMenu()
    await withMenu.unmount()

    await render(
      <composed.DataGridPlayground
        columnsOverride={overflowColumns}
        dataOverride={overflowData}
        containerHeight="560"
        height="460"
      />,
    )
    await waitForGrid()
    await hold(titleOf(LONG_NAME))
    await expect.poll(openTips, { timeout: 2000 }).toContain(LONG_NAME)
    await release()
    expect(openTips()).toContain(LONG_NAME)
    await touch.realTap(center(document.querySelector(HEAD_CELL)!))
    await expect.poll(openTips, { timeout: 2000 }).not.toContain(LONG_NAME)
  })
})

describe('Касание: мультисортировка из меню (ADR 0231)', () => {
  const itemLabels = () =>
    [
      ...(menu()?.querySelectorAll(
        '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]',
      ) ?? []),
    ].map(item => item.textContent?.trim() ?? '')
  const itemByLabel = (label: string) =>
    [
      ...(menu()?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []),
    ].find(item => item.textContent?.trim() === label)
  const openKebab = async (columnId: string) => {
    scroller().scrollLeft = 0
    const kebab =
      headById(columnId).querySelector<HTMLElement>('[data-action-menu]')!
    kebab.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    await touch.realTap(center(kebab))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
  }

  test('TV8: при включённой мультисортировке и сортировке по другой колонке меню колонки предлагает «Добавить к сортировке»: колонка встаёт следующим уровнем; без сортировки по другим колонкам пункта нет', async () => {
    // Кнопки шапки — в меню колонки: сортировку пальцем дают его пункты.
    renderGrid({
      columnCount: 6,
      dataCount: 20,
      enableColumnSorting: true,
      enableHeaderActionMenu: true,
      headerActionMenuMode: 'always',
    })
    await waitForGrid()
    const sortLabels = columnSortingLabels(tableLabels)
    const add = sortLabels.addToSorting

    await openKebab('lastName')
    expect(itemLabels()).not.toContain(add)
    await touch.realTap(center(itemByLabel(sortLabels.sortAscending)!))
    await expect
      .poll(() => headById('lastName').getAttribute('aria-sort'))
      .toBe('ascending')
    await expect.poll(menu).toBeNull()

    await openKebab('lastName')
    expect(itemLabels(), 'у отсортированной колонки пункта нет').not.toContain(
      add,
    )
    await closeMenu()

    await openKebab('firstName')
    await touch.realTap(center(itemByLabel(add)!))
    await expect
      .poll(() => headById('firstName').getAttribute('aria-sort'))
      .toBe('ascending')
    expect(headById('lastName').getAttribute('aria-sort')).toBe('ascending')
    // Колонка — следующий уровень: строки по-прежнему идут по первому уровню.
    const lastNames = () =>
      [...document.querySelectorAll<HTMLElement>(BODY_ROW)]
        .sort(
          (x, y) =>
            x.getBoundingClientRect().top - y.getBoundingClientRect().top,
        )
        .map(row => cellOf(row, 'lastName').textContent?.trim() ?? '')
    await expect.poll(() => lastNames().every(Boolean)).toBe(true)
    expect(lastNames()).toEqual(
      [...lastNames()].sort((x, y) => x.localeCompare(y)),
    )
    await expect.poll(menu).toBeNull()
  })
})

// Касание каждой фичи (ADR 0231, TV11–TV27): путь пользователя пальцем, теми же касаниями
// Chromium, что и TU. Стенд — своя таблица: столбцы текста, вариантов и чисел.
interface TouchItem {
  id: string
  name: string
  city: string
  amount: number
  subRows?: TouchItem[]
}

const CITIES = ['Rome', 'Paris', 'Berlin']
const TOUCH_DATA: TouchItem[] = Array.from({ length: 60 }, (_, index) => ({
  id: `r${index}`,
  name: `Name ${index}`,
  city: CITIES[index % 3]!,
  amount: index * 10,
}))
const TOUCH_TREE: TouchItem[] = TOUCH_DATA.slice(0, 10).map(item => ({
  ...item,
  subRows: [0, 1].map(child => ({
    ...item,
    id: `${item.id}-${child}`,
    name: `${item.name}.${child}`,
  })),
}))
const TOUCH_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 140 },
  {
    id: 'city',
    accessorKey: 'city',
    header: 'City',
    size: 130,
    dataType: 'select',
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    size: 130,
    dataType: 'number',
  },
]

interface TouchGridProps {
  plugins: unknown[]
  data?: TouchItem[]
  options?: Record<string, unknown>
}

const TouchGrid = ({ plugins, data = TOUCH_DATA, options }: TouchGridProps) => {
  const table = useCreateTable({
    columns: TOUCH_COLUMNS as never,
    data,
    getRowId: (row: TouchItem) => row.id,
    getSubRows: (row: TouchItem) => row.subRows,
    enableToolbar: true,
    enableStatusBar: true,
    plugins: plugins as never,
    ...options,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} height={560} />
    </div>
  )
}

const mountTouch = async (props: TouchGridProps) => {
  const screen = await render(<TouchGrid {...props} />)
  await waitForGrid()
  return screen
}

/** Коснуться элемента: сперва в окно, затем пальцем в центр. */
const tapOn = async (get: () => Element | null | undefined) => {
  // Элемент ищется в момент касания: перерисовка таблицы меняет узлы.
  await expect.poll(get).toBeTruthy()
  get()!.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  await new Promise(resolve => requestAnimationFrame(resolve))
  await touch.realTap(await settledCenter(() => get() as HTMLElement))
}
const rowById = (id: string) =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-id='${id}']`)
const visibleRowIds = () =>
  Array.from(document.querySelectorAll<HTMLElement>(`${BODY_ROW}[data-row-id]`))
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )
    .map(row => row.dataset.rowId!)
const cityTexts = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`${BODY_ROW}[data-row-id]`),
  ).map(row => cellOf(row, 'city').textContent?.trim() ?? '')
const headKebab = (id: string) =>
  headById(id).querySelector<HTMLElement>('[data-action-menu]')!
const menuItem = (label: string) =>
  Array.from(
    menu()?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [],
  ).find(item => item.textContent?.trim().startsWith(label))

describe('Касание каждой фичи (ADR 0231, TV11–TV27)', () => {
  test('TV11: касание кнопки сортировки сортирует колонку', async () => {
    await mountTouch({ plugins: [columnSorting()] })
    await tapOn(() => headById('name').querySelector('.column-sort__button'))
    // Направление первого нажатия — по типу колонки; сортировка включена.
    await expect
      .poll(() => headById('name').getAttribute('aria-sort'))
      .toMatch(/^(ascending|descending)$/)
  })

  test('TV12: касанием открывается панель фильтра колонки, вариант чек-листа отмечается касанием, отбор применяется', async () => {
    await mountTouch({ plugins: [columnFiltering({ debounceMs: 0 })] })
    await tapOn(() => headById('city').querySelector('.column-filter__button'))
    const panel = () =>
      document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
    await expect.poll(panel, { timeout: 5000 }).not.toBeNull()
    const rome = () =>
      panel()!.querySelector<HTMLElement>(
        '[data-option-index][data-value="Rome"] [role="checkbox"]',
      )
    await expect.poll(rome).not.toBeNull()
    await tapOn(() => rome())
    await expect.poll(() => rome()!.getAttribute('aria-checked')).toBe('true')
    await expect.poll(() => [...new Set(cityTexts())]).toEqual(['Rome'])
  })

  test('TV13: касание поля поиска даёт фокус для ввода; кнопка очистки очищает касанием', async () => {
    await mountTouch({ plugins: [quickSearch({ debounceMs: 0 })] })
    const field = () =>
      document.querySelector<HTMLInputElement>(
        `input[aria-label="${quickSearchLabels(tableLabels).search}"]`,
      )!
    await tapOn(() => field())
    await expect.poll(() => document.activeElement).toBe(field())
    await userEvent.keyboard('Name 7')
    await expect.poll(() => visibleRowIds()).toEqual(['r7'])
    const clear = () =>
      document.querySelector<HTMLElement>('[data-testid="quick-search-clear"]')
    await expect.poll(clear).not.toBeNull()
    await tapOn(() => clear())
    await expect.poll(() => field().value).toBe('')
    await expect.poll(() => visibleRowIds().length).toBeGreaterThan(1)
  })

  test('TV14: касанием из кебаба колонка закрепляется слева', async () => {
    await mountTouch({
      plugins: [columnPinning(), headerActionMenu({ mode: 'always' })],
    })
    await tapOn(() => headKebab('amount'))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    const pin = columnPinningLabels(tableLabels)
    const direct = menuItem(pin.pinLeft)
    await tapOn(() => direct ?? menuItem(pin.pin))
    if (!direct) {
      // Раздел закрепления — пункт стороны внутри.
      await expect.poll(() => menuItem(pin.pinLeft)).toBeTruthy()
      await tapOn(() => menuItem(pin.pinLeft))
    }
    await expect
      .poll(() => headById('amount').getAttribute('data-cell-pinned'))
      .toBe('left')
  })

  test('TV15: в разделе «Колонки» «Настроек вида» касание флажка скрывает колонку', async () => {
    await mountTouch({ plugins: [columnVisibility()] })
    await tapOn(() =>
      document.querySelector('[data-testid="view-settings-button"]'),
    )
    const columns = columnVisibilityLabels(tableLabels).columns
    const section = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid="view-settings-popover"] button',
        ),
      ).find(button => button.textContent?.startsWith(columns))
    await expect.poll(section, { timeout: 5000 }).toBeTruthy()
    await tapOn(() => section())
    const box = () =>
      document.querySelector<HTMLElement>(
        '[role="checkbox"][aria-label="City"]',
      )
    await expect.poll(box).toBeTruthy()
    await tapOn(() => box())
    await expect
      .poll(() => document.querySelector(`${HEAD_CELL}[data-column-id='city']`))
      .toBeNull()
  })

  test('TV16: касанием из кебаба выбирается функция сводки колонки', async () => {
    await mountTouch({
      plugins: [
        columnTotals(),
        columnAggregation(),
        headerActionMenu({ mode: 'always' }),
      ],
      options: { enableFooter: true },
    })
    const labels = columnAggregationLabels(tableLabels)
    await tapOn(() => headKebab('amount'))
    await expect
      .poll(() => menuItem(labels.summary), { timeout: 5000 })
      .toBeTruthy()
    await tapOn(() => menuItem(labels.summary))
    await expect.poll(() => menuItem(labels.max)).toBeTruthy()
    await tapOn(() => menuItem(labels.max))
    const footer = () =>
      document.querySelector<HTMLElement>(
        `.data-grid__footer-cell[data-column-id='amount']`,
      )?.textContent ?? ''
    await expect.poll(footer).toContain(labels.max)
    expect(footer()).toContain('590')
  })

  test('TV17: касание флажка строки выбирает строку, флажка шапки — все строки', async () => {
    await mountTouch({ plugins: [rowSelection()] })
    const rowBox = () =>
      rowById('r2')!.querySelector<HTMLElement>('[role="checkbox"]')!
    await tapOn(() => rowBox())
    await expect.poll(() => rowBox().getAttribute('aria-checked')).toBe('true')
    await tapOn(() => document.querySelector(`${HEAD_CELL} [role="checkbox"]`))
    await expect
      .poll(() =>
        Array.from(
          document.querySelectorAll(`${BODY_ROW} [role="checkbox"]`),
        ).every(box => box.getAttribute('aria-checked') === 'true'),
      )
      .toBe(true)
  })

  test('TV18: касание шеврона раскрывает строку, кнопки «Раскрыть всё» — все строки', async () => {
    await mountTouch({ plugins: [rowExpanding()], data: TOUCH_TREE })
    const labels = rowExpandingLabels(tableLabels)
    await tapOn(() =>
      rowById('r1')!.querySelector(`[aria-label="${labels.expandRow}"]`)!,
    )
    await expect.poll(() => rowById('r1-0')).not.toBeNull()
    await tapOn(() =>
      document.querySelector(
        `${HEAD_CELL} [aria-label="${labels.expandAll}"]`,
      )!,
    )
    await expect.poll(() => rowById('r0-0')).not.toBeNull()
    expect(rowById('r2-1')).not.toBeNull()
  })

  test('TV19: касание кнопки группировки в шапке группирует по колонке', async () => {
    await mountTouch({ plugins: [rowGrouping()] })
    await tapOn(() => headById('city').querySelector('.column-group__button'))
    await expect
      .poll(() => document.querySelectorAll('[data-group-value]').length)
      .toBe(3)
  })
})

describe('Касание каждой фичи (ADR 0231, TV20–TV27)', () => {
  const statusText = () =>
    document.querySelector('[data-testid="data-grid-status-bar"]')
      ?.textContent ?? ''

  test('TV20: палец, держащий перетаскиваемую строку у нижнего края области, прокручивает таблицу', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    await mountTouch({ plugins: [rowDragging()] })
    const handle = () => rowById('r1')?.querySelector<HTMLElement>(HANDLE)
    await expect.poll(handle).toBeTruthy()
    const from = await settledCenter(() => handle()!)
    const area = scroller().getBoundingClientRect()
    const to = { x: from.x, y: area.bottom - 6 }
    const top = () => scrollLayer(scroller()).top()
    expect(top()).toBe(0)
    await touch.realTouchDown([from])
    try {
      await wait(300)
      await touch.realTouchMove(from, to, 16)
      await expect.poll(top, { timeout: 4000 }).toBeGreaterThan(40)
    } finally {
      await touch.realTouchUp()
    }
  })

  test('TV21: касание кебаба строки открывает меню строки, касание пункта выполняет действие', async () => {
    const archived: string[] = []
    const archive: RowAction = {
      id: 'touchArchive',
      slot: 'actionRowSlot',
      icon: () => <span aria-hidden />,
      label: () => 'Archive',
      onSelect: ({ row }) => {
        archived.push(row.id)
      },
    }
    const probe = definePlugin()({ id: 'touchProbe', slotActions: [archive] })
    await mountTouch({
      plugins: [probe(), rowActions(), rowActionMenu({ mode: 'always' })],
    })
    // Кнопки строки видны у тронутой строки (ADR 0086).
    await tapOn(() => rowById('r2') && cellOf(rowById('r2')!, 'name'))
    await tapOn(() => rowById('r2')!.querySelector('[data-action-menu]'))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    await tapOn(() => menuItem('Archive'))
    await expect.poll(() => archived).toEqual(['r2'])
  })

  test('TV22: пункт «Копировать» контекстного меню, открытого долгим нажатием, копирует выделенные ячейки', async ({
    skip,
  }) => {
    skip(!chromium, 'удержание пальца — CDP Chromium')
    const written: string[] = []
    const clipboard = navigator.clipboard
    const write = vi
      .spyOn(clipboard, 'write')
      .mockImplementation(async items => {
        for (const item of items)
          written.push(await (await item.getType('text/plain')).text())
      })
    const writeText = vi
      .spyOn(clipboard, 'writeText')
      .mockImplementation(async text => {
        written.push(text)
      })
    try {
      await mountTouch({ plugins: [cellSelection(), contextMenu()] })
      const cell = () => cellOf(rowById('r2')!, 'name')
      await tapOn(cell)
      await expect
        .poll(() => cell().getAttribute('data-cell-selected'))
        .toBe('true')
      await touch.realTouchDown([await settledCenter(cell)])
      await wait(LONG_PRESS_WAIT_MS)
      await touch.realTouchUp()
      await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
      await tapOn(() => menuItem(cellSelectionLabels(tableLabels).copy))
      await expect.poll(() => written).toEqual(['Name 2'])
    } finally {
      write.mockRestore()
      writeText.mockRestore()
    }
  })

  test('TV23: касание кнопки «Следующая страница» листает, касание выбора размера страницы меняет его', async () => {
    await mountTouch({ plugins: [pagination({ pageNumbers: false })] })
    const labels = paginationLabels(tableLabels)
    await tapOn(() =>
      document.querySelector(`[aria-label="${labels.nextPage}"]`),
    )
    await expect.poll(() => visibleRowIds()[0]).not.toBe('r0')
    await tapOn(() =>
      document.querySelector('[data-testid="page-size-select"]'),
    )
    const option = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>('[role="option"]'),
      ).find(item => item.textContent?.trim() === '10')
    await expect.poll(option, { timeout: 5000 }).toBeTruthy()
    await tapOn(option)
    await expect.poll(statusText).toMatch(/1.10/)
    await expect.poll(() => visibleRowIds()[0]).toBe('r0')
  })

  test('TV24: касание кнопки «наверх» прокручивает к началу', async () => {
    await mountTouch({ plugins: [backToTop()] })
    scroller().scrollTop = 1200
    const button = () =>
      document.querySelector<HTMLElement>(
        `[aria-label="${backToTopLabels(tableLabels).backToTop}"]`,
      )
    await expect.poll(button, { timeout: 5000 }).toBeTruthy()
    await tapOn(button)
    await expect
      .poll(() => scrollLayer(scroller()).top(), { timeout: 5000 })
      .toBe(0)
  })

  test('TV25: касанием открываются журнал отказов и пульт несохранённых изменений', async () => {
    await mountTouch({ plugins: [failureLog(), unsavedChanges()] })
    await tapOn(() =>
      document.querySelector('[data-testid="failure-log-button"]'),
    )
    await expect
      .poll(() => document.querySelector('[data-testid="failure-log"]'), {
        timeout: 5000,
      })
      .toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => document.querySelector('[data-testid="failure-log"]'))
      .toBeNull()
    await tapOn(() =>
      document.querySelector('[data-testid="unsaved-changes-button"]'),
    )
    await expect
      .poll(() => document.querySelector('[data-testid="unsaved-changes"]'), {
        timeout: 5000,
      })
      .toBeTruthy()
    await userEvent.keyboard('{Escape}')
  })

  test('TV26: касанием открывается панель выгрузки и выбирается формат', async () => {
    const json = {
      id: 'json',
      label: 'JSON',
      extension: 'json',
      mimeType: 'application/json',
      serialize: ({ rows }: { rows: unknown[][] }) => JSON.stringify(rows),
    }
    await mountTouch({
      plugins: [dataExport({ formats: [exportFormats.csv(), json] })],
    })
    await tapOn(() => document.querySelector('[data-testid="export-button"]'))
    await expect
      .poll(() => document.querySelector('[data-testid="export-panel"]'), {
        timeout: 5000,
      })
      .toBeTruthy()
    const radio = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="export-axis-format"] [role="radio"][data-value="json"]',
      )
    await tapOn(radio)
    await expect.poll(() => radio()!.getAttribute('aria-checked')).toBe('true')
    await userEvent.keyboard('{Escape}')
  })

  test('TV27: под вложенной шапкой колонку переносят пальцем за ручку', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    renderGrid({
      columnCount: 8,
      dataCount: 20,
      headerNesting: 'nested',
      enableColumnDragging: true,
    })
    await waitForGrid()
    const leaves = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-last-headers-row='true'][data-column-id]`,
        ),
      )
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )
        .map(cell => cell.getAttribute('data-column-id'))
    const before = leaves()
    expect(before.indexOf('firstName')).toBeLessThan(before.indexOf('lastName'))
    const first = headById('firstName')
    const from = await settledCenter(() =>
      first.querySelector<HTMLElement>(HANDLE)!,
    )
    const to = {
      x: from.x + first.getBoundingClientRect().width * 1.6,
      y: from.y,
    }
    await touch.realTouchDown([from])
    await wait(300)
    await touch.realTouchMove(from, to, 16)
    await wait(50)
    await touch.realTouchUp()
    await expect
      .poll(() => leaves().indexOf('firstName'))
      .toBeGreaterThan(leaves().indexOf('lastName'))
  })

  test('TU15: перетаскивание и нажатие мимо снимают data-touched и скрывают кнопки, а выделение и активная ячейка сохраняются', async ({
    skip,
  }) => {
    skip(!chromium, 'жест пальцем по шагам — CDP Chromium')
    const screen = await renderGrid({
      columnCount: 4,
      dataCount: 10,
      enableCellSelection: true,
      enableKeyboardNavigation: true,
      enableRowDragging: true,
      enableRowActionMenu: true,
      rowActionMenuMode: 'always',
    })
    try {
      await waitForGrid()
      const first = rowAt(1)
      const firstCell = cellOf(first, dataColumn())
      await tapCell(first, dataColumn())
      await settle(first)
      expect(touchedButtons(first, dataColumn()).every(shown)).toBe(true)
      expect(firstCell).toHaveAttribute('data-kn-active', 'true')
      expect(firstCell).toHaveAttribute('data-cell-selected', 'true')

      scroller().scrollLeft = 0
      await wait(100)
      const from = center(first.querySelector(HANDLE)!)
      const to = center(rowAt(4).querySelector(HANDLE)!)
      await touch.realTouchDown([from])
      await wait(300)
      await touch.realTouchMove(from, to, 16)
      await wait(50)
      await expect.poll(() => first.hasAttribute('data-touched')).toBe(false)
      const firstMenuButton = first.querySelector('[data-action-menu]')
      expect(firstMenuButton === null || !shown(firstMenuButton)).toBe(true)
      expect(firstCell).toHaveAttribute('data-kn-active', 'true')
      expect(firstCell).toHaveAttribute('data-cell-selected', 'true')
      await touch.realTouchUp()
      scroller().scrollLeft = 0
      await wait(100)

      const second = rowAt(2)
      const secondCell = cellOf(second, dataColumn())
      await tapCell(second, dataColumn())
      await settle(second)
      expect(touchedButtons(second, dataColumn()).every(shown)).toBe(true)
      await expect
        .poll(() => secondCell.getAttribute('data-kn-active'))
        .toBe('true')
      await touch.realMouseDown({ x: 1, y: 1 })
      await touch.realMouseUp()
      await expect.poll(() => second.hasAttribute('data-touched')).toBe(false)
      const secondMenuButton = second.querySelector('[data-action-menu]')
      expect(secondMenuButton === null || !shown(secondMenuButton)).toBe(true)
      await expect
        .poll(() => secondCell.getAttribute('data-kn-active'))
        .toBe('true')
      expect(secondCell).toHaveAttribute('data-cell-selected', 'true')
    } finally {
      await touch.realTouchUp().catch(() => undefined)
      await touch.realMouseUp().catch(() => undefined)
      await screen.unmount()
    }
  })
})

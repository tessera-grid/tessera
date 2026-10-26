import axe from 'axe-core'
import { commands, server } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'
import { revealedHandleWidth } from '../helpers'

import { Stories, renderGrid } from '../helpers'
import { composed } from '../stories'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { pinViaPopover } from './column-pinning-helpers'
import { tableLabels } from '../labels'
import { scrollLayer } from '../../../core/scrollStretch'

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
  test('TU1: без наведения скрытые кнопки заголовка — сортировка, фильтр, закрепление, кебаб, ручка — видны всегда', async () => {
    renderGrid({
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
    expect(buttons.length).toBeGreaterThan(2)
    await expect.poll(() => buttons.filter(b => !shown(b)).length).toBe(0)
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
      expect(firstButtons.length).toBeGreaterThan(1)
      expect(firstButtons.some(shown)).toBe(false)

      await tapCell(first, column)
      await expect
        .poll(() => touchedButtons(first, column).filter(b => !shown(b)).length)
        .toBe(0)
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
    const head = headById(dataColumn())
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
    expect(menu()!.textContent).toContain(tableLabels.widenColumn)
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

  test('TU9: колонку и строку тянут пальцем за ручку; свайп по ячейке прокручивает грид и ничего не тянет', async ({
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
    const drag = async (from: Point, to: Point) => {
      await touch.realTouchDown([from])
      await touch.realTouchMove(from, to, 16)
      await wait(50)
      await touch.realTouchUp()
    }

    const columns = headOrder()
    const first = headById(dataColumn())
    const columnHandle = first.querySelector<HTMLElement>(HANDLE)!
    const from = center(columnHandle)
    await drag(from, {
      x: from.x + first.getBoundingClientRect().width * 1.6,
      y: from.y,
    })
    await expect.poll(headOrder).not.toEqual(columns)

    // Протяжка колонки докручивает грид вправо — ручки строк вернуть в окно.
    scroller().scrollLeft = 0
    await wait(100)
    const rows = rowOrder()
    const rowHandle = rowAt(1).querySelector<HTMLElement>(HANDLE)!
    const start = center(rowHandle)
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
    expect(menu()!.textContent).toContain(tableLabels.moveRight)
    await closeMenu()

    const rowHandle = rowAt(2).querySelector<HTMLElement>(HANDLE)!
    await touch.realTap(center(rowHandle))
    await expect.poll(menu, { timeout: 5000 }).toBeTruthy()
    expect(menu()!.textContent).toContain(tableLabels.moveDown)
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
        el.matches(`[aria-label="${tableLabels.editCell}"]`),
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
    await pinViaPopover(headById('lastName'), tableLabels.pinLeft)
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
      serverRowModelRowCount: 1_000_000,
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

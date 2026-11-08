import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  onTestFinished,
  test,
} from 'vitest'

import { useLayoutEffect } from 'react'
import { ResizeHandler } from '../../../plugins/columnSizing/ResizeHandler'
import { columnSizing } from '../../../plugins/columnSizing'
import { useCreateTable } from '../../../core/useCreateTable'
import { useSlice } from '../../../core/reactivity'
import { DataGrid } from '../../../grid/DataGrid'
import { columnSizingLabels } from '../../../plugins/columnSizing/labels'
import { ENGLISH_LABELS } from '../../../core/localization'
import { ColumnResizingGrid } from './columns-fixtures'
import { PINNING_NESTED } from './header-fixtures'
import {
  contrast,
  effectiveBg,
  inBothThemes,
  resolveColor,
  toRgba,
} from './a11y-helpers'
import { snapshot } from './contrast-helpers'

// Подсветка границы колонки при изменении ширины (ADR 0197): синяя черта грипа при
// наведении на его зону, линия во всю видимую высоту колонки при нажатии, протяжке,
// открытом меню ширины и фокусе клавиатуры. Указатель — настоящий (Playwright).

const HEAD_CELL = '.data-grid__head-cell'
const BODY_ROW = '.data-grid__body-row'
const BODY_CELL = '.data-grid__body-cell'
const FOOTER = '.data-grid__footer'
const SCROLLER = '.data-grid__container'
const RESIZE_GRIP = '.resize__handler--column'
const LINE = '[data-column-resize-line]'
const LINE_COLOR = 'var(--tsr-comp-resize-line-color)'
const LINE_WIDTH = 'var(--tsr-comp-resize-line-width)'
const STROKE_WIDTH = 'var(--tsr-comp-resize-handler-stroke-width)'
const IDLE = 'var(--tsr-comp-control-color)'

type Point = { x: number; y: number }
const pointer = commands as unknown as {
  realDragHold: (from: Point, to: Point) => Promise<void>
  realMouseMove: (from: Point, to: Point) => Promise<void>
  realMouseDown: (at: Point) => Promise<void>
  realMouseUp: () => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
  moreContrast: (active: boolean) => Promise<void>
}

// Снимки пикселей — без ужатия раннером: окно не больше рамки.
const initialViewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(900, 720))
afterAll(() => page.viewport(initialViewport.width, initialViewport.height))

afterEach(async () => {
  await pointer.forcedColors(false)
  await pointer.moreContrast(false)
  document.documentElement.classList.remove('dark')
})

type Args = Parameters<typeof ColumnResizingGrid>[0]

const renderGrid = async (args: Args = {}) => {
  const screen = await render(<ColumnResizingGrid {...args} />)
  const container = screen.container
  await expect
    .poll(
      () => container.querySelectorAll(`${HEAD_CELL} ${RESIZE_GRIP}`).length,
    )
    .toBeGreaterThan(2)
  return { container, screen }
}

/** Заголовки колонок с грипом слева направо. */
const resizableHeads = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(HEAD_CELL)]
    .filter(cell => cell.querySelector(RESIZE_GRIP))
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

const headById = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)!

const gripOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(RESIZE_GRIP)!
const separatorOf = (cell: HTMLElement) =>
  gripOf(cell).querySelector<HTMLElement>('[role="separator"]')!
const centerOf = (el: Element): Point => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Линия во всю высоту: положение и цвет; `null` — линии нет. */
const lineOf = (cell: HTMLElement) => {
  if (!gripOf(cell).hasAttribute('data-resize-line')) return null
  const line = cell
    .closest('.data-grid-theme')
    ?.querySelector<HTMLElement>(`${LINE}:not([hidden])`)
  if (!line) return null
  const rect = line.getBoundingClientRect()
  return {
    center: rect.left + rect.width / 2,
    width: rect.width,
    top: rect.top,
    bottom: rect.bottom,
    color: getComputedStyle(line).backgroundColor,
  }
}

/** Низ видимой части таблицы: последняя строка или футер, не ниже области прокрутки. */
const visibleBottomOf = (container: HTMLElement) => {
  const scroller = container.querySelector<HTMLElement>(SCROLLER)!
  const area =
    scroller.getBoundingClientRect().top +
    scroller.clientTop +
    scroller.clientHeight
  const ends = [...container.querySelectorAll(`${BODY_ROW}, ${FOOTER}`)].map(
    el => el.getBoundingClientRect().bottom,
  )
  return Math.min(area, Math.max(...ends))
}

const strokeColor = (cell: HTMLElement) =>
  getComputedStyle(separatorOf(cell)).borderTopColor
const tokenColor = (cell: HTMLElement, value: string) =>
  resolveColor(gripOf(cell), value)
/** Длина токена в px в контексте грипа. */
const tokenLength = (cell: HTMLElement, value: string) => {
  const probe = document.createElement('span')
  probe.style.width = value
  probe.style.position = 'absolute'
  gripOf(cell).append(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return width
}

/** Линия на правой границе колонки, от верха её заголовка до низа видимой части. */
const expectLineAlongColumn = async (
  container: HTMLElement,
  id: string,
  { top }: { top?: () => number } = {},
) => {
  const cell = () => headById(container, id)
  await expect.poll(() => lineOf(cell()) !== null).toBe(true)
  // Линия продолжает черту грипа: на правой границе колонки (CR19), у края таблицы — внутри.
  await expect
    .poll(() =>
      Math.abs(lineOf(cell())!.center - centerOf(separatorOf(cell())).x),
    )
    .toBeLessThanOrEqual(1)
  const expectedTop = top ?? (() => cell().getBoundingClientRect().top)
  expect(Math.abs(lineOf(cell())!.top - expectedTop())).toBeLessThanOrEqual(1)
  expect(
    Math.abs(lineOf(cell())!.bottom - visibleBottomOf(container)),
  ).toBeLessThanOrEqual(1)
  expect(lineOf(cell())!.color).toBe(tokenColor(cell(), LINE_COLOR))
  // Линия толщиной токена; черта своего цвета не меняет.
  expect(lineOf(cell())!.width).toBeCloseTo(tokenLength(cell(), LINE_WIDTH), 1)
  expect(strokeColor(cell())).toBe(tokenColor(cell(), IDLE))
}

/** Линия видна поверх тела и футера: пиксели снимка вдоль неё — её цвет. */
const expectLinePainted = async (container: HTMLElement, id: string) => {
  const line = lineOf(headById(container, id))!
  const color = toRgba(line.color)
  const scroller = container.querySelector<HTMLElement>(SCROLLER)!
  const frame = scroller.getBoundingClientRect()
  const shot = await snapshot(scroller, { left: frame.left, top: frame.top })
  for (const share of [0.3, 0.6, 0.97]) {
    const pixel = shot(
      line.center,
      line.top + (line.bottom - line.top) * share,
    )!
    for (const channel of [0, 1, 2]) {
      expect(Math.abs(pixel[channel]! - color[channel]!)).toBeLessThan(12)
    }
  }
}

/**
 * Фокус клавиатуры на разделителе: фокус и клавиша на нём. Firefox и WebKit не дают
 * `:focus-visible` программному фокусу, клавиша на разделителе — фокус клавиатуры везде.
 */
const focusByKeyboard = async (cell: HTMLElement) => {
  separatorOf(cell).blur()
  separatorOf(cell).focus()
  await userEvent.keyboard('{Shift}')
  expect(document.activeElement).toBe(separatorOf(cell))
  await expect
    .poll(() => separatorOf(cell).closest('[data-resize-line]') !== null)
    .toBe(true)
}

const releaseAll = async () => {
  await pointer.realMouseUp()
  await userEvent.keyboard('{Escape}')
}

/** Видимая область прокрутки по горизонтали. */
const areaOf = (container: HTMLElement) => {
  const scroller = container.querySelector<HTMLElement>(SCROLLER)!
  const left = scroller.getBoundingClientRect().left + scroller.clientLeft
  return { scroller, left, right: left + scroller.clientWidth }
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

/**
 * Расширить последнюю колонку у края (автопрокрутка), затем сузить на 150px — не отпуская.
 * Минимум колонок мока — их начальная ширина: сузить можно только расширенную.
 */
const widenThenNarrow = async (cell: () => HTMLElement, right: number) => {
  const from = centerOf(separatorOf(cell()))
  const edge = { x: right - 6, y: from.y }
  await pointer.realDragHold(from, edge)
  const min = Number(separatorOf(cell()).getAttribute('aria-valuemin'))
  await expect
    .poll(() => cell().getBoundingClientRect().width)
    .toBeGreaterThan(min + 200)
  const narrow = { x: right - 156, y: from.y }
  await pointer.realMouseMove(edge, narrow)
  return { edge, narrow }
}

/** Последняя колонка, таблица прокручена до конца: справа места нет. */
const lastColumnAtEnd = async (container: HTMLElement) => {
  const { scroller } = areaOf(container)
  scroller.scrollLeft = scroller.scrollWidth
  const LAST = `${HEAD_CELL}[data-last-header-in-row='true']`
  await expect.poll(() => container.querySelector(LAST)).not.toBeNull()
  const id = container.querySelector<HTMLElement>(LAST)!.dataset.columnId!
  await expect
    .poll(() => scroller.scrollLeft)
    .toBe(scroller.scrollWidth - scroller.clientWidth)
  return { id, cell: () => headById(container, id) }
}

describe('Автопрокрутка при протяжке ширины (ADR 0197, §5)', () => {
  test('RL15: протяжка грипа к правому краю прокручивает таблицу вправо и растит колонку, к левому — прокручивает влево и сужает её; граница остаётся под указателем', async () => {
    const { container } = await renderGrid({ columnCount: 12 })
    const { scroller, left, right } = areaOf(container)
    // Самая правая колонка, видимая целиком: до её максимума далеко.
    const id = resizableHeads(container)
      .filter(head => head.getBoundingClientRect().right < right - 60)
      .at(-1)!.dataset.columnId!
    const cell = () => headById(container, id)
    const borderGap = (x: number) =>
      Math.abs(cell().getBoundingClientRect().right - x)
    try {
      // Вправо: указатель в краевой зоне, затем вне её — граница встаёт под него.
      await userEvent.hover(gripOf(cell()))
      const from = centerOf(separatorOf(cell()))
      const edge = { x: right - 8, y: from.y }
      await pointer.realDragHold(from, edge)
      await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(120)
      const back = { x: right - 120, y: from.y }
      await pointer.realMouseMove(edge, back)
      const scrolled = scroller.scrollLeft
      await wait(150)
      expect(scroller.scrollLeft).toBe(scrolled)
      await expect.poll(() => borderGap(back.x)).toBeLessThanOrEqual(1)
      await pointer.realMouseUp()

      // Влево: левый край той же колонки за краем области — есть что прокручивать
      // до её минимума.
      const offset = cell().getBoundingClientRect().left - left + 200
      const target = scroller.scrollLeft + offset
      scroller.scrollLeft = target
      await expect.poll(() => scroller.scrollLeft).toBe(target)
      await userEvent.hover(gripOf(cell()))
      const start = centerOf(separatorOf(cell()))
      const leftEdge = { x: left + 8, y: start.y }
      const width = cell().getBoundingClientRect().width
      await pointer.realDragHold(start, leftEdge)
      await expect.poll(() => scroller.scrollLeft).toBeLessThan(target - 40)
      // У края колонка сужается вслед за прокруткой.
      await expect
        .poll(() => cell().getBoundingClientRect().width)
        .toBeLessThan(width)
      const inside = { x: left + 140, y: start.y }
      await pointer.realMouseMove(leftEdge, inside)
      await expect.poll(() => borderGap(inside.x)).toBeLessThanOrEqual(1)
    } finally {
      await releaseAll()
    }
  })

  test('RL16: автопрокрутка останавливается у максимальной и минимальной ширины колонки; Escape посреди неё возвращает исходную ширину', async () => {
    const { container } = await renderGrid({ columnCount: 12 })
    const { scroller, left, right } = areaOf(container)
    try {
      // Максимум: колонка растёт у правого края, пока не упрётся в свою наибольшую ширину.
      const wideId = resizableHeads(container)
        .filter(head => head.getBoundingClientRect().right < right - 60)
        .at(-1)!.dataset.columnId!
      const wide = () => headById(container, wideId)
      const max = Number(separatorOf(wide()).getAttribute('aria-valuemax'))
      expect(max).toBeGreaterThan(0)
      await userEvent.hover(gripOf(wide()))
      const from = centerOf(separatorOf(wide()))
      await pointer.realDragHold(from, { x: right - 4, y: from.y })
      await expect
        .poll(() => Math.round(wide().getBoundingClientRect().width), {
          timeout: 5000,
        })
        .toBe(max)
      const atMax = scroller.scrollLeft
      await wait(200)
      expect(scroller.scrollLeft).toBe(atMax)
      await releaseAll()

      // Минимум: колонка сужается у левого края, пока не упрётся в свою наименьшую ширину.
      const target = resizableHeads(container).find(
        head => head.getBoundingClientRect().left > left + 60,
      )!
      const id = target.dataset.columnId!
      const cell = () => headById(container, id)
      const min = Number(separatorOf(cell()).getAttribute('aria-valuemin'))
      const initial = cell().getBoundingClientRect().width
      await userEvent.hover(gripOf(cell()))
      const start = centerOf(separatorOf(cell()))
      await pointer.realDragHold(start, { x: left + 4, y: start.y })
      await expect
        .poll(() => Math.round(cell().getBoundingClientRect().width))
        .toBe(min)
      const stopped = scroller.scrollLeft
      await wait(200)
      expect(scroller.scrollLeft).toBe(stopped)

      // Escape посреди протяжки — исходная ширина.
      await userEvent.keyboard('{Escape}')
      await expect
        .poll(() => cell().getBoundingClientRect().width)
        .toBeCloseTo(initial, 0)
    } finally {
      await releaseAll()
    }
  })

  test('RL19: после сужения у конца прокрутки повторная протяжка к правому краю плавно докручивает таблицу к границе и затем растит колонку', async () => {
    const { container } = await renderGrid({ columnCount: 12 })
    const { scroller, right } = areaOf(container)
    const { cell } = await lastColumnAtEnd(container)
    const gap = (x: number) => cell().getBoundingClientRect().right - x
    try {
      await userEvent.hover(cell())
      // Расширить у края, сузить: граница остаётся у края, указатель левее.
      const { edge, narrow } = await widenThenNarrow(cell, right)
      await expect.poll(() => gap(narrow.x)).toBeGreaterThan(100)
      const width = cell().getBoundingClientRect().width
      // Снова к краю: граница впереди указателя — таблица докручивается без скачков.
      // Кадры пишутся и во время движения указателя: докрутка начинается в зоне.
      const steps: number[] = []
      let sampling = true
      const sampler = (async () => {
        let last = scroller.scrollLeft
        while (sampling) {
          await nextFrame()
          steps.push(scroller.scrollLeft - last)
          last = scroller.scrollLeft
        }
      })()
      await pointer.realMouseMove(narrow, edge)
      for (let i = 0; i < 20; i++) await nextFrame()
      sampling = false
      await sampler
      expect(steps.some(step => step > 0)).toBe(true)
      expect(Math.max(...steps)).toBeLessThanOrEqual(23)
      await expect.poll(() => gap(edge.x)).toBeLessThanOrEqual(8)
      await expect
        .poll(() => cell().getBoundingClientRect().width)
        .toBeGreaterThan(width + 40)
    } finally {
      await releaseAll()
    }
  })

  test('RL20: сужение у конца прокрутки сразу сужает таблицу; отпускание и прокрутка в начало ширину прокрутки не меняют', async () => {
    const { container } = await renderGrid({ columnCount: 12 })
    const { scroller, right } = areaOf(container)
    const { cell } = await lastColumnAtEnd(container)
    try {
      await userEvent.hover(cell())
      await widenThenNarrow(cell, right)
      // Таблица сузилась вместе с колонкой: справа пустого места нет, граница у края.
      await expect
        .poll(() => Math.abs(cell().getBoundingClientRect().right - right))
        .toBeLessThanOrEqual(1)
      expect(scroller.scrollLeft).toBe(
        scroller.scrollWidth - scroller.clientWidth,
      )
      const scrolled = scroller.scrollLeft
      const range = scroller.scrollWidth
      await pointer.realMouseUp()
      await wait(150)
      expect(scroller.scrollLeft).toBe(scrolled)
      expect(scroller.scrollWidth).toBe(range)
      scroller.scrollLeft = 0
      await wait(150)
      expect(scroller.scrollWidth).toBe(range)
    } finally {
      await releaseAll()
    }
  })

  test('RL21: после отпускания прокрутка не поджимается, даже если в отрисовке конца протяжки приложение читает раскладку', async () => {
    const COLUMNS = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      header: `C${i}`,
      accessorFn: (row: { n: number }) => row.n * 100 + i,
      size: 150,
      maxSize: 2000,
    }))
    const ROWS = Array.from({ length: 30 }, (_, n) => ({ id: `r${n}`, n }))
    // Хост читает раскладку в эффекте той же отрисовки, что кончает протяжку, — как
    // консоль истории, прокручивающая свой журнал.
    const Host = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: ROWS,
        getRowId: (row: { id: string }) => row.id,
        plugins: [columnSizing()],
      })
      useSlice(table as never, 'columnResizing' as never)
      useLayoutEffect(() => {
        void document.querySelector('.data-grid__container')?.scrollWidth
      })
      return (
        <div style={{ width: 800, height: 420 }}>
          <DataGrid table={table} height={400} />
        </div>
      )
    }
    const screen = await render(<Host />)
    await expect
      .poll(() => screen.container.querySelectorAll(RESIZE_GRIP).length)
      .toBeGreaterThan(2)
    const { scroller, right } = areaOf(screen.container)
    // Таблица у конца прокрутки: автопрокрутка уводит дальше её прежнего конца.
    const { cell } = await lastColumnAtEnd(screen.container)
    const end = scroller.scrollLeft
    try {
      await userEvent.hover(cell())
      const from = centerOf(separatorOf(cell()))
      await pointer.realDragHold(from, { x: right - 6, y: from.y })
      await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(end + 200)
      await wait(150)
      const held = scroller.scrollLeft
      await pointer.realMouseUp()
      await wait(300)
      expect(scroller.scrollLeft).toBeGreaterThanOrEqual(held - 1)
    } finally {
      await releaseAll()
    }
  })

  test('RL17: протяжка грипа закреплённой колонки к краю таблицу не прокручивает', async () => {
    // Узкое окно: у края колонка ещё не упёрлась в свой максимум — без запрета прокрутка шла бы.
    await page.viewport(500, 720)
    onTestFinished(() => page.viewport(900, 720))
    const first = await renderGrid({
      columnCount: 12,
      enableColumnPinning: true,
    })
    const id = resizableHeads(first.container)[0]!.dataset.columnId!
    await first.screen.unmount()
    const { container } = await renderGrid({
      columnCount: 12,
      enableColumnPinning: true,
      initialColumnPinning: { start: [id], end: [] },
    })
    const { scroller, right } = areaOf(container)
    const cell = () => headById(container, id)
    expect(cell().getAttribute('data-cell-pinned')).toBe('left')
    try {
      await userEvent.hover(gripOf(cell()))
      const from = centerOf(separatorOf(cell()))
      await pointer.realDragHold(from, { x: right - 8, y: from.y })
      await expect.poll(() => lineOf(cell()) !== null).toBe(true)
      await wait(300)
      expect(scroller.scrollLeft).toBe(0)
    } finally {
      await releaseAll()
    }
  })
})

describe('Подсветка границы колонки (ADR 0197)', () => {
  test('RL14: у последней колонки и колонки перед правыми закреплёнными черта грипа — у правого края колонки, зона грипа целиком внутри', async () => {
    /** Черта у правого края: её правый край на границе ячейки, зона — внутри. */
    const expectStrokeAtEdge = (cell: HTMLElement) => {
      const edge = cell.getBoundingClientRect().right
      const stroke = separatorOf(cell).getBoundingClientRect()
      const zone = gripOf(cell).getBoundingClientRect()
      expect(Math.abs(stroke.right - edge)).toBeLessThanOrEqual(0.5)
      expect(zone.right).toBeLessThanOrEqual(edge + 0.5)
      expect(zone.width).toBeCloseTo(24, 0)
    }
    const last = await renderGrid({ columnCount: 4 })
    const scroller = last.container.querySelector<HTMLElement>(SCROLLER)!
    scroller.scrollLeft = scroller.scrollWidth
    await expect
      .poll(() =>
        last.container.querySelector(
          `${HEAD_CELL}[data-last-header-in-row='true'] ${RESIZE_GRIP}`,
        ),
      )
      .not.toBeNull()
    const lastHead = last.container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-last-header-in-row='true']`,
    )!
    await userEvent.hover(lastHead)
    expectStrokeAtEdge(lastHead)
    await last.screen.unmount()

    const pinned = await renderGrid({ columnCount: 4, enableRowActions: true })
    const before = pinned.container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-before-right-pinned='true']`,
    )!
    await userEvent.hover(before)
    expectStrokeAtEdge(before)
  })

  test('RL13: черта грипа шириной токена --tsr-comp-resize-handler-stroke-width, по умолчанию 2px — как линия границы', async () => {
    const { container } = await renderGrid()
    const cell = resizableHeads(container)[0]!
    await userEvent.hover(cell)
    const width = () => separatorOf(cell).getBoundingClientRect().width
    expect(tokenLength(cell, STROKE_WIDTH)).toBe(2)
    expect(width()).toBeCloseTo(tokenLength(cell, STROKE_WIDTH), 1)
    expect(width()).toBeCloseTo(tokenLength(cell, LINE_WIDTH), 1)
  })

  test('RL1: наведение на заголовок и на зону грипа не меняет цвет черты и не показывает линию', async () => {
    const { container } = await renderGrid()
    const id = resizableHeads(container)[0]!.dataset.columnId!
    const cell = () => headById(container, id)

    await userEvent.hover(cell())
    await expect.poll(() => strokeColor(cell())).toBe(tokenColor(cell(), IDLE))
    expect(lineOf(cell())).toBeNull()

    await userEvent.hover(gripOf(cell()))
    // Черта вытянулась от наведения — грип под указателем, цвет прежний.
    await expect
      .poll(() => separatorOf(cell()).getBoundingClientRect().height)
      .toBe(20)
    expect(strokeColor(cell())).toBe(tokenColor(cell(), IDLE))
    expect(lineOf(cell())).toBeNull()
  })

  test('RL2: нажатие, протяжка, открытое меню ширины и фокус клавиатуры показывают синюю линию толщиной токена от верха заголовка до низа видимой части; черта своего цвета не меняет', async () => {
    const { container } = await renderGrid({ enableFooter: true })
    const id = resizableHeads(container)[0]!.dataset.columnId!
    const cell = () => headById(container, id)
    try {
      // Нажатие без сдвига.
      await userEvent.hover(gripOf(cell()))
      await pointer.realMouseDown(centerOf(separatorOf(cell())))
      await expectLineAlongColumn(container, id)
      // Отпускание без сдвига открывает меню ширины: линия остаётся.
      await pointer.realMouseUp()
      await expect
        .poll(() => document.querySelector('[role="menu"]'))
        .not.toBeNull()
      await userEvent.hover(container.querySelector(BODY_CELL)!)
      await expectLineAlongColumn(container, id)
      await userEvent.keyboard('{Escape}')
      await expect
        .poll(() => document.querySelector('[role="menu"]'))
        .toBeNull()
      separatorOf(cell()).blur()
      await expect.poll(() => lineOf(cell())).toBeNull()

      // Протяжка: указатель ушёл с грипа в тело.
      const from = centerOf(separatorOf(cell()))
      await pointer.realDragHold(from, { x: from.x + 30, y: from.y + 120 })
      await expectLineAlongColumn(container, id)
      await pointer.realMouseUp()
      await expect.poll(() => lineOf(cell())).toBeNull()

      // Фокус клавиатуры на разделителе; линия видна поверх тела и футера.
      await focusByKeyboard(cell())
      await expectLineAlongColumn(container, id)
      await expectLinePainted(container, id)
    } finally {
      await releaseAll()
    }
  })

  test('RL3: линия следует за границей при протяжке мышью, стрелками и из меню ширины', async () => {
    const { container } = await renderGrid()
    const id = resizableHeads(container)[0]!.dataset.columnId!
    const cell = () => headById(container, id)
    const width = () => cell().getBoundingClientRect().width
    try {
      // Мышью: два шага протяжки, линия у границы после каждого.
      await userEvent.hover(gripOf(cell()))
      const from = centerOf(separatorOf(cell()))
      const mid = { x: from.x + 40, y: from.y }
      await pointer.realDragHold(from, mid)
      await expectLineAlongColumn(container, id)
      const before = width()
      await pointer.realMouseMove(mid, { x: mid.x + 50, y: mid.y })
      await expect.poll(width).toBeGreaterThan(before + 40)
      await expectLineAlongColumn(container, id)
      await pointer.realMouseUp()

      // Стрелкой с клавиатуры.
      await focusByKeyboard(cell())
      const beforeKey = width()
      await userEvent.keyboard('{ArrowRight}')
      await expect.poll(width).toBeGreaterThan(beforeKey + 5)
      await expectLineAlongColumn(container, id)

      // Пунктом меню ширины, выбранным с клавиатуры.
      await userEvent.click(separatorOf(cell()))
      await expect
        .poll(() => document.querySelector('[role="menu"]'))
        .not.toBeNull()
      const widen = columnSizingLabels(ENGLISH_LABELS).widenColumn
      const item = [
        ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ].find(el => el.textContent?.includes(widen))!
      item.focus()
      const beforeMenu = width()
      await userEvent.keyboard('{Enter}')
      await expect.poll(width).toBeGreaterThan(beforeMenu + 40)
      await expectLineAlongColumn(container, id)
    } finally {
      await releaseAll()
    }
  })

  test('RL4: отпускание, закрытие меню и уход фокуса с разделителя убирают линию', async () => {
    const { container } = await renderGrid()
    const id = resizableHeads(container)[0]!.dataset.columnId!
    const cell = () => headById(container, id)
    try {
      // Отпускание после протяжки.
      await userEvent.hover(gripOf(cell()))
      const from = centerOf(separatorOf(cell()))
      await pointer.realDragHold(from, { x: from.x + 40, y: from.y })
      await expect.poll(() => lineOf(cell()) !== null).toBe(true)
      await pointer.realMouseUp()
      await expect.poll(() => lineOf(cell())).toBeNull()

      // Закрытие меню нажатием мимо него.
      await userEvent.click(separatorOf(cell()))
      await expect.poll(() => lineOf(cell()) !== null).toBe(true)
      await userEvent.click(container.querySelectorAll(BODY_CELL)[5]!)
      await expect
        .poll(() => document.querySelector('[role="menu"]'))
        .toBeNull()
      await expect.poll(() => lineOf(cell())).toBeNull()

      // Уход фокуса с разделителя.
      await focusByKeyboard(cell())
      await expect.poll(() => lineOf(cell()) !== null).toBe(true)
      await userEvent.keyboard('{Tab}')
      await expect.poll(() => lineOf(cell())).toBeNull()
    } finally {
      await releaseAll()
    }
  })

  test('RL5: в короткой таблице линия кончается на последней строке; линия не меняет область прокрутки', async () => {
    const { container } = await renderGrid({ dataCount: 3 })
    const id = resizableHeads(container)[0]!.dataset.columnId!
    const cell = () => headById(container, id)
    const scroller = container.querySelector<HTMLElement>(SCROLLER)!
    const rows = [...container.querySelectorAll(BODY_ROW)]
    const lastRowBottom = Math.max(
      ...rows.map(row => row.getBoundingClientRect().bottom),
    )
    const area =
      scroller.getBoundingClientRect().top +
      scroller.clientTop +
      scroller.clientHeight
    expect(lastRowBottom).toBeLessThan(area - 40)
    const extent = () => [scroller.scrollHeight, scroller.scrollWidth]
    const before = extent()
    try {
      await focusByKeyboard(cell())
      await expect.poll(() => lineOf(cell()) !== null).toBe(true)
      expect(
        Math.abs(lineOf(cell())!.bottom - lastRowBottom),
      ).toBeLessThanOrEqual(1)
      expect(extent()).toEqual(before)
    } finally {
      await releaseAll()
    }
  })

  test('RL6: грип колонки, которую нельзя растягивать, не синеет и не показывает линию при наведении, нажатии и фокусе', async () => {
    await render(
      <div className="data-grid-theme">
        <div
          className="data-grid__head-cell"
          style={{ position: 'relative', width: 200, height: 50 }}
        >
          <ResizeHandler
            disabled
            isResizing={false}
            size={200}
            minSize={80}
            onResize={() => {}}
            onResizeEnd={() => {}}
            onResizeCancel={() => {}}
            onEscape={() => {}}
            onResetSize={() => {}}
            onResizeBy={() => {}}
          />
        </div>
      </div>,
    )
    const cell = document.querySelector<HTMLElement>(HEAD_CELL)!
    const wrapper = gripOf(cell)
    try {
      await userEvent.hover(wrapper)
      await pointer.realMouseDown(centerOf(separatorOf(cell)))
      await userEvent.keyboard('{Shift}')
      separatorOf(cell).focus()
      expect(strokeColor(cell)).toBe(tokenColor(cell, IDLE))
      expect(wrapper.hasAttribute('data-resize-line')).toBe(false)
      expect(lineOf(cell)).toBeNull()
    } finally {
      await releaseAll()
    }
  })

  test('RL7: закрепление, вложенная шапка и футер — линия над прокручиваемой частью, от верха своего заголовка, через футер в обоих положениях', async () => {
    // Закрепление слева и справа: ids берутся из первой отрисовки.
    const first = await renderGrid({ enableColumnPinning: true })
    const ids = resizableHeads(first.container).map(c => c.dataset.columnId!)
    await first.screen.unmount()
    const left = ids[0]!
    const right = ids[1]!
    const pinned = await renderGrid({
      enableColumnPinning: true,
      initialColumnPinning: { start: [left], end: [right] },
    })
    const scroller = pinned.container.querySelector<HTMLElement>(SCROLLER)!
    scroller.scrollLeft = 200
    try {
      for (const id of [left, right]) {
        await focusByKeyboard(headById(pinned.container, id))
        await expectLineAlongColumn(pinned.container, id)
        await expectLinePainted(pinned.container, id)
        separatorOf(headById(pinned.container, id)).blur()
      }
    } finally {
      await releaseAll()
      await pinned.screen.unmount()
    }

    // Вложенная шапка: грип есть у листьев; лист под группой — от верха листа, лист во
    // всю высоту шапки — от верха шапки.
    const nested = await renderGrid({
      ...PINNING_NESTED,
      enableColumnPinning: false,
    })
    try {
      const heads = resizableHeads(nested.container)
      const full = heads.find(
        c =>
          c.dataset.firstHeadersRow === 'true' &&
          c.dataset.lastHeadersRow === 'true',
      )!
      const leaf = heads.find(
        c =>
          c.dataset.firstHeadersRow !== 'true' &&
          c.dataset.lastHeadersRow === 'true',
      )!
      expect(leaf.getBoundingClientRect().top).toBeGreaterThan(
        full.getBoundingClientRect().top + 10,
      )
      for (const head of [full, leaf]) {
        const id = head.dataset.columnId!
        await focusByKeyboard(head)
        await expectLineAlongColumn(nested.container, id)
        separatorOf(head).blur()
      }
    } finally {
      await releaseAll()
      await nested.screen.unmount()
    }

    // Футер `pinned` и `inline`: линия проходит через него.
    for (const footerPosition of ['pinned', 'inline'] as const) {
      const { container, screen } = await renderGrid({
        enableFooter: true,
        footerPosition,
        dataCount: 4,
      })
      try {
        const head = resizableHeads(container)[0]!
        await focusByKeyboard(head)
        await expectLineAlongColumn(container, head.dataset.columnId!)
        const footer = container.querySelector(FOOTER)!.getBoundingClientRect()
        const line = lineOf(head)!
        // Низ футера под горизонтальной полосой прокрутки (WebKit) не виден: линия — до видимого низа.
        const scroller = container.querySelector<HTMLElement>(
          '.data-grid__container',
        )!
        const visible =
          scroller.getBoundingClientRect().top +
          scroller.clientTop +
          scroller.clientHeight
        expect(line.bottom).toBeGreaterThanOrEqual(
          Math.min(footer.bottom, visible) - 2,
        )
        expect(line.top).toBeLessThan(footer.top)
        await expectLinePainted(container, head.dataset.columnId!)
      } finally {
        await releaseAll()
        await screen.unmount()
      }
    }
  })

  test('RL9: синий токен линии по умолчанию — --tsr-sys-info, линия не ниже 3:1 к фону шапки и тела в обеих темах и в повышенном контрасте; в forced-colors — Highlight', async () => {
    const { container } = await renderGrid()
    const id = resizableHeads(container)[0]!.dataset.columnId!
    const cell = () => headById(container, id)
    try {
      await focusByKeyboard(cell())
      await expect.poll(() => lineOf(cell()) !== null).toBe(true)
      const check = async () => {
        expect(tokenColor(cell(), LINE_COLOR)).toBe(
          tokenColor(cell(), 'var(--tsr-sys-info)'),
        )
        const line = toRgba(lineOf(cell())!.color)
        const body = container.querySelector<HTMLElement>(
          `${BODY_CELL}[aria-colindex='${cell().getAttribute('aria-colindex')}']`,
        )!
        expect(contrast(line, effectiveBg(cell()))).toBeGreaterThanOrEqual(3)
        expect(contrast(line, effectiveBg(body))).toBeGreaterThanOrEqual(3)
      }
      await inBothThemes(check)
      await pointer.moreContrast(true)
      await inBothThemes(check)
      await pointer.moreContrast(false)

      await pointer.forcedColors(true)
      await expect
        .poll(() => lineOf(cell())?.color)
        .toBe(resolveColor(gripOf(cell()), 'Highlight'))
    } finally {
      await releaseAll()
    }
  })
})

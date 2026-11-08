import axe from 'axe-core'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import type { DebugAction } from '../../../core/debugActions'
import { humanClick } from '../helpers'
import { composed } from '../stories'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  resolveColor,
  toRgba,
} from './a11y-helpers'

// Маркер угла выделения ячеек (ADR 0198, этап 1): квадрат в правом нижнем углу активного
// диапазона, протяжка за него меняет диапазон. Указатель — настоящий (Playwright).

type Point = { x: number; y: number }
const pointer = commands as unknown as {
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
  moreContrast: (active: boolean) => Promise<void>
}

const HANDLE = '[data-range-handle]'
const SELECTED = '[data-cell-selected]'

const initialViewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1100, 800))
afterAll(() => page.viewport(initialViewport.width, initialViewport.height))
afterEach(async () => {
  await pointer.realMouseUp()
  await pointer.forcedColors(false)
  await pointer.moreContrast(false)
  document.documentElement.classList.remove('dark')
})

type Args = Parameters<typeof composed.CellSelectionPlayground>[0]

const renderGrid = async (args: Args = {}) => {
  const screen = await render(<composed.CellSelectionPlayground {...args} />)
  await expect
    .poll(
      () => screen.container.querySelectorAll('.data-grid__body-row').length,
    )
    .toBeGreaterThan(5)
  return screen
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const centerOf = (el: Element): Point => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
/** Ячейка данных строки `row` по месту `column` среди выбираемых колонок. */
const cell = (row: number, column: number) =>
  document
    .querySelector(`.data-grid__body-row[data-index="${row}"]`)!
    .querySelectorAll<HTMLElement>(
      '.data-grid__body-cell[data-column-id]:not([data-actions-column-cell="true"])',
    )[column]!
const handle = () => document.querySelector<HTMLElement>(HANDLE)
const shown = () => {
  const el = handle()
  return el !== null && !el.hidden
}
const mark = () => handle()!.firstElementChild as HTMLElement
const selected = () => document.querySelectorAll(SELECTED).length
const focusedId = () =>
  document
    .querySelector<HTMLElement>('[data-cell-focused]')
    ?.closest('.data-grid__body-row')
    ?.getAttribute('data-index') +
  ':' +
  document.querySelector<HTMLElement>('[data-cell-focused]')?.dataset.columnId

/** Выделить прямоугольник от ячейки до ячейки протяжкой мыши. */
const selectRange = async (from: HTMLElement, to: HTMLElement) => {
  await pointer.realDragHold(centerOf(from), centerOf(to), 6)
  await pointer.realMouseUp()
  await expect.poll(shown).toBe(true)
}

/** Центр маркера стоит в правом нижнем углу ячейки. */
const expectHandleAt = async (target: HTMLElement) => {
  await expect
    .poll(() => {
      const h = centerOf(handle()!)
      const r = target.getBoundingClientRect()
      return Math.max(Math.abs(h.x - r.right), Math.abs(h.y - r.bottom))
    })
    .toBeLessThanOrEqual(1)
}

describe('Маркер угла выделения (ADR 0198)', () => {
  test('HN1: у активного диапазона — квадрат в правом нижнем углу цветом кромки выделения с обводкой цветом фона, и у одной ячейки; у других диапазонов маркера нет', async () => {
    await renderGrid()
    expect(handle()).toBeNull()

    // Одна ячейка.
    await userEvent.click(cell(1, 1))
    await expect.poll(shown).toBe(true)
    await expectHandleAt(cell(1, 1))

    // Диапазон.
    await selectRange(cell(1, 1), cell(3, 2))
    await expectHandleAt(cell(3, 2))
    const style = getComputedStyle(mark())
    expect(style.backgroundColor).toBe(
      resolveColor(handle()!, 'var(--tsr-comp-cell-selected-border-color)'),
    )
    expect(style.boxShadow).toContain(
      resolveColor(handle()!, 'var(--tsr-sys-bg)'),
    )
    expect(mark().getBoundingClientRect().width).toBeCloseTo(8, 0)

    // Второй диапазон Ctrl+клик: маркер один — у последнего.
    await userEvent.click(cell(5, 3), { modifiers: ['Control'] })
    await expect.poll(() => document.querySelectorAll(HANDLE).length).toBe(1)
    await expectHandleAt(cell(5, 3))
  })

  test('HN2: протяжка квадрата меняет диапазон — левый верхний угол на месте, второй следует за указателем, через неподвижный угол с переворотом; опорная ячейка — неподвижный угол', async () => {
    await renderGrid()
    await selectRange(cell(2, 2), cell(3, 3))
    const fixed = focusedId()
    expect(fixed).toBe(`2:${cell(2, 2).dataset.columnId}`)

    // Вниз и вправо: диапазон 2..5 × 2..4.
    await pointer.realDragHold(centerOf(handle()!), centerOf(cell(5, 4)), 8)
    await expect.poll(selected).toBe(4 * 3)
    await expect.poll(focusedId).toBe(fixed)

    // Через неподвижный угол: влево вверх до 0..2 × 0..2.
    await pointer.realMouseMove(centerOf(cell(5, 4)), centerOf(cell(0, 0)), 10)
    await expect.poll(selected).toBe(3 * 3)
    expect(
      document
        .querySelector(`.data-grid__body-row[data-index="0"]`)
        ?.querySelector(SELECTED),
    ).not.toBeNull()
    await pointer.realMouseUp()
    await expect.poll(focusedId).toBe(fixed)
    // Маркер — снова в правом нижнем углу нового диапазона.
    await expectHandleAt(cell(2, 2))
  })

  test('HN3: Escape во время протяжки маркера возвращает диапазон, бывший до нажатия', async () => {
    await renderGrid()
    await selectRange(cell(1, 1), cell(2, 2))
    const before = [...document.querySelectorAll<HTMLElement>(SELECTED)].map(
      el => el.dataset.columnId,
    )
    await pointer.realDragHold(centerOf(handle()!), centerOf(cell(6, 4)), 8)
    await expect.poll(selected).toBeGreaterThan(before.length)
    await userEvent.keyboard('{Escape}')
    await expect.poll(selected).toBe(before.length)
    await pointer.realMouseUp()
    await wait(100)
    expect(selected()).toBe(before.length)
    await expectHandleAt(cell(2, 2))
  })

  test('HN4: протяжка маркера к нижнему краю прокручивает таблицу и растит диапазон', async () => {
    await renderGrid({ dataCount: 200 })
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    await selectRange(cell(2, 1), cell(3, 2))
    const area = scroller.getBoundingClientRect()
    const bottom = area.top + scroller.clientTop + scroller.clientHeight
    const start = centerOf(handle()!)
    await pointer.realDragHold(start, { x: start.x, y: bottom - 4 }, 8)
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(200)
    await expect.poll(selected).toBeGreaterThan(20)
    await pointer.realMouseUp()
  })

  test('HN8: зона нажатия маркера не меньше 24×24; нажатие в ней не начинает новое выделение и не доходит до ячейки под зоной', async () => {
    await renderGrid()
    await selectRange(cell(1, 1), cell(2, 2))
    const zone = handle()!.getBoundingClientRect()
    expect(zone.width).toBeGreaterThanOrEqual(24)
    expect(zone.height).toBeGreaterThanOrEqual(24)
    // Край зоны — над соседней ячейкой справа и снизу.
    const under = cell(3, 3)
    let reached = false
    const onPress = () => {
      reached = true
    }
    under.addEventListener('mousedown', onPress)
    const corner = { x: zone.right - 3, y: zone.bottom - 3 }
    expect(document.elementFromPoint(corner.x, corner.y)?.closest(HANDLE)).toBe(
      handle(),
    )
    await pointer.realDragHold(corner, corner, 1)
    await pointer.realMouseUp()
    await wait(100)
    under.removeEventListener('mousedown', onPress)
    expect(reached).toBe(false)
    expect(selected()).toBe(4)
    await expectHandleAt(cell(2, 2))
  })

  test('HN9: маркер не фокусируется и скрыт от дерева доступности; axe с color-contrast в ролях table, grid и treegrid', async () => {
    for (const args of [
      {},
      { enableKeyboardNavigation: true },
      { enableRowExpanding: true, dataNesting: 'nested' as const },
    ]) {
      const screen = await renderGrid(args)
      await selectRange(cell(1, 1), cell(2, 2))
      expect(handle()!.getAttribute('aria-hidden')).toBe('true')
      expect(handle()!.tabIndex).toBe(-1)
      expect(handle()!.hasAttribute('tabindex')).toBe(false)
      await inBothThemes(async () => {
        const result = await axe.run(
          document.querySelector<HTMLElement>('.data-grid-theme')!,
          AXE_OPTIONS,
        )
        expect(result.violations.map(v => v.id)).toEqual([])
      })
      await screen.unmount()
    }
  })

  test('HN10: маркер не обрезан ячейкой; угол вне окна виртуализации — маркера нет, вернулся — есть; угол в закреплённой колонке — маркер над прокручиваемой частью', async () => {
    const screen = await renderGrid({ dataCount: 300 })
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    await selectRange(cell(1, 1), cell(2, 2))
    // Не обрезан: в точке метки — сам маркер.
    const at = centerOf(mark())
    expect(document.elementFromPoint(at.x, at.y)?.closest(HANDLE)).toBe(
      handle(),
    )
    // Угол уходит из окна виртуализации и возвращается.
    scroller.scrollTop = 4000
    await expect.poll(shown).toBe(false)
    scroller.scrollTop = 0
    await expect.poll(shown).toBe(true)
    await expectHandleAt(cell(2, 2))
    await screen.unmount()

    // Угол в закреплённой слева колонке.
    const first = await renderGrid({ enableColumnPinning: true })
    const id = cell(0, 0).dataset.columnId!
    await first.unmount()
    await renderGrid({
      enableColumnPinning: true,
      initialColumnPinning: { start: [id], end: [] },
      columnCount: 14,
    })
    const pinnedScroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    await userEvent.click(cell(2, 0))
    await expect.poll(shown).toBe(true)
    pinnedScroller.scrollLeft = 400
    await expect.poll(() => pinnedScroller.scrollLeft).toBeGreaterThan(300)
    await expectHandleAt(cell(2, 0))
    const point = centerOf(mark())
    expect(document.elementFromPoint(point.x, point.y)?.closest(HANDLE)).toBe(
      handle(),
    )
  })

  test('HN11: пока ячейка в правке, маркера нет; протяжка не выделяет служебные колонки и ячейки, запрещённые canSelectCell', async () => {
    const screen = await renderGrid({
      enableRowActions: true,
      enableCellEditing: true,
      columnCount: 4,
    })

    // Правка: в угловой ячейке редактор — маркера нет; правка закрыта — маркер снова есть.
    const age = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-index="1"] .data-grid__body-cell[data-column-id="age"]',
      )!
    await userEvent.click(age())
    await expect.poll(shown).toBe(true)
    await userEvent.hover(age())
    await humanClick(age().querySelector<HTMLElement>('.cell__button button')!)
    await expect.poll(() => age().querySelector('input')).not.toBeNull()
    await expect.poll(shown).toBe(false)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => age().querySelector('input')).toBeNull()
    await expect.poll(shown).toBe(true)

    // Служебная колонка: протяжка на колонку действий строки — угол на последней колонке данных.
    const row = (index: number) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id]`,
        ),
      ].sort(
        (x, y) =>
          x.getBoundingClientRect().left - y.getBoundingClientRect().left,
      )
    const actions = row(3).find(
      each => each.getAttribute('data-actions-column-cell') === 'true',
    )!
    expect(actions).toBeTruthy()
    const data = row(3).filter(each => each !== actions)
    await selectRange(data.at(-2)!, data.at(-2)!)
    await pointer.realDragHold(centerOf(handle()!), centerOf(actions), 8)
    await wait(150)
    await pointer.realMouseUp()
    expect(actions.hasAttribute('data-cell-selected')).toBe(false)
    await expectHandleAt(data.at(-1)!)

    // canSelectCell: запрещённая колонка внутри растянутого диапазона не выделена.
    const forbidden = cell(1, 1).dataset.columnId!
    await screen.rerender(
      <composed.CellSelectionPlayground
        enableRowActions
        enableCellEditing
        columnCount={4}
        cellSelectionCanSelectCell={each => each.column.id !== forbidden}
      />,
    )
    await selectRange(cell(1, 0), cell(1, 0))
    await pointer.realDragHold(centerOf(handle()!), centerOf(cell(3, 2)), 8)
    await wait(150)
    await pointer.realMouseUp()
    await expectHandleAt(cell(3, 2))
    expect(cell(2, 1).hasAttribute('data-cell-selected')).toBe(false)
    expect(cell(2, 0).hasAttribute('data-cell-selected')).toBe(true)
    expect(cell(2, 2).hasAttribute('data-cell-selected')).toBe(true)
  })

  test('HN12: маркер по умолчанию; handle: false — без маркера; mouse: false — без маркера мыши; смена на лету; enabled: false — без маркера', async () => {
    const screen = await renderGrid()
    await userEvent.click(cell(1, 1))
    await expect.poll(shown).toBe(true)
    await screen.rerender(
      <composed.CellSelectionPlayground cellSelectionHandle={false} />,
    )
    await expect.poll(() => handle()).toBeNull()
    await screen.rerender(
      <composed.CellSelectionPlayground
        cellSelectionHandle={{ mouse: false }}
      />,
    )
    await expect.poll(() => handle()).toBeNull()
    await screen.rerender(
      <composed.CellSelectionPlayground
        cellSelectionHandle={{ touch: false }}
      />,
    )
    await expect.poll(shown).toBe(true)
    await screen.unmount()

    await renderGrid({ enableCellSelection: false })
    await userEvent.click(cell(1, 1))
    await wait(150)
    expect(handle()).toBeNull()
  })

  test('HN13: маркер не ниже 3:1 к заливке выделения и к фону в обеих темах и в повышенном контрасте; в forced-colors — Highlight', async () => {
    await renderGrid()
    await selectRange(cell(1, 1), cell(2, 2))
    const check = async () => {
      const color = toRgba(getComputedStyle(mark()).backgroundColor)
      expect(contrast(color, effectiveBg(cell(2, 2)))).toBeGreaterThanOrEqual(3)
      expect(contrast(color, effectiveBg(cell(3, 3)))).toBeGreaterThanOrEqual(3)
    }
    await inBothThemes(check)
    await pointer.moreContrast(true)
    await inBothThemes(check)
    await pointer.moreContrast(false)
    await pointer.forcedColors(true)
    await expect
      .poll(() => getComputedStyle(mark()).backgroundColor)
      .toBe(resolveColor(handle()!, 'Highlight'))
  })

  test('HN14: протяжка маркера — жест cellSelection.resizeRange в канале действий: начало, конец, отмена с причиной', async () => {
    const actions: DebugAction[] = []
    await renderGrid({ onDebugAction: action => actions.push(action) })
    await selectRange(cell(1, 1), cell(2, 2))
    const resize = () =>
      actions.filter(
        a => a.plugin === 'cellSelection' && a.action === 'resizeRange',
      )
    await pointer.realDragHold(centerOf(handle()!), centerOf(cell(4, 3)), 6)
    await expect.poll(() => resize().map(a => a.phase)).toEqual(['start'])
    await pointer.realMouseUp()
    await expect
      .poll(() => resize().map(a => a.phase))
      .toEqual(['start', 'end'])
    expect(resize().every(a => a.source === 'pointer')).toBe(true)
    await pointer.realDragHold(centerOf(handle()!), centerOf(cell(5, 3)), 6)
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => resize().at(-1)?.detail)
      .toEqual({ reason: 'cancel' })
  })
})

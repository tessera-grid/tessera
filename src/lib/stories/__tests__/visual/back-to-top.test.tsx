import { type ReactElement, useEffect } from 'react'

import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { beforeEach, describe, expect, test } from 'vitest'

import {
  IDLE_DELAY,
  MIN_DURATION,
} from '../../../core/fastScroll/fastScrollDetector'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  backToTop,
  infiniteScroll,
  keyboardNavigation,
  pagination,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { composed } from '../stories'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { tableLabels } from '../labels'

// Кнопка «наверх» (ADR 0082; BT1–BT2, BT4–BT11, BT15). Модульные BT3, BT12–BT13 —
// в `backToTop`, перф BT14 — в `scroll`.

interface Item {
  id: string
  a: string
  b: string
  c: string
}

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    a: `A${i}`,
    b: `B${i}`,
    c: `C${i}`,
  }))

const ITEMS = makeItems(1000)
let manyItems: Item[] | undefined
const MANY = () => (manyItems ??= makeItems(100_000))

const COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', size: 160 },
  { id: 'b', accessorKey: 'b', header: 'B', size: 160 },
  { id: 'c', accessorKey: 'c', header: 'C', size: 160 },
]
const WIDE_COLUMNS = [
  ...COLUMNS,
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `w${i}`,
    accessorFn: () => i,
    header: `W${i}`,
    size: 160,
  })),
]

let loadCalls = 0

interface ScrollTable {
  scrollToRow: (
    id: string,
    options?: { behavior?: 'instant' | 'smooth'; align?: 'start' },
  ) => Promise<boolean>
}

const browser = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}

interface GridProps {
  data?: Item[]
  /** Пагинация с этим размером страницы. */
  pageSize?: number
  /** Лента со счётчиком загруженных строк. */
  infinite?: boolean
  enableStatusBar?: boolean
  keyboard?: boolean
  threshold?: number
  horizontalThreshold?: number
  axes?: 'vertical' | 'horizontal' | 'both'
  onTable?: (table: ScrollTable) => void
  wide?: boolean
  width?: number
  localization?: Record<string, string>
  icons?: Record<string, () => ReactElement>
}

const Grid = ({
  data = ITEMS,
  pageSize,
  infinite = false,
  enableStatusBar,
  keyboard = false,
  threshold,
  horizontalThreshold,
  axes,
  onTable,
  wide = false,
  width = 640,
  localization,
  icons,
}: GridProps) => {
  const table = useCreateTable({
    rowCount: data.length * 10,
    columns: (wide ? WIDE_COLUMNS : COLUMNS) as never,
    data,
    getRowId: (row: Item) => row.id,
    enableStatusBar,
    plugins: [
      backToTop({ threshold, horizontalThreshold, axes }),
      pagination({
        enabled: pageSize !== undefined,
        initialPageSize: pageSize,
      }),
      infiniteScroll({
        enabled: infinite,
        hasMore: true,
        loadedCount: true,
        onLoadMore: () => {
          loadCalls++
          return new Promise<void>(() => {})
        },
      }),
      keyboardNavigation({ enabled: keyboard }),
    ] as never,
  })
  useEffect(() => {
    onTable?.(table as unknown as ScrollTable)
  })
  return (
    <div style={{ width, height: 400, background: 'var(--card)' }}>
      <DataGrid
        table={table as never}
        localization={localization as never}
        icons={icons as never}
      />
    </div>
  )
}

const frame = () => new Promise(requestAnimationFrame)
const frames = async (count = 3) => {
  for (let i = 0; i < count; i++) await frame()
}

const mount = async (props: GridProps = {}) => {
  const screen = await render(<Grid {...props} />)
  await expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)
  await frames()
  return screen
}

const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const statusBar = () =>
  document.querySelector<HTMLElement>('[data-testid="data-grid-status-bar"]')
const button = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="back-to-top"]')
const startButton = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="back-to-start"]')
const startShown = () =>
  startButton() !== null &&
  !startButton()!.parentElement!.hidden &&
  getComputedStyle(startButton()!).visibility === 'visible'
/** Экран тела: высота области прокрутки без липкой шапки. */
const bodyScreen = () =>
  scroller().clientHeight -
  rect(document.querySelector('.data-grid__head')!).height
/** Выход из быстрой прокрутки, открытой прыжком самого теста. */
const idle = () =>
  new Promise(resolve => setTimeout(resolve, IDLE_DELAY + MIN_DURATION + 100))
/**
 * Положение по кадрам после действия — пока не встанет у края — и сумма скелетов строк
 * за всё время.
 */
const recordUntilEdge = async (
  read: () => number,
  action: () => Promise<unknown>,
) => {
  const positions: number[] = []
  let skeletons = 0
  await action()
  for (let i = 0; i < 150; i++) {
    await frame()
    positions.push(read())
    skeletons += skeletonCount()
    if (positions.length > 3 && positions.slice(-3).every(value => value === 0))
      break
  }
  return { positions, skeletons }
}
const descending = (values: number[]) =>
  values.every((value, i) => i === 0 || value <= values[i - 1]!)
const pager = () =>
  document.querySelector<HTMLElement>(
    `nav[aria-label="${tableLabels.pagination}"]`,
  )
const shown = () =>
  button() !== null && getComputedStyle(button()!).visibility === 'visible'
const rect = (el: Element) => el.getBoundingClientRect()
const skeletonCount = () =>
  document.querySelectorAll('.data-grid__body-row [class*="skeleton"]').length

const scrollTo = async (top: number, left?: number) => {
  scroller().scrollTo({ top, left, behavior: 'instant' })
  await frames()
}
const scrollPast = () => scrollTo(scroller().clientHeight * 2 + 200)

/** Позиции прокрутки по событиям `scroll` за время действия. */
const recordScroll = async (action: () => Promise<unknown>) => {
  const tops: number[] = []
  const onScroll = () => tops.push(scroller().scrollTop)
  scroller().addEventListener('scroll', onScroll)
  await action()
  await frames(5)
  scroller().removeEventListener('scroll', onScroll)
  return tops
}

beforeEach(async () => {
  loadCalls = 0
  await cleanup()
})

describe('Кнопка «наверх»', () => {
  test('BT1: кнопки нет до двух высот тела, после — есть, у верха снова нет; threshold задаёт порог в px', async () => {
    await mount({ pageSize: 100 })
    const twoScreens = scroller().clientHeight * 2
    expect(shown()).toBe(false)
    await scrollTo(twoScreens - 20)
    expect(shown()).toBe(false)
    // +1px: Firefox округляет прокрутку до долей пикселя.
    await scrollTo(twoScreens + 1)
    expect(shown()).toBe(true)
    await scrollTo(0)
    expect(shown()).toBe(false)
    await cleanup()

    await mount({ pageSize: 100, threshold: 120 })
    await scrollTo(100)
    expect(shown()).toBe(false)
    await scrollTo(120)
    expect(shown()).toBe(true)
  })

  test('BT2: кнопка не вызывает панель; с пагинацией, счётчиком ленты или enableStatusBar: true стоит справа перед пагинацией', async () => {
    await mount()
    await scrollPast()
    expect(statusBar()).toBeNull()
    expect(button()).toBeNull()
    await cleanup()

    await mount({ pageSize: 100 })
    const end = statusBar()!.querySelector('[data-align="end"]')!
    expect(end.contains(button())).toBe(true)
    expect(
      button()!.compareDocumentPosition(pager()!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await cleanup()

    await mount({ infinite: true })
    expect(
      statusBar()!.querySelector('[data-align="end"]')!.contains(button()),
    ).toBe(true)
    await cleanup()

    await mount({ enableStatusBar: true })
    expect(statusBar()!.contains(button())).toBe(true)
  })

  test.each([
    ['полная ширина', 640],
    ['узкая ширина', 300],
  ])(
    'BT4: появление и уход кнопки не меняют раскладку панели и высоту тела — %s',
    async (_label, width) => {
      await mount({ pageSize: 100, width })
      const snapshot = () => ({
        layout: statusBar()!.getAttribute('data-status-bar-layout'),
        bar: [rect(statusBar()!).top, rect(statusBar()!).height],
        pager: [rect(pager()!).left, rect(pager()!).top],
        button: [rect(button()!).left, rect(button()!).top],
        body: scroller().clientHeight,
      })
      const before = snapshot()
      await scrollPast()
      expect(shown()).toBe(true)
      expect(snapshot()).toEqual(before)
      await scrollTo(0)
      expect(shown()).toBe(false)
      expect(snapshot()).toEqual(before)
    },
  )

  test('BT16: дальше экрана — прыжок на экран от верха, затем плавно последний экран; ближе — только плавно; строки без скелетов; мышью, Enter и Space', async () => {
    await mount({ data: MANY(), enableStatusBar: true })
    const screen = bodyScreen()
    for (const press of [
      () => humanClick(button()!),
      () => userEvent.keyboard('{Enter}'),
      () => userEvent.keyboard(' '),
    ]) {
      await scrollTo(scroller().scrollHeight / 2)
      await idle()
      expect(shown()).toBe(true)
      button()!.focus()
      const { positions, skeletons } = await recordUntilEdge(
        () => scroller().scrollTop,
        press,
      )
      // Прыжок — на экран от верха, дальше — плавно до нуля.
      expect(positions[0]).toBeGreaterThan(0)
      expect(positions[0]).toBeLessThanOrEqual(screen + 1)
      expect(new Set(positions).size).toBeGreaterThan(3)
      expect(descending(positions)).toBe(true)
      expect(positions.at(-1)).toBe(0)
      expect(skeletons).toBe(0)
    }

    // Ближе экрана — без прыжка: первый кадр рядом со стартом.
    await cleanup()
    await mount({ data: MANY(), enableStatusBar: true, threshold: 20 })
    const start = Math.round(bodyScreen() / 2)
    await scrollTo(start)
    await idle()
    const near = await recordUntilEdge(
      () => scroller().scrollTop,
      () => humanClick(button()!),
    )
    expect(near.positions[0]).toBeGreaterThan(start / 2)
    expect(new Set(near.positions).size).toBeGreaterThan(3)
    expect(near.positions.at(-1)).toBe(0)
  })

  test('BT6: после прыжка верхние строки показывают содержимое, а не скелеты', async () => {
    await mount({ data: MANY(), enableStatusBar: true })
    await scrollTo(scroller().scrollHeight / 2)
    // Прыжок теста в середину открыл сессию быстрой прокрутки, а ячейки середины
    // смонтированы до входа и скелетов не показывают: ждём выхода по простою.
    await new Promise(resolve =>
      setTimeout(resolve, IDLE_DELAY + MIN_DURATION + 100),
    )
    expect(skeletonCount()).toBe(0)
    let skeletons = 0
    let watching = true
    const watch = () => {
      skeletons += skeletonCount()
      if (watching) requestAnimationFrame(watch)
    }
    await humanClick(button()!)
    requestAnimationFrame(watch)
    await expect.poll(() => scroller().scrollTop).toBe(0)
    await frames(5)
    watching = false
    expect(skeletons).toBe(0)
    expect(
      document.querySelector('.data-grid__body-row[data-row-id="r0"]')
        ?.textContent,
    ).toContain('A0')
  })

  test('BT7: прыжок не меняет горизонтальную прокрутку; лента не выгружает и не перезапрашивает загруженное', async () => {
    await mount({ pageSize: 100, wide: true, width: 480 })
    await scrollTo(scroller().clientHeight * 3, 300)
    const left = scroller().scrollLeft
    expect(left).toBeGreaterThan(290)
    await humanClick(button()!)
    await frames()
    await expect.poll(() => scroller().scrollTop).toBe(0)
    expect(scroller().scrollLeft).toBe(left)
    await cleanup()

    await mount({ infinite: true })
    const counter = () =>
      document.querySelector('[data-testid="loaded-rows-count"]')?.textContent
    const loaded = counter()
    await scrollTo(scroller().clientHeight * 4)
    expect(loadCalls).toBe(0)
    await humanClick(button()!)
    await frames(5)
    await expect.poll(() => scroller().scrollTop).toBe(0)
    expect(loadCalls).toBe(0)
    expect(counter()).toBe(loaded)
    await scrollTo(scroller().clientHeight * 4)
    expect(
      document
        .querySelector('.data-grid__body-row')
        ?.getAttribute('data-row-id'),
    ).not.toBe('r0')
  })

  test('BT8: после нажатия фокус остаётся на кнопке — видима и aria-disabled, прячется по уходу фокуса', async () => {
    await mount({ pageSize: 100 })
    await scrollPast()
    await humanClick(button()!)
    await frames()
    await expect.poll(() => scroller().scrollTop).toBe(0)
    expect(document.activeElement).toBe(button())
    expect(button()!.getAttribute('aria-disabled')).toBe('true')
    expect(shown()).toBe(true)

    await userEvent.tab()
    await frames()
    expect(document.activeElement).not.toBe(button())
    expect(shown()).toBe(false)
  })

  test.each([true, false])(
    'BT9: keyboardNavigation %s — активная ячейка в первой строке той же колонки, фокус на кнопке; без плагина меняется только прокрутка',
    async keyboard => {
      await mount({ pageSize: 100, keyboard })
      await scrollTo(40 * 50)
      const row = [
        ...document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
      ].find(el => rect(el).top > rect(scroller()).top + 60)!
      const rowId = row.getAttribute('data-row-id')!
      await humanClick(row.querySelector('[data-column-id="b"]')!)
      // Клик, как в Safari: нажатие на кнопку не даёт ей фокус.
      const noFocus = (event: MouseEvent) => event.preventDefault()
      button()!.addEventListener('mousedown', noFocus)
      await humanClick(button()!)
      button()!.removeEventListener('mousedown', noFocus)
      await frames()
      await expect.poll(() => scroller().scrollTop).toBe(0)
      expect(document.activeElement).toBe(button())

      if (!keyboard) {
        expect(
          document.querySelector('.data-grid__body-cell[tabindex="0"]'),
        ).toBeNull()
        return
      }
      const active = document.querySelector<HTMLElement>(
        '.data-grid__body-cell[tabindex="0"]',
      )!
      expect(
        active.closest('.data-grid__body-row')!.getAttribute('data-row-id'),
      ).toBe('r0')
      expect(active.getAttribute('data-column-id')).toBe('b')
      expect(rowId).not.toBe('r0')

      // Tab в грид — с поля перед ним: обратный путь с кнопки в WebKit под Playwright
      // непредсказуем (уходит по кругу), а вход в грид один для обоих направлений (KN32).
      const before = document.createElement('input')
      document.body.prepend(before)
      before.focus()
      await userEvent.tab()
      before.remove()
      await frames()
      expect(document.activeElement).toBe(active)
      await expect.poll(() => scroller().scrollTop).toBe(0)
    },
  )

  test('BT10: подпись и тултип — из localization, иконка — из icons', async () => {
    const Icon = () => <svg data-testid="custom-back-to-top" />
    await mount({
      pageSize: 100,
      localization: { backToTop: 'Вверх' },
      icons: { backToTop: Icon },
    })
    expect(button()!.getAttribute('aria-label')).toBe('Вверх')
    expect(
      button()!.querySelector('[data-testid="custom-back-to-top"]'),
    ).not.toBeNull()
    await scrollPast()
    await userEvent.hover(button()!)
    await expect
      .poll(() =>
        [...document.querySelectorAll('[data-side]')].some(
          el => el.textContent?.trim() === 'Вверх',
        ),
      )
      .toBe(true)
  })

  test('BT11: axe с color-contrast видимой и aria-disabled кнопки в обеих темах, контраст иконки к фону не меньше 3:1; зона нажатия не меньше 24×24', async () => {
    await mount({ pageSize: 100 })
    const run = (state: string) =>
      inBothThemes(async () => {
        const { violations } = await axe.run(statusBar()!, {
          ...AXE_OPTIONS,
          rules: {
            ...AXE_OPTIONS.rules,
            'color-contrast': { enabled: true },
          },
        })
        expect(violations, state).toEqual([])
      })

    await scrollPast()
    expect(shown()).toBe(true)
    await run('видима')
    // У кнопки-иконки нет текста — axe её контраст не меряет (WCAG 1.4.11).
    await inBothThemes(async () => {
      const icon = button()!.querySelector('svg')!
      expect(
        contrast(toRgba(getComputedStyle(icon).color), backgroundOf(button())),
      ).toBeGreaterThanOrEqual(3)
    })
    const box = rect(button()!)
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)

    await humanClick(button()!)
    await frames()
    expect(button()!.getAttribute('aria-disabled')).toBe('true')
    await run('aria-disabled')
  })

  test('BT17: с prefers-reduced-motion кнопки и scrollToRow прыгают к цели за один кадр', async () => {
    await browser.reducedMotion(true)
    try {
      let table: ScrollTable | undefined
      await mount({
        data: MANY(),
        enableStatusBar: true,
        wide: true,
        width: 480,
        onTable: t => (table = t),
      })
      await scrollTo(scroller().scrollHeight / 2, 1200)
      await idle()
      const top = await recordUntilEdge(
        () => scroller().scrollTop,
        () => humanClick(button()!),
      )
      expect(top.positions.every(value => value === 0)).toBe(true)

      await scrollTo(0, 1200)
      await expect.poll(startShown).toBe(true)
      const left = await recordUntilEdge(
        () => scroller().scrollLeft,
        () => humanClick(startButton()!),
      )
      expect(left.positions.every(value => value === 0)).toBe(true)

      const positions: number[] = []
      const target = table!.scrollToRow('r50000', {
        behavior: 'smooth',
        align: 'start',
      })
      for (let i = 0; i < 10; i++) {
        await frame()
        positions.push(scroller().scrollTop)
      }
      expect(await target).toBe(true)
      expect(new Set(positions).size).toBe(1)
      expect(positions[0]).toBeGreaterThan(0)
    } finally {
      await browser.reducedMotion(false)
    }
  })

  test('BT18: «к первой колонке» видна после двух ширин тела, у левого края пропадает; место — только при горизонтальной прокрутке, появление не сдвигает панель', async () => {
    await mount({ pageSize: 100 })
    expect(scroller().scrollWidth).toBeLessThanOrEqual(scroller().clientWidth)
    expect(startButton()!.parentElement!.hidden).toBe(true)
    expect(rect(startButton()!).width).toBe(0)

    await cleanup()
    await mount({ pageSize: 100, wide: true, width: 480 })
    await expect.poll(() => startButton()!.parentElement!.hidden).toBe(false)
    expect(startShown()).toBe(false)
    const place = rect(button()!).left
    const twoScreens = scroller().clientWidth * 2
    await scrollTo(0, twoScreens - 20)
    expect(startShown()).toBe(false)
    await scrollTo(0, twoScreens + 20)
    expect(startShown()).toBe(true)
    expect(rect(button()!).left).toBe(place)
    await scrollTo(0, 0)
    expect(startShown()).toBe(false)
  })

  test('BT19: «к первой колонке» — прыжок на экран и плавно последний экран; вертикаль не меняется, ячейки по пути без скелетов', async () => {
    await mount({ data: MANY(), enableStatusBar: true, wide: true, width: 480 })
    await scrollTo(5000, 1400)
    await idle()
    const top = scroller().scrollTop
    const width = scroller().clientWidth
    const { positions, skeletons } = await recordUntilEdge(
      () => scroller().scrollLeft,
      () => humanClick(startButton()!),
    )
    expect(positions[0]).toBeGreaterThan(0)
    expect(positions[0]).toBeLessThanOrEqual(width + 1)
    expect(new Set(positions).size).toBeGreaterThan(3)
    expect(descending(positions)).toBe(true)
    expect(positions.at(-1)).toBe(0)
    expect(skeletons).toBe(0)
    expect(scroller().scrollTop).toBe(top)
  })

  test.each([true, false])(
    'BT20: keyboardNavigation %s — после нажатия «к первой колонке» фокус на кнопке; с плагином активная ячейка в первой колонке той же строки',
    async keyboard => {
      await mount({ pageSize: 100, wide: true, width: 480, keyboard })
      await scrollTo(0, scroller().scrollWidth)
      const cell = [
        ...document.querySelectorAll<HTMLElement>(
          '.data-grid__body-row[data-row-id="r2"] .data-grid__body-cell',
        ),
      ].at(-1)!
      const columnId = cell.getAttribute('data-column-id')
      await humanClick(cell)
      const noFocus = (event: MouseEvent) => event.preventDefault()
      startButton()!.addEventListener('mousedown', noFocus)
      await humanClick(startButton()!)
      startButton()!.removeEventListener('mousedown', noFocus)
      await expect.poll(() => scroller().scrollLeft).toBe(0)
      expect(document.activeElement).toBe(startButton())
      if (!keyboard) {
        expect(
          document.querySelector('.data-grid__body-cell[tabindex="0"]'),
        ).toBeNull()
        return
      }
      const active = document.querySelector<HTMLElement>(
        '.data-grid__body-cell[tabindex="0"]',
      )!
      expect(
        active.closest('.data-grid__body-row')!.getAttribute('data-row-id'),
      ).toBe('r2')
      expect(active.getAttribute('data-column-id')).toBe('a')
      expect(columnId).not.toBe('a')
    },
  )

  test('BT21: axes включает одну или обе кнопки; подпись и тултип «к первой колонке» — из localization, иконка — из icons', async () => {
    await mount({ pageSize: 100, wide: true, width: 480, axes: 'vertical' })
    expect(button()).not.toBeNull()
    expect(startButton()).toBeNull()
    await cleanup()
    await mount({ pageSize: 100, wide: true, width: 480, axes: 'horizontal' })
    expect(button()).toBeNull()
    expect(startButton()).not.toBeNull()
    await cleanup()

    const Icon = () => <svg data-testid="custom-back-to-start" />
    await mount({
      pageSize: 100,
      wide: true,
      width: 480,
      localization: { backToStart: 'К началу строки' },
      icons: { backToStart: Icon },
    })
    expect(startButton()!.getAttribute('aria-label')).toBe('К началу строки')
    expect(
      startButton()!.querySelector('[data-testid="custom-back-to-start"]'),
    ).not.toBeNull()
    await scrollTo(0, scroller().scrollWidth)
    await userEvent.hover(startButton()!)
    await expect
      .poll(() =>
        [...document.querySelectorAll('[data-side]')].some(
          el => el.textContent?.trim() === 'К началу строки',
        ),
      )
      .toBe(true)
  })

  test('BT22: axe с color-contrast видимой кнопки «к первой колонке» в обеих темах, контраст иконки к фону не меньше 3:1', async () => {
    await mount({ pageSize: 100, wide: true, width: 480 })
    await scrollTo(0, scroller().scrollWidth)
    expect(startShown()).toBe(true)
    await inBothThemes(async () => {
      const { violations } = await axe.run(statusBar()!, {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })
      expect(violations).toEqual([])
      const icon = startButton()!.querySelector('svg')!
      expect(
        contrast(
          toRgba(getComputedStyle(icon).color),
          backgroundOf(startButton()),
        ),
      ).toBeGreaterThanOrEqual(3)
    })
  })
})

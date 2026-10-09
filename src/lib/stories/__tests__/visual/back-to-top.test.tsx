import type { ReactElement } from 'react'

import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
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

interface GridProps {
  data?: Item[]
  /** Пагинация с этим размером страницы. */
  pageSize?: number
  /** Лента со счётчиком загруженных строк. */
  infinite?: boolean
  enableStatusBar?: boolean
  keyboard?: boolean
  threshold?: number
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
  wide = false,
  width = 640,
  localization,
  icons,
}: GridProps) => {
  const table = useCreateTable({
    columns: (wide ? WIDE_COLUMNS : COLUMNS) as never,
    data,
    getRowId: (row: Item) => row.id,
    enableStatusBar,
    plugins: [
      backToTop({ threshold }),
      pagination({
        enabled: pageSize !== undefined,
        initialPageSize: pageSize,
      }),
      infiniteScroll({
        enabled: infinite,
        hasMore: true,
        rowCount: data.length * 10,
        loadedCount: true,
        onLoadMore: () => {
          loadCalls++
          return new Promise<void>(() => {})
        },
      }),
      keyboardNavigation({ enabled: keyboard }),
    ] as never,
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
const pager = () =>
  document.querySelector<HTMLElement>('nav[aria-label="Pagination"]')
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

  test('BT5: нажатие мышью, Enter и Space прокручивает 100 000 строк к первой строке за один кадр', async () => {
    await mount({ data: MANY(), enableStatusBar: true })
    const middle = scroller().scrollHeight / 2
    for (const press of [
      () => humanClick(button()!),
      () => userEvent.keyboard('{Enter}'),
      () => userEvent.keyboard(' '),
    ]) {
      await scrollTo(middle)
      expect(shown()).toBe(true)
      button()!.focus()
      const tops = await recordScroll(press)
      expect(tops.length).toBeGreaterThan(0)
      expect(tops).toEqual(tops.map(() => 0))
      expect(scroller().scrollTop).toBe(0)
    }
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
    await frames(20)
    watching = false
    expect(scroller().scrollTop).toBe(0)
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
    expect(scroller().scrollTop).toBe(0)
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
    expect(scroller().scrollTop).toBe(0)
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
    expect(scroller().scrollTop).toBe(0)
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
      await humanClick(button()!)
      await frames()
      expect(scroller().scrollTop).toBe(0)
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

      await userEvent.tab({ shift: true })
      await frames()
      expect(document.activeElement).toBe(active)
      expect(scroller().scrollTop).toBe(0)
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

  test('BT15: истории «Pagination» и «Infinite scroll» — кнопка после прокрутки возвращает в начало', async () => {
    await render(<composed.BackToTopPagination />)
    await expect.poll(() => button()).not.toBeNull()
    await scrollPast()
    expect(shown()).toBe(true)
    await humanClick(button()!)
    await expect.poll(() => scroller().scrollTop).toBe(0)
    await cleanup()

    await render(<composed.BackToTopInfiniteScroll serverDelayMs={0} />)
    await expect
      .poll(
        () =>
          document.querySelector('[data-testid="loaded-rows-count"]')
            ?.textContent,
      )
      .toBe('Loaded 100 of 1,000')
    await scrollPast()
    expect(shown()).toBe(true)
    await humanClick(button()!)
    await expect.poll(() => scroller().scrollTop).toBe(0)
  })
})

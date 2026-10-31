import { useMemo } from 'react'
import axe from 'axe-core'
import { commands, page, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellSelection,
  columnPinning,
  pagination,
  rowExpanding,
  rowSelection,
} from '../../../plugins'
import type { HighlightTarget } from '../../../core/highlights/highlightFeature'
import type { FlashOutcome } from '../../../../index'
import { humanClick } from '../helpers'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'

// Вспышка итога на цели (ADR 0134; OF4, OF6–OF12): заливка проверяется по пикселям
// скриншота и вычисленным слоям — вид, а не устройство стилей. Модульные OF1–OF3, OF5,
// OF13 — в `flashes.dom`, перф OF20 — в `performance/scroll`.

declare module 'vitest/browser' {
  interface BrowserCommands {
    reducedMotion: (reduce: boolean) => Promise<void>
    forcedColors: (active: boolean) => Promise<void>
  }
}

interface Item {
  id: string
  a: string
  b: string
  c: string
  subRows?: Item[]
}

const item = (i: number): Item => ({
  id: `r${i}`,
  a: `A${i}`,
  b: `B${i}`,
  c: `C${i}`,
})

/** Ячейка с плотным блоком вместо текста: пиксели содержимого видны на скриншоте. */
const block = () => (
  <span
    data-ink
    style={{
      display: 'inline-block',
      width: 12,
      height: 12,
      background: 'var(--tsr-sys-fg)',
    }}
  />
)

const COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', footer: 'Fa', size: 120 },
  {
    id: 'b',
    accessorKey: 'b',
    header: 'B',
    footer: 'Fb',
    size: 160,
    cell: block,
  },
  { id: 'c', accessorKey: 'c', header: 'C', footer: 'Fc', size: 120 },
]

const WIDE = [
  ...COLUMNS,
  ...Array.from({ length: 40 }, (_, i) => ({
    id: `x${i}`,
    accessorFn: () => i,
    header: `X${i}`,
    size: 120,
  })),
]

type Api = {
  flashOutcome: (
    target: HighlightTarget | readonly HighlightTarget[],
    outcome: FlashOutcome,
  ) => void
  highlight: (
    target: HighlightTarget,
    options?: { tone?: string },
  ) => { clear: () => void }
  setPageIndex: (index: number) => void
  getRow: (id: string) => { toggleExpanded: (value?: boolean) => void }
}

let table: Api

interface GridProps {
  count?: number
  columns?: unknown[]
  data?: Item[]
  pinned?: boolean
  selected?: string[]
  cells?: boolean
  keyboard?: boolean
  tree?: boolean
  paged?: boolean
}

const Grid = ({
  count = 6,
  columns = COLUMNS,
  data,
  pinned = false,
  selected,
  cells = false,
  keyboard = false,
  tree = false,
  paged = false,
}: GridProps) => {
  const rows = useMemo(
    () => data ?? Array.from({ length: count }, (_, i) => item(i)),
    [count, data],
  )
  table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    columns: columns as never,
    data: rows,
    getRowId: (row: Item) => row.id,
    enableFooter: columns === COLUMNS,
    state: {
      ...(pinned && { columnPinning: { start: ['a'], end: ['c'] } }),
    },
    plugins: [
      columnPinning(),
      ...(selected
        ? [
            rowSelection({
              rowSelection: Object.fromEntries(selected.map(id => [id, true])),
            }),
          ]
        : []),
      ...(cells ? [cellSelection()] : []),
      ...(tree ? [rowExpanding()] : []),
      ...(paged ? [pagination({ initialPageSize: 5 })] : []),
    ] as never,
  }) as unknown as Api
  return (
    // Подложка грида — карточка темы, как в историях: слой выбора строки прозрачен.
    <div style={{ width: 640, height: 360, background: 'var(--card)' }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const mount = async (props: GridProps = {}) => {
  const screen = await render(<Grid {...props} />)
  await expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)
  return screen
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellEl = (rowId: string, columnId: string) =>
  rowEl(rowId).querySelector<HTMLElement>(`[data-column-id="${columnId}"]`)!
const headEl = (columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"]`,
  )!
const footEl = (columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__footer-cell[data-column-id="${columnId}"]`,
  )!

/** Выбор ячейки или диапазона — подготовка состояния, не предмет проверки. */
const selectCell = (cell: HTMLElement, shiftKey = false) => {
  const init = { bubbles: true, cancelable: true, button: 0, shiftKey }
  cell.dispatchEvent(new MouseEvent('mousedown', init))
  document.dispatchEvent(new MouseEvent('mouseup', init))
}

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Переходы слоёв вспышки и подсветки. */
const layerTransitions = (prefix = '--tsr-') =>
  document
    .getAnimations()
    .filter(
      animation =>
        animation instanceof CSSTransition &&
        /^--tsr-(flash|highlight)/.test(animation.transitionProperty) &&
        animation.transitionProperty.startsWith(prefix),
    ) as CSSTransition[]

/** Действие и ожидание покоя: переходы слоёв доиграли. */
const act = async (run: () => void) => {
  run()
  await frame()
  await frame()
  for (let left = layerTransitions(); left.length; left = layerTransitions()) {
    await Promise.all(left.map(animation => animation.finished.catch(() => {})))
    await frame()
  }
}

/** Свои токены темы на время теста. */
const styles: HTMLStyleElement[] = []
const tokens = (css: string) => {
  const style = document.createElement('style')
  style.textContent = `.data-grid-theme { ${css} }`
  document.head.append(style)
  styles.push(style)
}
/** Вспышка держится весь тест: снимки снимают удержание, а не угасание. */
const holdLong = () =>
  tokens(
    '--tsr-comp-flash-duration: 60s; --tsr-comp-error-flash-duration: 60s;',
  )

/** Скриншот как пиксели в CSS-координатах окна. */
const snapshot = async () => {
  const shot = (await page.screenshot({
    base64: true,
    save: false,
  })) as unknown as string | { base64: string }
  const base64 = typeof shot === 'string' ? shot : shot.base64
  const image = new Image()
  image.src = `data:image/png;base64,${base64}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const scale = image.width / document.documentElement.clientWidth
  return (x: number, y: number) =>
    Array.from(
      context
        .getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1)
        .data.slice(0, 3),
    )
}
type Shot = Awaited<ReturnType<typeof snapshot>>

/** Точка фона ячейки — правый нижний угол, вдали от текста и границ. */
const bgPoint = (el: HTMLElement): [number, number] => {
  const rect = el.getBoundingClientRect()
  return [rect.right - 8, rect.bottom - 8]
}
const colorAt = (shot: Shot, el: HTMLElement) => shot(...bgPoint(el))
const distance = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + Math.abs(value - b[i]!), 0)

/** Оттенок цвета в градусах. */
const hue = ([r, g, b]: number[]) => {
  const [rr, gg, bb] = [r! / 255, g! / 255, b! / 255]
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  if (max === min) return NaN
  const d = max - min
  const h =
    max === rr
      ? ((gg - bb) / d) % 6
      : max === gg
        ? (bb - rr) / d + 2
        : (rr - gg) / d + 4
  return (h * 60 + 360) % 360
}
const hueGap = (a: number, b: number) => {
  const gap = Math.abs(a - b) % 360
  return gap > 180 ? 360 - gap : gap
}

/** Значение CSS-цвета, вычисленное в контексте темы грида. */
const resolve = (value: string) => {
  const probe = document.createElement('span')
  probe.style.backgroundColor = value
  document.querySelector('.data-grid-theme')!.appendChild(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}

/** Цвет `rgba` поверх непрозрачного фона. */
const over = (fg: number[], bg: number[]) =>
  [0, 1, 2].map(i => fg[i]! * fg[3]! + bg[i]! * (1 - fg[3]!))

const OUTCOMES: FlashOutcome[] = ['arrived', 'accepted', 'reverted']
const fillOf = (outcome: FlashOutcome) =>
  toRgba(resolve(`var(--tsr-comp-flash-${outcome}-bg)`))
const surface = () => toRgba(resolve('var(--tsr-sys-surface)'))
/** Оттенок итога поверх поверхности — по токену темы. */
const outcomeHue = (outcome: FlashOutcome) =>
  hue(over(fillOf(outcome), surface()))

const rowAlpha = (el: HTMLElement) =>
  toRgba(getComputedStyle(el).getPropertyValue('--tsr-flash-row'))[3]!

// Грид целиком в окне: закреплённая справа колонка и футер видны на скриншоте.
const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1000, 800))
afterAll(() => page.viewport(viewport.width, viewport.height))

afterEach(async () => {
  styles.splice(0).forEach(style => style.remove())
  document.documentElement.classList.remove('dark')
  await commands.reducedMotion(false)
  await userEvent.unhover(document.body)
})

describe('Вспышка итога: время', () => {
  test('OF4: все итоги появляются сразу, держатся --tsr-comp-flash-duration и гаснут за --tsr-comp-flash-fade-duration; токены отказа кнопки вспышку не меняют', async () => {
    tokens(`
      --tsr-comp-flash-duration: 400ms;
      --tsr-comp-flash-fade-duration: 700ms;
      --tsr-comp-error-flash-fill-duration: 300ms;
      --tsr-comp-error-flash-duration: 900ms;
      --tsr-comp-error-flash-fade-duration: 600ms;
    `)
    await mount()
    const transitionOf = (el: HTMLElement) =>
      layerTransitions('--tsr-flash-row').find(
        animation => (animation.effect as KeyframeEffect).target === el,
      )

    for (const [id, outcome] of [
      ['r1', 'arrived'],
      ['r2', 'accepted'],
      ['r3', 'reverted'],
    ] as const) {
      const row = rowEl(id)
      const full = fillOf(outcome)[3]!
      const start = performance.now()
      table.flashOutcome({ row: id }, outcome)
      await frame()
      await frame()
      // Появление — сразу, без перехода.
      expect(rowAlpha(row), outcome).toBe(full)
      expect(transitionOf(row), outcome).toBeUndefined()
      await expect
        .poll(() => row.hasAttribute('data-flash-out'), { interval: 10 })
        .toBe(true)
      const held = performance.now() - start
      expect(held, outcome).toBeGreaterThanOrEqual(390)
      expect(held, outcome).toBeLessThan(400 + 150)
      await frame()
      expect(transitionOf(row)?.effect?.getTiming().duration, outcome).toBe(700)
      await expect
        .poll(() => row.hasAttribute('data-flash'), { timeout: 2000 })
        .toBe(false)
      expect(rowAlpha(row)).toBe(0)
    }
  })

  test('OF10: при уменьшенном движении вспышка держится ту же длительность и снимается без перехода', async () => {
    await commands.reducedMotion(true)
    await mount()
    for (const [id, outcome, hold] of [
      ['r1', 'accepted', 300],
      ['r2', 'reverted', 300],
    ] as const) {
      const row = rowEl(id)
      const full = fillOf(outcome)[3]!
      const start = performance.now()
      table.flashOutcome({ row: id }, outcome)
      await frame()
      await frame()
      expect(rowAlpha(row), outcome).toBe(full)
      await expect
        .poll(() => row.hasAttribute('data-flash-out'), {
          interval: 10,
          timeout: 3000,
        })
        .toBe(true)
      const held = performance.now() - start
      expect(held, outcome).toBeGreaterThanOrEqual(hold - 10)
      expect(held, outcome).toBeLessThan(hold + 150)
      await frame()
      expect(rowAlpha(row), outcome).toBe(0)
    }
  })
})

describe('Вспышка итога: цели и вид', () => {
  test('OF7: строка — целиком с закреплёнными и служебными ячейками, ячейка, колонка — заголовок, тело и футер; тон из --tsr-comp-flash-<итог>-bg, атрибуты data-flash и data-column-flash; тон переопределяется темой', async () => {
    holdLong()
    await mount({ pinned: true, selected: [] })
    const before = await snapshot()
    await act(() => {
      table.flashOutcome({ row: 'r1' }, 'reverted')
      table.flashOutcome({ cell: ['r3', 'a'] }, 'accepted')
      table.flashOutcome({ column: 'b' }, 'arrived')
    })
    const lit = await snapshot()
    const tinted = (el: HTMLElement, outcome: FlashOutcome, label: string) => {
      expect(
        distance(colorAt(lit, el), colorAt(before, el)),
        label,
      ).toBeGreaterThan(6)
      expect(
        hueGap(hue(colorAt(lit, el)), outcomeHue(outcome)),
        label,
      ).toBeLessThan(25)
    }
    for (const el of [
      cellEl('r1', 'a'),
      cellEl('r1', 'c'),
      rowEl('r1').querySelector<HTMLElement>(
        '[data-actions-column-cell="true"]',
      )!,
    ]) {
      tinted(el, 'reverted', `строка: ${el.dataset.columnId}`)
    }
    tinted(cellEl('r3', 'a'), 'accepted', 'ячейка')
    for (const el of [headEl('b'), cellEl('r0', 'b'), footEl('b')]) {
      tinted(el, 'arrived', `колонка: ${el.className}`)
    }
    // Соседи не тронуты.
    for (const el of [cellEl('r3', 'c'), cellEl('r4', 'a')]) {
      expect(colorAt(lit, el)).toEqual(colorAt(before, el))
    }
    expect(rowEl('r1').getAttribute('data-flash')).toBe('reverted')
    expect(cellEl('r3', 'a').getAttribute('data-flash')).toBe('accepted')
    for (const el of [headEl('b'), cellEl('r0', 'b'), footEl('b')]) {
      expect(el.getAttribute('data-column-flash')).toBe('arrived')
    }

    tokens('--tsr-comp-flash-accepted-bg: rgb(140 0 255 / 30%);')
    await act(() => table.flashOutcome({ row: 'r4' }, 'accepted'))
    expect(getComputedStyle(rowEl('r4')).backgroundImage).toContain(
      'rgba(140, 0, 255, 0.3)',
    )
  })

  test('OF8: текст, кромки диапазона и кольцо фокуса не тонированы; вспышка над подсветкой приложения; выбор строки и тинт диапазона различимы сквозь неё', async () => {
    holdLong()
    const screen = await mount({ cells: true, selected: ['r4'] })
    // Содержимое и кромки диапазона b2:b3.
    selectCell(cellEl('r2', 'b'))
    selectCell(cellEl('r3', 'b'), true)
    await expect
      .poll(() => cellEl('r3', 'b').getAttribute('data-cell-selected'))
      .toBe('true')
    const ink = cellEl('r1', 'b').querySelector<HTMLElement>('[data-ink]')!
    const center = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect()
      return [rect.left + rect.width / 2, rect.top + rect.height / 2] as const
    }
    const edge = () => {
      const rect = cellEl('r3', 'b').getBoundingClientRect()
      return [rect.left + 1, rect.top + rect.height / 2] as const
    }
    const before = await snapshot()
    await act(() => {
      table.flashOutcome([{ row: 'r1' }, { row: 'r3' }], 'reverted')
      table.flashOutcome([{ row: 'r4' }, { row: 'r5' }], 'accepted')
    })
    const lit = await snapshot()
    expect(lit(...center(ink))).toEqual(before(...center(ink)))
    const bgShift = (el: HTMLElement) =>
      distance(colorAt(lit, el), colorAt(before, el))
    expect(distance(lit(...edge()), before(...edge()))).toBeLessThan(
      bgShift(cellEl('r3', 'b')) * 0.4,
    )
    // Тинт диапазона сквозь вспышку: синий канал выше, чем у той же строки вне диапазона.
    const inRange = colorAt(lit, cellEl('r3', 'b'))
    const outside = colorAt(lit, cellEl('r3', 'c'))
    expect(inRange[2]! - outside[2]!).toBeGreaterThan(3)
    // Выбор строки сквозь вспышку: выбранная r4 отличается от невыбранной r5 того же итога.
    expect(
      distance(
        colorAt(lit, cellEl('r4', 'c')),
        colorAt(lit, cellEl('r5', 'c')),
      ),
    ).toBeGreaterThan(4)
    await screen.unmount()

    // Над подсветкой приложения: цвет — вспышка поверх подсветки, а не наоборот.
    const stackedScreen = await mount()
    const plain = await snapshot()
    await act(() => {
      table.highlight({ row: 'r2' }, { tone: 'warning' })
      table.flashOutcome({ row: 'r2' }, 'reverted')
    })
    const stacked = await snapshot()
    const base = colorAt(plain, cellEl('r2', 'a'))
    const tone = toRgba(resolve('var(--tsr-comp-highlight-warning-bg)'))
    const flash = fillOf('reverted')
    const flashOnTop = over(flash, over(tone, base))
    const toneOnTop = over(tone, over(flash, base))
    const seen = colorAt(stacked, cellEl('r2', 'a'))
    expect(distance(seen, flashOnTop)).toBeLessThan(distance(seen, toneOnTop))

    // Фокус-кольцо клавиатурной навигации.
    await stackedScreen.unmount()
    await mount({ keyboard: true })
    await humanClick(cellEl('r1', 'a'))
    await userEvent.keyboard('{ArrowRight}')
    await expect
      .poll(() => document.activeElement === cellEl('r1', 'b'))
      .toBe(true)
    const ring = () => {
      const rect = cellEl('r1', 'b').getBoundingClientRect()
      return [rect.left + rect.width - 30, rect.top + 1] as const
    }
    await sleep(300)
    const focused = await snapshot()
    await act(() => table.flashOutcome({ cell: ['r1', 'b'] }, 'reverted'))
    const flashed = await snapshot()
    expect(distance(flashed(...ring()), focused(...ring()))).toBeLessThan(
      distance(
        colorAt(flashed, cellEl('r1', 'b')),
        colorAt(focused, cellEl('r1', 'b')),
      ) * 0.4,
    )
  })

  test('OF9: accepted и reverted отличимы по оттенку между собой, от arrived и тинта диапазона; текст в худшем сочетании держит 4.5:1; axe без нарушений в обеих темах', async () => {
    holdLong()
    await mount({ pinned: true, selected: ['r2'] })
    await userEvent.hover(cellEl('r2', 'a'))
    await inBothThemes(async () => {
      const solid = (token: string) =>
        over(toRgba(resolve(`var(${token})`)), surface())
      const tint = hue(solid('--tsr-comp-cell-selected-bg'))
      const hues = Object.fromEntries(
        OUTCOMES.map(outcome => [outcome, outcomeHue(outcome)]),
      ) as Record<FlashOutcome, number>
      for (const outcome of ['accepted', 'reverted'] as const) {
        expect(hueGap(hues[outcome], tint), outcome).toBeGreaterThan(40)
        expect(hueGap(hues[outcome], hues.arrived), outcome).toBeGreaterThan(40)
      }
      expect(hueGap(hues.accepted, hues.reverted)).toBeGreaterThan(40)

      for (const outcome of OUTCOMES) {
        await act(() => table.flashOutcome({ row: 'r2' }, outcome))
        const cell = cellEl('r2', 'a')
        const bg = [...over(fillOf(outcome), backgroundOf(cell)), 1]
        const text = toRgba(
          getComputedStyle(cell.querySelector('*') ?? cell).color,
        )
        expect(contrast(text, bg), outcome).toBeGreaterThanOrEqual(4.5)
        const { violations } = await axe.run(
          document.querySelector<HTMLElement>('[role="table"]')!,
          {
            ...AXE_OPTIONS,
            rules: {
              ...AXE_OPTIONS.rules,
              'color-contrast': { enabled: true },
            },
          },
        )
        expect(
          violations.map(v => v.id),
          outcome,
        ).toEqual([])
      }
    })
  })

  test('OF12: вспышка ничего не объявляет и не меняет aria-* цели', async () => {
    holdLong()
    await mount({ keyboard: true })
    const aria = (el: HTMLElement) =>
      el
        .getAttributeNames()
        .filter(name => name.startsWith('aria-') || name === 'role')
        .map(name => `${name}=${el.getAttribute(name)}`)
    const targets = () => [rowEl('r1'), cellEl('r2', 'b'), headEl('c')]
    const live = () =>
      [...document.querySelectorAll('[aria-live]')].map(el => el.textContent)
    const before = targets().map(aria)
    const said = live()
    await act(() => {
      table.flashOutcome({ row: 'r1' }, 'reverted')
      table.flashOutcome({ cell: ['r2', 'b'] }, 'accepted')
      table.flashOutcome({ column: 'c' }, 'arrived')
    })
    await sleep(200)
    expect(targets().map(aria)).toEqual(before)
    expect(live()).toEqual(said)
  })
})

describe('Вспышка итога: цель вне окна', () => {
  test('OF6: цель ушла из окна по строке и по колонке, со страницы и под свёрнутого родителя и вернулась до истечения — залита сразу, без перехода; после истечения — нет', async () => {
    tokens('--tsr-comp-flash-duration: 1500ms;')
    const returnsLit = async (
      attr: 'data-flash' | 'data-column-flash',
      el: () => HTMLElement | null,
    ) => {
      await expect.poll(() => el()?.getAttribute(attr)).toBe('accepted')
      expect(layerTransitions('--tsr-flash')).toEqual([])
    }
    const screen = await mount({ count: 1000, columns: WIDE })
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    table.flashOutcome([{ row: 'r1' }, { column: 'x39' }], 'accepted')
    scroller.scrollTop = 30000
    await expect
      .poll(() => document.querySelector('[data-row-id="r1"]'))
      .toBeNull()
    scroller.scrollTop = 0
    await returnsLit('data-flash', () => rowEl('r1'))
    expect(rowAlpha(rowEl('r1'))).toBe(fillOf('accepted')[3])

    const x39 = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-cell[data-column-id="x39"]',
      )
    expect(x39()).toBeNull()
    scroller.scrollLeft = scroller.scrollWidth
    await returnsLit('data-column-flash', x39)

    // После истечения — без вспышки.
    scroller.scrollLeft = 0
    await expect.poll(() => x39()).toBeNull()
    await sleep(1500 + 500 + 100)
    scroller.scrollLeft = scroller.scrollWidth
    await expect.poll(() => x39()).not.toBeNull()
    expect(x39()!.hasAttribute('data-column-flash')).toBe(false)
    await screen.unmount()

    const paged = await mount({ count: 20, paged: true })
    table.flashOutcome({ row: 'r7' }, 'accepted')
    await act(() => table.setPageIndex(1))
    await returnsLit('data-flash', () => rowEl('r7'))
    await paged.unmount()

    await mount({
      data: [{ ...item(0), subRows: [item(10)] }, item(1)],
      tree: true,
    })
    table.flashOutcome({ row: 'r10' }, 'accepted')
    await act(() => table.getRow('r0').toggleExpanded(true))
    await returnsLit('data-flash', () => rowEl('r10'))
  })
})

describe('Вспышка итога: высокая контрастность', () => {
  test('OF11: forced-colors — reverted заливает Mark с текстом MarkText; arrived и accepted не рисуются', async ({
    skip,
  }) => {
    skip(
      server.browser === 'webkit',
      'WebKit не подменяет цвета в forced-colors',
    )
    holdLong()
    await commands.forcedColors(true)
    try {
      await mount({ pinned: true })
      const sys = (name: string) => {
        const probe = document.createElement('span')
        probe.style.color = name
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      }
      const textOf = (el: HTMLElement) =>
        el.querySelector<HTMLElement>('.data-grid__cell-wrapper-content') ?? el
      const before = await snapshot()
      await act(() => {
        table.flashOutcome({ row: 'r1' }, 'reverted')
        table.flashOutcome({ cell: ['r3', 'b'] }, 'reverted')
        table.flashOutcome({ column: 'c' }, 'reverted')
        table.flashOutcome([{ row: 'r2' }, { row: 'r4' }], 'accepted')
        table.flashOutcome({ cell: ['r5', 'b'] }, 'arrived')
      })
      for (const [label, el] of [
        ['строка', cellEl('r1', 'b')],
        ['строка, закреплённая', cellEl('r1', 'a')],
        ['ячейка', cellEl('r3', 'b')],
        ['колонка', cellEl('r5', 'c')],
        ['колонка, шапка', headEl('c')],
        ['колонка, футер', footEl('c')],
      ] as const) {
        const target = label === 'строка' ? rowEl('r1') : el
        await expect
          .poll(() => getComputedStyle(target).backgroundColor)
          .toBe(sys('Mark'))
        expect(getComputedStyle(target).backgroundColor, label).toBe(
          sys('Mark'),
        )
        expect(getComputedStyle(textOf(el)).color, label).toBe(sys('MarkText'))
      }
      const after = await snapshot()
      for (const el of [
        cellEl('r2', 'b'),
        cellEl('r4', 'a'),
        cellEl('r5', 'b'),
      ]) {
        expect(colorAt(after, el)).toEqual(colorAt(before, el))
      }
    } finally {
      await commands.forcedColors(false)
    }
  })
})

describe('Вспышка и подсветка диапазона: вид (ADR 0152)', () => {
  test('TG10: вспышка и подсветка диапазона — контраст текста не ниже 4.5:1 в обеих темах, axe с color-contrast, в forced-colors — Mark, и на ячейках выделения', async ({
    skip,
  }) => {
    holdLong()
    await mount({ pinned: true, cells: true })
    // Выделение внутри обоих диапазонов: под вспышкой и подсветкой.
    selectCell(cellEl('r2', 'a'))
    selectCell(cellEl('r4', 'b'), true)
    await expect
      .poll(() => cellEl('r4', 'b').getAttribute('data-cell-selected'))
      .toBe('true')
    const flashRange = {
      range: { rows: ['r1', 'r2'], columns: ['a', 'c'] },
    } as unknown as HighlightTarget
    const highlightRange = {
      range: { rows: ['r4', 'r5'], columns: ['a', 'c'] },
    } as unknown as HighlightTarget
    const cells = (rows: string[]) =>
      rows.flatMap(rowId => ['a', 'b', 'c'].map(c => cellEl(rowId, c)))
    const textOf = (el: HTMLElement) =>
      el.querySelector<HTMLElement>('.data-grid__cell-wrapper-content') ?? el

    await inBothThemes(async () => {
      let handle!: { clear: () => void }
      await act(() => {
        table.flashOutcome(flashRange, 'reverted')
        handle = table.highlight(highlightRange, { tone: 'danger' })
      })
      const fills: [string[], number[]][] = [
        [['r1', 'r2'], fillOf('reverted')],
        [['r4', 'r5'], toRgba(resolve('var(--tsr-comp-highlight-danger-bg)'))],
      ]
      for (const [rows, fill] of fills) {
        for (const cell of cells(rows)) {
          const id = `${rows.join('–')}:${cell.dataset.columnId}`
          expect(
            cell.hasAttribute('data-flash') ||
              cell.hasAttribute('data-highlight'),
            id,
          ).toBe(true)
          const bg = [...over(fill, backgroundOf(cell)), 1]
          const text = toRgba(getComputedStyle(textOf(cell)).color)
          expect(contrast(text, bg), id).toBeGreaterThanOrEqual(4.5)
        }
      }
      const { violations } = await axe.run(
        document.querySelector<HTMLElement>('[role="table"]')!,
        {
          ...AXE_OPTIONS,
          rules: {
            ...AXE_OPTIONS.rules,
            'color-contrast': { enabled: true },
          },
        },
      )
      expect(violations.map(v => v.id)).toEqual([])
      await act(() => handle.clear())
    })

    skip(
      server.browser === 'webkit',
      'WebKit не подменяет цвета в forced-colors',
    )
    await commands.forcedColors(true)
    try {
      const sys = (name: string) => {
        const probe = document.createElement('span')
        probe.style.color = name
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      }
      // Выделенная ячейка вне диапазонов: вспышка в режиме — сразу, без перехода фона.
      await expect
        .poll(() => getComputedStyle(cellEl('r3', 'a')).backgroundColor)
        .toBe(sys('Highlight'))
      table.flashOutcome({ cell: ['r3', 'a'] }, 'reverted')
      await new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      )
      expect(getComputedStyle(cellEl('r3', 'a')).backgroundColor).toBe(
        sys('Mark'),
      )
      await act(() => {
        table.flashOutcome(flashRange, 'reverted')
        table.highlight(highlightRange, { tone: 'danger' })
      })
      for (const cell of cells(['r1', 'r2', 'r4', 'r5'])) {
        const id = `${cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}:${cell.dataset.columnId}`
        await expect
          .poll(() => getComputedStyle(cell).backgroundColor)
          .toBe(sys('Mark'))
        expect(getComputedStyle(cell).backgroundColor, id).toBe(sys('Mark'))
        expect(getComputedStyle(textOf(cell)).color, id).toBe(sys('MarkText'))
      }
    } finally {
      await commands.forcedColors(false)
    }
  })
})

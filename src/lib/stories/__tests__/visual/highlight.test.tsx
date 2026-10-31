import { useMemo } from 'react'
import axe from 'axe-core'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellSelection,
  columnPinning,
  columnSorting,
  pagination,
  quickSearch,
  rowExpanding,
  rowSelection,
} from '../../../plugins'
import type {
  HighlightOptions,
  HighlightTarget,
} from '../../../core/highlights/highlightFeature'
import { humanClick } from '../helpers'
import { composed } from '../stories'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'

// Публичная подсветка (ADR 0080; HL1–HL4, HL7, HL9–HL15, HL17, HL21; HL25–HL26 — ADR 0101): заливка проверяется
// по пикселям скриншота — вид, а не устройство стилей. Модульные HL5, HL6, HL16,
// HL18, HL20 — в `highlights.dom`, перф HL19 — в `performance/scroll`, HL22 — в
// `theming-invariants`.

declare module 'vitest/browser' {
  interface BrowserCommands {
    reducedMotion: (reduce: boolean) => Promise<void>
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

const NESTED = [
  {
    id: 'g',
    header: 'Group',
    columns: [
      { id: 'a', accessorKey: 'a', header: 'A', size: 120 },
      { id: 'b', accessorKey: 'b', header: 'B', size: 160 },
    ],
  },
  { id: 'c', accessorKey: 'c', header: 'C', size: 120 },
]

type Api = {
  highlight: (
    target: HighlightTarget,
    options?: HighlightOptions,
  ) => { clear: () => void }
  clearHighlights: (key?: string) => void
  setGlobalFilter: (value: unknown) => void
  setSorting: (value: unknown) => void
  setPageIndex: (index: number) => void
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
  width?: number
  height?: number
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
  width = 640,
  height = 360,
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
      columnSorting(),
      quickSearch(),
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
    <div style={{ width, height, background: 'var(--card)' }}>
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
/** Переходы слоёв подсветки (появление и затухание, ADR 0101). */
const highlightTransitions = () =>
  document
    .getAnimations()
    .filter(
      animation =>
        animation instanceof CSSTransition &&
        animation.transitionProperty.startsWith('--tsr-highlight'),
    )
/** Действие с подсветкой и ожидание покоя: переходы слоёв доиграли. */
const act = async (run: () => void) => {
  run()
  await frame()
  await frame()
  // Прерванный переход отклоняет `finished`, на его месте — новый: ждём, пока их нет.
  for (
    let left = highlightTransitions();
    left.length;
    left = highlightTransitions()
  ) {
    await Promise.all(left.map(animation => animation.finished.catch(() => {})))
    await frame()
  }
}

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

/** Полосы оттенков встроенных тонов — по ролям темы (red, amber, green). */
const TONE_HUE = { danger: 0, warning: 38, success: 142 } as const
type Tone = keyof typeof TONE_HUE
const TONES = Object.keys(TONE_HUE) as Tone[]

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

// Грид целиком в окне: закреплённая справа колонка и футер видны на скриншоте.
const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1000, 800))
afterAll(() => page.viewport(viewport.width, viewport.height))

afterEach(async () => {
  document.documentElement.classList.remove('dark')
  await commands.reducedMotion(false)
  await userEvent.unhover(document.body)
})

describe('Подсветка: цели', () => {
  test('HL1: highlight({ row }) заливает все ячейки строки тоном, включая закреплённые и служебные; clear() снимает', async () => {
    await mount({ pinned: true, selected: [] })
    const kinds = () => [
      cellEl('r1', 'a'),
      cellEl('r1', 'b'),
      cellEl('r1', 'c'),
      rowEl('r1').querySelector<HTMLElement>(
        '[data-actions-column-cell="true"]',
      )!,
    ]
    const before = await snapshot()
    let handle!: { clear: () => void }
    await act(() => {
      handle = table.highlight({ row: 'r1' }, { tone: 'danger' })
    })
    const lit = await snapshot()
    for (const el of kinds()) {
      const id = el.dataset.columnId
      expect(
        distance(colorAt(lit, el), colorAt(before, el)),
        id,
      ).toBeGreaterThan(8)
      expect(hueGap(hue(colorAt(lit, el)), TONE_HUE.danger), id).toBeLessThan(
        25,
      )
    }
    // Соседняя строка не тронута.
    expect(colorAt(lit, cellEl('r3', 'b'))).toEqual(
      colorAt(before, cellEl('r3', 'b')),
    )

    await act(() => handle.clear())
    await sleep(700)
    const cleared = await snapshot()
    for (const el of kinds()) {
      expect(distance(colorAt(cleared, el), colorAt(before, el))).toBeLessThan(
        3,
      )
    }
  })

  test('TG9: highlight и flashOutcome с диапазоном заливают все его ячейки в окне, закреплённые слева и справа — сплошной полосой; текст и кромки выделения не тонированы', async () => {
    await mount({ pinned: true, cells: true })
    const range = {
      range: { rows: ['r1', 'r3'], columns: ['a', 'c'] },
    } as unknown as HighlightTarget
    const inside = ['r1', 'r2', 'r3'].flatMap(rowId =>
      ['a', 'b', 'c'].map(columnId => cellEl(rowId, columnId)),
    )
    const outside = [cellEl('r0', 'b'), cellEl('r4', 'a'), cellEl('r4', 'c')]
    const ink = () =>
      cellEl('r2', 'b').querySelector<HTMLElement>('[data-ink]')!
    const inkPoint = (): [number, number] => {
      const rect = ink().getBoundingClientRect()
      return [rect.left + rect.width / 2, rect.top + rect.height / 2]
    }
    // Выделение внутри диапазона: его кромка рисуется поверх заливки.
    selectCell(cellEl('r2', 'b'))
    selectCell(cellEl('r3', 'b'), true)
    await expect
      .poll(() => cellEl('r3', 'b').getAttribute('data-cell-selected'))
      .toBe('true')
    const before = await snapshot()

    let handle!: { clear: () => void }
    await act(() => {
      handle = table.highlight(range, { tone: 'danger' })
    })
    const lit = await snapshot()
    for (const el of inside) {
      const id = `${el.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}:${el.dataset.columnId}`
      expect(el.getAttribute('data-highlight'), id).toBe('danger')
      expect(
        distance(colorAt(lit, el), colorAt(before, el)),
        id,
      ).toBeGreaterThan(8)
      // Выделенные ячейки — с тинтом выделения поверх: их тон не сверяется.
      if (el.dataset.cellSelected) continue
      expect(hueGap(hue(colorAt(lit, el)), TONE_HUE.danger), id).toBeLessThan(
        25,
      )
    }
    for (const el of outside) {
      expect(el.hasAttribute('data-highlight')).toBe(false)
      expect(colorAt(lit, el)).toEqual(colorAt(before, el))
    }
    expect(distance(lit(...inkPoint()), before(...inkPoint()))).toBeLessThan(3)
    const edgeCell = cellEl('r3', 'b')
    const edgeRect = edgeCell.getBoundingClientRect()
    const edgePoint: [number, number] = [
      edgeRect.left + 1,
      edgeRect.top + edgeRect.height / 2,
    ]
    expect(distance(lit(...edgePoint), before(...edgePoint))).toBeLessThan(
      distance(colorAt(lit, edgeCell), colorAt(before, edgeCell)) * 0.4,
    )

    await act(() => handle.clear())
    ;(
      table as unknown as Api & {
        flashOutcome: (target: HighlightTarget, outcome: string) => void
      }
    ).flashOutcome(range, 'reverted')
    await frame()
    for (const el of inside) {
      expect(el.getAttribute('data-flash')).toBe('reverted')
      expect(getComputedStyle(el).getPropertyValue('--tsr-flash-cell')).toBe(
        getComputedStyle(inside[0]!).getPropertyValue('--tsr-flash-cell'),
      )
    }
    expect(
      getComputedStyle(inside[0]!).getPropertyValue('--tsr-flash-cell').trim(),
    ).not.toBe('')
    for (const el of outside) expect(el.hasAttribute('data-flash')).toBe(false)
  })

  test('HL2: highlight({ cell }) заливает одну ячейку, соседние — нет', async () => {
    await mount()
    const before = await snapshot()
    await act(() => {
      table.highlight({ cell: ['r2', 'b'] }, { tone: 'success' })
    })
    const lit = await snapshot()
    const target = cellEl('r2', 'b')
    expect(
      distance(colorAt(lit, target), colorAt(before, target)),
    ).toBeGreaterThan(8)
    expect(hueGap(hue(colorAt(lit, target)), TONE_HUE.success)).toBeLessThan(25)
    for (const el of [
      cellEl('r2', 'a'),
      cellEl('r2', 'c'),
      cellEl('r1', 'b'),
      cellEl('r3', 'b'),
    ]) {
      expect(colorAt(lit, el)).toEqual(colorAt(before, el))
    }
  })

  test('HL3: highlight({ column }) заливает заголовок, тело и футер; под вложенной шапкой подсветка листа, в том числе растянутого, группу не заливает; цель-группа — только её заголовок', async () => {
    const screen = await mount()
    let before = await snapshot()
    await act(() => {
      table.highlight({ column: 'b' }, { tone: 'warning' })
    })
    let lit = await snapshot()
    for (const el of [
      headEl('b'),
      cellEl('r0', 'b'),
      cellEl('r4', 'b'),
      footEl('b'),
    ]) {
      expect(distance(colorAt(lit, el), colorAt(before, el))).toBeGreaterThan(8)
      expect(hueGap(hue(colorAt(lit, el)), TONE_HUE.warning)).toBeLessThan(25)
    }
    expect(colorAt(lit, cellEl('r0', 'a'))).toEqual(
      colorAt(before, cellEl('r0', 'a')),
    )
    await screen.unmount()

    await mount({ columns: NESTED })
    before = await snapshot()
    const leaves: { clear: () => void }[] = []
    await act(() => {
      leaves.push(
        table.highlight({ column: 'a' }, { tone: 'warning' }),
        table.highlight({ column: 'c' }, { tone: 'warning' }),
      )
    })
    lit = await snapshot()
    // `c` растянут на обе строки шапки: его ячейка — верх цепочки заголовков.
    for (const id of ['a', 'c']) {
      expect(
        distance(colorAt(lit, headEl(id)), colorAt(before, headEl(id))),
      ).toBeGreaterThan(8)
    }
    expect(colorAt(lit, headEl('g'))).toEqual(colorAt(before, headEl('g')))

    await act(() => {
      leaves.forEach(handle => handle.clear())
      table.highlight({ column: 'g' }, { tone: 'warning' })
    })
    await expect
      .poll(() => headEl('a').hasAttribute('data-column-highlight'))
      .toBe(false)
    await expect
      .poll(async () => {
        const group = await snapshot()
        return distance(
          colorAt(group, headEl('g')),
          colorAt(before, headEl('g')),
        )
      })
      .toBeGreaterThan(8)
    const group = await snapshot()
    for (const el of [headEl('a'), cellEl('r0', 'a')]) {
      expect(colorAt(group, el)).toEqual(colorAt(before, el))
    }
  })

  test('HL4: duration — заливка держится заданное время, затем гаснет переходом токена затухания', async () => {
    await mount()
    const row = rowEl('r1')
    const alpha = () =>
      toRgba(getComputedStyle(row).getPropertyValue('--tsr-highlight-row'))[3]!
    const full = toRgba(resolve('var(--tsr-comp-highlight-danger-bg)'))[3]!
    expect(full).toBeGreaterThan(0.05)
    table.highlight({ row: 'r1' }, { tone: 'danger', duration: 1000 })
    await expect.poll(alpha).toBe(full)
    await sleep(150)
    expect(alpha()).toBe(full)
    // Затухание: 500 мс по токену — посередине альфа между полной и нулём.
    await expect.poll(() => row.hasAttribute('data-highlight-out')).toBe(true)
    const fade = getComputedStyle(row)
    expect(fade.transitionProperty).toContain('--tsr-highlight-row')
    await sleep(200)
    const mid = alpha()
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(full)
    await expect.poll(() => row.hasAttribute('data-highlight')).toBe(false)
  })

  test('HL26: подсветка проявляется переходом токена затухания; строка, вернувшаяся в окно виртуализации, — сразу залитой', async () => {
    await mount({ count: 200 })
    const alpha = (id: string) =>
      toRgba(
        getComputedStyle(rowEl(id)).getPropertyValue('--tsr-highlight-row'),
      )[3]!
    const full = toRgba(resolve('var(--tsr-comp-highlight-danger-bg)'))[3]!
    table.highlight({ row: 'r1' }, { tone: 'danger' })
    await frame()
    await frame()
    // Токен — 500 мс: на втором кадре альфа ещё между нулём и полной.
    const rising = alpha('r1')
    expect(rising).toBeGreaterThan(0)
    expect(rising).toBeLessThan(full)
    await expect.poll(() => alpha('r1')).toBe(full)

    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = scroller.scrollHeight
    await expect
      .poll(() => document.querySelector('[data-row-id="r1"]'))
      .toBeNull()
    scroller.scrollTop = 0
    await expect
      .poll(() => document.querySelector('[data-row-id="r1"]'))
      .not.toBeNull()
    expect(alpha('r1')).toBe(full)
    expect(highlightTransitions()).toEqual([])
  })
})

describe('Подсветка: тоны, блик, движение', () => {
  test('HL7: встроенные тоны — из токенов; свой тон — data-highlight и токен приложения, без токена заливки нет; недопустимое имя — предупреждение без подсветки', async () => {
    await mount()
    const ids = ['r0', 'r2', 'r4']
    await act(() =>
      TONES.forEach((tone, i) => table.highlight({ row: ids[i]! }, { tone })),
    )
    TONES.forEach((tone, i) => {
      expect(getComputedStyle(rowEl(ids[i]!)).backgroundImage).toContain(
        resolve(`var(--tsr-comp-highlight-${tone}-bg)`),
      )
    })

    const style = document.createElement('style')
    style.textContent = `.data-grid-theme { --tsr-comp-highlight-brand-bg: rgb(140 0 255 / 30%); }`
    document.head.append(style)
    const before = await snapshot()
    await act(() => {
      table.highlight({ cell: ['r1', 'b'] }, { tone: 'brand' })
      table.highlight({ cell: ['r3', 'b'] }, { tone: 'plain' })
    })
    const lit = await snapshot()
    expect(cellEl('r1', 'b').getAttribute('data-highlight')).toBe('brand')
    expect(hueGap(hue(colorAt(lit, cellEl('r1', 'b'))), 273)).toBeLessThan(25)
    expect(cellEl('r3', 'b').getAttribute('data-highlight')).toBe('plain')
    expect(colorAt(lit, cellEl('r3', 'b'))).toEqual(
      colorAt(before, cellEl('r3', 'b')),
    )
    style.remove()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await act(() => {
      table.highlight({ cell: ['r5', 'b'] }, { tone: 'Bad tone' })
    })
    expect(
      warn.mock.calls.some(call => String(call[0]).includes('Bad tone')),
    ).toBe(true)
    expect(cellEl('r5', 'b').hasAttribute('data-highlight')).toBe(false)
    warn.mockRestore()
  })

  test('HL25: подсветка статична — у строки, ячейки, заголовка и футера цели нет анимаций, пока она держится', async () => {
    await mount()
    await act(() => {
      table.highlight({ row: 'r1' }, { tone: 'success' })
      table.highlight({ cell: ['r3', 'b'] }, { tone: 'warning' })
      table.highlight({ column: 'c' }, { tone: 'danger' })
    })
    const targets = () => [
      rowEl('r1'),
      cellEl('r3', 'b'),
      headEl('c'),
      cellEl('r0', 'c'),
      footEl('c'),
    ]
    for (const el of targets()) {
      expect(
        el.hasAttribute('data-highlight') ||
          el.hasAttribute('data-column-highlight'),
      ).toBe(true)
    }
    // Ни в момент постановки, ни позже: только заливка, без бегущих слоёв.
    for (const wait of [0, 200, 600]) {
      await sleep(wait)
      const running = targets().flatMap(el =>
        el
          .getAnimations({ subtree: true })
          .filter(animation => animation instanceof CSSAnimation)
          .map(animation => (animation as CSSAnimation).animationName),
      )
      expect(running).toEqual([])
    }
  })

  test('HL9: prefers-reduced-motion — заливка видна, затухание мгновенное', async () => {
    await commands.reducedMotion(true)
    await mount()
    const before = await snapshot()
    let handle!: { clear: () => void }
    await act(() => {
      handle = table.highlight({ row: 'r1' }, { tone: 'danger' })
    })
    const lit = await snapshot()
    expect(
      distance(
        colorAt(lit, cellEl('r1', 'b')),
        colorAt(before, cellEl('r1', 'b')),
      ),
    ).toBeGreaterThan(8)

    await act(() => handle.clear())
    const row = rowEl('r1')
    expect(
      toRgba(getComputedStyle(row).getPropertyValue('--tsr-highlight-row'))[3],
    ).toBe(0)
  })
})

describe('Подсветка и состояния строк', () => {
  test(
    'HL10: матрица состояний — оттенок тона, отличие от неподсвеченной, ховер и выбор различимы, полоса без разрывов',
    // Десятки снимков экрана: в WebKit снимок медленнее, общего тайм-аута мало.
    { timeout: 60_000 },
    async () => {
      await mount({ pinned: true, selected: ['r2'] })
      // r0 — покой, r1 — нечётная, r2 — выбор; ховер — r0 и r2.
      const kinds = (id: string) => [
        cellEl(id, 'a'),
        cellEl(id, 'b'),
        cellEl(id, 'c'),
      ]
      const shots = async () => {
        const result: Record<string, Shot> = { idle: await snapshot() }
        for (const id of ['r0', 'r2']) {
          await userEvent.hover(cellEl(id, 'b'))
          await sleep(250)
          result[id] = await snapshot()
        }
        await userEvent.unhover(document.body)
        await sleep(250)
        return result
      }
      for (const dark of [false, true]) {
        document.documentElement.classList.toggle('dark', dark)
        await sleep(250)
        const base = await shots()
        for (const tone of TONES) {
          await act(() =>
            ['r0', 'r1', 'r2'].forEach(id =>
              table.highlight({ row: id }, { tone, key: 'matrix' }),
            ),
          )
          const lit = await shots()
          const cases: [string, string, keyof typeof base][] = [
            ['rest', 'r0', 'idle'],
            ['odd', 'r1', 'idle'],
            ['hover', 'r0', 'r0'],
            ['selected', 'r2', 'idle'],
            ['selected+hover', 'r2', 'r2'],
          ]
          for (const [state, id, shot] of cases) {
            for (const el of kinds(id)) {
              const label = `${dark ? 'dark' : 'light'} ${tone} ${state} ${el.dataset.columnId}`
              const color = colorAt(lit[shot]!, el)
              expect(hueGap(hue(color), TONE_HUE[tone]), label).toBeLessThan(25)
              // Тон заметен: сдвиг от неподсвеченной ячейки — десятки уровней, а не шум.
              expect(
                distance(color, colorAt(base[shot]!, el)),
                label,
              ).toBeGreaterThan(30)
            }
          }
          // Под подсветкой состояние различимо там, где оно различимо без неё.
          for (const [id, shot] of [
            ['r0', 'r0'],
            ['r2', 'r2'],
            ['r2', 'idle'],
          ] as const) {
            for (const el of kinds(id)) {
              const ref = shot === 'idle' ? 'r0' : id
              const refEl = cellEl(ref, el.dataset.columnId!)
              const plain = distance(
                colorAt(base[shot]!, el),
                colorAt(base.idle!, shot === 'idle' ? refEl : el),
              )
              // Шум сжатия скриншота — до пары уровней; различие меньше этого не проверяем.
              if (plain < 6) continue
              const label = `${dark ? 'dark' : 'light'} ${tone} ${id}/${shot} ${el.dataset.columnId}`
              expect(
                distance(
                  colorAt(lit[shot]!, el),
                  colorAt(lit.idle!, shot === 'idle' ? refEl : el),
                ),
                label,
              ).toBeGreaterThanOrEqual(Math.floor(plain * 0.6))
            }
          }
          // Полоса без разрывов: стык закреплённой и обычной ячейки того же тона.
          const left = cellEl('r0', 'a').getBoundingClientRect()
          const seam = lit.idle!(left.right + 2, left.bottom - 8)
          expect(hueGap(hue(seam), TONE_HUE[tone])).toBeLessThan(25)
          await act(() => table.clearHighlights('matrix'))
          await sleep(600)
        }
      }
    },
  )

  test('HL11: текст, кромки выделения ячеек и фокус-кольцо под подсветкой не тонированы', async () => {
    const screen = await mount({ cells: true })
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
    let before = await snapshot()
    await act(() => {
      table.highlight({ row: 'r1' }, { tone: 'danger' })
      table.highlight({ row: 'r3' }, { tone: 'danger' })
      table.highlight({ column: 'b' }, { tone: 'warning' })
    })
    // Кромка видна до подсветки: точка — синяя.
    expect(
      hueGap(
        hue(before(...edge())),
        hue(toRgba(resolve('var(--tsr-comp-cell-selected-border-color)'))),
      ),
    ).toBeLessThan(20)
    let lit = await snapshot()
    expect(lit(...center(ink))).toEqual(before(...center(ink)))
    // Тонкие линии на скриншоте сглаживаются с соседним фоном (масштаб окна ≠ 1): их
    // сдвиг — лишь доля сдвига фона той же ячейки, а не весь тон.
    const bgShift = (el: HTMLElement) =>
      distance(colorAt(lit, el), colorAt(before, el))
    expect(distance(lit(...edge()), before(...edge()))).toBeLessThan(
      bgShift(cellEl('r3', 'b')) * 0.4,
    )
    await screen.unmount()

    // Фокус-кольцо клавиатурной навигации.
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
    // Контур проявляется переходом — снимаем после него.
    await sleep(300)
    before = await snapshot()
    await act(() => {
      table.highlight({ row: 'r1' }, { tone: 'danger' })
      table.highlight({ cell: ['r1', 'b'] }, { tone: 'success' })
    })
    lit = await snapshot()
    expect(distance(lit(...ring()), before(...ring()))).toBeLessThan(
      distance(
        colorAt(lit, cellEl('r1', 'b')),
        colorAt(before, cellEl('r1', 'b')),
      ) * 0.4,
    )
  })

  test('HL12: слои складываются; тинт выделения ячеек — поверх заливки; вспышка итога — над подсветкой', async () => {
    await mount({ cells: true, tree: true })
    await act(() => {
      table.highlight({ row: 'r1' }, { tone: 'warning' })
    })
    const rowOnly = await snapshot()
    await act(() => {
      table.highlight({ column: 'b' }, { tone: 'warning' })
    })
    const both = await snapshot()
    await act(() => {
      table.highlight({ cell: ['r1', 'b'] }, { tone: 'warning' })
    })
    const all = await snapshot()
    const target = cellEl('r1', 'b')
    // Каждый слой добавляет тон: точка темнее/насыщеннее предыдущей.
    expect(
      distance(colorAt(both, target), colorAt(rowOnly, target)),
    ).toBeGreaterThan(6)
    expect(
      distance(colorAt(all, target), colorAt(both, target)),
    ).toBeGreaterThan(6)

    // Выделение ячейки: синий тинт поверх заливки — синий канал растёт.
    await act(() => {
      table.highlight({ row: 'r3' }, { tone: 'warning' })
    })
    const lit = await snapshot()
    selectCell(cellEl('r2', 'a'))
    selectCell(cellEl('r3', 'b'), true)
    await expect
      .poll(() => cellEl('r3', 'a').getAttribute('data-cell-selected'))
      .toBe('true')
    await frame()
    const selected = await snapshot()
    const plain = colorAt(lit, cellEl('r3', 'a'))
    const tinted = colorAt(selected, cellEl('r3', 'a'))
    expect(tinted[2]! - plain[2]!).toBeGreaterThan(3)

    // Вспышка итога над подсветкой — видна (ADR 0134).
    await act(() =>
      (
        table as unknown as {
          flashOutcome: (target: { row: string }, outcome: string) => void
        }
      ).flashOutcome({ row: 'r1' }, 'arrived'),
    )
    const arrived = await snapshot()
    expect(
      distance(
        colorAt(arrived, cellEl('r1', 'a')),
        colorAt(all, cellEl('r1', 'a')),
      ),
    ).toBeGreaterThan(6)
  })

  test('HL13: встроенные тоны отличимы по оттенку от выделения ячеек и вспышки arrived в обеих темах', async () => {
    await mount()
    await inBothThemes(async () => {
      const surface = toRgba(resolve('var(--tsr-sys-surface)'))
      const solid = (token: string) =>
        over(toRgba(resolve(`var(${token})`)), surface)
      const system = [
        solid('--tsr-comp-cell-selected-bg'),
        solid('--tsr-comp-flash-arrived-bg'),
      ]
      for (const tone of TONES) {
        const fill = solid(`--tsr-comp-highlight-${tone}-bg`)
        for (const other of system) {
          expect(hueGap(hue(fill), hue(other)), tone).toBeGreaterThan(40)
        }
      }
    })
  })

  test('HL14: axe и контраст текста ≥ 4.5:1 в худшем сочетании (закреплённая + выбор + ховер + тон) в обеих темах', async () => {
    await mount({ pinned: true, selected: ['r2'] })
    await userEvent.hover(cellEl('r2', 'a'))
    await inBothThemes(async () => {
      for (const tone of TONES) {
        await act(() => {
          table.highlight({ row: 'r2' }, { tone })
        })
        const cell = cellEl('r2', 'a')
        const underlay = backgroundOf(cell)
        const tint = toRgba(resolve(`var(--tsr-comp-highlight-${tone}-bg)`))
        const bg = [...over(tint, underlay), 1]
        const text = toRgba(
          getComputedStyle(cell.querySelector('*') ?? cell).color,
        )
        expect(contrast(text, bg), tone).toBeGreaterThanOrEqual(4.5)
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
          tone,
        ).toEqual([])
      }
    })
  })
})

describe('Подсветка: жизнь цели и доступность', () => {
  test('HL15: подсветка переживает виртуализацию строк и колонок, сортировку, фильтр и смену страницы', async () => {
    const wide = [
      ...COLUMNS,
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `x${i}`,
        accessorFn: () => i,
        header: `X${i}`,
        size: 120,
      })),
    ]
    const screen = await mount({ count: 1000, columns: wide })
    await act(() => {
      table.highlight({ row: 'r1' }, { tone: 'danger' })
      table.highlight({ column: 'x39' }, { tone: 'warning' })
    })
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = 30000
    await expect
      .poll(() => document.querySelector('[data-row-id="r1"]'))
      .toBeNull()
    scroller.scrollTop = 0
    await expect
      .poll(() => rowEl('r1')?.getAttribute('data-highlight'))
      .toBe('danger')

    scroller.scrollLeft = scroller.scrollWidth
    await expect
      .poll(() =>
        document
          .querySelector('.data-grid__body-cell[data-column-id="x39"]')
          ?.getAttribute('data-column-highlight'),
      )
      .toBe('warning')
    scroller.scrollLeft = 0

    await act(() => table.setSorting([{ id: 'a', desc: false }]))
    await expect
      .poll(() => rowEl('r1')?.getAttribute('data-highlight'))
      .toBe('danger')
    await act(() => table.setGlobalFilter('A2'))
    await expect
      .poll(() => document.querySelector('[data-row-id="r1"]'))
      .toBeNull()
    await act(() => table.setGlobalFilter(undefined))
    await expect
      .poll(() => rowEl('r1')?.getAttribute('data-highlight'))
      .toBe('danger')
    await screen.unmount()

    await mount({ count: 20, paged: true })
    await act(() => {
      table.highlight({ row: 'r1' }, { tone: 'success' })
    })
    await act(() => table.setPageIndex(2))
    await expect
      .poll(() => document.querySelector('[data-row-id="r1"]'))
      .toBeNull()
    await act(() => table.setPageIndex(0))
    await expect
      .poll(() => rowEl('r1')?.getAttribute('data-highlight'))
      .toBe('success')
  })

  test('HL17: label — объявление и aria-description на строке, ячейке и заголовке колонки; без label aria не меняются; в ролях table, grid и treegrid', async () => {
    const tree: Item[] = [{ ...item(0), subRows: [item(10)] }, item(1), item(2)]
    for (const [role, props] of [
      ['table', {}],
      ['grid', { keyboard: true }],
      ['treegrid', { keyboard: true, tree: true, data: tree }],
    ] as const) {
      const screen = await mount(props as GridProps)
      expect(document.querySelector(`[role="${role}"]`), role).not.toBeNull()
      await act(() => {
        table.highlight({ row: 'r1' }, { label: 'Row will be deleted' })
        table.highlight({ cell: ['r2', 'b'] }, { label: 'Invalid value' })
        table.highlight({ column: 'c' }, { label: 'Changed column' })
        table.highlight({ row: 'r2' })
      })
      expect(rowEl('r1').getAttribute('aria-description'), role).toBe(
        'Row will be deleted',
      )
      expect(cellEl('r2', 'b').getAttribute('aria-description'), role).toBe(
        'Invalid value',
      )
      expect(headEl('c').getAttribute('aria-description'), role).toBe(
        'Changed column',
      )
      expect(cellEl('r1', 'c').hasAttribute('aria-description'), role).toBe(
        false,
      )
      expect(rowEl('r2').hasAttribute('aria-description'), role).toBe(false)
      expect(
        document.querySelector('[aria-live]')?.textContent,
        role,
      ).toContain('Changed column')
      await act(() => table.clearHighlights())
      expect(rowEl('r1').hasAttribute('aria-description'), role).toBe(false)
      await screen.unmount()
    }
  })
})

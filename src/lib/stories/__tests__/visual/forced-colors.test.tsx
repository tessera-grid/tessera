import { Toolbar } from '@base-ui/react/toolbar'
import { useMemo, useState } from 'react'
import { commands, page, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellSelection, columnPinning, rowSelection } from '../../../plugins'
import type {
  HighlightOptions,
  HighlightTarget,
} from '../../../core/highlights/highlightFeature'
import { IconButton } from '@/lib/ui/IconButton'
import { Segments } from '@/lib/ui/Segments'
import { Switch } from '@/lib/ui/Switch'
import { ToolbarButton } from '@/lib/ui/ToolbarButton'
import { SvgIcon } from '@/lib/ui/icons'
import { arcHeadOf, arcTrackOf, pendingArcOf, renderGrid } from '../helpers'
import { submittedCellsSeed } from '../performance/perf-cases'
import { composed, treeLinesArgs } from '../stories'
import { contrast, toRgba } from './a11y-helpers'
import { tableLabels } from '../labels'

// Высокая контрастность Windows (ADR 0087, HC1–HC10): эмуляция
// `forced-colors: active` в Chromium (`npm test`) и Firefox (`test:engines`). Ожидаемые
// цвета — системные цвета палитры эмуляции, их отдаёт сам браузер. WebKit режим не
// подменяет (у Safari его нет) — набор там пропущен. HC11 — в `theming-invariants`.

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

const forcing = server.browser !== 'webkit'

beforeEach(async ({ skip }) => {
  skip(!forcing, 'WebKit не подменяет цвета в forced-colors')
  await fc.forcedColors(true)
})

afterEach(async () => {
  await fc.forcedColors(false)
})

/** Системный цвет палитры, как его отдаёт браузер. */
const sys = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

const style = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo)

/** Цвет токена, разрешённый в контексте элемента. */
const tokenIn = (el: Element, name: string) => {
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  el.appendChild(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

/**
 * Нижняя граница контраста на заливке `Highlight`: 3:1, но не выше пары самой палитры
 * (`HighlightText` на `Highlight`) — лучше её грид не нарисует; в эмуляции Firefox
 * пара даёт 2,94.
 */
const paletteFloor = () =>
  Math.min(
    3,
    contrast(toRgba(sys('HighlightText')), toRgba(sys('Highlight'))) - 0.01,
  )
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

interface Item {
  id: string
  a: string
  b: string
  c: string
}

const COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', size: 120 },
  { id: 'b', accessorKey: 'b', header: 'B', size: 140 },
  { id: 'c', accessorKey: 'c', header: 'C', size: 120 },
]

type Api = {
  highlight: (
    target: HighlightTarget,
    options?: HighlightOptions,
  ) => { clear: () => void }
}
let table: Api

const FOOTER_COLUMNS = COLUMNS.map(column => ({
  ...column,
  footer: () => `Sum ${column.header}`,
}))

/** Вложенная шапка — раскладка `grid` (HC19). */
const NESTED_COLUMNS = [
  COLUMNS[0]!,
  { id: 'g', header: 'G', columns: COLUMNS.slice(1) },
]

const Grid = ({
  selected = [] as string[],
  footer = false,
  nested = false,
}) => {
  const data = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: `r${i}`,
        a: `A${i}`,
        b: `B${i}`,
        c: `C${i}`,
      })),
    [],
  )
  table = useCreateTable({
    enableKeyboardNavigation: true,
    columns: (nested
      ? NESTED_COLUMNS
      : footer
        ? FOOTER_COLUMNS
        : COLUMNS) as never,
    data,
    getRowId: (row: Item) => row.id,
    enableFooter: footer,
    state: { columnPinning: { start: ['a'], end: [] } },
    plugins: [
      columnPinning(),
      rowSelection({
        rowSelection: Object.fromEntries(selected.map(id => [id, true])),
      }),
      cellSelection(),
    ] as never,
  }) as unknown as Api
  return (
    <div style={{ width: 520, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const mount = async (
  selected: string[] = [],
  footer = false,
  nested = false,
) => {
  const screen = await render(
    <Grid selected={selected} footer={footer} nested={nested} />,
  )
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
const headCellEl = (columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"]`,
  )!
const rgbOf = (name: string) => toRgba(sys(name)).slice(0, 3)
/**
 * Пиксель цвета `want` с допуском в 4 по каналу: закреплённые ячейки и шапка
 * полупрозрачны на сотую (`--tsr-comp-opacity`) и смешиваются с подложкой.
 */
const expectPixel = (rgb: number[], want: number[], label: string) =>
  expect(
    Math.max(...rgb.map((v, i) => Math.abs(v - want[i]!))),
    `${label}: [${rgb}] вместо [${want}]`,
  ).toBeLessThanOrEqual(4)
const textOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>('.data-grid__cell-wrapper-title') ?? cell

/** Контраст кольца фокуса к заливке под ним: ячейки или, если она прозрачна, строки. */
const ringContrast = (cell: HTMLElement) => {
  const own = toRgba(style(cell).backgroundColor)
  const fill =
    own[3]! > 0.99
      ? own
      : toRgba(style(cell.closest('.data-grid__body-row')!).backgroundColor)
  return contrast(toRgba(style(cell).outlineColor), fill)
}

/** Выбор ячейки или диапазона — подготовка состояния, не предмет проверки. */
const selectCell = (cell: HTMLElement, shiftKey = false) => {
  const init = { bubbles: true, cancelable: true, button: 0, shiftKey }
  cell.dispatchEvent(new MouseEvent('mousedown', init))
  document.dispatchEvent(new MouseEvent('mouseup', init))
}

/** Пиксели скриншота в CSS-координатах окна. */
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

/**
 * Пиксель сдвинут от `from` к `to` хотя бы на четверть: тонкая линия сглажена и
 * смешана с фоном, но идёт в сторону своего цвета.
 */
const toward = (rgb: number[], from: string, to: string) => {
  const a = toRgba(from)
  const b = toRgba(to)
  const axis = [0, 1, 2].map(i => b[i]! - a[i]!)
  const shift = [0, 1, 2].map(i => rgb[i]! - a[i]!)
  const length = axis.reduce((sum, v) => sum + v * v, 0)
  const t = axis.reduce((sum, v, i) => sum + v * shift[i]!, 0) / length
  const off = Math.hypot(...[0, 1, 2].map(i => shift[i]! - t * axis[i]!))
  return t >= 0.25 && off < 60
}

const textBox = (text: Node) => {
  const range = document.createRange()
  range.selectNodeContents(text)
  return range.getBoundingClientRect()
}

/**
 * Доля пикселей заливки `fill` под строкой текста: подложка Chromium (`Canvas` под
 * текстом) закрывает заливку целиком — доля около нуля.
 */
const fillUnderText = (
  shot: (x: number, y: number) => number[],
  text: Node,
  fill: string,
) => {
  const box = textBox(text)
  const target = toRgba(fill)
  let hits = 0
  let total = 0
  for (let x = box.left + 1; x < box.right - 1; x++) {
    for (let y = box.top + 2; y < box.bottom - 2; y += 2) {
      total++
      if (shot(x, y).every((value, i) => Math.abs(value - target[i]!) < 40)) {
        hits++
      }
    }
  }
  return hits / total
}

describe('Высокая контрастность (ADR 0087)', () => {
  test('HC1: выбранная строка — фон Highlight и у закреплённой ячейки, текст HighlightText, флажок различим', async () => {
    await mount(['r2'])
    const row = rowEl('r2')
    expect(style(row).backgroundColor).toBe(sys('Highlight'))
    const pinned = cellEl('r2', 'a')
    expect(pinned.getAttribute('data-cell-pinned')).toBe('left')
    expect(style(pinned).backgroundColor).toBe(sys('Highlight'))
    for (const id of ['a', 'b']) {
      expect(style(textOf(cellEl('r2', id))).color, id).toBe(
        sys('HighlightText'),
      )
    }
    // Флажок: рамка и галочка видны на Highlight.
    const box = row.querySelector<HTMLElement>('[role="checkbox"]')!
    const boxBg = toRgba(style(box).backgroundColor)
    const fill = boxBg[3]! > 0.99 ? boxBg : toRgba(sys('Highlight'))
    expect(
      contrast(toRgba(style(box).borderTopColor), toRgba(sys('Highlight'))),
    ).toBeGreaterThanOrEqual(paletteFloor())
    expect(
      contrast(toRgba(style(box).color), fill),
      'галочка к заливке флажка',
    ).toBeGreaterThanOrEqual(paletteFloor())
    // Невыбранная строка — фон Canvas.
    expect(style(rowEl('r3')).backgroundColor).toBe(sys('Canvas'))
  })

  test('HC2: выделенный диапазон ячеек — фон Highlight, текст HighlightText', async () => {
    await mount()
    selectCell(cellEl('r1', 'b'))
    selectCell(cellEl('r3', 'c'), true)
    await expect
      .poll(() => cellEl('r2', 'c').getAttribute('data-cell-selected'))
      .toBe('true')
    for (const [row, col] of [
      ['r2', 'b'],
      ['r2', 'c'],
      ['r3', 'c'],
    ] as const) {
      const cell = cellEl(row, col)
      // Фон ячейки переходит (токен перехода строки) — ждём конечный.
      await expect
        .poll(() => style(cell).backgroundColor, { message: `${row}/${col}` })
        .toBe(sys('Highlight'))
      expect(style(textOf(cell)).color, `${row}/${col}`).toBe(
        sys('HighlightText'),
      )
    }
  })

  test('HC3: кольцо фокуса активной ячейки видно на выбранной строке и в диапазоне — контраст к Highlight ≥ 3:1; на обычной строке — Highlight, отличимо от разделителей GrayText', async () => {
    await mount(['r2'])
    const cell = cellEl('r2', 'b')
    cell.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    await expect.poll(() => document.activeElement).toBe(cell)
    expect(style(cell).outlineStyle).toBe('solid')
    await expect
      .poll(() => ringContrast(cell))
      .toBeGreaterThanOrEqual(paletteFloor())

    selectCell(cellEl('r4', 'b'))
    selectCell(cellEl('r5', 'c'), true)
    const inRange = cellEl('r5', 'b')
    await expect
      .poll(() => inRange.getAttribute('data-cell-selected'))
      .toBe('true')
    inRange.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    await expect.poll(() => document.activeElement).toBe(inRange)
    expect(style(inRange).outlineStyle).toBe('solid')
    await expect
      .poll(() => ringContrast(inRange))
      .toBeGreaterThanOrEqual(paletteFloor())

    // Обычная строка: кольцо Highlight, разделитель строк — GrayText. Снимок без сжатия.
    await page.viewport(414, 720)
    try {
      const plain = cellEl('r1', 'b')
      plain.focus()
      await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
      await expect.poll(() => document.activeElement).toBe(plain)
      await expect.poll(() => style(plain).outlineColor).toBe(sys('Highlight'))
      const shot = await snapshot()
      const box = plain.getBoundingClientRect()
      expect(shot(box.left + 0.5, box.top + box.height / 2), 'кольцо').toEqual(
        rgbOf('Highlight'),
      )
      const next = cellEl('r1', 'c').getBoundingClientRect()
      expect(
        shot(next.left + next.width / 2, next.top + 0.5),
        'разделитель',
      ).toEqual(rgbOf('GrayText'))
      expect(rgbOf('GrayText')).not.toEqual(rgbOf('Highlight'))
    } finally {
      await page.viewport(414, 896)
    }
  })

  test('HC15: разделители строк внутри выбранных строк, диапазона и подсветки — цветом заливки, вне заливок — GrayText', async () => {
    // Окно в рамку раннера: снимок без сжатия, разделитель в 1px — целыми пикселями.
    await page.viewport(414, 720)
    try {
      await mount(['r2', 'r3'])
      table.highlight({ column: 'a' }, { tone: 'danger' })
      selectCell(cellEl('r5', 'b'))
      selectCell(cellEl('r6', 'c'), true)
      await expect
        .poll(() => style(cellEl('r6', 'b')).backgroundColor)
        .toBe(sys('Highlight'))
      await expect
        .poll(() => style(cellEl('r1', 'a')).backgroundColor)
        .toBe(sys('Mark'))
      await expect
        .poll(() => style(rowEl('r3')).backgroundColor)
        .toBe(sys('Highlight'))
      const shot = await snapshot()
      // Разделитель над строкой — верхняя рамка её ячейки.
      const divider = (row: string, column: string) => {
        const box = cellEl(row, column).getBoundingClientRect()
        return shot(box.left + box.width / 2, box.top + 0.5)
      }
      expectPixel(
        divider('r3', 'b'),
        rgbOf('Highlight'),
        'выбранные строки подряд',
      )
      expectPixel(divider('r1', 'a'), rgbOf('Mark'), 'подсветка колонки')
      expectPixel(divider('r6', 'b'), rgbOf('Highlight'), 'диапазон')
      expectPixel(divider('r1', 'b'), rgbOf('GrayText'), 'вне заливок')
    } finally {
      await page.viewport(414, 896)
    }
  })

  test('HC18: плоская шапка — линии 1px GrayText между строками, под шапкой и над закреплённым футером; вертикальных линий и контура ячейки нет', async () => {
    await page.viewport(414, 720)
    try {
      await mount([], true)
      await expect
        .poll(() => style(rowEl('r1')).backgroundColor)
        .toBe(sys('Canvas'))
      const shot = await snapshot()
      const gray = rgbOf('GrayText')
      const canvas = rgbOf('Canvas')
      const r1 = rowEl('r1').getBoundingClientRect()
      const r2 = rowEl('r2').getBoundingClientRect()
      const c = cellEl('r1', 'c').getBoundingClientRect()
      // Между строками — одна линия по всей ширине: служебная, закреплённая, обычные ячейки.
      for (const [name, x] of [
        ['a', cellEl('r1', 'a').getBoundingClientRect().left + 10],
        ['b', cellEl('r1', 'b').getBoundingClientRect().left + 10],
        ['служебная', r1.left + 10],
        ['c', c.left + 10],
      ] as const) {
        expectPixel(shot(x, r2.top + 0.5), gray, `линия, ${name}`)
        expectPixel(shot(x, r2.top - 0.5), canvas, `одна линия, ${name}`)
      }
      const head = document
        .querySelector('.data-grid__head')!
        .getBoundingClientRect()
      expectPixel(shot(c.left + 10, head.bottom - 0.5), gray, 'под шапкой')
      const footer = document
        .querySelector('.data-grid__footer')!
        .getBoundingClientRect()
      expectPixel(shot(c.left + 10, footer.top + 0.5), gray, 'над футером')
      // Ни вертикальных линий, ни контура ячейки: края ячеек — фон.
      const b = cellEl('r1', 'b').getBoundingClientRect()
      const y = r1.top + r1.height / 2
      expectPixel(shot(b.left + 0.5, y), canvas, 'левый край ячейки')
      expectPixel(shot(b.right - 0.5, y), canvas, 'правый край ячейки')
      expectPixel(shot(c.left + 0.5, y), canvas, 'левый край соседа')
    } finally {
      await page.viewport(414, 896)
    }
  })

  test('HC19: вложенная шапка — рамки ячеек шапки и тела одной линией 1px GrayText, без контура ячейки', async () => {
    await page.viewport(414, 720)
    try {
      await mount([], false, true)
      await expect.poll(() => headCellEl('g')).toBeTruthy()
      await expect
        .poll(() => style(rowEl('r1')).backgroundColor)
        .toBe(sys('Canvas'))
      const shot = await snapshot()
      const gray = rgbOf('GrayText')
      const canvas = rgbOf('Canvas')
      const b = cellEl('r1', 'b').getBoundingClientRect()
      const y = b.top + b.height / 2
      expectPixel(shot(b.right - 0.5, y), gray, 'тело: линия между b и c')
      expectPixel(shot(b.right + 0.5, y), canvas, 'тело: одна линия')
      expectPixel(
        shot(b.left + 0.5, y),
        canvas,
        'тело: левый край b без контура',
      )
      const r2 = cellEl('r2', 'b').getBoundingClientRect()
      const x = b.left + b.width / 2
      expectPixel(shot(x, r2.top + 0.5), gray, 'тело: линия между строками')
      expectPixel(shot(x, r2.top - 0.5), canvas, 'тело: одна линия')
      const headB = headCellEl('b').getBoundingClientRect()
      const headY = headB.top + headB.height / 2
      expectPixel(
        shot(headB.right - 0.5, headY),
        gray,
        'шапка: линия между b и c',
      )
      const group = headCellEl('g').getBoundingClientRect()
      expectPixel(shot(x, group.bottom - 0.5), gray, 'шапка: под группой')
      const head = document
        .querySelector('.data-grid__head')!
        .getBoundingClientRect()
      expectPixel(shot(x, head.bottom - 0.5), gray, 'под шапкой')
    } finally {
      await page.viewport(414, 896)
    }
  })

  test('HC4: наведение строки — рамка 2px Highlight, ячейки — контур 1px Highlight, без заливки', async () => {
    // Окно в рамку раннера: снимок без сжатия, линия в 1px — целыми пикселями.
    await page.viewport(414, 720)
    try {
      await mount(['r5'])
      await userEvent.hover(cellEl('r3', 'b'))
      const row = rowEl('r3')
      await expect.poll(() => style(row).backgroundColor).toBe(sys('Canvas'))
      // Контур ячейки переходит (токен перехода строки) — ждём конечный.
      await expect
        .poll(() => style(cellEl('r3', 'b')).outlineColor)
        .toBe(sys('Highlight'))
      // Контур виден на экране, а не только в стилях: ячейки его не перекрывают.
      const shot = await snapshot()
      const highlight = toRgba(sys('Highlight')).slice(0, 3)
      const box = row.getBoundingClientRect()
      for (const column of ['a', 'b', 'c']) {
        const cell = cellEl('r3', column).getBoundingClientRect()
        const x = cell.left + cell.width / 2
        for (const y of [
          box.top + 0.5,
          box.top + 1.5,
          box.bottom - 1.5,
          box.bottom - 0.5,
        ]) {
          expect(shot(x, y), `строка, ${column} @ ${y}`).toEqual(highlight)
        }
      }
      const cell = cellEl('r3', 'b').getBoundingClientRect()
      expect(
        shot(cell.left + 0.5, cell.top + cell.height / 2),
        'ячейка, левый край',
      ).toEqual(highlight)
      // Без заливки: середина строки — фон палитры.
      expect(
        shot(cell.left + cell.width - 4, cell.top + cell.height / 2),
      ).toEqual(toRgba(sys('Canvas')).slice(0, 3))
      // На выбранной строке рамка — HighlightText: Highlight на Highlight не видно.
      await userEvent.hover(cellEl('r5', 'b'))
      const selected = rowEl('r5')
      await expect
        .poll(() => style(selected).backgroundColor)
        .toBe(sys('Highlight'))
      const selectedBox = selected.getBoundingClientRect()
      const selectedShot = await snapshot()
      expect(
        selectedShot(cell.left + cell.width / 2, selectedBox.top + 0.5),
        'выбранная строка, верхний край',
      ).toEqual(toRgba(sys('HighlightText')).slice(0, 3))
    } finally {
      await page.viewport(414, 896)
    }
  })

  test('HC20: наведение ячейки заголовка — контур 1px Highlight по краю (нижний — над линией под шапкой), без заливки, у обычной и закреплённой колонки', async () => {
    await page.viewport(414, 720)
    try {
      await mount()
      const highlight = rgbOf('Highlight')
      const canvas = rgbOf('Canvas')
      // a — закреплённая колонка, b — обычная.
      for (const column of ['a', 'b']) {
        const head = headCellEl(column)
        const quiet = head.getBoundingClientRect()
        const y = quiet.top + quiet.height / 2
        expectPixel(
          (await snapshot())(quiet.left + 0.5, y),
          canvas,
          `${column}: без наведения контура нет`,
        )
        await userEvent.hover(head)
        await expect
          .poll(() => style(head, '::before').borderTopColor)
          .toBe(sys('Highlight'))
        const shot = await snapshot()
        const box = head.getBoundingClientRect()
        const x = box.left + box.width / 2
        expectPixel(shot(box.left + 0.5, y), highlight, `${column}: левый край`)
        // Край закреплённой колонки — своя граница: контур внутри неё.
        const edge = parseFloat(style(head).borderRightWidth)
        expectPixel(
          shot(box.right - edge - 0.5, y),
          highlight,
          `${column}: правый край`,
        )
        expectPixel(
          shot(x, box.top + 0.5),
          highlight,
          `${column}: верхний край`,
        )
        // Нижний край — над линией под шапкой (HC18), линия остаётся.
        expectPixel(
          shot(x, box.bottom - 1.5),
          highlight,
          `${column}: нижний край`,
        )
        expectPixel(
          shot(x, box.bottom - 0.5),
          rgbOf('GrayText'),
          `${column}: линия под шапкой`,
        )
        expectPixel(shot(box.left + 1.5, y), canvas, `${column}: контур в 1px`)
        // Без заливки: внутри ячейки, правее подписи, — фон палитры.
        expectPixel(
          shot(box.right - edge - 4, y),
          canvas,
          `${column}: без заливки`,
        )
      }
    } finally {
      await page.viewport(414, 896)
    }
  })

  test('HC5: подсветка строки, ячейки и колонки любого тона — фон Mark, текст MarkText', async () => {
    await mount()
    table.highlight({ row: 'r1' }, { tone: 'danger' })
    table.highlight({ cell: ['r3', 'b'] }, { tone: 'success' })
    table.highlight({ column: 'c' }, { tone: 'brand' })
    await frame()
    await frame()
    const row = rowEl('r1')
    await expect.poll(() => style(row).backgroundColor).toBe(sys('Mark'))
    expect(style(textOf(cellEl('r1', 'b'))).color).toBe(sys('MarkText'))
    // Закреплённая ячейка с подложкой повторяет подсветку строки.
    expect(style(cellEl('r1', 'a')).backgroundColor).toBe(sys('Mark'))
    expect(style(row, '::before').content).toBe('none')
    for (const cell of [cellEl('r3', 'b'), cellEl('r5', 'c')]) {
      await expect.poll(() => style(cell).backgroundColor).toBe(sys('Mark'))
      expect(style(textOf(cell)).color).toBe(sys('MarkText'))
    }
  })

  test('HC14: текст на заливках Highlight и Mark — без подложки Canvas в теле, шапке и футере', async () => {
    await mount(['r2'], true)
    selectCell(cellEl('r0', 'b'))
    selectCell(cellEl('r1', 'b'), true)
    table.highlight({ row: 'r4' }, { tone: 'danger' })
    table.highlight({ cell: ['r3', 'b'] }, { tone: 'warning' })
    table.highlight({ column: 'c' }, { tone: 'success' })
    const column = (kind: 'head' | 'footer') =>
      document.querySelector<HTMLElement>(
        `.data-grid__${kind}-cell[data-column-id="c"]`,
      )!
    const cases: [string, HTMLElement, string][] = [
      ['выбранная строка', cellEl('r2', 'b'), 'Highlight'],
      ['выбранная строка, закреплённая', cellEl('r2', 'a'), 'Highlight'],
      ['диапазон', cellEl('r1', 'b'), 'Highlight'],
      ['подсветка строки', cellEl('r4', 'b'), 'Mark'],
      ['подсветка строки, закреплённая', cellEl('r4', 'a'), 'Mark'],
      ['подсветка ячейки', cellEl('r3', 'b'), 'Mark'],
      ['подсветка колонки', cellEl('r5', 'c'), 'Mark'],
      ['подсветка колонки на выбранной строке', cellEl('r2', 'c'), 'Mark'],
      ['подсветка колонки на подсвеченной строке', cellEl('r4', 'c'), 'Mark'],
      ['подсветка колонки, шапка', column('head'), 'Mark'],
      ['подсветка колонки, футер', column('footer'), 'Mark'],
    ]
    // Заливка — у ячейки или, если та прозрачна, у строки; переходит — ждём конечную.
    const fillOf = (cell: HTMLElement) => {
      const own = style(cell).backgroundColor
      const row = cell.closest('.data-grid__body-row')
      return toRgba(own)[3]! > 0.99 || !row ? own : style(row).backgroundColor
    }
    for (const [name, cell, fill] of cases) {
      await expect.poll(() => fillOf(cell), { message: name }).toBe(sys(fill))
    }
    const shot = await snapshot()
    for (const [name, cell, fill] of cases) {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
        acceptNode: node =>
          node.textContent!.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT,
      })
      const text = walker.nextNode()!
      expect
        .soft(style(text.parentElement!).color, `${name}: цвет текста`)
        .toBe(sys(`${fill}Text`))
      const box = textBox(text)
      const target = toRgba(sys(fill))
      // Подложка Canvas закрыла бы заливку под текстом целиком.
      expect
        .soft(fillUnderText(shot, text, sys(fill)), name)
        .toBeGreaterThan(0.25)
      // Заливка рядом с текстом — ровный системный цвет, без слоя тона.
      const aside = shot(box.right + 6, (box.top + box.bottom) / 2)
      expect
        .soft(
          aside.every((value, i) => Math.abs(value - target[i]!) < 8),
          `${name}: заливка ${aside} вместо ${target}`,
        )
        .toBe(true)
    }
  })

  test('FB7: forced-colors — дуга ожидания кнопки цветом Highlight; у кнопки в отказе нет ни отметки, ни заливки Mark', async () => {
    const Button = ({
      pending,
      failed,
    }: {
      pending: boolean
      failed?: boolean
    }) => (
      <div className="data-grid-theme" style={{ padding: 20 }}>
        <IconButton aria-label="Load" pending={pending} failed={failed}>
          <SvgIcon width={20} height={20} />
        </IconButton>
      </div>
    )
    const screen = await render(<Button pending />)
    const button = () => document.querySelector('button')!
    const arc = () => pendingArcOf(button())!
    const highlight = toRgba(sys('Highlight'))
    for (const i of [1, 2, 3, 4]) {
      expect(
        toRgba(tokenIn(button(), `--tsr-comp-pending-spinner-${i}`)),
      ).toEqual(highlight)
    }
    expect(style(arc()).forcedColorAdjust).toBe('none')
    expect(toRgba(style(arcHeadOf(arc())).stroke)).toEqual(highlight)
    // Дорожки нет: бледный `Highlight` — не системный цвет.
    expect(toRgba(style(arcTrackOf(arc())).stroke)[3]).toBe(0)
    await frame()
    await screen.rerender(<Button pending={false} failed />)
    expect(button().querySelector('[data-failure-indicator]')).toBeNull()
    const markRgb = toRgba(sys('Mark'))
    // У кнопки нет ни заливки, ни контура Mark — сигнал момента на цели.
    expect(toRgba(style(button()).backgroundColor)).not.toEqual(markRgb)
    await expect.poll(() => pendingArcOf(button())).toBeNull()
    await screen.unmount()
  })

  test('HC8: линии дерева видны цветом GrayText', async () => {
    await render(<composed.RowExpandingPlayground {...treeLinesArgs} />)
    const cell = () =>
      [...document.querySelectorAll<HTMLElement>('[data-tree-depth]')].find(
        el => {
          const r = el.getBoundingClientRect()
          return r.top > 80 && r.bottom < innerHeight - 10
        },
      )
    await expect.poll(cell).toBeTruthy()
    const target = cell()!
    expect(
      getComputedStyle(target.querySelector('[aria-hidden] > span')!)
        .borderLeftColor,
    ).toBe(sys('GrayText'))
    const box = target.getBoundingClientRect()
    const shot = await snapshot()
    // Горизонталь поворота — на середине строки, от линии родителя до текста.
    const y = box.top + box.height / 2
    // Внутри отступа и отступа содержимого, мимо рамки ячейки.
    const indent = parseFloat(getComputedStyle(target).paddingLeft) + 16
    const xs = Array.from({ length: indent - 3 }, (_, i) => box.left + 3 + i)
    expect(
      xs.some(x => toward(shot(x, y), sys('Canvas'), sys('GrayText'))),
    ).toBe(true)
  })

  test('HC9: полоски скелета видны цветом GrayText', async () => {
    await render(<composed.SkeletonPlayground />)
    const stripe = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '.data-grid__body-cell--skeleton [data-skeleton]',
        ),
      ].find(el => el.getBoundingClientRect().width > 10)
    await expect.poll(stripe).toBeTruthy()
    expect(style(stripe()!).backgroundColor).toBe(sys('GrayText'))
  })

  test('HC10: пункт меню под клавиатурой, выбранный сегмент, включённый Switch и активная кнопка тулбара различимы', async () => {
    const Primitives = () => {
      const [value, setValue] = useState('b')
      return (
        <div className="data-grid-theme" style={{ padding: 20 }}>
          <Segments
            value={value}
            onValueChange={setValue}
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
            ]}
          />
          <Switch checked aria-label="On" />
          <Toolbar.Root>
            <ToolbarButton
              label="Columns"
              active
              icon={<SvgIcon width={20} height={20} />}
            />
          </Toolbar.Root>
        </div>
      )
    }
    const screen = await render(<Primitives />)
    const canvas = toRgba(sys('Canvas'))
    const indicator = document.querySelector<HTMLElement>(
      '[data-segments-indicator]',
    )!
    expect(style(indicator).backgroundColor).toBe(sys('Highlight'))
    const checked = document.querySelector<HTMLElement>(
      '[role="radio"][data-checked]',
    )!
    expect(style(checked).color).toBe(sys('HighlightText'))
    // Подпись выбранного сегмента видна на экране: без подложки Canvas под ней.
    await expect
      .poll(() => style(indicator).backgroundColor)
      .toBe(sys('Highlight'))
    const label = document.createTreeWalker(checked, NodeFilter.SHOW_TEXT)
    let text = label.nextNode()
    while (text && !text.textContent!.trim()) text = label.nextNode()
    expect(
      fillUnderText(await snapshot(), text!, sys('Highlight')),
      'сегмент',
    ).toBeGreaterThan(0.25)
    const on = document.querySelector<HTMLElement>('[role="switch"]')!
    expect(style(on).backgroundColor).toBe(sys('Highlight'))
    const thumb = on.firstElementChild as HTMLElement
    expect(
      contrast(toRgba(style(thumb).backgroundColor), toRgba(sys('Highlight'))),
    ).toBeGreaterThanOrEqual(paletteFloor())
    const active = document.querySelector<HTMLElement>('button[data-active]')!
    expect(style(active).backgroundColor).toBe(sys('Highlight'))
    expect(style(active).color).toBe(sys('HighlightText'))
    expect(
      contrast(toRgba(style(active).backgroundColor), canvas),
    ).toBeGreaterThan(1)
    await screen.unmount()

    // Пункт меню под клавиатурой — кебаб заголовка.
    await render(<composed.HeaderMenuPlayground />)
    // Ленивый триггер заменяет заглушку — кебаб перечитываем.
    const kebab = () =>
      document.querySelector<HTMLElement>(
        `.data-grid__head-cell [aria-label^="${tableLabels.headerMenu}"]`,
      )
    await expect.poll(kebab).not.toBeNull()
    kebab()!.focus()
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .poll(() => document.querySelector('[role="menuitem"][data-highlighted]'))
      .not.toBeNull()
    const item = document.querySelector<HTMLElement>(
      '[role="menuitem"][data-highlighted]',
    )!
    // Фон пункта переходит (токен перехода пунктов) — ждём конечный.
    await expect.poll(() => style(item).backgroundColor).toBe(sys('Highlight'))
    expect(style(item).color).toBe(sys('HighlightText'))
  })
})

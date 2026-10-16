import { Toolbar } from '@base-ui/react/toolbar'
import { useMemo, useState } from 'react'
import { commands, page, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellSelection,
  columnPinning,
  keyboardNavigation,
  rowSelection,
} from '../../../plugins'
import type {
  HighlightOptions,
  HighlightTarget,
} from '../../../core/highlights/highlightFeature'
import { IconButton } from '@/lib/ui/IconButton'
import { Segments } from '@/lib/ui/Segments'
import { Switch } from '@/lib/ui/Switch'
import { ToolbarButton } from '@/lib/ui/ToolbarButton'
import { SvgIcon } from '@/lib/ui/icons'
import { renderGrid } from '../helpers'
import { submittedCellsSeed } from '../performance/perf-cases'
import { composed } from '../stories'
import { contrast, toRgba } from './a11y-helpers'

// Высокая контрастность Windows (ADR 0087, HC1–HC10, HC13): эмуляция
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

/** Части значения через запятую верхнего уровня; у тени — её цвет. */
const topLevelParts = (value: string) => {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth--
    else if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  parts.push(value.slice(start))
  return parts.map(part => part.replace(/\s*-?[\d.]+px/g, '').trim())
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

const Grid = ({ selected = [] as string[] }) => {
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
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    state: { columnPinning: { start: ['a'], end: [] } },
    plugins: [
      columnPinning(),
      rowSelection({
        rowSelection: Object.fromEntries(selected.map(id => [id, true])),
      }),
      cellSelection(),
      keyboardNavigation(),
    ] as never,
  }) as unknown as Api
  return (
    <div style={{ width: 520, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const mount = async (selected: string[] = []) => {
  const screen = await render(<Grid selected={selected} />)
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

  test('HC3: кольцо фокуса активной ячейки видно на выбранной строке и в диапазоне — контраст к Highlight ≥ 3:1', async () => {
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
  })

  test('HC4: наведение строки — контур 1px Highlight без заливки', async () => {
    await mount()
    await userEvent.hover(cellEl('r3', 'b'))
    const row = rowEl('r3')
    // Цвет контура строки переходит (токен перехода строки) — ждём конечный.
    await expect.poll(() => style(row).outlineColor).toBe(sys('Highlight'))
    expect(style(row).outlineStyle).toBe('solid')
    expect(style(row).outlineWidth).toBe('1px')
    expect(style(row).backgroundColor).toBe(sys('Canvas'))
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

  test('HC6: свет ожидания кнопки — цветом Highlight; ошибка — ровный свет цветом Mark', async () => {
    const Button = ({
      pending,
      flash,
    }: {
      pending: boolean
      flash: number
    }) => (
      <div className="data-grid-theme" style={{ padding: 20 }}>
        <IconButton aria-label="Load" pending={pending} errorFlash={flash}>
          <SvgIcon width={20} height={20} />
        </IconButton>
      </div>
    )
    const screen = await render(<Button pending flash={0} />)
    const button = () => document.querySelector('button')!
    const ring = () => style(button(), '::after')
    const highlight = toRgba(sys('Highlight'))
    for (const i of [1, 2, 3, 4]) {
      expect(toRgba(tokenIn(button(), `--tsr-comp-pending-glow-${i}`))).toEqual(
        highlight,
      )
    }
    expect(ring().forcedColorAdjust).toBe('none')
    expect(ring().boxShadow).not.toBe('none')
    await frame()
    await screen.rerender(<Button pending={false} flash={1} />)
    expect(button().getAttribute('data-error-flash')).toBe('on')
    await expect
      .poll(() => parseFloat(ring().getPropertyValue('--tsr-ring-fill')))
      .toBe(100)
    // Ровный слой ошибки — пятый в списке теней.
    expect(toRgba(topLevelParts(ring().boxShadow)[4]!)).toEqual(
      toRgba(sys('Mark')),
    )
  })

  test('HC7: свет ячейки в правке — те же цвета: ожидание Highlight, ошибка Mark', async () => {
    await renderGrid({
      columnCount: 6,
      dataCount: 20,
      enableCellEditing: true,
      extraPlugins: [submittedCellsSeed(20, 'pending')],
    })
    const layer = () =>
      document.querySelector<HTMLElement>('.cell-edit-feedback[data-pending]')
    await expect.poll(layer).not.toBeNull()
    for (const i of [1, 2, 3, 4]) {
      expect(toRgba(tokenIn(layer()!, `--tsr-comp-pending-glow-${i}`))).toEqual(
        toRgba(sys('Highlight')),
      )
    }
    expect(toRgba(tokenIn(layer()!, '--tsr-comp-error-flash-glow'))).toEqual(
      toRgba(sys('Mark')),
    )
    expect(style(layer()!, '::after').forcedColorAdjust).toBe('none')
    expect(style(layer()!, '::after').backgroundImage).not.toBe('none')
  })

  test('HC8: линии дерева видны цветом GrayText', async () => {
    await render(<composed.RowExpandingTreeLines />)
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
    await render(<composed.SkeletonDefault />)
    const stripe = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '.data-grid__body-cell--skeleton [class*="skeleton"]',
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
      '[class*="indicator"]',
    )!
    expect(style(indicator).backgroundColor).toBe(sys('Highlight'))
    const checked = document.querySelector<HTMLElement>(
      '[role="radio"][data-checked]',
    )!
    expect(style(checked).color).toBe(sys('HighlightText'))
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
    await render(<composed.HeaderActionMenu />)
    // Ленивый триггер заменяет заглушку — кебаб перечитываем.
    const kebab = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__head-cell [aria-label^="Column options"]',
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

  test('HC13: история «High contrast» — все состояния на одном экране', async () => {
    await render(<composed.HighContrast />)
    await expect
      .poll(() =>
        document.querySelector('.data-grid__body-row[data-selected="true"]'),
      )
      .not.toBeNull()
    const selected = document.querySelector<HTMLElement>(
      '.data-grid__body-row[data-selected="true"]',
    )!
    await expect
      .poll(() => style(selected).backgroundColor)
      .toBe(sys('Highlight'))
    await expect
      .poll(() =>
        document.querySelector('.data-grid__body-row[data-highlight]'),
      )
      .not.toBeNull()
    expect(document.querySelector('[data-tree-depth]')).not.toBeNull()
  })
})

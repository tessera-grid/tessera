import { useMemo } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellSelection, columnPinning } from '../../../plugins'
import { toRgba } from './a11y-helpers'

// Вид закреплённого блока при прилипании (ADR 0011, 2026-10-31): тон, разделитель и тень —
// только когда под блоком прокручено содержимое (CP39); скругления концов края и тень в
// сторону прокрутки (CP40).

const IDS = ['a', 'b', 'c', 'd', 'e', 'f']
const ROWS = Array.from({ length: 30 }, (_, i) => ({
  id: `r${i}`,
  ...Object.fromEntries(IDS.map(id => [id, `${id}${i}`])),
}))

const NO_SIZING = {}

/** Слева закреплены a и b, справа — f. */
const Grid = ({
  size = 150,
  footer = false,
  select = false,
  sizing = NO_SIZING,
}: {
  size?: number
  footer?: boolean
  select?: boolean
  /** Ширины колонок срезом приложения. */
  sizing?: Record<string, number>
}) => {
  const columns = useMemo(
    () =>
      IDS.map(id => ({
        id,
        accessorKey: id,
        header: id.toUpperCase(),
        footer: () => `Σ${id}`,
        size,
      })),
    [size],
  )
  const table = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: { id: string }) => row.id,
    state: {
      columnPinning: { start: ['a', 'b'], end: ['f'] },
      columnSizing: sizing,
    },
    enableFooter: footer,
    plugins: [columnPinning(), ...(select ? [cellSelection()] : [])] as never,
  } as never)
  return (
    <div style={{ width: 600, height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector)!
const container = () => q('.data-grid__container')
const rowEl = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
const cellEl = (row: string, column: string) =>
  rowEl(row).querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!
const headEl = (column: string) =>
  q(`.data-grid__head-cell[data-column-id="${column}"]`)
const footEl = (column: string) =>
  q(`.data-grid__footer-cell[data-column-id="${column}"]`)
const style = (el: Element) => getComputedStyle(el)
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
const scrollLeft = async (left: number) => {
  container().scrollLeft = left
  await nextFrame()
  await nextFrame()
}
/** Переходы фона закончились. */
const settle = async () => {
  await Promise.all(
    container()
      .getAnimations({ subtree: true })
      .filter(a => a.effect?.getTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => undefined)),
  )
}
const transparent = (color: string) => toRgba(color)[3] === 0
/** Цвет токена в контексте элемента. */
const tokenIn = (el: Element, name: string) =>
  style(el).getPropertyValue(name).trim()

/** Пиксели скриншота в CSS-координатах окна. */
const snapshot = async () => {
  const shot = (await page.screenshot({
    base64: true,
    save: false,
  })) as unknown as string | { base64: string }
  const image = new Image()
  image.src = `data:image/png;base64,${typeof shot === 'string' ? shot : shot.base64}`
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
const sum = (rgb: number[]) => rgb[0]! + rgb[1]! + rgb[2]!

describe('вид прилипшего закреплённого блока (ADR 0011)', () => {
  test('CP39: тон, разделитель и тень закреплённого блока — только когда под ним прокручено содержимое; иначе фон строки и прозрачный разделитель той же ширины; смена ширин колонок пересчитывает признак', async () => {
    /** Блок выглядит как обычные колонки: фон строки, разделитель прозрачный. */
    const plain = (column: string, side: 'Right' | 'Left') => {
      for (const row of ['r0', 'r1']) {
        const cell = cellEl(row, column)
        expect(style(cell).backgroundColor, `${column} ${row}`).toBe(
          style(rowEl(row)).backgroundColor,
        )
      }
      const cell = cellEl('r0', column)
      expect(style(cell)[`border${side}Width`]).toBe('1px')
      expect(transparent(style(cell)[`border${side}Color`])).toBe(true)
      expect(style(cell).boxShadow).toBe('none')
    }
    /** Блок прилип: тон отличается от строки, разделитель и тень видны. */
    const stuck = (column: string, side: 'Right' | 'Left') => {
      for (const row of ['r0', 'r1']) {
        const cell = cellEl(row, column)
        expect(style(cell).backgroundColor, `${column} ${row}`).not.toBe(
          style(rowEl(row)).backgroundColor,
        )
      }
      const cell = cellEl('r0', column)
      expect(style(cell)[`border${side}Width`]).toBe('1px')
      expect(transparent(style(cell)[`border${side}Color`])).toBe(false)
      expect(style(cell).boxShadow).not.toBe('none')
    }

    const screen = await render(<Grid />)
    try {
      await expect.poll(() => cellEl('r1', 'b')).toBeTruthy()
      // В начале: левый блок как колонки, правый прилип — справа есть содержимое.
      await settle()
      plain('b', 'Right')
      stuck('f', 'Left')

      // Прокрутка от начала: прилип и левый.
      await scrollLeft(100)
      await settle()
      stuck('b', 'Right')
      stuck('f', 'Left')

      // В конце: правый как колонки.
      await scrollLeft(container().scrollWidth)
      await settle()
      stuck('b', 'Right')
      plain('f', 'Left')
    } finally {
      await screen.unmount()
    }

    // Колонки уже области: прокручивать нечего — оба блока как колонки. Шире — без
    // прокрутки правый блок прилипает.
    const narrow = await render(<Grid size={80} />)
    try {
      await expect.poll(() => cellEl('r1', 'b')).toBeTruthy()
      await settle()
      plain('b', 'Right')
      plain('f', 'Left')
      const SIZING = { c: 400 }
      await narrow.rerender(<Grid size={80} sizing={SIZING} />)
      await expect
        .poll(() => container().hasAttribute('data-pinned-right-stuck'))
        .toBe(true)
      expect(container().scrollLeft).toBe(0)
      await settle()
      stuck('f', 'Left')
      plain('b', 'Right')
    } finally {
      await narrow.unmount()
    }
  })

  test('CP40: концы края прилипшего блока скруглены токеном — заголовок первого ряда шапки сверху, последняя строка или футер снизу; тень — только в сторону прокручиваемых колонок, огибает угол; у выбранной ячейки — вместе с кромками выделения', async () => {
    const screen = await render(<Grid select />)
    try {
      await expect.poll(() => cellEl('r1', 'b')).toBeTruthy()
      await scrollLeft(100)
      await settle()
      const radius = tokenIn(container(), '--tsr-comp-sticky-radius')
      const probe = document.createElement('div')
      probe.style.borderTopLeftRadius = radius
      container().append(probe)
      const want = style(probe).borderTopLeftRadius
      probe.remove()
      expect(want).not.toBe('0px')

      // Сверху — заголовок у края блока; соседний закреплённый — без скругления.
      expect(style(headEl('b')).borderTopRightRadius).toBe(want)
      expect(style(headEl('a')).borderTopRightRadius).toBe('0px')
      expect(style(headEl('f')).borderTopLeftRadius).toBe(want)
      // Снизу — последняя строка.
      container().scrollTop = container().scrollHeight
      await expect.poll(() => rowEl('r29')).toBeTruthy()
      await settle()
      expect(style(cellEl('r29', 'b')).borderBottomRightRadius).toBe(want)
      expect(style(cellEl('r28', 'b')).borderBottomRightRadius).toBe('0px')
      expect(style(cellEl('r29', 'f')).borderBottomLeftRadius).toBe(want)

      // Тень — вправо от края, соседняя закреплённая колонка не затенена; угол затенён.
      const shot = await snapshot()
      const edge = cellEl('r27', 'b').getBoundingClientRect()
      const y = edge.top + edge.height / 2
      const rowBg = sum(shot(edge.right + 40, y))
      expect(sum(shot(edge.right + 2, y))).toBeLessThan(rowBg - 6)
      const a = cellEl('r27', 'a').getBoundingClientRect()
      expect(sum(shot(a.right - 2, y))).toBe(sum(shot(a.left + 10, y)))
      const corner = cellEl('r29', 'b').getBoundingClientRect()
      const fill = sum(shot(corner.right - 30, corner.top + 10))
      expect(sum(shot(corner.right - 1.5, corner.bottom - 1.5))).toBeLessThan(
        fill - 4,
      )

      // Выбранная ячейка у края: кромки выделения и тень вместе.
      const cell = cellEl('r27', 'b')
      const init = { bubbles: true, cancelable: true, button: 0 }
      cell.dispatchEvent(new MouseEvent('mousedown', init))
      document.dispatchEvent(new MouseEvent('mouseup', init))
      await expect.poll(() => cell.dataset.cellSelected).toBe('true')
      const shadow = style(cell).boxShadow
      expect(shadow).toContain('inset')
      expect(shadow).toContain('-4px 0px 8px 8px')
    } finally {
      await screen.unmount()
    }

    // С футером конец блока снизу — его ячейка, а не последняя строка.
    const footed = await render(<Grid footer />)
    try {
      await expect.poll(() => footEl('b')).toBeTruthy()
      await scrollLeft(100)
      container().scrollTop = container().scrollHeight
      await expect.poll(() => rowEl('r29')).toBeTruthy()
      await settle()
      const want = style(headEl('b')).borderTopRightRadius
      expect(style(footEl('b')).borderBottomRightRadius).toBe(want)
      expect(style(footEl('f')).borderBottomLeftRadius).toBe(want)
      expect(style(cellEl('r29', 'b')).borderBottomRightRadius).toBe('0px')
    } finally {
      await footed.unmount()
    }
  })
})

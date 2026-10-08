import { commands } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'
import {
  HANDLE,
  ROW,
  SCROLLER,
  nextFrame,
  rowIdOrder,
  sortedRows,
} from '../../rowDragging.dnd'

// Перетаскивание строки через границу окна виртуализатора (ADR 0006, D35–D36):
// `SortableContext` получает id только строк окна, при автопрокрутке окно и список
// сдвигаются вместе. Настоящая мышь Playwright (ADR 0043, TQ3).

interface Point {
  x: number
  y: number
}

const pointer = commands as unknown as {
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
}

const center = (element: Element): Point => {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * Вертикальное смещение строки dnd-kit из инлайн-transform
 * `translate3d(var(--…-offset-left, 0px), Ypx, 0px)`: второй аргумент с конца.
 */
const shiftY = (row: HTMLElement) => {
  const match = /,\s*(-?[\d.]+)px,\s*0px\)$/.exec(row.style.transform)
  return match ? Math.round(Number(match[1])) : 0
}

/**
 * Перетащить первую строку к нижнему краю, держать, пока автопрокрутка не уведёт
 * окно на `rows` строк ниже, и увести указатель в середину — прокрутка встаёт.
 */
const dragPastWindow = async (rows = 5) => {
  const { container } = await render(<composed.RowDragging />)
  await expect
    .poll(() => container.querySelectorAll(ROW).length)
    .toBeGreaterThan(3)
  const scroller = container.querySelector<HTMLElement>(SCROLLER)!
  scroller.scrollTop = 0
  await nextFrame()

  const source = sortedRows(container)[0]
  const sourceId = source.getAttribute('data-row-id')
  const rowHeight = source.getBoundingClientRect().height
  const box = scroller.getBoundingClientRect()
  const bottom = { x: box.left + box.width / 2, y: box.bottom - 4 }
  const middle = { x: bottom.x, y: box.top + box.height / 2 }

  await pointer.realDragHold(center(source.querySelector(HANDLE)!), bottom)
  await expect
    .poll(() => scroller.scrollTop, { timeout: 10_000 })
    .toBeGreaterThan(rowHeight * rows)
  await pointer.realMouseMove(bottom, middle, 6)
  for (let i = 0; i < 6; i++) {
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
  }
  return { container, scroller, sourceId, rowHeight }
}

describe('Перетаскивание строки через границу окна', () => {
  test('D35: настоящее перетаскивание вниз через границу окна с автопрокруткой ставит строку на верный индекс', async () => {
    const { container, sourceId, rowHeight } = await dragPastWindow()
    // Над-строка — последняя строка, сдвинутая на высоту строки вверх.
    const over = sortedRows(container)
      .filter(row => row.getAttribute('data-row-id') !== sourceId)
      .filter(row => shiftY(row) === -Math.round(rowHeight))
      .at(-1)
    const targetId = over!.getAttribute('data-row-id')
    await pointer.realMouseUp()

    await expect
      .poll(() => {
        const order = rowIdOrder(container)
        const source = order.indexOf(sourceId)
        const target = order.indexOf(targetId)
        return source !== -1 && target !== -1 && source > target
      })
      .toBe(true)
  })

  test('D36: во время удержания после автопрокрутки строки до над-строки сдвинуты на высоту строки, остальные — на месте', async () => {
    const { container, sourceId, rowHeight } = await dragPastWindow()
    try {
      for (let frame = 0; frame < 8; frame++) {
        const shifts = sortedRows(container)
          .filter(row => row.getAttribute('data-row-id') !== sourceId)
          .map(shiftY)
        // Только «на месте» или «на строку вверх»; сдвинутые — сплошной префикс окна.
        expect(
          shifts.every(
            shift => shift === 0 || shift === -Math.round(rowHeight),
          ),
          `кадр ${frame}: ${shifts.join(',')}`,
        ).toBe(true)
        const firstStill = shifts.indexOf(0)
        const tail = firstStill === -1 ? [] : shifts.slice(firstStill)
        expect(
          tail.every(shift => shift === 0),
          `кадр ${frame}: ${shifts.join(',')}`,
        ).toBe(true)
        expect(shifts[0], `кадр ${frame}`).toBe(-Math.round(rowHeight))
        // eslint-disable-next-line no-await-in-loop
        await nextFrame()
      }
    } finally {
      await pointer.realMouseUp()
    }
  })
})

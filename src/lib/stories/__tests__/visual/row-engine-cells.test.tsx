import { describe, expect, test } from 'vitest'

import { SEL, bodyRows } from '../helpers'
import { renderPluginsGrid } from '../performance/hosts'
import { bodyCellsOf, nextFrame, waitForGrid } from './core-helpers'

// EN14: ячейки окна колонок (ADR 0200). Тело создаёт ячейку, когда её рисует, а не все
// видимые ячейки строки разом.

type ProbeTable = {
  getRowModel: () => { rows: object[] }
}

const ASKS = ['getAllCells', 'getVisibleCells'] as const

describe('Ячейки окна колонок (ADR 0200)', () => {
  test('EN14: тело не просит у строки все её ячейки — на 1000×1000 строки, смонтированные прокруткой вниз и вбок, создают ячейки только для колонок окна', async () => {
    const box: { table?: ProbeTable } = {}
    await renderPluginsGrid({
      columnCount: 1000,
      dataCount: 1000,
      plugins: [
        {
          id: 'tableProbe',
          setup: (table: ProbeTable) => {
            box.table = table
          },
        } as never,
      ],
    })
    await waitForGrid()
    const proto = Object.getPrototypeOf(
      box.table!.getRowModel().rows[0],
    ) as Record<(typeof ASKS)[number], (this: { id: string }) => unknown>
    const own = ASKS.map(name => proto[name])
    const asked = new Set<string>()
    ASKS.forEach((name, i) => {
      proto[name] = function () {
        asked.add(this.id)
        return own[i]!.call(this)
      }
    })
    try {
      const scroller = document.querySelector<HTMLElement>(SEL.scroller)!
      const firstIndex = () => bodyRows()[0]!.getAttribute('aria-rowindex')
      const before = firstIndex()
      scroller.scrollTop = scroller.scrollHeight / 2
      await nextFrame()
      await nextFrame()
      await expect.poll(firstIndex).not.toBe(before)
      scroller.scrollLeft = scroller.scrollWidth / 2
      await nextFrame()
      await nextFrame()

      const rendered = bodyRows().map(row => bodyCellsOf(row).length)
      expect(Math.max(...rendered)).toBeLessThan(100)
      expect([...asked]).toEqual([])
    } finally {
      ASKS.forEach((name, i) => {
        proto[name] = own[i]!
      })
    }
  })
})

import { page } from 'vitest/browser'
import { cleanup } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  BODY_CELL,
  headCellById,
  pinViaPopover,
  renderColumnPinning,
  renderHeaderGroupsPinning,
  scrollerOf,
  withWideViewport,
} from './column-pinning-helpers'

// CP31–CP33: футер следует закреплению колонок (ADR 0011).

const FOOTER_CELL = '.data-grid__footer-cell'

/** `[left, width]` ячейки футера и первой ячейки тела той же колонки, px. */
const footerVsBody = (container: HTMLElement) => {
  const box = (el: Element | null) => {
    if (!el) return null
    const { left, width } = el.getBoundingClientRect()
    return [Math.round(left), Math.round(width)]
  }
  const row = container.querySelector('.data-grid__body-row')!
  return Array.from(row.querySelectorAll<HTMLElement>(BODY_CELL)).map(cell => {
    const id = cell.getAttribute('data-column-id')
    const footer = container.querySelector(
      `${FOOTER_CELL}[data-column-id='${id}']`,
    )
    return { id, footer: box(footer), body: box(cell) }
  })
}

const footerCell = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(
    `${FOOTER_CELL}[data-column-id='${id}']`,
  )!

const scrollTo = async (container: HTMLElement, left: number) => {
  const scroller = scrollerOf(container)
  scroller.scrollLeft = left
  await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(0)
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
}

describe('Column Pinning — footer', () => {
  test('CP31: footer cells of left- and right-pinned columns stick with their body columns on horizontal scroll and carry an opaque backing', async () => {
    const container = await renderColumnPinning({ enableFooter: true })
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin left')
    await pinViaPopover(headCellById(container, 'lastName'), 'Pin right')
    await expect
      .poll(() =>
        footerCell(container, 'lastName')?.getAttribute('data-cell-pinned'),
      )
      .toBe('right')
    expect(
      footerCell(container, 'firstName').getAttribute('data-cell-pinned'),
    ).toBe('left')

    await scrollTo(container, 400)
    for (const { id, footer, body } of footerVsBody(container)) {
      if (id === 'firstName' || id === 'lastName')
        expect(footer, id!).toEqual(body)
    }
    for (const id of ['firstName', 'lastName']) {
      expect(
        getComputedStyle(footerCell(container, id)).backgroundColor,
        id,
      ).not.toBe('rgba(0, 0, 0, 0)')
    }
  })

  test('CP32: under nested headers, footer cells of left- and right-pinned groups stick with their body columns on horizontal scroll', async () => {
    const { innerWidth, innerHeight } = window
    // Обе группы и прокрутка между ними: вьюпорт шире группы, но уже грида.
    await page.viewport(900, innerHeight)
    try {
      const container = await renderHeaderGroupsPinning({ enableFooter: true })
      await pinViaPopover(headCellById(container, 'name'), 'Pin left')
      await pinViaPopover(headCellById(container, 'info'), 'Pin right')
      await expect
        .poll(() =>
          footerCell(container, 'gender')?.getAttribute('data-cell-pinned'),
        )
        .toBe('right')
      expect(scrollerOf(container).scrollWidth).toBeGreaterThan(
        scrollerOf(container).clientWidth,
      )

      await scrollTo(container, 200)
      for (const { id, footer, body } of footerVsBody(container)) {
        expect(footer, id!).toEqual(body)
      }
    } finally {
      await page.viewport(innerWidth, innerHeight)
    }
  })

  test('CP33: with free space on the right, right-pinned footer cells keep the left edge and width of their body columns, flat and nested', async () => {
    await withWideViewport(async () => {
      const flat = await renderColumnPinning({
        columnCount: 5,
        enableFooter: true,
      })
      await pinViaPopover(headCellById(flat, 'lastName'), 'Pin right')
      await expect
        .poll(() =>
          footerCell(flat, 'lastName')?.getAttribute('data-cell-pinned'),
        )
        .toBe('right')
      expect(scrollerOf(flat).scrollWidth).toBeLessThanOrEqual(
        scrollerOf(flat).clientWidth,
      )
      for (const { id, footer, body } of footerVsBody(flat)) {
        expect(footer, id!).toEqual(body)
      }
      await cleanup()

      const nested = await renderHeaderGroupsPinning({ enableFooter: true })
      await pinViaPopover(headCellById(nested, 'info'), 'Pin right')
      await expect
        .poll(() =>
          footerCell(nested, 'gender')?.getAttribute('data-cell-pinned'),
        )
        .toBe('right')
      expect(scrollerOf(nested).scrollWidth).toBeLessThanOrEqual(
        scrollerOf(nested).clientWidth,
      )
      for (const { id, footer, body } of footerVsBody(nested)) {
        expect(footer, id!).toEqual(body)
      }
    })
  })
})

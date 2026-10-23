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
import { tableLabels } from '../labels'

// CP31–CP33, CP35: футер следует закреплению колонок (ADR 0011).

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
    await pinViaPopover(
      headCellById(container, 'firstName'),
      tableLabels.pinLeft,
    )
    await pinViaPopover(
      headCellById(container, 'lastName'),
      tableLabels.pinRight,
    )
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
      await pinViaPopover(headCellById(container, 'name'), tableLabels.pinLeft)
      await pinViaPopover(headCellById(container, 'info'), tableLabels.pinRight)
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
      await pinViaPopover(headCellById(flat, 'lastName'), tableLabels.pinRight)
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
      await pinViaPopover(headCellById(nested, 'info'), tableLabels.pinRight)
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

  test('CP35: the footer cell of the row-actions column behaves like its header cell — alone on the right it does not cover data on horizontal scroll; with a user right pin it sticks with an opaque backing', async () => {
    const container = await renderColumnPinning({
      enableFooter: true,
      enableRowActions: true,
    })
    const ACTIONS = "[data-actions-column-cell='true']"
    const footerActions = () =>
      container.querySelector<HTMLElement>(`${FOOTER_CELL}${ACTIONS}`)!
    const headActions = () =>
      container.querySelector<HTMLElement>(`.data-grid__head-cell${ACTIONS}`)!
    await expect.poll(footerActions).not.toBeNull()
    const scroller = scrollerOf(container)
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth + 400)

    // Действия — единственные справа: у правого края видны данные, как в шапке.
    await scrollTo(container, 400)
    const edge = scroller.getBoundingClientRect().right - 12
    const cellAt = (row: HTMLElement, selector: string) => {
      const box = row.getBoundingClientRect()
      return document
        .elementFromPoint(edge, box.top + box.height / 2)
        ?.closest<HTMLElement>(selector)
    }
    const headAtEdge = cellAt(
      headActions().parentElement!,
      '.data-grid__head-cell',
    )
    const footAtEdge = cellAt(footerActions().parentElement!, FOOTER_CELL)
    expect(headAtEdge?.getAttribute('data-actions-column-cell')).not.toBe(
      'true',
    )
    expect(footAtEdge).toBeTruthy()
    expect(footAtEdge!.getAttribute('data-actions-column-cell')).not.toBe(
      'true',
    )
    expect(footAtEdge!.getAttribute('data-column-id')).toBe(
      headAtEdge?.getAttribute('data-column-id'),
    )

    // Пользовательский правый пин: действия входят в правый блок — закреплены с подложкой.
    scroller.scrollLeft = 0
    await pinViaPopover(
      headCellById(container, 'lastName'),
      tableLabels.pinRight,
    )
    await expect
      .poll(() =>
        footerCell(container, 'lastName')?.getAttribute('data-cell-pinned'),
      )
      .toBe('right')
    await scrollTo(container, 400)
    const box = (el: HTMLElement) => {
      const { left, width } = el.getBoundingClientRect()
      return [Math.round(left), Math.round(width)]
    }
    expect(box(footerActions())).toEqual(box(headActions()))
    expect(getComputedStyle(footerActions()).backgroundColor).not.toBe(
      'rgba(0, 0, 0, 0)',
    )
  })
})

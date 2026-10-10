import { describe, expect, test } from 'vitest'

import { renderColumnPinning, scrollerOf } from './column-pinning-helpers'

// CB7: строка футера — свой бокс (ADR 0084). Строку на `display: contents` Safari до 17
// убирает из дерева доступности; раскладку футера по-прежнему держат CP31–CP33.

describe('Строка футера', () => {
  test('CB7: строка футера — бокс с role="row" на всю ширину содержимого, в ней все ячейки футера', async () => {
    const container = await renderColumnPinning({ enableFooter: true })
    const footer = container.querySelector<HTMLElement>('.data-grid__footer')!
    const row = footer.querySelector<HTMLElement>(':scope > [role="row"]')!
    expect(getComputedStyle(row).display).not.toBe('contents')

    const cells = footer.querySelectorAll('.data-grid__footer-cell')
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.closest('[role="row"]')).toBe(row)
    }

    const box = row.getBoundingClientRect()
    expect(box.height).toBeCloseTo(footer.getBoundingClientRect().height, 0)
    expect(box.width).toBeGreaterThanOrEqual(
      scrollerOf(container).scrollWidth - 1,
    )
  })
})

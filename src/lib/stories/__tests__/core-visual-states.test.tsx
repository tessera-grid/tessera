import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { renderGrid } from './helpers'
import {
  bodyCellsOf,
  headCellsLeftRight,
  resolveVarColor,
  rowsTopDown,
  waitForGrid,
} from './core-helpers'

// R13–R16 из docs/decisions/0004-core-on-tanstack-table.md: визуальные состояния.
// Каждое требование — отдельный именованный тест `R<n>`. Тесты, поднимающие
// CSS-`:hover`, снимают его в finally, чтобы курсор не оставался над ячейкой.

describe('Ядро на TanStack — визуальные состояния', () => {
  test('R13: наведение на заголовок красит фон в --data-grid-head-cell-hovered-bg', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const head = headCellsLeftRight()[0]
    const before = getComputedStyle(head).backgroundColor
    const expected = resolveVarColor('--data-grid-head-cell-hovered-bg')

    try {
      await userEvent.hover(head)
      await expect
        .poll(() => getComputedStyle(head).backgroundColor)
        .toBe(expected)
      expect(getComputedStyle(head).backgroundColor).not.toBe(before)
    } finally {
      await userEvent.unhover(head)
    }
  })

  test('R14: наведение на строку красит фон в --data-grid-row-hovered-bg', async () => {
    renderGrid({ columnCount: 3, dataCount: 4 })
    await waitForGrid()

    const row = rowsTopDown()[0]
    const before = getComputedStyle(row).backgroundColor
    const expected = resolveVarColor('--data-grid-row-hovered-bg')

    try {
      await userEvent.hover(row)
      await expect
        .poll(() => getComputedStyle(row).backgroundColor)
        .toBe(expected)
      expect(getComputedStyle(row).backgroundColor).not.toBe(before)
    } finally {
      await userEvent.unhover(row)
    }
  })

  test('R15: наведение на ячейку обводит её аутлайном (--data-grid-cell-outline-color, offset -1px)', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const cell = bodyCellsOf(rowsTopDown()[0])[0]
    const expected = resolveVarColor('--data-grid-cell-outline-color')

    try {
      await userEvent.hover(cell)
      await expect
        .poll(() => getComputedStyle(cell).outlineStyle)
        .toBe('solid')
      const style = getComputedStyle(cell)
      expect(style.outlineWidth).toBe('1px')
      expect(style.outlineColor).toBe(expected)
      expect(style.outlineOffset).toBe('-1px')
    } finally {
      await userEvent.unhover(cell)
    }
  })

  test('R16: нечётные строки имеют отличный фон (зебра)', async () => {
    renderGrid({ columnCount: 3, dataCount: 6 })
    await waitForGrid()

    const rows = rowsTopDown()
    const oddRow = rows.find(r => r.getAttribute('data-row-odd') === 'true')!
    const evenRow = rows.find(r => r.getAttribute('data-row-odd') === 'false')!

    const oddBg = getComputedStyle(oddRow).backgroundColor
    const evenBg = getComputedStyle(evenRow).backgroundColor

    expect(oddBg).toBe(resolveVarColor('--data-grid-row-odd-bg'))
    expect(evenBg).toBe(resolveVarColor('--data-grid-row-bg'))
    expect(oddBg).not.toBe(evenBg)
  })
})

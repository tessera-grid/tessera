import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { renderGrid } from '../helpers'
import { bodyCellsOf, rowsTopDown, waitForGrid } from './core-helpers'

// R15–R16 из docs/decisions/0004-core-on-tanstack-table.md — СТРУКТУРНАЯ часть
// визуальных состояний (геометрия аутлайна, факт зебры). ЦВЕТ этих состояний
// (`hovered-bg`, `outline-color`, `row-odd/row-bg` = токен) — зона темизации
// (ADR 0009 R-B2/R-B4): см. `theming-matrix.test.tsx` TT-01/02/03/06/13. Прежние
// R13/R14 (чистый цвет hover) целиком покрыты TT-13/TT-03 и здесь удалены.
// Тесты, поднимающие CSS-`:hover`, снимают его в finally.

describe('Ядро на TanStack — визуальные состояния (структура)', () => {
  test('R15: наведение на ячейку обводит её аутлайном (solid, 1px, offset -1px)', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const cell = bodyCellsOf(rowsTopDown()[0])[0]

    try {
      await userEvent.hover(cell)
      await expect
        .poll(() => getComputedStyle(cell).outlineStyle)
        .toBe('solid')
      const style = getComputedStyle(cell)
      // Геометрия аутлайна — структурный контракт ядра; цвет — в TT-06.
      expect(style.outlineWidth).toBe('1px')
      expect(style.outlineOffset).toBe('-1px')
    } finally {
      await userEvent.unhover(cell)
    }
  })

  test('R16: признак зебры `data-row-odd` следует чётности индекса (структура)', async () => {
    renderGrid({ columnCount: 3, dataCount: 6 })
    await waitForGrid()

    const rows = rowsTopDown()
    // Структура зебры — чистый DOM, без чтения цвета: у каждой строки признак
    // `data-row-odd` = чётность её `data-index`. Что row-bg ≠ row-odd-bg (зебра
    // ВИДИМА, различие токенов) — инвариант темизации (theming-matrix).
    rows.forEach(row => {
      const index = Number(row.getAttribute('data-index'))
      expect(row.getAttribute('data-row-odd')).toBe(
        index % 2 === 1 ? 'true' : 'false',
      )
    })
    expect(rows.some(r => r.getAttribute('data-row-odd') === 'true')).toBe(true)
    expect(rows.some(r => r.getAttribute('data-row-odd') === 'false')).toBe(true)
  })
})

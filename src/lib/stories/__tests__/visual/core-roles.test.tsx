import { describe, expect, test } from 'vitest'

import { bodyRows, headCells, renderGrid } from '../helpers'
import { bodyCellsOf, waitForGrid } from './core-helpers'

// R10–R12 из docs/decisions/0004-core-on-tanstack-table.md: базовые роли и
// атрибуты доступности. Каждое требование — отдельный именованный тест `R<n>`.

describe('Ядро на TanStack — роли и атрибуты', () => {
  test('R10: выставлены базовые роли (table/rowgroup/row/columnheader)', async () => {
    // Футер включён, чтобы проверить все три rowgroup (head/body/footer).
    renderGrid({ columnCount: 3, dataCount: 3, enableFooter: true })
    await waitForGrid()

    expect(document.querySelector('[role="table"]')).not.toBeNull()

    const rowgroups = document.querySelectorAll('[role="rowgroup"]')
    expect(rowgroups.length).toBe(3)
    expect(
      document.querySelector('.data-grid__head[role="rowgroup"]'),
    ).not.toBeNull()
    expect(
      document.querySelector('.data-grid__body[role="rowgroup"]'),
    ).not.toBeNull()

    expect(bodyRows().every(r => r.getAttribute('role') === 'row')).toBe(true)
    expect(
      headCells().every(h => h.getAttribute('role') === 'columnheader'),
    ).toBe(true)
  })

  test('R11: выставлены базовые индексы (aria-colindex, aria-rowindex + data-index)', async () => {
    renderGrid({ columnCount: 3, dataCount: 3, enableFooter: true })
    await waitForGrid()

    expect(
      headCells().every(h => h.getAttribute('aria-colindex') !== null),
    ).toBe(true)
    bodyCellsOf(bodyRows()[0]).forEach(cell => {
      expect(cell.getAttribute('aria-colindex')).not.toBeNull()
    })
    document
      .querySelectorAll<HTMLElement>('.data-grid__footer-cell')
      .forEach(cell =>
        expect(cell.getAttribute('aria-colindex')).not.toBeNull(),
      )

    bodyRows().forEach(row => {
      expect(row.getAttribute('aria-rowindex')).not.toBeNull()
      expect(row.getAttribute('data-index')).not.toBeNull()
    })
  })

  test('R12: на строках/ячейках/заголовках есть базовые позиционные data-атрибуты', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const rowAttrs = ['data-row-odd', 'data-last-row']
    bodyRows().forEach(row => {
      rowAttrs.forEach(attr => expect(row.getAttribute(attr)).not.toBeNull())
    })

    const cellAttrs = [
      'data-first-cell-in-row',
      'data-last-cell-in-row',
      'data-cell-of-first-row',
      'data-cell-of-last-row',
    ]
    bodyCellsOf(bodyRows()[0]).forEach(cell => {
      cellAttrs.forEach(attr => expect(cell.getAttribute(attr)).not.toBeNull())
    })

    const headAttrs = [
      'data-first-header-in-row',
      'data-last-header-in-row',
      'data-first-headers-row',
      'data-last-headers-row',
      'data-header-full-height',
    ]
    headCells().forEach(cell => {
      headAttrs.forEach(attr => expect(cell.getAttribute(attr)).not.toBeNull())
    })
  })
})

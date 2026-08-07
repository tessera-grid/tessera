import { describe, expect, test } from 'vitest'

import { bodyRows, headCells, renderGrid } from '../helpers'
import {
  bodyCellsOf,
  headCellsLeftRight,
  rowsTopDown,
  textOf,
  waitForGrid,
} from './core-helpers'

// R1–R5 из docs/decisions/0004-core-on-tanstack-table.md: структура, порядок и
// содержимое. Каждое требование — отдельный именованный тест `R<n>` (см.
// docs/decisions/0009-test-coverage-visual-and-performance.md). Все тесты гоняют историю `All Features` и
// монтируются заново (auto-cleanup vitest-browser-react).

describe('Ядро на TanStack — структура и порядок', () => {
  test('R1: во вьюпорте число заголовков = числу колонок, строк = числу data', async () => {
    const columnCount = 3
    const dataCount = 5
    renderGrid({ columnCount, dataCount })
    await waitForGrid()

    expect(headCells()).toHaveLength(columnCount)

    const rows = bodyRows()
    expect(rows).toHaveLength(dataCount)
    rows.forEach(row => {
      expect(bodyCellsOf(row)).toHaveLength(columnCount)
    })
  })

  test('R2: порядок колонок (aria-colindex) совпадает с порядком их создания', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    // DOM-порядок заголовков (слева направо) и их aria-colindex — восходящие 0..n-1,
    // а тексты идут в порядке определения колонок (Country → First Name → Last Name).
    const cells = headCellsLeftRight()
    expect(cells.map(c => Number(c.getAttribute('aria-colindex')))).toEqual([
      0, 1, 2,
    ])
    expect(cells.map(textOf)).toEqual(['Country', 'First Name', 'Last Name'])
  })

  test('R3: порядок строк (data-index/aria-rowindex) совпадает с порядком data', async () => {
    const dataCount = 5
    renderGrid({ columnCount: 3, dataCount })
    await waitForGrid()

    const rows = rowsTopDown()
    // Сверху вниз индексы идут 0..n-1 (порядок массива data), а aria-rowindex
    // на каждой строке совпадает с её data-index.
    rows.forEach((row, i) => {
      expect(row.getAttribute('data-index')).toBe(String(i))
      expect(row.getAttribute('aria-rowindex')).toBe(String(i))
    })
  })

  test('R4: i-я ячейка тела выровнена по ширине и позиции с i-м заголовком', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const heads = headCellsLeftRight()
    const firstRowCells = bodyCellsOf(rowsTopDown()[0]).sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    expect(firstRowCells).toHaveLength(heads.length)

    heads.forEach((head, i) => {
      const hr = head.getBoundingClientRect()
      const cr = firstRowCells[i].getBoundingClientRect()
      // Колонка и её заголовок несут один aria-colindex...
      expect(firstRowCells[i].getAttribute('aria-colindex')).toBe(
        head.getAttribute('aria-colindex'),
      )
      // ...и совпадают по левому краю и ширине (одна вертикальная колонка).
      expect(Math.abs(cr.left - hr.left)).toBeLessThan(1)
      expect(Math.abs(cr.width - hr.width)).toBeLessThan(1)
    })
  })

  test('R5: заголовок рендерит columnDef.header, ячейка — columnDef.cell', async () => {
    // Явные данные: значение ячейки колонки country = row.country, поэтому в теле
    // видно ровно то, что вернул columnDef.cell (getValue()), а в шапке — header.
    renderGrid({
      columnCount: 3,
      dataOverride: [
        { country: 'Wonderland', firstName: 'Alice', lastName: 'Liddell' },
      ],
    })
    await waitForGrid()

    const heads = headCellsLeftRight()
    expect(textOf(heads[0])).toBe('Country')

    const firstRowCells = bodyCellsOf(rowsTopDown()[0]).sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    expect(textOf(firstRowCells[0])).toBe('Wonderland')
    expect(textOf(firstRowCells[1])).toBe('Alice')
  })
})

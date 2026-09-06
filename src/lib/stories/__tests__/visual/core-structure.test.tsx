import { describe, expect, test } from 'vitest'

import { bodyRows, headCells, renderGrid } from '../helpers'
import {
  bodyCellsOf,
  buildColumns,
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
    // Явные колонки с известными заголовками (seam columnsOverride) — сверяемся с
    // поданным набором в порядке его создания, а не с литералами дефолтного мока.
    renderGrid({
      columnsOverride: buildColumns([
        { id: 'alpha', header: 'Alpha' },
        { id: 'bravo', header: 'Bravo' },
        { id: 'charlie', header: 'Charlie' },
      ]),
      dataOverride: [{ alpha: 'a', bravo: 'b', charlie: 'c' }],
    })
    await waitForGrid()

    // DOM-порядок заголовков (слева направо) и их aria-colindex — восходящие 1..n
    // (ARIA 1-based), а тексты идут ровно в порядке определения колонок.
    const cells = headCellsLeftRight()
    expect(cells.map(c => Number(c.getAttribute('aria-colindex')))).toEqual([
      1, 2, 3,
    ])
    expect(cells.map(textOf)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  test('R3: порядок строк (data-index/aria-rowindex) совпадает с порядком data', async () => {
    const dataCount = 5
    renderGrid({ columnCount: 3, dataCount })
    await waitForGrid()

    const rows = rowsTopDown()
    // data-index идёт 0..n-1 (порядок массива data), а aria-rowindex — 1-based по
    // ARIA и учитывает строку заголовка: первая строка данных = 2 (заголовок = 1).
    rows.forEach((row, i) => {
      expect(row.getAttribute('data-index')).toBe(String(i))
      expect(row.getAttribute('aria-rowindex')).toBe(String(i + 2))
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
    // Явные колонки: header и cell-рендер заданы напрямую, поэтому в шапке видно
    // ровно columnDef.header, а в теле — вывод columnDef.cell (с префиксом,
    // отличающим его от сырого значения accessor).
    renderGrid({
      columnsOverride: buildColumns([
        {
          id: 'greeting',
          header: 'Greeting Header',
          cell: info => `cell:${info.getValue()}`,
        },
      ]),
      dataOverride: [{ greeting: 'Hello' }],
    })
    await waitForGrid()

    const heads = headCellsLeftRight()
    expect(textOf(heads[0])).toBe('Greeting Header')

    const firstRowCells = bodyCellsOf(rowsTopDown()[0]).sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    expect(textOf(firstRowCells[0])).toBe('cell:Hello')
  })

  test('R19: каждая ячейка несёт data-column-id, согласованный между шапкой и телом', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const heads = headCellsLeftRight()
    // Каждый заголовок несёт непустой логический id столбца, и id уникальны.
    const headIds = heads.map(h => h.getAttribute('data-column-id'))
    headIds.forEach(id => expect(id).toBeTruthy())
    expect(new Set(headIds).size).toBe(headIds.length)

    // i-я ячейка первой строки (слева направо) несёт тот же data-column-id, что и
    // i-й заголовок — идентификация столбца согласована между шапкой и телом.
    const firstRowCells = bodyCellsOf(rowsTopDown()[0]).sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    expect(firstRowCells.map(c => c.getAttribute('data-column-id'))).toEqual(
      headIds,
    )
  })
})

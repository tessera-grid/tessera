import { describe, expect, test } from 'vitest'

import { SEL, bodyRows, headCells, renderGrid } from '../helpers'
import {
  HEAD_HEIGHT_VAR,
  ROW_HEIGHT_VAR,
  bodyCellsOf,
  buildColumns,
  cssVar,
  headCellsLeftRight,
  rowsTopDown,
  waitForGrid,
} from './core-helpers'

// R6–R9 из docs/decisions/0004-core-on-tanstack-table.md: размеры и отступы.
// Каждое требование — отдельный именованный тест `R<n>`.

describe('Ядро на TanStack — размеры и отступы', () => {
  test('R6: высота ряда заголовков фиксирована (50px на уровень, между уровнями — 1px разделитель)', async () => {
    renderGrid({ columnCount: 4, dataCount: 4 })
    await waitForGrid()

    // Один уровень заголовков — разделителей нет: переменная высоты шапки = 50.
    expect(cssVar(HEAD_HEIGHT_VAR)).toBe('50px')

    const cells = headCells()
    cells.forEach(cell => {
      const wrapper = cell.querySelector<HTMLElement>(
        '.data-grid__cell-wrapper-content',
      )!
      // Фиксированный пол высоты — 50px; ячейка не растягивается содержимым сверх него.
      expect(getComputedStyle(wrapper).minHeight).toBe('50px')
      expect(Math.round(cell.getBoundingClientRect().height)).toBe(50)
    })

    // Все заголовки одного уровня одной высоты.
    const heights = cells.map(c => Math.round(c.getBoundingClientRect().height))
    expect(new Set(heights).size).toBe(1)
  })

  test('R7: высота строки тела фиксирована (--tsr-comp-row-height, 50px)', async () => {
    renderGrid({ columnCount: 4, dataCount: 6 })
    await waitForGrid()

    expect(cssVar(ROW_HEIGHT_VAR)).toBe('50px')

    const rows = bodyRows()
    rows.forEach(row => {
      // Высота задана переменной явно — не зависит от содержимого ячеек.
      expect(getComputedStyle(row).height).toBe('50px')
    })
  })

  test('R8: ширина колонки определяется её размером (columnDef.size)', async () => {
    // Явные размеры (seam columnsOverride) — сверяемся с поданными size, а не с
    // размерами дефолтного мока.
    renderGrid({
      // Размеры в пределах дефолтного диапазона [minSize 48, maxSize 750] и
      // отличны от размеров дефолтного мока — чтобы тест доказывал использование
      // именно переданных size.
      columnsOverride: buildColumns([
        { id: 'a', header: 'A', size: 220 },
        { id: 'b', header: 'B', size: 300 },
        { id: 'c', header: 'C', size: 175 },
      ]),
      dataOverride: [{ a: 1, b: 2, c: 3 }],
    })
    await waitForGrid()

    const widths = headCellsLeftRight().map(c =>
      Math.round(c.getBoundingClientRect().width),
    )
    expect(widths).toEqual([220, 300, 175])
  })

  test('R9: горизонтальный отступ контента ячейки зависит от режима', async () => {
    // Дефолтный режим: отступ содержимого из темы (ADR 0135 — 12px) по горизонтали.
    renderGrid({ columnCount: 3, dataCount: 3, enableRowActions: true })
    await waitForGrid()

    const dataWrapper = bodyCellsOf(
      rowsTopDown()[0],
    )[0].querySelector<HTMLElement>('.data-grid__cell-wrapper-content')!
    const dataStyle = getComputedStyle(dataWrapper)
    const padding = dataStyle
      .getPropertyValue('--tsr-comp-cell-content-padding-x')
      .trim()
    expect(padding).toBe('12px')
    expect(dataStyle.paddingLeft).toBe(padding)
    expect(dataStyle.paddingRight).toBe(padding)

    // Сервисная колонка действий рендерится в режиме smallPadding = 4px.
    const actionCell = document.querySelector<HTMLElement>(
      `${SEL.bodyCell}[data-actions-column-cell='true']`,
    )!
    const actionWrapper = actionCell.querySelector<HTMLElement>(
      '.data-grid__cell-wrapper-content',
    )!
    expect(getComputedStyle(actionWrapper).paddingLeft).toBe('4px')
    expect(getComputedStyle(actionWrapper).paddingRight).toBe('4px')
  })
})

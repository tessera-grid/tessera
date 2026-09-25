import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { DEFAULT_LABELS } from '../../../core/localization'
import { bodyRows, headCells, renderGrid } from '../helpers'
import { bodyCellsOf, waitForGrid } from './core-helpers'

// A1–A10: доступность (a11y). axe-core прогоняется в реальном Chromium (см.
// vitest.config.ts). Каждое требование — отдельный именованный тест `A<n>`
// (docs/decisions/0009-test-coverage-visual-and-performance.md).
//
// Отключённые правила — вне зоны структурной доступности этого набора:
// - color-contrast: зависит от токенов темы, покрыт тестами темизации;
// - region: документ-левел landmark-правило, неприменимо к встраиваемому гриду;
// - scrollable-region-focusable: без плагина keyboardNavigation грид — role="table"
//   только для чтения; с плагином правило включено и проверяется в A7.
const AXE_OPTIONS: axe.RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
    'scrollable-region-focusable': { enabled: false },
  },
}

/** Корень таблицы (`role="table"`) — контекст для axe. */
const gridRoot = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('[role="table"]')
  if (!el) {
    throw new Error('grid root [role="table"] not found')
  }
  return el
}

/** Нарушения axe в пределах грида. */
const violations = async (): Promise<axe.Result[]> => {
  const { violations } = await axe.run(gridRoot(), AXE_OPTIONS)
  return violations
}

const byRule = (list: axe.Result[], id: string) => list.filter(v => v.id === id)

describe('Доступность (a11y)', () => {
  test('A1: у таблицы есть доступное имя, aria-rowcount и aria-colcount', async () => {
    renderGrid({ columnCount: 3, dataCount: 5, enableFooter: true })
    await waitForGrid()

    const table = gridRoot()
    // Имя таблицы (переопределяемо через localization.table).
    expect(table.getAttribute('aria-label')).toBeTruthy()
    // rowcount = строки заголовка (1) + строки данных (5); colcount = число колонок.
    expect(table.getAttribute('aria-rowcount')).toBe('6')
    expect(Number(table.getAttribute('aria-colcount'))).toBe(headCells().length)
  })

  test('A2: ячейки тела и футера несут role="cell" (валидная структура table→row→cell)', async () => {
    renderGrid({ columnCount: 3, dataCount: 3, enableFooter: true })
    await waitForGrid()

    bodyCellsOf(bodyRows()[0]).forEach(cell =>
      expect(cell.getAttribute('role')).toBe('cell'),
    )
    document
      .querySelectorAll<HTMLElement>('.data-grid__footer-cell')
      .forEach(cell => expect(cell.getAttribute('role')).toBe('cell'))

    const found = await violations()
    expect(byRule(found, 'aria-required-children')).toEqual([])
    expect(byRule(found, 'aria-required-parent')).toEqual([])
  })

  test('A3: icon-кнопки заголовка имеют доступное имя (axe button-name)', async () => {
    renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableGrouping: true,
    })
    await waitForGrid()

    // Кнопки действий заголовка снабжены aria-label из локализации.
    expect(
      gridRoot().querySelectorAll('button[aria-label]').length,
    ).toBeGreaterThan(0)

    expect(byRule(await violations(), 'button-name')).toEqual([])
  })

  test('A4: чекбоксы выбора имеют доступное имя', async () => {
    renderGrid({ columnCount: 3, dataCount: 5, enableRowSelection: true })
    await waitForGrid()

    const checkboxes = gridRoot().querySelectorAll('.row-select-checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
    checkboxes.forEach(cb => expect(cb.getAttribute('aria-label')).toBeTruthy())
  })

  test('A5: грид со всеми (совместимыми) фичами не имеет нарушений axe', async () => {
    renderGrid({
      columnCount: 8,
      dataCount: 30,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableGrouping: true,
      enableRowSelection: true,
      enableFooter: true,
    })
    await waitForGrid()

    expect(await violations()).toEqual([])
  })

  test('A6: aria-colindex следует порядку отображения (закреплённая справа — последняя)', async () => {
    // c2 закрепляется только вправо: в натуральном порядке она третья, а визуально —
    // последняя. aria-colindex обязан повторять визуальный порядок.
    const columnsOverride = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      accessorKey: `c${i}`,
      header: `C${i}`,
      size: 150,
      enablePinning: true,
      ...(i === 2 ? { meta: { pinSides: 'end' as const } } : {}),
    }))
    renderGrid({
      columnsOverride,
      columnCount: 6,
      dataCount: 5,
      enableColumnPinning: true,
    })
    await waitForGrid()

    const head = () =>
      headCells().find(cell => cell.getAttribute('data-column-id') === 'c2')!
    await userEvent.hover(head())
    await userEvent.click(
      head().querySelector<HTMLElement>('.column-pin__button')!,
    )
    await expect
      .poll(() => head().getAttribute('data-cell-pinned'))
      .toBe('right')

    const colcount = gridRoot().getAttribute('aria-colcount')
    // Незакреплённые ячейки лежат в раскладке содержимого — слева направо индекс
    // строго растёт. Sticky-ячейку справа по координатам не сортируем: в узком
    // вьюпорте она визуально накрывает центральные колонки.
    const indexes = headCells()
      .filter(cell => cell.getAttribute('data-cell-pinned') === 'false')
      .sort(
        (a, b) =>
          a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      )
      .map(cell => Number(cell.getAttribute('aria-colindex')))
    indexes
      .slice(1)
      .forEach((index, i) => expect(index).toBeGreaterThan(indexes[i]))
    expect(head().getAttribute('aria-colindex')).toBe(colcount)
    const body = bodyCellsOf(bodyRows()[0]).find(
      cell => cell.getAttribute('data-column-id') === 'c2',
    )!
    expect(body.getAttribute('aria-colindex')).toBe(colcount)
  })

  test('A7: с клавиатурной навигацией — без нарушений axe, включая scrollable-region-focusable', async () => {
    renderGrid({
      columnCount: 8,
      dataCount: 30,
      enableKeyboardNavigation: true,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableRowSelection: true,
      enableCellSelection: true,
      enableFooter: true,
    })
    await waitForGrid()

    const root = document.querySelector<HTMLElement>('[role="grid"]')!
    expect(root).toBeTruthy()
    // Правило scrollable-region-focusable здесь НЕ отключено: с плагином область
    // прокрутки достижима с клавиатуры (WCAG 2.1.1).
    const { violations } = await axe.run(root.parentElement!, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    })
    expect(violations).toEqual([])
  })

  test('A8: кнопка правки cellEditing имеет доступное имя из локализации (axe button-name)', async () => {
    renderGrid({ columnCount: 6, dataCount: 5, enableCellEditing: true })
    await waitForGrid()

    const buttons = gridRoot().querySelectorAll(
      '.data-grid__body-cell .cell__button button',
    )
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach(button =>
      expect(button.getAttribute('aria-label')).toBe(DEFAULT_LABELS.editCell),
    )
    expect(byRule(await violations(), 'button-name')).toEqual([])
  })

  test('A9: под вложенной шапкой строки заголовков несут role="row" с aria-rowindex', async () => {
    renderGrid({ showHeaderGroups: true, dataCount: 5 })
    await waitForGrid()

    const headRows = Array.from(
      gridRoot().querySelectorAll<HTMLElement>(
        '.data-grid__head > [role="row"]',
      ),
    )
    expect(headRows.length).toBeGreaterThan(1)
    headRows.forEach((row, i) =>
      expect(row.getAttribute('aria-rowindex')).toBe(String(i + 1)),
    )
    headCells().forEach(cell =>
      expect(cell.closest('[role="row"]')).not.toBeNull(),
    )
    expect(byRule(await violations(), 'aria-required-parent')).toEqual([])
  })

  test('A10: aria-selected на строках отражает выбор (только в role="grid")', async () => {
    const table = await renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableRowSelection: true,
    })
    await waitForGrid()
    expect(bodyRows()[0].hasAttribute('aria-selected')).toBe(false)
    table.unmount()

    renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableRowSelection: true,
      enableKeyboardNavigation: true,
    })
    await waitForGrid()
    expect(bodyRows()[0].getAttribute('aria-selected')).toBe('false')

    await userEvent.click(
      bodyRows()[0].querySelector<HTMLElement>('.row-select-checkbox')!,
    )
    await expect
      .poll(() => bodyRows()[0].getAttribute('aria-selected'))
      .toBe('true')
  })
})

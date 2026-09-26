import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { DEFAULT_LABELS } from '../../../core/localization'
import { Stories, bodyRows, headCells, renderGrid } from '../helpers'
import { bodyCellsOf, waitForGrid } from './core-helpers'

// A1–A10, W1–W15: доступность (a11y, ADR 0020 и ADR 0032). axe-core прогоняется в реальном Chromium (см.
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

// --- Контраст (WCAG 1.4.11): цвет → RGBA через canvas, наложение альфы на фон.
const canvas = document.createElement('canvas').getContext('2d', {
  willReadFrequently: true,
})!
const toRgba = (color: string): number[] => {
  canvas.clearRect(0, 0, 1, 1)
  canvas.fillStyle = '#000'
  canvas.fillStyle = color
  canvas.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data
  return [r, g, b, a / 255]
}
const luminance = (rgb: number[]) =>
  rgb
    .slice(0, 3)
    .map(c => c / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
/**
 * Непрозрачный фон элемента: первый предок грида с заливкой, иначе поверхность
 * темы (`--tsr-sys-surface`) — фон страницы в тесте не зависит от темы.
 */
const backgroundOf = (el: Element | null): number[] => {
  const theme = el?.closest('.data-grid-theme')
  for (; el && el !== theme; el = el.parentElement) {
    const color = toRgba(getComputedStyle(el).backgroundColor)
    if (color[3] > 0.99) return color
  }
  return toRgba(
    getComputedStyle(theme ?? document.body).getPropertyValue(
      '--tsr-sys-surface',
    ),
  )
}
const contrast = (fg: number[], bg: number[]) => {
  const solid = fg.map((c, i) => (i < 3 ? c * fg[3] + bg[i] * (1 - fg[3]) : 1))
  const [hi, lo] = [luminance(solid), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}
/** Прогнать проверку в светлой и тёмной теме (класс `.dark` на <html>). */
const inBothThemes = async (check: () => Promise<void>) => {
  for (const dark of [false, true]) {
    document.documentElement.classList.toggle('dark', dark)
    // Цвета контролов анимируются (transition) — читаем конечные значения.
    document.getAnimations().forEach(animation => animation.finish())
    try {
      await check()
    } finally {
      document.documentElement.classList.remove('dark')
    }
  }
}

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
    await table.unmount()

    await renderGrid({
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

  test('W1: поле редактора cellEditing называется по колонке из localization.editCellValue', async () => {
    await renderGrid({ columnCount: 6, dataCount: 5, enableCellEditing: true })
    await waitForGrid()

    const button = gridRoot().querySelector<HTMLElement>(
      '.data-grid__body-cell .cell__button button',
    )!
    const columnId = button
      .closest('.data-grid__body-cell')!
      .getAttribute('data-column-id')!
    await userEvent.click(button)
    const input = () =>
      gridRoot().querySelector<HTMLInputElement>('.data-grid__body-cell input')
    await expect.poll(input).toBeTruthy()

    const label = input()!.getAttribute('aria-label')!
    expect(label).not.toBe('edit cell value')
    const header = headCells().find(
      cell => cell.getAttribute('data-column-id') === columnId,
    )!
    expect(label).toBe(
      DEFAULT_LABELS.editCellValue(header.textContent!.trim() || columnId),
    )
    await userEvent.keyboard('{Escape}')
  })

  test('W2: индикатор загрузки назван, грид несёт aria-busy', async () => {
    await renderGrid({ columnCount: 4, dataCount: 5, enableLoading: true })
    await waitForGrid()

    const progress = document.querySelector('[role="progressbar"]')!
    expect(progress.getAttribute('aria-label')).toBe(DEFAULT_LABELS.loading)
    expect(gridRoot().getAttribute('aria-busy')).toBe('true')
    expect(byRule(await violations(), 'aria-progressbar-name')).toEqual([])
  })

  test('W3: скелет первой загрузки скрыт от AT и объявляет загрузку', async () => {
    await renderGrid({ columnCount: 4, dataCount: 5, enableSkeleton: true })
    // Своя status-область скелета (соседняя live-область грида W9 пуста).
    const status = () =>
      Array.from(document.querySelectorAll('[role="status"]')).find(
        el => el.textContent === DEFAULT_LABELS.loading,
      )
    await expect.poll(status).toBeTruthy()

    expect(status()!.textContent).toBe(DEFAULT_LABELS.loading)
    expect(
      document.querySelector(
        '[role="table"], [role="grid"], [role="treegrid"]',
      ),
    ).toBeNull()
    const parts = document.querySelectorAll(
      '.data-grid__head--skeleton, .data-grid__body--skeleton',
    )
    expect(parts.length).toBe(2)
    parts.forEach(part => expect(part.getAttribute('aria-hidden')).toBe('true'))
    const { violations } = await axe.run(status()!.parentElement!, AXE_OPTIONS)
    expect(violations).toEqual([])
  })

  test('W4: выделенные ячейки несут aria-selected, грид — aria-multiselectable', async () => {
    await renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableKeyboardNavigation: true,
      enableCellSelection: true,
    })
    await waitForGrid()

    const grid = document.querySelector<HTMLElement>('[role="grid"]')!
    expect(grid.getAttribute('aria-multiselectable')).toBe('true')
    const cell = grid.querySelector<HTMLElement>(
      '.data-grid__body-cell[data-cell-selectable]',
    )!
    expect(cell.getAttribute('aria-selected')).toBe('false')

    await userEvent.click(cell)
    await expect.poll(() => cell.getAttribute('aria-selected')).toBe('true')
    expect(
      grid.querySelectorAll('.data-grid__body-cell[aria-selected="true"]'),
    ).toHaveLength(1)
  })

  test('W5: граница чекбокса выбора контрастна фону ≥ 3:1 в обеих темах', async () => {
    await renderGrid({ columnCount: 4, dataCount: 5, enableRowSelection: true })
    await waitForGrid()
    await inBothThemes(async () => {
      const box = gridRoot().querySelector<HTMLElement>('.row-select-checkbox')!
      const border = toRgba(getComputedStyle(box).borderTopColor)
      expect(
        contrast(border, backgroundOf(box.parentElement)),
      ).toBeGreaterThanOrEqual(3)
    })
  })

  test('W6: контур фокуса активной ячейки контрастен фону ≥ 3:1 в обеих темах', async () => {
    await renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableKeyboardNavigation: true,
    })
    await waitForGrid()
    const cell = document.querySelector<HTMLElement>(
      '[role="grid"] .data-grid__body-cell',
    )!
    cell.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    const active = document.activeElement as HTMLElement
    await inBothThemes(async () => {
      const style = getComputedStyle(active)
      expect(style.outlineStyle).toBe('solid')
      expect(
        contrast(toRgba(style.outlineColor), backgroundOf(active)),
      ).toBeGreaterThanOrEqual(3)
    })
  })

  test('W7: край выделения ячеек контрастен фону ≥ 3:1 в обеих темах', async () => {
    await renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableCellSelection: true,
    })
    await waitForGrid()
    await userEvent.click(
      document.querySelector<HTMLElement>(
        '.data-grid__body-cell[data-cell-selectable]',
      )!,
    )
    const selected = () =>
      document.querySelector<HTMLElement>('[data-cell-selected="true"]')!
    await expect.poll(selected).toBeTruthy()
    await inBothThemes(async () => {
      const shadow = getComputedStyle(selected()).boxShadow
      const edge = shadow.match(/^((?:rgba?|color|oklch|oklab)\([^)]*\))/)![1]
      expect(
        contrast(toRgba(edge), backgroundOf(selected())),
      ).toBeGreaterThanOrEqual(3)
    })
  })

  test('W8: подсказка не закрывается, пока указатель на ней; закрывается по Escape', async () => {
    await renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableColumnSorting: true,
    })
    await waitForGrid()
    const trigger = gridRoot().querySelector<HTMLElement>(
      '.data-grid__head-cell button',
    )!
    const tooltip = () =>
      document.querySelector<HTMLElement>(
        '[data-side][data-open]:not([data-starting-style])',
      )
    await userEvent.hover(trigger)
    await expect.poll(tooltip, { timeout: 3000 }).toBeTruthy()

    await userEvent.hover(tooltip()!)
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(tooltip()).toBeTruthy()

    await userEvent.hover(trigger)
    await userEvent.keyboard('{Escape}')
    await expect.poll(tooltip).toBeNull()
  })

  test('W9: изменения объявляются через live-область; enableAnnouncements: false отключает', async () => {
    const args = {
      containerHeight: 600,
      height: 500,
      columnCount: 4,
      dataCount: 5,
      enableColumnSorting: true,
      enableRowSelection: true,
      enableCellSelection: true,
      enableLoading: true,
    }
    const screen = await renderGrid(args)
    await waitForGrid()
    const live = () =>
      document.querySelector<HTMLElement>(
        '[role="status"][aria-live="polite"]',
      )!.textContent
    const sortable = headCells().find(cell =>
      cell.querySelector('.column-sort__button, [data-sort-button]'),
    )
    const sortButton =
      sortable?.querySelector<HTMLElement>('button') ??
      gridRoot().querySelector<HTMLElement>('.data-grid__head-cell button')!
    const column = sortButton
      .closest('.data-grid__head-cell')!
      .getAttribute('data-column-id')!

    // Окончание загрузки.
    await screen.rerender(
      <Stories.AllFeatures {...args} enableLoading={false} />,
    )
    await expect.poll(live).toBe(DEFAULT_LABELS.announceLoaded(5))

    // Сортировка.
    await userEvent.click(sortButton)
    await expect.poll(live).toMatch(/^Sorted by .+, (ascending|descending)$/)
    expect(live()).toContain(
      headCells()
        .find(cell => cell.getAttribute('data-column-id') === column)!
        .textContent!.trim() || column,
    )

    // Выбор строки.
    await userEvent.click(
      bodyRows()[0].querySelector<HTMLElement>('.row-select-checkbox')!,
    )
    await expect.poll(live).toBe(DEFAULT_LABELS.announceSelection(1))

    // Копирование выделения ячеек.
    const cell = bodyRows()[1].querySelector<HTMLElement>(
      '.data-grid__body-cell[data-cell-selectable]',
    )!
    await userEvent.click(cell)
    cell.dispatchEvent(
      new ClipboardEvent('copy', {
        bubbles: true,
        clipboardData: new DataTransfer(),
      }),
    )
    await expect.poll(live).toBe(DEFAULT_LABELS.announceCopy(1))

    // Пустой результат.
    await screen.rerender(
      <Stories.AllFeatures {...args} enableLoading={false} dataCount={0} />,
    )
    await expect.poll(live).toBe(DEFAULT_LABELS.noData)
    await screen.unmount()

    // Отключение объявлений ядра.
    await renderGrid({
      ...args,
      enableLoading: false,
      enableAnnouncements: false,
    })
    await waitForGrid()
    await userEvent.click(
      bodyRows()[0].querySelector<HTMLElement>('.row-select-checkbox')!,
    )
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(live()).toBe('')
  })

  test('W10: с иерархией строк грид — treegrid, строки несут aria-level/setsize/posinset', async () => {
    const screen = await render(
      <Stories.RowGrouping
        enableKeyboardNavigation
        enableRowExpanding
        initialGrouping={['gender']}
      />,
    )
    const tree = () => document.querySelector<HTMLElement>('[role="treegrid"]')
    await expect.poll(tree).toBeTruthy()

    const groups = () =>
      Array.from(
        tree()!.querySelectorAll<HTMLElement>(
          '.data-grid__body-row[data-group-row="true"]',
        ),
      )
    await expect.poll(() => groups().length).toBeGreaterThan(1)
    groups().forEach((row, i) => {
      expect(row.getAttribute('aria-level')).toBe('1')
      expect(row.getAttribute('aria-setsize')).toBe(String(groups().length))
      expect(row.getAttribute('aria-posinset')).toBe(String(i + 1))
    })

    // Раскрыть первую группу — её строки уровнем ниже, позиции среди своих.
    await userEvent.click(
      groups()[0].querySelector<HTMLElement>(
        '.data-grid__body-cell button[aria-label]',
      )!,
    )
    const children = () =>
      Array.from(
        tree()!.querySelectorAll<HTMLElement>(
          '.data-grid__body-row[aria-level="2"]',
        ),
      )
    await expect.poll(() => children().length).toBeGreaterThan(0)
    children().forEach((row, i) => {
      expect(row.getAttribute('aria-setsize')).toBe(String(children().length))
      expect(row.getAttribute('aria-posinset')).toBe(String(i + 1))
    })
    const { violations } = await axe.run(tree()!.parentElement!, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    })
    expect(violations).toEqual([])
    await screen.unmount()

    // Без клавиатурной навигации — таблица без атрибутов уровня.
    await render(
      <Stories.RowGrouping enableRowExpanding initialGrouping={['gender']} />,
    )
    await expect
      .poll(() => document.querySelector('.data-grid__body-row'))
      .toBeTruthy()
    expect(document.querySelector('[role="treegrid"]')).toBeNull()
    expect(gridRoot().querySelector('[aria-level]')).toBeNull()
  })

  test('W11: validate блокирует коммит, поле помечено aria-invalid и описано текстом ошибки', async () => {
    const onlyDigits = (value: string) =>
      /^\d+$/.test(value) ? null : 'Digits only'
    await renderGrid({
      columnCount: 6,
      dataCount: 5,
      enableCellEditing: true,
      validateCellEdit: onlyDigits,
    })
    await waitForGrid()

    await userEvent.click(
      gridRoot().querySelector<HTMLElement>(
        '.data-grid__body-cell .cell__button button',
      )!,
    )
    const input = () =>
      gridRoot().querySelector<HTMLInputElement>('.data-grid__body-cell input')
    await expect.poll(input).toBeTruthy()
    expect(input()!.hasAttribute('aria-invalid')).toBe(false)

    await userEvent.clear(input()!)
    await userEvent.type(input()!, 'abc{Enter}')
    await expect.poll(() => input()?.getAttribute('aria-invalid')).toBe('true')
    const error = document.getElementById(
      input()!.getAttribute('aria-describedby')!,
    )!
    expect(error.textContent).toBe('Digits only')
    expect(error.getAttribute('role')).toBe('alert')
    expect(error.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(byRule(await violations(), 'color-contrast')).toEqual([])

    await userEvent.clear(input()!)
    await userEvent.type(input()!, '42{Enter}')
    await expect.poll(input).toBeNull()
  })

  test('W12: Alt+Shift+→/← вкладывают строку в предыдущую группу и выносят обратно', async () => {
    await render(
      <Stories.RowDragging
        dataMode="hierarchy"
        enableRowExpanding
        enableKeyboardNavigation
      />,
    )
    const rowById = (id: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="${id}"]`,
      )
    await expect.poll(() => rowById('item-id-4')).toBeTruthy()
    expect(rowById('item-id-4')!.getAttribute('aria-level')).toBe('1')
    const activeRowId = () =>
      (document.activeElement as HTMLElement)
        .closest('.data-grid__body-row')
        ?.getAttribute('data-row-id')

    rowById('item-id-4')!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
    await expect
      .poll(() => rowById('item-id-4')?.getAttribute('aria-level'))
      .toBe('2')
    await expect.poll(activeRowId).toBe('item-id-4')

    await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}')
    await expect
      .poll(() => rowById('item-id-4')?.getAttribute('aria-level'))
      .toBe('1')
    await expect.poll(activeRowId).toBe('item-id-4')
  })

  test('W13: заголовки служебных колонок названы — скрытой подписью или контролом (axe empty-table-header)', async () => {
    await renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableRowSelection: true,
      enableRowExpanding: true,
      enableRowDragging: true,
      enableRowActions: true,
    })
    await waitForGrid()

    const service = headCells().filter(
      cell => cell.getAttribute('data-actions-column-cell') === 'true',
    )
    expect(service.length).toBeGreaterThan(2)
    // Имя — скрытая подпись или именованный контрол (чекбокс «Select all rows»).
    service.forEach(cell =>
      expect(
        cell.textContent!.trim() ||
          cell.querySelector('[aria-label]')?.getAttribute('aria-label'),
      ).toBeTruthy(),
    )
    expect(byRule(await violations(), 'empty-table-header')).toEqual([])
  })

  test('W14: футер — строка навигации после последней строки тела', async () => {
    const dataCount = 5
    await renderGrid({
      columnCount: 4,
      dataCount,
      enableKeyboardNavigation: true,
      enableFooter: true,
    })
    await waitForGrid()
    const active = () => document.activeElement as HTMLElement

    bodyRows()
      [dataCount - 1].querySelector<HTMLElement>('[data-kn-cell]')!
      .focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .poll(() => active().classList.contains('data-grid__footer-cell'))
      .toBe(true)
    expect(active().getAttribute('role')).toBe('gridcell')

    await userEvent.keyboard('{ArrowUp}')
    await expect
      .poll(() =>
        active().closest('.data-grid__body-row')?.getAttribute('data-index'),
      )
      .toBe(String(dataCount - 1))

    await userEvent.keyboard(
      '{Control>}{Home}{/Control}{Control>}{End}{/Control}',
    )
    await expect
      .poll(() => active().classList.contains('data-grid__footer-cell'))
      .toBe(true)
    expect(active().getAttribute('data-last-cell-in-row')).toBe('true')
  })

  test('W16: фокус на строке treegrid — ←/→ раскрывают, сворачивают и ведут к ячейке и родителю', async () => {
    await render(
      <Stories.RowGrouping
        enableKeyboardNavigation
        enableRowExpanding
        initialGrouping={['gender']}
      />,
    )
    const row = (index: number) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-index="${index}"]`,
      )!
    await expect.poll(() => row(0)).toBeTruthy()
    const active = () => document.activeElement as HTMLElement
    const press = (key: string) => userEvent.keyboard(key)

    row(0).querySelector<HTMLElement>('[data-kn-cell]')!.focus()
    await press('{ArrowLeft}')
    await expect.poll(active).toBe(row(0))
    expect(active().getAttribute('aria-expanded')).toBe('false')

    await press('{ArrowRight}')
    await expect.poll(() => row(0).getAttribute('aria-expanded')).toBe('true')
    expect(active()).toBe(row(0))

    await press('{ArrowRight}')
    await expect.poll(() => active().getAttribute('role')).toBe('gridcell')
    await press('{ArrowLeft}{ArrowDown}')
    await expect.poll(active).toBe(row(1))
    expect(row(1).getAttribute('aria-level')).toBe('2')

    // ← на подстроке — к родителю, ← на раскрытом родителе — свернуть.
    await press('{ArrowLeft}')
    await expect.poll(active).toBe(row(0))
    await press('{ArrowLeft}')
    await expect.poll(() => row(0).getAttribute('aria-expanded')).toBe('false')
  })

  test('W17: имя заголовка колонки — только его текст, без имён кнопок', async () => {
    await renderGrid({
      columnCount: 3,
      dataCount: 3,
      enableColumnSorting: true,
      enableColumnPinning: true,
    })
    await waitForGrid()

    const header = headCells().find(cell =>
      cell.querySelector('.data-grid__cell-wrapper-title'),
    )!
    const title = document.getElementById(
      header.getAttribute('aria-labelledby')!,
    )!
    expect(header.contains(title)).toBe(true)
    expect(title.querySelector('button')).toBeNull()
    expect(title.textContent!.trim()).not.toBe('')
  })
})

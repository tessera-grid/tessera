import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { ENGLISH_LABELS } from '../../../core/localization'
import {
  Stories,
  bodyRows,
  headCells,
  renderGrid,
  humanClick,
  revealCellButtons,
} from '../helpers'
import { plainGroupingArgs } from '../stories'
import {
  AXE_OPTIONS,
  backgroundOf,
  byRule,
  contrast,
  gridRoot,
  inBothThemes,
  toRgba,
  violations,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { Tooltip } from '../../../ui/Tooltip'

// W1–W17: остаток WCAG 2.1 AA (ADR 0032). Каждое требование — отдельный
// именованный тест `W<n>` (docs/decisions/0009-test-coverage-visual-and-performance.md).

describe('Доступность: остаток WCAG 2.1 AA', () => {
  test('W1: поле редактора cellEditing называется по колонке из localization.editCellValue', async () => {
    await renderGrid({ columnCount: 6, dataCount: 5, enableCellEditing: true })
    await waitForGrid()

    const button = gridRoot().querySelector<HTMLElement>(
      '.data-grid__body-cell .cell__button button',
    )!
    const columnId = button
      .closest('.data-grid__body-cell')!
      .getAttribute('data-column-id')!
    await humanClick(button)
    const input = () =>
      gridRoot().querySelector<HTMLInputElement>('.data-grid__body-cell input')
    await expect.poll(input).toBeTruthy()

    const label = input()!.getAttribute('aria-label')!
    expect(label).not.toBe('edit cell value')
    const header = headCells().find(
      cell => cell.getAttribute('data-column-id') === columnId,
    )!
    expect(label).toBe(
      ENGLISH_LABELS.editCellValue(header.textContent!.trim() || columnId),
    )
    await userEvent.keyboard('{Escape}')
  })

  test('W2: индикатор загрузки назван, грид несёт aria-busy', async () => {
    await renderGrid({ columnCount: 4, dataCount: 5, loading: 'refresh' })
    await waitForGrid()
    // Индикатор — после задержки показа (ADR 0094, GL5).
    await expect
      .poll(() => document.querySelector('[role="progressbar"]'))
      .not.toBeNull()

    const progress = document.querySelector('[role="progressbar"]')!
    expect(progress.getAttribute('aria-label')).toBe(ENGLISH_LABELS.loading)
    expect(gridRoot().getAttribute('aria-busy')).toBe('true')
    expect(byRule(await violations(), 'aria-progressbar-name')).toEqual([])
  })

  test('W3: скелет первой загрузки скрыт от AT и объявляет загрузку', async () => {
    await renderGrid({ columnCount: 4, dataCount: 5, loading: 'initial' })
    // Своя status-область скелета (соседняя live-область грида W9 пуста).
    const status = () =>
      Array.from(document.querySelectorAll('[role="status"]')).find(
        el => el.textContent === ENGLISH_LABELS.loading,
      )
    await expect.poll(status).toBeTruthy()

    expect(status()!.textContent).toBe(ENGLISH_LABELS.loading)
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
    // Активную ячейку размечает отрисовка после нажатия — дождаться её.
    await expect.poll(() => getComputedStyle(active).outlineStyle).toBe('solid')
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

  test('W8: подсказка обрезанного текста не закрывается, пока указатель на ней; закрывается по Escape', async () => {
    const text = 'A very long label that does not fit its narrow box'
    const screen = await render(
      <div style={{ padding: '80px 40px' }}>
        <Tooltip title={text} overflowOnly>
          <span
            data-testid="trigger"
            tabIndex={0}
            style={{
              display: 'block',
              width: 80,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {text}
          </span>
        </Tooltip>
      </div>,
    )
    const trigger = screen.getByTestId('trigger').element() as HTMLElement
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
      loading: 'refresh' as const,
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
      <Stories.DataGridPlayground {...args} loading={false} />,
    )
    await expect.poll(live).toBe(ENGLISH_LABELS.announceLoaded(5))

    // Сортировка.
    await revealCellButtons(sortButton.closest('.data-grid__head-cell')!)
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
    await expect.poll(live).toBe(ENGLISH_LABELS.announceSelection(1))

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
    await expect.poll(live).toBe(ENGLISH_LABELS.announceCopy(1))

    // Пустой результат.
    await screen.rerender(
      <Stories.DataGridPlayground {...args} loading={false} dataCount={0} />,
    )
    await expect.poll(live).toBe(ENGLISH_LABELS.noData)
    await screen.unmount()

    // Отключение объявлений ядра.
    await renderGrid({
      ...args,
      loading: false,
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
      <Stories.RowGroupingPlayground
        {...plainGroupingArgs}
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
      <Stories.RowGroupingPlayground
        {...plainGroupingArgs}
        enableRowExpanding
        initialGrouping={['gender']}
      />,
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

    await humanClick(
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
      <Stories.RowDraggingPlayground
        dataNesting="nested"
        enableRowExpanding
        initialExpanded
        enableKeyboardNavigation
      />,
    )
    const rowById = (id: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="${id}"]`,
      )
    await expect.poll(() => rowById('item-id-1')).toBeTruthy()
    expect(rowById('item-id-1')!.getAttribute('aria-level')).toBe('1')
    const activeRowId = () =>
      (document.activeElement as HTMLElement)
        .closest('.data-grid__body-row')
        ?.getAttribute('data-row-id')

    rowById('item-id-1')!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
    await expect
      .poll(() => rowById('item-id-1')?.getAttribute('aria-level'))
      .toBe('2')
    await expect.poll(activeRowId).toBe('item-id-1')

    await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}')
    await expect
      .poll(() => rowById('item-id-1')?.getAttribute('aria-level'))
      .toBe('1')
    await expect.poll(activeRowId).toBe('item-id-1')
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
      <Stories.RowGroupingPlayground
        {...plainGroupingArgs}
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

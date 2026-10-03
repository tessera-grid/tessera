import { describe, expect, test } from 'vitest'

import {
  headCells,
  measureInteractionWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  PAGED,
  PERF_TIMEOUT,
  SMALL,
} from './perf-cases'
import { INTERACTION_BUDGET_MS, LOAD_BUDGET_MS } from '../perf.constants'
import { columns as mockColumns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'

// Отзывчивость на ВЗАИМОДЕЙСТВИЕ (INP): выбор ОДНОЙ строки меняет только
// срез rowSelection на одну запись — законной работы минимум (обновить одну строку и
// её чекбокс), поэтому всё остальное во измеренной задаче есть «лишние» ре-рендеры от
// широких подписок компонентов на весь стейт. Шаг стрелкой (keyboardNavigation)
// аналогично меняет лишь активную ячейку и пиновку строки в виртуализаторе.
// Метрика — самая длинная задача главного потока (синхронный blob
// обработчик→рендер→коммит→layout), сверяется с бюджетом RAIL Response под ×4
// CPU-троттлингом.

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

const firstRowCheckbox = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__body-row .row-select-checkbox',
  )

const firstBodyCell = () =>
  document.querySelector<HTMLElement>(
    ".data-grid__body-row[data-index='0'] .data-grid__body-cell[data-kn-cell]",
  )

const clickFirstRowCheckbox = async () => {
  firstRowCheckbox()?.click()
}

const pressArrowDown = async () => {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    }),
  )
}

// Меню колонок (ADR 0035): кнопка тулбара → поповер с деревом на 1000 колонок.
const COLUMN_VISIBILITY = { enableToolbar: true, enableColumnVisibility: true }

const columnsButton = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="column-visibility-button"]',
  )
const columnsMenu = () =>
  document.querySelector<HTMLElement>('[data-testid="column-visibility-menu"]')

/** Поповер грузится лениво: ждём настоящий триггер Base UI. */
const waitForColumnsButton = () =>
  expect
    .poll(() => columnsButton()?.hasAttribute('data-base-ui-click-trigger'))
    .toBe(true)

const openColumnsMenu = async () => {
  columnsButton()!.click()
  await expect.poll(() => columnsMenu()?.hasAttribute('data-open')).toBe(true)
}

/** Ввод в контролируемое поле React: нативный сеттер + событие input. */
const typeIntoSearch = async () => {
  const input = columnsMenu()!.querySelector<HTMLInputElement>('input')!
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!
  setValue.call(input, 'col_9')
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

// Пагинация (ADR 0038): кнопка «вперёд» и выбор размера страницы в нижней панели.
const PAGINATION = { enablePagination: true }

const pageButton = (action: string) =>
  document.querySelector<HTMLElement>(`[data-page-action="${action}"]`)
const pageSizeTrigger = () =>
  document.querySelector<HTMLElement>('[data-testid="page-size-select"]')
const pageSizeOption = (size: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    option => option.textContent?.trim() === size,
  )

// Экспорт (ADR 0044): «Выгрузить» в панели (строки «Все данные») сериализует всю таблицу синхронно.
const EXPORT = { enableToolbar: true, enableExport: true }
const EXPORT_SIZE = { columnCount: 10, dataCount: 100_000 } as const

const exportButton = () =>
  document.querySelector<HTMLElement>('[data-testid="export-button"]')
const exportRunButton = () =>
  document.querySelector<HTMLElement>('[data-testid="export-run"]')

/** Панель грузится лениво: до загрузки кнопка-заглушка по клику тоже открывает её. */
const openExportPanel = async () => {
  await expect.poll(() => exportButton()).not.toBeNull()
  exportButton()!.click()
  await expect.poll(() => exportRunButton()).not.toBeNull()
}

/**
 * Скачивание в замере не нужно: подменяем клик по ссылке, сериализация остаётся.
 * Замер повторяет действие, а «Выгрузить» закрывает панель — перед повтором открываем её снова.
 */
const exportWithoutDownload = async () => {
  if (!exportRunButton()) {
    exportButton()!.click()
    await expect.poll(() => exportRunButton()).not.toBeNull()
  }
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = () => {}
  try {
    exportRunButton()!.click()
  } finally {
    HTMLAnchorElement.prototype.click = click
  }
}

// Фильтрация (ADR 0045): применение поиска и фильтра колонки без дебаунса — замер
// ловит пересчёт модели и перерисовку, а не ожидание таймера.
const SEARCH = {
  enableToolbar: true,
  enableQuickSearch: true,
  quickSearchOptions: { debounceMs: 0 },
}
const SEARCH_SIZE = { columnCount: 10, dataCount: 100_000 } as const
const FILTERING = {
  enableColumnFiltering: true,
  columnFilteringOptions: { debounceMs: 0 },
}

/** Ввод в контролируемое поле React: нативный сеттер + событие input. */
const setInputValue = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Замер повторяет действие (прогрев + замер): значение чередуется, чтобы фильтр менялся. */
const alternate = (input: HTMLInputElement, a: string, b: string) =>
  setInputValue(input, input.value === a ? b : a)

const quickSearchInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
const filterValueInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="filter-value"]')

const openCountryFilter = async () => {
  const button = () =>
    document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="country"] .column-filter__button',
    )
  await expect.poll(button).not.toBeNull()
  button()!.click()
  await expect.poll(filterValueInput).not.toBeNull()
}

const pad = (n: number) => String(n).padStart(2, '0')
const MONTH = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
})()

/**
 * 1000×1000 с колонкой дат первой — её кнопка фильтра в окне; дни текущего месяца,
 * чтобы календарь открылся на них (ADR 0047, DF22).
 */
const DATE_FILTERING = {
  ...FILTERING,
  columnsOverride: [
    {
      id: 'registered',
      accessorKey: 'registered',
      header: 'Registered',
      filter: 'date',
      size: 150,
    },
    ...mockColumns,
    ...Array.from(
      { length: LARGE.columnCount - mockColumns.length - 1 },
      (_, i) => ({
        id: `col_${i}`,
        accessorKey: `col_${i}`,
        header: `col_${i}`,
        size: 150,
        enableResizing: true,
        enableGrouping: true,
        enableSorting: true,
        enablePinning: true,
        enableDragging: true,
      }),
    ),
  ],
  dataOverride: getData(LARGE.dataCount).map((row, i) => ({
    ...row,
    registered: `${MONTH}-${pad(1 + (i % 28))}`,
  })),
}

const calendarDay = (day: number) =>
  document.querySelector<HTMLElement>(
    `[data-testid="filter-calendar"] [data-day="${MONTH}-${pad(day)}"] button`,
  )

const openDateFilter = async () => {
  const button = () =>
    document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="registered"] .column-filter__button',
    )
  await expect.poll(button).not.toBeNull()
  button()!.click()
  await expect.poll(() => calendarDay(10)).not.toBeNull()
}

let dateFlip = false
const toggleCalendarDay = async () => {
  dateFlip = !dateFlip
  calendarDay(dateFlip ? 10 : 20)!.click()
}

interface InteractionCase {
  id: string
  label: string
  /** Подпись объёма в дашборде, если не 30×500 / 1000×1000. */
  size?: string
  args: Record<string, unknown>
  /** Подготовка вне замера (напр. фокус на ячейку). */
  prepare?: () => Promise<void>
  /** Измеряемое взаимодействие. */
  act: () => Promise<void>
  /**
   * Известный недостиг: кейс сверяется с регресс-потолком, а не с бюджетом INP
   * (как P5/P6 в first-render).
   */
  regressionCeiling?: number
  /** Бюджет класса Load вместо INP (разовая тяжёлая операция, не отклик). */
  loadBudget?: boolean
}

const CASES: InteractionCase[] = [
  {
    id: 'I1',
    label: 'выбор строки, небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    act: clickFirstRowCheckbox,
  },
  {
    id: 'I2',
    label: 'выбор строки, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    act: clickFirstRowCheckbox,
  },
  {
    id: 'I3',
    label:
      'шаг стрелкой, большая выборка, все плагины + клавиатурная навигация',
    args: { ...LARGE, ...ALL_PLUGINS, enableKeyboardNavigation: true },
    prepare: async () => {
      await expect.poll(() => firstBodyCell()).not.toBeNull()
      firstBodyCell()!.focus()
    },
    act: pressArrowDown,
  },
  {
    id: 'I4',
    label: 'скрытие колонки из меню колонок, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: async () => {
      await waitForColumnsButton()
      await openColumnsMenu()
    },
    // Смена набора колонок перерисовывает видимые строки 1000×1000 со всеми
    // плагинами (~170 мс под ×4); одной горячей точки в профиле нет.
    regressionCeiling: 250,
    act: async () => {
      columnsMenu()!
        .querySelector<HTMLElement>('[data-column-id] [role="checkbox"]')!
        .click()
    },
  },
  {
    id: 'I5',
    label: 'открытие меню колонок на 1000 колонок, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: waitForColumnsButton,
    act: async () => columnsButton()!.click(),
  },
  {
    id: 'I6',
    label: 'ввод в поиск меню колонок на 1000 колонок, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: async () => {
      await waitForColumnsButton()
      await openColumnsMenu()
    },
    act: typeIntoSearch,
  },
  {
    id: 'I7',
    label:
      'переход на следующую страницу по 100 строк, 100 000 строк, все плагины',
    size: '100 000×30',
    args: { ...PAGED, ...ALL_PLUGINS, ...PAGINATION, paginationPageSize: 100 },
    // Новая страница — строки с другими id: видимые строки монтируются заново со
    // всеми плагинами (~150–210 мс под ×4); одной горячей точки в профиле нет.
    regressionCeiling: 300,
    prepare: async () => {
      await expect.poll(() => pageButton('next')).not.toBeNull()
    },
    act: async () => pageButton('next')!.click(),
  },
  {
    id: 'I8',
    label: 'смена размера страницы 25 ↔ 100, 100 000 строк, все плагины',
    size: '100 000×30',
    args: { ...PAGED, ...ALL_PLUGINS, ...PAGINATION },
    // Строки первой страницы сохраняются, меняется высота тела и хвост строк
    // (~105–140 мс под ×4).
    regressionCeiling: 200,
    prepare: async () => {
      await expect.poll(() => pageSizeTrigger()).not.toBeNull()
    },
    // Замер повторяет действие (прогрев + замер), поэтому размер чередуется;
    // открытие списка — отдельная задача, в longest не попадает.
    act: async () => {
      const next = pageSizeTrigger()!.textContent?.includes('100')
        ? '25'
        : '100'
      pageSizeTrigger()!.click()
      await expect.poll(() => pageSizeOption(next)).toBeTruthy()
      pageSizeOption(next)!.click()
      await expect.poll(() => pageSizeTrigger()!.textContent?.trim()).toBe(next)
    },
  },
  {
    id: 'FL35',
    label: 'применение быстрого поиска, 100 000×10, все плагины',
    size: '100 000×10',
    args: { ...SEARCH_SIZE, ...ALL_PLUGINS, ...SEARCH },
    // Проход «содержит» по 1 000 000 ячеек — сам по себе 70–350 мс под ×4 (в
    // зависимости от совпадений); лишних перерисовок в профиле нет.
    regressionCeiling: 550,
    prepare: async () => {
      await expect.poll(quickSearchInput).not.toBeNull()
    },
    act: async () => alternate(quickSearchInput()!, 'a', 'e'),
  },
  {
    id: 'FL36',
    label: 'применение фильтра колонки, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...FILTERING },
    // Как I4: перерисовка видимых строк на 1000 колонок (~140 мс под ×4).
    regressionCeiling: 220,
    prepare: openCountryFilter,
    act: async () => alternate(filterValueInput()!, 'a', 'e'),
  },
  {
    id: 'DF22',
    label: 'применение фильтра даты, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...DATE_FILTERING },
    // Как FL36 и вдобавок перерисовка месяца календаря (~180 мс под ×4).
    regressionCeiling: 280,
    prepare: openDateFilter,
    act: toggleCalendarDay,
  },
  {
    id: 'EX33',
    label: 'выгрузка «Все данные», 100 000×10, все плагины',
    size: '100 000×10',
    loadBudget: true,
    args: { ...EXPORT_SIZE, ...ALL_PLUGINS, ...EXPORT },
    prepare: openExportPanel,
    act: exportWithoutDownload,
  },
]

describe('Отзывчивость взаимодействий (INP)', () => {
  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      async () => {
        renderGrid(c.args as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await c.prepare?.()

        // Нативные события (а не userEvent) — чтобы НЕ мерить тяжёлые проверки
        // видимости userEvent (getComputedStyle/checkVisibility), а только работу
        // приложения: обработчик → обновление стейта → ре-рендер → коммит.
        const result = await measureInteractionWork(c.act)
        const budget =
          c.regressionCeiling ??
          (c.loadBudget ? LOAD_BUDGET_MS : INTERACTION_BUDGET_MS)

        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'interaction',
          size:
            c.size ??
            (c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500'),
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: c.regressionCeiling !== undefined,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              budgetMs: budget,
              pass: result.longestMs <= budget,
              ...result,
            },
          ],
        })

        // Переключение выбора не переставляет строки/колонки — синхронная работа не
        // должна порождать длинную задачу. Превышение = лишние ре-рендеры (широкие
        // подписки компонентов на весь стейт).
        expect(
          result.longestMs,
          `longest=${result.longestMs.toFixed(1)}ms tasks=${result.taskCount}`,
        ).toBeLessThanOrEqual(budget)
      },
      PERF_TIMEOUT,
    )
  }
})

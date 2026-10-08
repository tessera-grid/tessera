import {
  constructTable,
  createCoreRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  stockFeatures,
  createExpandedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { cleanup } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  Stories,
  headCells,
  measureInteractionWork,
  measureTransitionWork,
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
import { createTesseraSortedRowModel } from '../../../plugins/columnSorting/sortedRowModel'
import { getTreeAria } from '../../../grid/treeAria'
import { createLazyCoreRowModel } from '../../../plugins/rowExpanding/lazyCoreRowModel'
import { createIncrementalExpandedRowModel } from '../../../plugins/rowExpanding/expandedRowModel'
import { createSearchAwareFilteredRowModel } from '../../../core/filteredRowModel'
import { createIdleAwareGroupedRowModel } from '../../../plugins/rowGrouping/groupedRowModel'
import {
  rowExpandingLazyFeature,
  setLoadedAnswer,
} from '../../../plugins/rowExpanding/lazyChildrenFeature'
import { exportFormats } from '../../../plugins/dataExport'
import { buildXlsx } from '../../../plugins/dataExport/xlsxBuild'
import { columns as mockColumns } from '../../__mocks__/columns'
import { getData, makeData } from '../../__mocks__/data'
import {
  makeOptionFilteringData,
  optionFilteringColumns,
} from '../../__mocks__/filteringData'

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

// Строка без детей: выбор строки с детьми выбрал бы и их (мок по умолчанию плоский).
const SELECT_ROW = 'item-id-1'
const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id='${id}']`,
  )
const isRowSelected = (id: string) =>
  rowOf(id)?.getAttribute('aria-selected') === 'true'

const firstBodyCell = () =>
  document.querySelector<HTMLElement>(
    ".data-grid__body-row[data-index='0'] .data-grid__body-cell[data-kn-cell]",
  )

const clickRowCheckbox = async () => {
  rowOf(SELECT_ROW)!.querySelector<HTMLElement>('.row-select-checkbox')!.click()
}

/** Прогрев выбрал одну строку, замер снял выбор. */
const SELECT_CHECKS = {
  afterWarmup: () => {
    // Детей нет и в данных: выбор строки не выбирает потомков.
    expect(
      getData(2).find(row => row.id === SELECT_ROW)?.subRows,
    ).toBeUndefined()
    expect(isRowSelected(SELECT_ROW)).toBe(true)
    expect(
      document.querySelectorAll('.data-grid__body-row[aria-selected="true"]'),
    ).toHaveLength(1)
  },
  verify: () => expect(isRowSelected(SELECT_ROW)).toBe(false),
}

/** Индекс строки активной (в фокусе) ячейки. */
const activeRowIndex = () =>
  document.activeElement?.closest<HTMLElement>('.data-grid__body-row')?.dataset
    .index

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
const firstColumnCheckbox = () =>
  columnsMenu()?.querySelector<HTMLElement>(
    '[data-column-id] [role="checkbox"]',
  )
const isColumnsMenuOpen = () => !!columnsMenu()?.hasAttribute('data-open')

/** Поповер грузится лениво: ждём настоящий триггер Base UI. */
const waitForColumnsButton = () =>
  expect
    .poll(() => columnsButton()?.hasAttribute('data-base-ui-click-trigger'))
    .toBe(true)

const openColumnsMenu = async () => {
  columnsButton()!.click()
  await expect.poll(() => columnsMenu()?.hasAttribute('data-open')).toBe(true)
}

const columnsSearch = () =>
  columnsMenu()!.querySelector<HTMLInputElement>('input')!

/**
 * Ввод в контролируемое поле React: нативный сеттер + событие input. Замер повторяет
 * действие — запрос чередуется: тот же текст React изменением не считает.
 */
const typeIntoSearch = async () => {
  const input = columnsSearch()
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, input.value === 'col_9' ? 'col_8' : 'col_9')
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const columnItems = () =>
  columnsMenu()?.querySelectorAll('[data-column-id]').length ?? 0

// Пагинация (ADR 0038): кнопка «вперёд» и выбор размера страницы в нижней панели.
const PAGINATION = { enablePagination: true }

const pageButton = (action: string) =>
  document.querySelector<HTMLElement>(`[data-page-action="${action}"]`)
const firstRowId = () =>
  document.querySelector<HTMLElement>(".data-grid__body-row[data-index='0']")
    ?.dataset.rowId
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

let exports = 0

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
  HTMLAnchorElement.prototype.click = () => {
    exports++
  }
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

const isDaySelected = (day: number) =>
  document
    .querySelector(
      `[data-testid="filter-calendar"] [data-day="${MONTH}-${pad(day)}"]`,
    )
    ?.hasAttribute('data-selected') ?? false

let dateFlip = false
const toggleCalendarDay = async () => {
  dateFlip = !dateFlip
  calendarDay(dateFlip ? 10 : 20)!.click()
}

/**
 * 100 000×10 с колонкой пола — select с вариантами (ADR 0048, SF25): фильтр по ней
 * при открытой панели пересчитывает строки и фасеты остальных колонок.
 */
const OPTION_FILTERING = {
  ...FILTERING,
  columnsOverride: mockColumns.slice(0, SEARCH_SIZE.columnCount).map(column =>
    column.id === 'gender'
      ? {
          ...column,
          options: [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ],
          filter: 'select',
        }
      : column,
  ),
}

const optionCheckbox = (value: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="filter-options"] [data-value="${value}"] [role="checkbox"]`,
  )

const openOptionFilter = (columnId: string) => async () => {
  const button = () =>
    document.querySelector<HTMLElement>(
      `.data-grid__head-cell[data-column-id="${columnId}"] .column-filter__button`,
    )
  await expect.poll(button).not.toBeNull()
  button()!.click()
  await expect
    .poll(() => document.querySelector('[data-testid="filter-options"]'))
    .not.toBeNull()
}

/** 30×500 с колонкой из 1000 вариантов первой (SF26). */
const MANY_OPTIONS = Array.from({ length: 1000 }, (_, i) => ({
  value: `v${i}`,
  label: `Value ${String(i).padStart(4, '0')}`,
}))
const MANY_OPTIONS_FILTERING = {
  ...FILTERING,
  columnsOverride: [
    {
      id: 'variant',
      accessorFn: (_: unknown, index: number) => `v${(index * 37) % 1000}`,
      header: 'Variant',
      options: MANY_OPTIONS,
      filter: 'select',
      size: 150,
    },
    ...mockColumns,
    ...Array.from(
      { length: SMALL.columnCount - mockColumns.length - 1 },
      (_, i) => ({
        id: `col_${i}`,
        accessorKey: `col_${i}`,
        header: `col_${i}`,
      }),
    ),
  ],
}

const variantButton = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="variant"] .column-filter__button',
  )

/** Открытие панели; открытую прежде закрывает (закрытие — отдельная короткая задача). */
const reopenVariantFilter = async () => {
  if (document.querySelector('[data-testid="filter-panel"]')) {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await expect
      .poll(() => document.querySelector('[data-testid="filter-panel"]'))
      .toBeNull()
  }
  variantButton()!.click()
  await expect
    .poll(() => document.querySelector('[data-testid="filter-options"]'))
    .not.toBeNull()
}

/** Вложенная шапка с перетаскиванием групп (ADR 0052, ND14). */
const NESTED_DRAG = {
  headerNesting: 'nested',
  enableColumnDragging: true,
  enableKeyboardNavigation: true,
  dataCount: 1000,
}
const headOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )

/** Группа «Name» — через соседа «Info» и обратно (Alt+Shift+→/←). */
const moveNameGroup = async () => {
  const name = headOf('name')!
  const right =
    name.getBoundingClientRect().left <
    headOf('info')!.getBoundingClientRect().left
  const before = name.getBoundingClientRect().left
  name.focus()
  name.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: right ? 'ArrowRight' : 'ArrowLeft',
      altKey: true,
      shiftKey: true,
      bubbles: true,
    }),
  )
  await expect
    .poll(() => headOf('name')!.getBoundingClientRect().left)
    .not.toBe(before)
}

// Ленивые дети (ADR 0054, RE38): две корневые строки без детей в данных помечены
// `hasChildren` (мок по умолчанию плоский; строка с детьми в данных не была бы ленивой),
// `loadChildren` отдаёт заранее собранные 100 детей синхронно — замеряется приход
// ответа: пересборка исходной модели 100 000 корней и отрисовка детей. Прогрев
// раскрывает нижнюю строку, замер — верхнюю.
const LAZY_KIDS = 100
const lazyKids = (() => {
  const rows = makeData({ shape: 'flat', count: LAZY_KIDS })
  const byParent = new Map<string, unknown[]>()
  return (parentId: string) => {
    if (!byParent.has(parentId)) {
      byParent.set(
        parentId,
        rows.map((row, i) => ({ ...row, id: `${parentId}-k${i}` })),
      )
    }
    return byParent.get(parentId)!
  }
})()
const LAZY_ROOTS = ['item-id-1', 'item-id-2']
const LAZY_CHILDREN = {
  enableRowExpanding: true,
  rowExpandingHasChildren: (row: { depth: number; id: string }) =>
    row.depth === 0 && LAZY_ROOTS.includes(row.id),
  rowExpandingLoadChildren: (row: { id: string }) => lazyKids(row.id),
}
/** Замеренный приход показал детей ответа под верхней ленивой строкой. */
const expectLazyArrival = () =>
  expect(
    document.querySelector(
      `.data-grid__body-row[data-row-id='${LAZY_ROOTS[0]}-k0']`,
    ),
  ).not.toBeNull()
// Нижняя свёрнутая ленивая строка: дети прогрева не вытесняют из окна ту, что выше.
const collapsedLazyToggle = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      ".data-grid__body-row[data-expanded='false']",
    ),
  ]
    .filter(row => LAZY_ROOTS.includes(row.dataset.rowId ?? ''))
    .sort((a, b) => Number(b.dataset.index) - Number(a.dataset.index))[0]
    ?.querySelector<HTMLElement>('.row-expand-button')

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
   * Вне трейса после прогрева (замер повторяет то же действие): проверить, что прогрев
   * сделал измеряемое, и при нужде вернуть состояние.
   */
  afterWarmup?: () => void | Promise<void>
  /** Проверка после замера, что взаимодействие сделало то, что мерится. */
  verify?: () => void
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
    act: clickRowCheckbox,
    ...SELECT_CHECKS,
  },
  {
    id: 'I2',
    label: 'выбор строки, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    // У края бюджета: ~80 мс под ×4 отдельно, до ~100 мс в полной матрице.
    regressionCeiling: 150,
    act: clickRowCheckbox,
    ...SELECT_CHECKS,
  },
  {
    id: 'I3',
    label:
      'шаг стрелкой, большая выборка, все плагины + клавиатурная навигация',
    args: { ...LARGE, ...ALL_PLUGINS, enableKeyboardNavigation: true },
    // У края бюджета: ~80–90 мс под ×4 отдельно, до ~120 мс в полной матрице.
    regressionCeiling: 150,
    prepare: async () => {
      await expect.poll(() => firstBodyCell()).not.toBeNull()
      firstBodyCell()!.focus()
    },
    act: pressArrowDown,
    afterWarmup: () => expect(activeRowIndex()).toBe('1'),
    verify: () => expect(activeRowIndex()).toBe('2'),
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
    // плагинами (~200–250 мс под ×4, выбросы до ~310); одной горячей точки в профиле нет.
    regressionCeiling: 320,
    act: async () => firstColumnCheckbox()!.click(),
    // Прогрев скрыл колонку, замер вернул.
    afterWarmup: () =>
      expect(firstColumnCheckbox()!.getAttribute('aria-checked')).toBe('false'),
    verify: () =>
      expect(firstColumnCheckbox()!.getAttribute('aria-checked')).toBe('true'),
  },
  {
    id: 'I5',
    label: 'открытие меню колонок на 1000 колонок, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: waitForColumnsButton,
    act: async () => columnsButton()!.click(),
    // Прогрев открыл меню; закрываем вне замера — замер мерит открытие.
    afterWarmup: async () => {
      expect(isColumnsMenuOpen()).toBe(true)
      columnsButton()!.click()
      await expect.poll(columnsMenu).toBeNull()
    },
    verify: () => expect(isColumnsMenuOpen()).toBe(true),
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
    afterWarmup: () => {
      expect(columnsSearch().value).toBe('col_9')
      expect(columnItems()).toBeLessThan(LARGE.columnCount)
    },
    verify: () => expect(columnsSearch().value).toBe('col_8'),
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
    afterWarmup: () => expect(firstRowId()).toBe('item-id-100'),
    verify: () => expect(firstRowId()).toBe('item-id-200'),
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
    // зависимости от совпадений); лишних перерисовок в профиле нет. Кейс целиком —
    // ~420–480 мс.
    regressionCeiling: 600,
    prepare: async () => {
      await expect.poll(quickSearchInput).not.toBeNull()
    },
    act: async () => alternate(quickSearchInput()!, 'a', 'e'),
    afterWarmup: () => expect(quickSearchInput()!.value).toBe('a'),
    verify: () => expect(quickSearchInput()!.value).toBe('e'),
  },
  {
    id: 'FL36',
    label: 'применение фильтра колонки, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...FILTERING },
    // Как I4: перерисовка видимых строк на 1000 колонок (~150–155 мс под ×4).
    regressionCeiling: 220,
    prepare: openCountryFilter,
    act: async () => alternate(filterValueInput()!, 'a', 'e'),
    afterWarmup: () => expect(filterValueInput()!.value).toBe('a'),
    verify: () => expect(filterValueInput()!.value).toBe('e'),
  },
  {
    id: 'DF22',
    label: 'применение фильтра даты, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...DATE_FILTERING },
    // Как FL36 и вдобавок перерисовка месяца календаря (~180 мс под ×4).
    regressionCeiling: 280,
    prepare: openDateFilter,
    act: toggleCalendarDay,
    afterWarmup: () => expect(isDaySelected(10)).toBe(true),
    verify: () => expect(isDaySelected(20)).toBe(true),
  },
  {
    id: 'SF25',
    label: 'применение фильтра варианта с фасетами, 100 000×10, все плагины',
    size: '100 000×10',
    args: { ...SEARCH_SIZE, ...ALL_PLUGINS, ...OPTION_FILTERING },
    // Как FL35: проход фильтра по 100 000 строкам и перерисовка; фасеты в замере не
    // видны — без счётчиков столько же (~400–440 мс под ×4).
    regressionCeiling: 600,
    prepare: openOptionFilter('gender'),
    // Прогрев отмечает «male», замер — «female»: оба щелчка применяют фильтр, а не снимают.
    act: async () =>
      optionCheckbox(
        optionCheckbox('male')!.getAttribute('aria-checked') === 'true'
          ? 'female'
          : 'male',
      )!.click(),
    afterWarmup: () =>
      expect(optionCheckbox('male')!.getAttribute('aria-checked')).toBe('true'),
    verify: () =>
      expect(optionCheckbox('female')!.getAttribute('aria-checked')).toBe(
        'true',
      ),
  },
  {
    id: 'SF26',
    label: 'открытие панели с 1000 вариантов, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS, ...MANY_OPTIONS_FILTERING },
    prepare: async () => {
      await expect.poll(variantButton).not.toBeNull()
    },
    act: reopenVariantFilter,
  },
  {
    id: 'EX33',
    label: 'выгрузка «Все данные», 100 000×10, все плагины',
    size: '100 000×10',
    loadBudget: true,
    args: { ...EXPORT_SIZE, ...ALL_PLUGINS, ...EXPORT },
    prepare: async () => {
      exports = 0
      await openExportPanel()
    },
    act: exportWithoutDownload,
    afterWarmup: () => expect(exports).toBe(1),
    verify: () => expect(exports).toBe(2),
  },
  {
    id: 'ND14',
    label: 'перестановка группы на вложенной шапке, 1000 строк',
    size: '1000×7 (вложенная шапка)',
    args: NESTED_DRAG,
    prepare: async () => {
      await expect.poll(() => headOf('name')).not.toBeNull()
    },
    act: moveNameGroup,
  },
  {
    id: 'RE38',
    label: 'приход 100 детей ленивой строки, 100 000×10, все плагины',
    size: '100 000×10',
    args: { ...SEARCH_SIZE, ...ALL_PLUGINS, ...LAZY_CHILDREN },
    // Известный недостиг: ответ пересобирает модели (инкрементно, ADR 0067; без
    // холостых проходов, ADR 0068; без копии rowsById, ADR 0069; раскрытие из прошлого,
    // ADR 0070) и перерисовывает тело на 100 000 корней (~215–225 мс под ×4); план —
    // «Дешёвый приход ленивых детей» в roadmap.
    regressionCeiling: 300,
    prepare: async () => {
      await expect.poll(collapsedLazyToggle).toBeTruthy()
      LAZY_ROOTS.forEach(id => lazyKids(id))
    },
    act: async () => collapsedLazyToggle()!.click(),
    verify: expectLazyArrival,
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
        const result = await measureInteractionWork(c.act, {
          afterWarmup: c.afterWarmup,
        })
        c.verify?.()
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

// Подсветка прихода (ADR 0056, RE50): тот же приход 100 детей, что в RE38, но ответом
// сервера — отметки прихода, слой строк и объявление — против синхронного ответа без
// них. Длиннейшая задача — ожидание или приход, каждая отдельно. Каждый замер — свежий грид; прогрев раскрывает одну строку, замер — другую.
describe('Отзывчивость взаимодействий — подсветка прихода', () => {
  test(
    'RE50: приход 100 детей с подсветкой на 100 000 корней не хуже прихода без неё',
    async () => {
      const measure = async (async: boolean) => {
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          ...LAZY_CHILDREN,
          ...(async
            ? {
                // Ответ — отдельной задачей, как у сервера: ожидание и приход не
                // склеиваются в одну задачу.
                rowExpandingLoadChildren: (row: { id: string }) =>
                  new Promise(resolve =>
                    setTimeout(() => resolve(lazyKids(row.id)), 0),
                  ),
              }
            : {}),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect.poll(collapsedLazyToggle).toBeTruthy()
        LAZY_ROOTS.forEach(id => lazyKids(id))
        const result = await measureInteractionWork(async () =>
          collapsedLazyToggle()!.click(),
        )
        expectLazyArrival()
        await cleanup()
        return result
      }
      const base = await measure(false)
      const lit = await measure(true)
      // Шум замера взаимодействия на 100 000 строк — до ~15%; больше — регрессия.
      const ceiling = Math.max(base.longestMs * 1.15, base.longestMs + 40)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×10',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record(
        'RE50-base',
        'приход 100 детей синхронно, без подсветки',
        base,
        false,
      )
      await record('RE50', 'приход 100 детей промисом, с подсветкой', lit, true)

      expect(
        lit.longestMs,
        `с подсветкой longest=${lit.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Скелет первой загрузки (ADR 0060, SL15): смена скелета на данные (выключение
// `enableSkeleton`) — самая длинная задача в пределах регресс-потолка против прежнего
// оверлея. База — его замер на 2026-10-07 (до ADR 0060); прежний оверлей делил смену
// на две задачи паузой 200 мс, теперь она одна.
const SKELETON_SWAP_BASE_MS = { small: 112, large: 131 }

describe('Отзывчивость — смена скелета на данные', () => {
  test(
    'SL15: смена скелета на данные — самая длинная задача в пределах регресс-потолка против прежнего оверлея',
    async () => {
      const sizes = [
        { key: 'small', size: SMALL, label: '30×500' },
        { key: 'large', size: LARGE, label: '1000×1000' },
      ] as const
      const rowsReady = () =>
        !!document.querySelector('.data-grid__body .data-grid__body-row')
      for (const { key, size, label } of sizes) {
        const args = { ...size, ...ALL_PLUGINS }
        const measureSwap = async () => {
          const screen = await renderGrid({ ...args, enableSkeleton: true })
          await expect
            .poll(() => document.querySelector('.data-grid__body--skeleton'), {
              timeout: 20_000,
            })
            .toBeTruthy()
          const result = await measureTransitionWork(async () => {
            await screen.rerender(
              <Stories.AllFeatures
                containerHeight={600}
                height={500}
                {...args}
                enableSkeleton={false}
              />,
            )
          }, rowsReady)
          await screen.unmount()
          return result
        }
        // Прогрев JIT вне замера.
        // eslint-disable-next-line no-await-in-loop
        await measureSwap()
        // eslint-disable-next-line no-await-in-loop
        const result = await measureSwap()
        const ceiling = Math.max(
          SKELETON_SWAP_BASE_MS[key] * 1.3,
          SKELETON_SWAP_BASE_MS[key] + 40,
        )
        // eslint-disable-next-line no-await-in-loop
        await recordPerf({
          id: `SL15-${key}`,
          label: `смена скелета на данные, ${label}, все плагины`,
          operation: 'interaction',
          size: label,
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              budgetMs: ceiling,
              pass: result.longestMs <= ceiling,
              ...result,
            },
          ],
        })
        expect(
          result.longestMs,
          `${label}: longest=${result.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(0)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT,
  )
})

// Сортировка по подписи (ADR 0063, OS11): первый клик сортировки колонки менеджера на
// 100 000 строк — с подписями `getOptionLabel` против той же колонки без них
// (сортировка по id). Каждый замер — свежий грид.
const OPTION_SORT_DATA = makeOptionFilteringData(100_000)
const managerColumn = (labelled: boolean) =>
  optionFilteringColumns.map(column =>
    column.id === 'managerId' && !labelled
      ? { ...column, getOptionLabel: undefined, filter: undefined }
      : column,
  )

const sortOf = (columnId: string) =>
  document
    .querySelector(`.data-grid__head-cell[data-column-id="${columnId}"]`)
    ?.getAttribute('aria-sort')

describe('Отзывчивость — сортировка по подписи', () => {
  test(
    'OS11: сортировка 100 000 строк по колонке lookup — в пределах регресс-потолка против той же колонки без подписей',
    async () => {
      const measure = async (labelled: boolean) => {
        await renderGrid({
          ...ALL_PLUGINS,
          columnsOverride: managerColumn(labelled),
          dataOverride: OPTION_SORT_DATA,
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const button = () =>
          document.querySelector<HTMLElement>(
            '.data-grid__head-cell[data-column-id="managerId"] .column-sort__button',
          )
        await expect.poll(button).toBeTruthy()
        // Прогрев сортирует другую колонку: замер — первый клик по колонке менеджера.
        let warmed = false
        const result = await measureInteractionWork(
          async () => {
            const target = warmed ? 'managerId' : 'name'
            warmed = true
            document
              .querySelector<HTMLElement>(
                `.data-grid__head-cell[data-column-id="${target}"] .column-sort__button`,
              )!
              .click()
          },
          { afterWarmup: () => expect(sortOf('name')).not.toBe('none') },
        )
        expect([sortOf('managerId'), sortOf('name')]).toEqual([
          expect.not.stringMatching(/^none$/),
          'none',
        ])
        await cleanup()
        return result
      }
      const base = await measure(false)
      const labelled = await measure(true)
      // Подпись сравнивается Intl.Collator, id — простым сравнением: ~+20–30% (база
      // ~490–565 мс, по подписи ~655–680 мс под ×4); запас на шум замера.
      const ceiling = Math.max(base.longestMs * 1.5, base.longestMs + 300)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×5',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('OS11-base', 'сортировка по id, без подписей', base, false)
      await record('OS11', 'сортировка по подписи', labelled, true)

      expect(
        labelled.longestMs,
        `по подписи longest=${labelled.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Своя отсортированная модель (ADR 0064, SM7): построение модели на 100 000 строк —
// смена направления сортировки и сразу модель — против createSortedRowModel TanStack
// на тех же данных. Headless-таблицы без рендера: меряется только модель.
const MODEL_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${(i * 7919) % 100_000}`,
  num: (i * 104_729) % 1000,
}))

const sortedModelTable = (factory: () => unknown) =>
  constructTable({
    features: tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
      rowSortingFeature,
      sortedRowModel: factory(),
      sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
    } as never),
    data: MODEL_ROWS,
    columns: [
      { id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' },
      { id: 'num', accessorKey: 'num', sortFn: 'basic' },
    ],
    getRowId: (row: { id: string }) => row.id,
  } as never) as unknown as {
    setSorting: (sorting: { id: string; desc: boolean }[]) => void
    getSortedRowModel: () => unknown
  }

describe('Своя отсортированная модель', () => {
  test(
    'SM7: построение модели на 100 000 строк — не дольше половины модели TanStack',
    async () => {
      const measure = async (factory: () => unknown) => {
        const table = sortedModelTable(factory)
        let desc = false
        return measureInteractionWork(async () => {
          desc = !desc
          table.setSorting([
            { id: 'name', desc },
            { id: 'num', desc: false },
          ])
          table.getSortedRowModel()
        })
      }
      const theirs = await measure(createSortedRowModel)
      const ours = await measure(createTesseraSortedRowModel)
      const ceiling = theirs.longestMs / 2
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×2',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('SM7-base', 'модель TanStack', theirs, false)
      await record('SM7', 'модель Tessera', ours, true)

      expect(
        ours.longestMs,
        `Tessera longest=${ours.longestMs.toFixed(1)}ms, TanStack ${theirs.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// aria-* дерева без объекта на строку (ADR 0065, TA3): счёт на 100 000 корней со 100
// детьми у двух — как в RE38 — против прежнего алгоритма (Map по parentId, объект на
// строку) в том же замере. Счёт повторяется 10 раз за действие: один проход короче
// порога замера задачи.
const TREE_ARIA_REPEAT = 10
// Строки — настоящие строки модели TanStack: на простых объектах счёт дешевле.
type TreeAriaRow = { id: string; depth: number; parentId?: string }
// Строится в самом тесте: таблица на 100 000 строк на весь прогон файла давит на
// сборку мусора соседних кейсов.
const makeTreeAriaRows = () => {
  const data = Array.from({ length: 100_000 }, (_, i) => ({
    id: `r${i}`,
    children:
      i < 2
        ? Array.from({ length: 100 }, (_, k) => ({ id: `r${i}-${k}` }))
        : [],
  }))
  const table = constructTable({
    features: tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
      rowExpandingFeature,
      expandedRowModel: createExpandedRowModel(),
    } as never),
    data,
    columns: [{ id: 'id', accessorKey: 'id' }],
    getRowId: (row: { id: string }) => row.id,
    getSubRows: (row: { children?: unknown[] }) => row.children,
    initialState: { expanded: { r0: true, r1: true } },
  } as never) as unknown as { getRowModel: () => { rows: TreeAriaRow[] } }
  return table.getRowModel().rows
}

/** Прежний счёт тела: соседи по parentId в Map, объект атрибутов на строку. */
const treeAriaByObjects = (rows: TreeAriaRow[]) => {
  const siblings = new Map<string, TreeAriaRow[]>()
  for (const row of rows) {
    const key = row.parentId ?? ''
    const group = siblings.get(key)
    if (group) group.push(row)
    else siblings.set(key, [row])
  }
  const aria = new Map<string, object>()
  for (const group of siblings.values()) {
    group.forEach((row, index) =>
      aria.set(row.id, {
        'aria-level': row.depth + 1,
        'aria-setsize': group.length,
        'aria-posinset': index + 1,
      }),
    )
  }
  return aria
}

describe('aria-* дерева', () => {
  test(
    'TA3: счёт aria-* дерева на 100 000 строк — не дольше четверти прежнего',
    async () => {
      const rows = makeTreeAriaRows()
      const theirs = await measureInteractionWork(async () => {
        for (let i = 0; i < TREE_ARIA_REPEAT; i++) {
          treeAriaByObjects(rows)
        }
      })
      const ours = await measureInteractionWork(async () => {
        for (let i = 0; i < TREE_ARIA_REPEAT; i++) {
          getTreeAria(rows)
        }
      })
      const ceiling = theirs.longestMs / 4
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 строк',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('TA3-base', 'объект на строку', theirs, false)
      await record('TA3', 'типизированные массивы', ours, true)

      expect(
        ours.longestMs,
        `новый longest=${ours.longestMs.toFixed(1)}ms, прежний ${theirs.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT,
  )
})

// Склейка ответов (ADR 0066, RE73): пять ответов `loadChildren`, пришедших отдельными
// задачами до кадра, против одного ответа на том же гриде. Без склейки каждый ответ —
// своя пересборка модели и перерисовка; пачка — не больше двух длинных задач, а её TBT не
// больше половины пяти приходов. Ответы — промисы, которые разрешает тест.
describe('Отзывчивость взаимодействий — склейка ответов', () => {
  test(
    'RE73: пять ответов отдельными задачами на 100 000 корней — не больше двух длинных задач, TBT не больше половины пяти приходов одного ответа',
    async () => {
      const resolvers = new Map<string, () => void>()
      await renderGrid({
        ...SEARCH_SIZE,
        ...ALL_PLUGINS,
        ...LAZY_CHILDREN,
        rowExpandingHasChildren: (row: { depth: number; index: number }) =>
          row.depth === 0 && row.index < 8,
        rowExpandingLoadChildren: (row: { id: string }) =>
          new Promise(resolve =>
            resolvers.set(row.id, () => resolve(lazyKids(row.id))),
          ),
      } as Parameters<typeof renderGrid>[0])
      await waitForGrid()
      const toggleOf = (id: string) =>
        document.querySelector<HTMLElement>(
          `.data-grid__body-row[data-row-id='${id}'] .row-expand-button`,
        )
      const idle = () =>
        !document.querySelector('.row-expand-button[aria-busy]')
      /** Раскрыть строки (ожидание), затем под трейсом разрешить их ответы отдельными задачами. */
      const arrive = async (ids: string[]) => {
        await expect.poll(() => ids.every(id => toggleOf(id))).toBe(true)
        ids.forEach(id => lazyKids(id))
        ids.forEach(id => toggleOf(id)!.click())
        await expect.poll(() => ids.every(id => resolvers.has(id))).toBe(true)
        // Раскрытие (модель, тело, эффекты) не попадает в замер прихода.
        for (let i = 0; i < 10; i++) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise(requestAnimationFrame)
        }
        return measureTransitionWork(async () => {
          ids.forEach(id => setTimeout(() => resolvers.get(id)!(), 0))
        }, idle)
      }
      // Прогрев: JIT пути прихода. Ниже раскрываются строки снизу вверх — дети
      // раскрытой строки не уводят остальные из окна.
      await arrive(['item-id-7'])
      const single = await arrive(['item-id-6'])
      const batch = await arrive([
        'item-id-5',
        'item-id-4',
        'item-id-3',
        'item-id-2',
        'item-id-1',
      ])
      await cleanup()
      // Без склейки пять ответов — пять приходов (~5× TBT); пачка — одна задача, в которую
      // может попасть сборка мусора, поэтому порог — половина пяти приходов.
      const ceiling = single.tbtMs * 2.5
      const record = (
        id: string,
        label: string,
        r: typeof single,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×10',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'tbt',
              valueMs: r.tbtMs,
              budgetMs: ceiling,
              pass: !gated || r.tbtMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('RE73-base', 'приход одного ответа промисом', single, false)
      await record(
        'RE73',
        'пять ответов отдельными задачами до кадра',
        batch,
        true,
      )

      expect(
        batch.tbtMs,
        `пачка TBT=${batch.tbtMs.toFixed(1)}ms (long ${batch.longTasks}), один ответ TBT=${single.tbtMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
      // Применение пачки и отрисовка её строк — до двух длинных задач; без склейки — до десяти.
      expect(
        batch.longTasks,
        `длинных задач в пачке: ${batch.longTasks}`,
      ).toBeLessThanOrEqual(2)
    },
    PERF_TIMEOUT * 2,
  )
})

// Инкрементальная исходная модель (ADR 0067, IM8): приход 100 детей у корня на 100 000
// корней — сборка модели из прежней против полной сборки TanStack на тех же данных
// (новая ссылка data — полная пересборка). Headless-таблицы без рендера со штатными
// фичами TanStack — строка платит за их инициализацию, как в гриде; ответ
// чередуется между двумя наборами детей, чтобы каждое действие его меняло.
const LAZY_MODEL_ROOTS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
}))
const lazyAnswer = (tag: string) =>
  Array.from({ length: 100 }, (_, i) => ({
    id: `r0-${tag}${i}`,
    name: `Kid ${i}`,
  }))
const LAZY_ANSWERS = [lazyAnswer('a'), lazyAnswer('b')]

describe('Инкрементальная исходная модель', () => {
  test(
    'IM8: сборка модели при приходе 100 детей на 100 000 корней — не дольше четверти полной сборки и 75 мс',
    async () => {
      const columns = [{ id: 'name', accessorKey: 'name' }]
      const getRowId = (row: { id: string }) => row.id

      const incremental = async () => {
        const table = constructTable({
          features: tableFeatures({
            ...stockFeatures,
            coreReactivityFeature: storeReactivityBindings(),
            rowExpandingLazyFeature,
            coreRowModel: createLazyCoreRowModel(),
          } as never),
          data: LAZY_MODEL_ROOTS,
          columns,
          getRowId,
        } as never) as unknown as { getCoreRowModel: () => unknown }
        table.getCoreRowModel()
        let turn = 0
        return measureInteractionWork(async () => {
          const kids = LAZY_ANSWERS[turn++ % 2]!
          setLoadedAnswer(table, prev => ({ ...prev, r0: kids }))
          table.getCoreRowModel()
        })
      }

      const full = async () => {
        let kids = LAZY_ANSWERS[0]!
        const table = constructTable({
          features: tableFeatures({
            ...stockFeatures,
            coreReactivityFeature: storeReactivityBindings(),
            coreRowModel: createCoreRowModel(),
          } as never),
          data: LAZY_MODEL_ROOTS,
          columns,
          getRowId,
          getSubRows: (row: { id: string }) =>
            row.id === 'r0' ? kids : undefined,
        } as never) as unknown as {
          getCoreRowModel: () => unknown
          options: { data: unknown }
        }
        table.getCoreRowModel()
        let turn = 0
        return measureInteractionWork(async () => {
          kids = LAZY_ANSWERS[turn++ % 2]!
          table.options.data = [...LAZY_MODEL_ROOTS]
          table.getCoreRowModel()
        })
      }

      const base = await full()
      const ours = await incremental()
      // Словарь rowsById переходит новой модели без копии (ADR 0069).
      // Абсолютный регресс-потолок ~3× замера: ловит замедление вместе с базой.
      const ceiling = Math.min(base.longestMs / 4, 75)
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 корней',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('IM8-base', 'полная сборка TanStack', base, false)
      await record('IM8', 'сборка из прежней модели', ours, true)

      expect(
        ours.longestMs,
        `инкремент longest=${ours.longestMs.toFixed(1)}ms, полная ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Холостые проходы (ADR 0068, PT7): фильтрация без фильтров и группировка без
// группировки на 100 000 строк — обёртки Tessera против фабрик TanStack в том же
// замере. Модель на входе чередуется между двумя готовыми исходными моделями: каждое
// действие её меняет, а сборка исходной модели в замер не входит.
const IDLE_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  city: `City ${i % 50}`,
}))

describe('Холостые проходы фильтрации и группировки', () => {
  test(
    'PT7: холостые проходы фильтрации и группировки на 100 000 строк — не дольше десятой доли проходов TanStack и 10 мс',
    async () => {
      const columns = [
        { id: 'name', accessorKey: 'name' },
        { id: 'city', accessorKey: 'city' },
      ]
      const getRowId = (row: { id: string }) => row.id
      const features = {
        ...stockFeatures,
        coreReactivityFeature: storeReactivityBindings(),
      }
      const source = constructTable({
        features: tableFeatures({
          ...features,
          coreRowModel: createCoreRowModel(),
        } as never),
        data: IDLE_ROWS,
        columns,
        getRowId,
      } as never) as unknown as {
        getCoreRowModel: () => unknown
        options: { data: unknown }
      }
      const inputs = [source.getCoreRowModel()]
      source.options.data = [...IDLE_ROWS]
      inputs.push(source.getCoreRowModel())

      const passes = async (
        filteredRowModel: unknown,
        groupedRowModel: unknown,
      ) => {
        let turn = 0
        const table = constructTable({
          features: tableFeatures({
            ...features,
            coreRowModel: () => () => inputs[turn % 2],
            filteredRowModel,
            groupedRowModel,
          } as never),
          data: IDLE_ROWS,
          columns,
          getRowId,
        } as never) as unknown as { getGroupedRowModel: () => unknown }
        table.getGroupedRowModel()
        return measureInteractionWork(async () => {
          turn++
          table.getGroupedRowModel()
        })
      }

      const base = await passes(
        createFilteredRowModel(),
        createGroupedRowModel(),
      )
      const ours = await passes(
        createSearchAwareFilteredRowModel(),
        createIdleAwareGroupedRowModel(),
      )
      // Абсолютный регресс-потолок ~3× замера: ловит замедление вместе с базой.
      const ceiling = Math.min(base.longestMs / 10, 10)
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 строк',
          plugins: 'columnFiltering, rowGrouping',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('PT7-base', 'холостые проходы TanStack', base, false)
      await record('PT7', 'холостые проходы Tessera', ours, true)

      expect(
        ours.longestMs,
        `Tessera longest=${ours.longestMs.toFixed(1)}ms, TanStack ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Инкрементальная модель раскрытия (ADR 0070, XM5): приход 100 детей у раскрытого корня
// на 100 000 корней — пересчёт модели раскрытия против фабрики TanStack в том же замере.
// Две входные модели собирает инкрементальная исходная модель (корни, кроме изменённого,
// — те же объекты); модель на входе чередуется между ними, её сборка в замер не входит.
describe('Инкрементальная модель раскрытия', () => {
  test(
    'XM5: пересчёт модели раскрытия после прихода 100 детей на 100 000 корней — не дольше четверти TanStack и 20 мс',
    async () => {
      const columns = [{ id: 'name', accessorKey: 'name' }]
      const getRowId = (row: { id: string }) => row.id
      const expanded = { r0: true, r50000: true }
      const source = constructTable({
        features: tableFeatures({
          ...stockFeatures,
          coreReactivityFeature: storeReactivityBindings(),
          rowExpandingLazyFeature,
          coreRowModel: createLazyCoreRowModel(),
        } as never),
        data: LAZY_MODEL_ROOTS,
        columns,
        getRowId,
        initialState: { expanded },
      } as never) as unknown as { getCoreRowModel: () => unknown }
      const inputs = LAZY_ANSWERS.map(kids => {
        setLoadedAnswer(source, prev => ({ ...prev, r0: kids }))
        return source.getCoreRowModel()
      })

      const recompute = async (expandedRowModel: unknown) => {
        let turn = 0
        const table = constructTable({
          features: tableFeatures({
            ...stockFeatures,
            coreReactivityFeature: storeReactivityBindings(),
            coreRowModel: () => () => inputs[turn % 2],
            expandedRowModel,
          } as never),
          data: LAZY_MODEL_ROOTS,
          columns,
          getRowId,
          initialState: { expanded },
        } as never) as unknown as { getExpandedRowModel: () => unknown }
        table.getExpandedRowModel()
        return measureInteractionWork(async () => {
          turn++
          table.getExpandedRowModel()
        })
      }

      const base = await recompute(createExpandedRowModel())
      const ours = await recompute(createIncrementalExpandedRowModel())
      // Абсолютный регресс-потолок ~3× замера: ловит замедление вместе с базой.
      const ceiling = Math.min(base.longestMs / 4, 20)
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 корней',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('XM5-base', 'модель раскрытия TanStack', base, false)
      await record('XM5', 'модель раскрытия из прошлой', ours, true)

      expect(
        ours.longestMs,
        `инкремент longest=${ours.longestMs.toFixed(1)}ms, TanStack ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Сортировка из прошлой модели (ADR 0072, SM12): приход 100 детей ленивой строки на
// 100 000 корней при активной сортировке по имени — сборка из прошлой против полной
// сортировки в том же замере. Полную вызывает смена направления на каждом действии: срез
// с тем же содержимым атом не меняет (сравнение по значению).
// Headless-таблицы со штатными фичами TanStack и ленивой исходной моделью.
const SORTED_ROOTS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${(i * 7919) % 100_000}`,
}))

describe('Сортировка из прошлой модели', () => {
  test(
    'SM12: приход 100 детей на 100 000 корней при активной сортировке — не дольше десятой доли полной сортировки и 100 мс',
    async () => {
      const sorting = [{ id: 'name', desc: false }]
      const arrival = async (full: boolean) => {
        const table = constructTable({
          features: tableFeatures({
            ...stockFeatures,
            coreReactivityFeature: storeReactivityBindings(),
            rowExpandingLazyFeature,
            coreRowModel: createLazyCoreRowModel(),
            sortedRowModel: createTesseraSortedRowModel(),
            sortFns: { alphanumeric: sortFn_alphanumeric },
          } as never),
          data: SORTED_ROOTS,
          columns: [
            { id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' },
          ],
          getRowId: (row: { id: string }) => row.id,
          initialState: { sorting },
        } as never) as unknown as {
          getSortedRowModel: () => unknown
          setSorting: (next: typeof sorting) => void
        }
        table.getSortedRowModel()
        let turn = 0
        return measureInteractionWork(async () => {
          const kids = LAZY_ANSWERS[turn++ % 2]!
          setLoadedAnswer(table, prev => ({ ...prev, r0: kids }))
          if (full) table.setSorting([{ id: 'name', desc: turn % 2 === 0 }])
          table.getSortedRowModel()
        })
      }

      const base = await arrival(true)
      const ours = await arrival(false)
      // Абсолютный регресс-потолок ~3× замера: ловит замедление вместе с базой.
      const ceiling = Math.min(base.longestMs / 10, 100)
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 корней',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('SM12-base', 'приход с полной сортировкой', base, false)
      await record('SM12', 'приход с сортировкой из прошлой', ours, true)

      expect(
        ours.longestMs,
        `из прошлой longest=${ours.longestMs.toFixed(1)}ms, полная ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Сборка .xlsx (ADR 0073, XL11): 100 000 × 10 — генератор кусками с отдачей потока и
// сжатием вне его против CSV того же объёма в том же замере. Сбор данных из таблицы
// общий для форматов и в замер не входит.
const XLSX_COLUMNS = Array.from({ length: 10 }, (_, i) => ({
  id: `c${i}`,
  header: `Column ${i}`,
  size: 120,
  ...(i === 3 ? { filter: 'date' } : {}),
}))
const XLSX_ROWS = Array.from({ length: 100_000 }, (_, r) =>
  XLSX_COLUMNS.map((_, c) =>
    c === 0
      ? `Name ${r}`
      : c === 3
        ? `2026-${String((r % 12) + 1).padStart(2, '0')}-15`
        : c % 2
          ? r * c
          : `Value ${r % 97}`,
  ),
)

describe('Экспорт в Excel', () => {
  test(
    'XL11: сборка .xlsx 100 000 × 10 — самая длинная задача главного потока не дольше 50 мс (база — CSV того же объёма)',
    async () => {
      const data = { columns: XLSX_COLUMNS, rows: XLSX_ROWS }
      let csvSize = 0
      let xlsxSize = 0
      const base = await measureInteractionWork(async () => {
        csvSize = exportFormats.csv().serialize(data).length
      })
      const ours = await measureInteractionWork(async () => {
        xlsxSize = (await buildXlsx(data)).size
      })
      expect(csvSize).toBeGreaterThan(0)
      expect(xlsxSize).toBeGreaterThan(0)

      const ceiling = 50
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×10',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: ceiling,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('XL11-base', 'сериализация CSV', base, false)
      await record('XL11', 'сборка .xlsx кусками', ours, true)

      expect(
        ours.longestMs,
        `xlsx longest=${ours.longestMs.toFixed(1)}ms tbt=${ours.tbtMs.toFixed(1)}ms, csv longest=${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

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
import { useCallback, useMemo, useState } from 'react'
import { cleanup, render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  Stories,
  getScroller,
  headCells,
  measureInteractionWork,
  measureRenderWork,
  measureScrollWork,
  measureTransitionWork,
  recordPerf,
} from '../helpers'
import {
  ALL_PLUGINS,
  CONTENT_SCROLL,
  CPU_THROTTLE_RATE,
  LARGE,
  PAGED,
  PERF_TIMEOUT,
  SMALL,
  inlineHeaderActions,
} from './perf-cases'
import {
  ANIMATION_BUDGET_MS,
  INTERACTION_BUDGET_MS,
  LOAD_BUDGET_MS,
  TBT_TARGET_MS,
} from '../perf.constants'
import { againstBase, ceilingOver, medianRun } from './baseline'
import type {
  HeaderAction,
  MenuAction,
  RowAction,
} from '../../../core/headerActions'
import { createTesseraSortedRowModel } from '../../../plugins/columnSortingModel/sortedRowModel'
import { getTreeAria } from '../../../grid/treeAria'
import { createLazyCoreRowModel } from '../../../plugins/rowExpanding/lazyCoreRowModel'
import { createIncrementalExpandedRowModel } from '../../../shared/rowModels/expandedRowModel'
import { rowChangeHints } from '../../../core/rowChanges'
import { createSearchAwareFilteredRowModel } from '../../../shared/rowModels/filteredRowModel'
import { createGroupStage } from '../../../plugins/rowGroupingModel/groupStage'
import { ownStage } from '../../../core/rowEngine/engine'
import { rowsOf } from '../../../core/rowEngine/rows'
import {
  rowExpandingLazyFeature,
  setLoadedAnswer,
} from '../../../plugins/rowExpanding/lazyChildrenFeature'
import { dataExport, exportFormats } from '../../../plugins/dataExport'
import { infiniteScroll } from '../../../plugins/infiniteScroll'
import { serverRowModel } from '../../../plugins/serverRowModel'
import { pagination } from '../../../plugins/pagination'
import { rowDragging } from '../../../plugins/rowDragging'
import {
  moveRow,
  nestRow,
  unnestRow,
} from '../../../plugins/rowDragging/moveRow'
import { cellEditing } from '../../../plugins/cellEditing'
import { editHistory } from '../../../plugins/editHistory'
import { pasteData } from '../../../plugins/cellSelection/paste'
import { columnTotals } from '../../../plugins/columnTotals'
import { quickSearchModel } from '../../../plugins/quickSearchModel'
import { failureLog } from '../../../plugins/failureLog'
import { renderPluginsGrid, renderGrid } from './hosts'
import { DRAFTS, applyAllDrafts, readDrafts } from '../../../core/drafts/drafts'
import { setPluginState } from '../../../core/definePlugin'
import { cellSelection } from '../../../plugins/cellSelection'
import { columnSizing } from '../../../plugins/columnSizing'
import { rowExpanding } from '../../../plugins/rowExpanding'
import { rowGrouping } from '../../../plugins/rowGrouping'
import { moveRowToGroup } from '../../../plugins/rowDragging/groupMove'
import { rowSelection } from '../../../plugins/rowSelection'
import { columnSorting } from '../../../plugins/columnSorting'
import { useCreateTable } from '../../../core/useCreateTable'
import {
  columnFilteringModel,
  columnSortingModel,
  rowGroupingModel,
  valueChangeFlash,
} from '../../../plugins'
import { DataGrid } from '../../../grid/DataGrid'
import { buildXlsx } from '../../../plugins/dataExportModel/xlsxBuild'
import { columns as mockColumns, makeColumns } from '../../__mocks__/columns'
import { getData, makeData } from '../../__mocks__/data'
import { HANDLE, beginDrag, firePointer } from '../../rowDragging.dnd'
import {
  makeOptionFilteringData,
  optionFilteringColumns,
} from '../../__mocks__/filteringData'
import { tableLabels } from '../labels'

// Отзывчивость на ВЗАИМОДЕЙСТВИЕ (INP): выбор ОДНОЙ строки меняет только
// срез rowSelection на одну запись — законной работы минимум (обновить одну строку и
// её чекбокс), поэтому всё остальное во измеренной задаче есть «лишние» ре-рендеры от
// широких подписок компонентов на весь стейт. Шаг стрелкой (keyboardNavigation)
// аналогично меняет лишь активную ячейку и пиновку строки в виртуализаторе.
// Метрика — самая длинная задача главного потока (синхронный blob
// обработчик→рендер→коммит→layout) под ×4 CPU-троттлингом; идёт в дашборд против цели
// RAIL Response без гейта (ADR 0099).

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

// Меню колонок (ADR 0035): раздел «Колонки» «Настроек вида» (ADR 0215) с деревом на 1000 колонок.
const COLUMN_VISIBILITY = { enableToolbar: true, enableColumnVisibility: true }

const settingsButton = () =>
  document.querySelector<HTMLElement>('[data-testid="view-settings-button"]')
const settingsPopover = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="view-settings-popover"][data-open]',
  )
/** Строка раздела «Колонки» и «назад» — на текущем уровне, не на снимке уходящего. */
const columnsRow = () =>
  settingsPopover()?.querySelector<HTMLElement>(
    '[data-popup-level] [data-view-settings-section="columns"]',
  )
const backRow = () =>
  settingsPopover()?.querySelector<HTMLElement>(
    '[data-popup-level] [data-popup-level-back]',
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
    .poll(() => settingsButton()?.hasAttribute('data-base-ui-click-trigger'))
    .toBe(true)

/** Первый уровень «Настроек вида» со строкой «Колонки». */
const openSettings = async () => {
  if (!settingsPopover()) settingsButton()!.click()
  await expect.poll(columnsRow).toBeTruthy()
}

const openColumnsMenu = async () => {
  await openSettings()
  columnsRow()!.click()
  await expect.poll(isColumnsMenuOpen).toBe(true)
}

/** Из раздела «Колонки» — на первый уровень: следующий замер снова входит в раздел. */
const leaveColumnsMenu = async () => {
  backRow()!.click()
  await expect.poll(columnsRow).toBeTruthy()
  await expect.poll(columnsMenu).toBeNull()
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

// Экспорт (ADR 0044): «Выгрузить» в панели (строки «Все строки») сериализует всю таблицу синхронно.
const EXPORT = { enableToolbar: true, enableDataExport: true }
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
  quickSearchDebounceMs: 0,
}
const SEARCH_SIZE = { columnCount: 10, dataCount: 100_000 } as const
const FILTERING = {
  enableColumnFiltering: true,
  columnFilteringDebounceMs: 0,
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
      dataType: 'dateString',
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
        enableRowGrouping: true,
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
          dataType: 'select',
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
      dataType: 'select',
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
  /** Цель класса Load вместо INP (разовая тяжёлая операция, не отклик). */
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
    act: clickRowCheckbox,
    ...SELECT_CHECKS,
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
    prepare: async () => {
      await waitForColumnsButton()
      await openSettings()
    },
    act: async () => columnsRow()!.click(),
    // Прогрев вошёл в раздел; выходим вне замера — замер мерит вход в раздел.
    afterWarmup: async () => {
      expect(isColumnsMenuOpen()).toBe(true)
      await leaveColumnsMenu()
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
    args: {
      ...PAGED,
      ...ALL_PLUGINS,
      ...PAGINATION,
      paginationInitialPageSize: 100,
    },
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
    args: {
      ...LARGE,
      ...ALL_PLUGINS,
      ...FILTERING,
      ...inlineHeaderActions(makeColumns(LARGE.columnCount)),
    },
    prepare: openCountryFilter,
    act: async () => alternate(filterValueInput()!, 'a', 'e'),
    afterWarmup: () => expect(filterValueInput()!.value).toBe('a'),
    verify: () => expect(filterValueInput()!.value).toBe('e'),
  },
  {
    id: 'DF22',
    label: 'применение фильтра даты, большая выборка, все плагины',
    args: {
      ...LARGE,
      ...ALL_PLUGINS,
      ...DATE_FILTERING,
      ...inlineHeaderActions(DATE_FILTERING.columnsOverride),
    },
    prepare: openDateFilter,
    act: toggleCalendarDay,
    afterWarmup: () => expect(isDaySelected(10)).toBe(true),
    verify: () => expect(isDaySelected(20)).toBe(true),
  },
  {
    id: 'SF25',
    label: 'применение фильтра варианта с фасетами, 100 000×10, все плагины',
    size: '100 000×10',
    args: {
      ...SEARCH_SIZE,
      ...ALL_PLUGINS,
      ...OPTION_FILTERING,
      ...inlineHeaderActions(OPTION_FILTERING.columnsOverride),
    },
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
    args: {
      ...SMALL,
      ...ALL_PLUGINS,
      ...MANY_OPTIONS_FILTERING,
      ...inlineHeaderActions(MANY_OPTIONS_FILTERING.columnsOverride),
    },
    prepare: async () => {
      await expect.poll(variantButton).not.toBeNull()
    },
    act: reopenVariantFilter,
  },
  {
    id: 'EX33',
    label: 'выгрузка «Все строки», 100 000×10, все плагины',
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

        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'interaction',
          size:
            c.size ??
            (c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500'),
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              targetMs: c.loadBudget ? LOAD_BUDGET_MS : INTERACTION_BUDGET_MS,
              ...result,
            },
          ],
        })
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
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const lit = medianRun(runs.variant, r => r.longestMs)
      // Подсветка прихода — около +20 % к синхронному приходу; запас на шум.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 40 })
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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

// Корень «Все колонки» меню (ADR 0133, HA10). «Скрыть все» — против скрытия одной
// колонки той же галочкой меню. «Показать все» убирает заглушку и монтирует таблицу
// заново — против монтирования того же грида. Замер — второе нажатие после прогрева.
const rootColumnsCheckbox = () =>
  columnsMenu()?.querySelector<HTMLElement>(
    '[data-testid="column-visibility-all"] [role="checkbox"]',
  )
const HA10_COST = { ratio: 1.3, plusMs: 40 }
const HA10_ARGS = { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY }

const openHa10Menu = async () => {
  await renderGrid(HA10_ARGS)
  await waitForGrid()
  await waitForColumnsButton()
  await openColumnsMenu()
}

const recordHa10 = (
  id: string,
  label: string,
  r: Awaited<ReturnType<typeof measureInteractionWork>>,
  ceiling: number | undefined,
) =>
  recordPerf({
    id,
    label,
    operation: 'interaction',
    size: '1000×1000',
    plugins: 'all',
    cpuThrottle: CPU_THROTTLE_RATE,
    metrics: [
      {
        kind: 'load',
        metric: 'longest',
        valueMs: r.longestMs,
        targetMs: INTERACTION_BUDGET_MS,
        ceilingMs: ceiling,
        ...r,
      },
    ],
  })

describe('Отзывчивость — корень «Все колонки»', () => {
  test(
    'HA10: «скрыть все» корнем на 1000 колонок не дороже скрытия одной колонки, «показать все» — не дороже монтирования той же таблицы',
    async () => {
      // Прогрев скрывает, после клика вне замера — показывает, замер снова скрывает.
      const measureHide = async (isRoot: boolean) => {
        await openHa10Menu()
        const target = () =>
          (isRoot ? rootColumnsCheckbox() : firstColumnCheckbox())!
        const checked = () => target().getAttribute('aria-checked')
        target().click()
        await expect.poll(checked).toBe('false')
        const result = await measureInteractionWork(
          async () => target().click(),
          { afterWarmup: () => expect(checked()).toBe('true') },
        )
        expect(checked()).toBe('false')
        await cleanup()
        return result
      }
      const hideRuns = await againstBase(measureHide)
      const hideBase = medianRun(hideRuns.base, r => r.longestMs)
      const hideAll = medianRun(hideRuns.variant, r => r.longestMs)

      const rowsReady = () =>
        !!document.querySelector('.data-grid__body .data-grid__body-row')
      const measureShow = async (isRoot: boolean) => {
        if (!isRoot) {
          const mount = await measureRenderWork(
            () => renderGrid(HA10_ARGS),
            rowsReady,
            { warmup: false },
          )
          await cleanup()
          return mount
        }
        await openHa10Menu()
        const checked = () =>
          rootColumnsCheckbox()!.getAttribute('aria-checked')
        const result = await measureInteractionWork(
          async () => rootColumnsCheckbox()!.click(),
          { afterWarmup: () => expect(checked()).toBe('false') },
        )
        expect(checked()).toBe('true')
        expect(rowsReady()).toBe(true)
        await cleanup()
        return result
      }
      const showRuns = await againstBase(measureShow)
      const mountBase = medianRun(showRuns.base, r => r.longestMs)
      const showAll = medianRun(showRuns.variant, r => r.longestMs)
      const ceiling = {
        hide: ceilingOver(hideBase.longestMs, HA10_COST),
        show: ceilingOver(mountBase.longestMs, HA10_COST),
      }

      await recordHa10(
        'HA10-hide-base',
        'скрыть одну колонку галочкой меню',
        hideBase,
        undefined,
      )
      await recordHa10(
        'HA10-hide',
        'скрыть все колонки корнем «Все колонки»',
        hideAll,
        ceiling.hide,
      )
      await recordHa10(
        'HA10-show-base',
        'монтирование той же таблицы',
        mountBase,
        undefined,
      )
      await recordHa10(
        'HA10-show',
        'показать все колонки корнем «Все колонки» из заглушки',
        showAll,
        ceiling.show,
      )
      expect(
        hideAll.longestMs,
        `скрыть все longest=${hideAll.longestMs.toFixed(1)}ms, одна колонка ${hideBase.longestMs.toFixed(1)}ms, потолок ${ceiling.hide.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling.hide)
      expect(
        showAll.longestMs,
        `показать все longest=${showAll.longestMs.toFixed(1)}ms, монтирование ${mountBase.longestMs.toFixed(1)}ms, потолок ${ceiling.show.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling.show)
    },
    PERF_TIMEOUT * 4,
  )
})

// Скелет первой загрузки (ADR 0060, SL15): смена скелета на данные (выключение
// `loading: 'initial'`) — самая длинная задача против монтирования того же грида сразу с
// данными: смена рисует те же строки.
const SL15_COST = { ratio: 1.3, plusMs: 40 }

describe('Отзывчивость — смена скелета на данные', () => {
  test(
    'SL15: смена скелета на данные — самая длинная задача не дольше монтирования того же грида с данными',
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
          const screen = await renderGrid({ ...args, loading: 'initial' })
          await expect
            .poll(() => document.querySelector('.data-grid__body--skeleton'), {
              timeout: 20_000,
            })
            .toBeTruthy()
          const result = await measureTransitionWork(async () => {
            await screen.rerender(
              <Stories.DataGridPlayground
                containerHeight={600}
                height={500}
                {...args}
                loading={false}
              />,
            )
          }, rowsReady)
          await screen.unmount()
          return result
        }
        const measureMount = async () => {
          const result = await measureRenderWork(
            () => renderGrid(args),
            rowsReady,
            { warmup: false },
          )
          await cleanup()
          return result
        }
        // Прогрев JIT вне замера.
        // eslint-disable-next-line no-await-in-loop
        await measureSwap()
        // eslint-disable-next-line no-await-in-loop
        await measureMount()
        // eslint-disable-next-line no-await-in-loop
        const runs = await againstBase(swap =>
          swap ? measureSwap() : measureMount(),
        )
        const base = medianRun(runs.base, r => r.longestMs)
        const swap = medianRun(runs.variant, r => r.longestMs)
        const ceiling = ceilingOver(base.longestMs, SL15_COST)
        const record = (
          id: string,
          title: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id,
            label: `${title}, ${label}, все плагины`,
            operation: 'interaction',
            size: label,
            plugins: 'all',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: r.longestMs,
                targetMs: LOAD_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        // eslint-disable-next-line no-await-in-loop
        await record(`SL15-${key}-base`, 'монтирование с данными', base, false)
        // eslint-disable-next-line no-await-in-loop
        await record(`SL15-${key}`, 'смена скелета на данные', swap, true)
        expect(
          swap.longestMs,
          `${label}: смена ${swap.longestMs.toFixed(1)}ms, монтирование с данными ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(0)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 4,
  )
})

// Номера страниц (ADR 0192, PJ13): переход на следующую страницу по 100 строк на 100 000 строк
// с рядом номеров против той же смены без него. Каждый замер — свежий грид.
describe('Отзывчивость — номера страниц', () => {
  test(
    'PJ13: смена страницы на 100 000 строк с номерами не дороже той же без них',
    async () => {
      const measure = async (numbered: boolean) => {
        await renderGrid({
          ...PAGED,
          ...ALL_PLUGINS,
          ...PAGINATION,
          paginationInitialPageSize: 100,
          paginationPageNumbers: numbered ? 'buttons' : false,
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect.poll(() => pageButton('next')).not.toBeNull()
        const result = await measureInteractionWork(
          async () => pageButton('next')!.click(),
          { afterWarmup: () => expect(firstRowId()).toBe('item-id-100') },
        )
        expect(firstRowId()).toBe('item-id-200')
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const numbered = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.1, plusMs: 5 })
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
          size: '100 000×30',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('PJ13-base', 'смена страницы без номеров', base, false)
      await record('PJ13', 'смена страницы с номерами', numbered, true)
      expect(numbered.longestMs).toBeLessThanOrEqual(ceiling)
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
      ? { ...column, getOptionLabel: undefined, dataType: undefined }
      : column,
  )

const sortOf = (columnId: string) =>
  document
    .querySelector(`.data-grid__head-cell[data-column-id="${columnId}"]`)
    ?.getAttribute('aria-sort')

describe('Отзывчивость — сортировка по подписи', () => {
  test(
    'OS11: сортировка 100 000 строк по колонке lookup не дороже той же колонки без подписей больше чем в 1,5 раза',
    async () => {
      const measure = async (labelled: boolean) => {
        await renderGrid({
          ...ALL_PLUGINS,
          ...inlineHeaderActions(managerColumn(labelled)),
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
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const labelled = medianRun(runs.variant, r => r.longestMs)
      // Подпись сравнивается Intl.Collator, id — простым сравнением: ~+20–30% (база
      // ~490–565 мс, по подписи ~655–680 мс под ×4); запас на шум замера.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.5, plusMs: 300 })
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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

// Сортировка текста по типу (ADR 0172, DT11): первый клик сортировки колонки имён на
// 100 000 строк — с `dataType: 'text'` (`Intl.Collator` языка) против той же колонки без
// типа (сортировка TanStack). Каждый замер — свежий грид.
const nameColumn = (typed: boolean) =>
  optionFilteringColumns.map(column =>
    column.id === 'name' && typed ? { ...column, dataType: 'text' } : column,
  )

describe('Отзывчивость — сортировка по типу данных', () => {
  test(
    'DT11: сортировка 100 000 строк текста через Intl.Collator — против нынешней сортировки',
    async () => {
      const measure = async (typed: boolean) => {
        await renderGrid({
          ...ALL_PLUGINS,
          ...inlineHeaderActions(nameColumn(typed)),
          dataOverride: OPTION_SORT_DATA,
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const button = () =>
          document.querySelector<HTMLElement>(
            '.data-grid__head-cell[data-column-id="name"] .column-sort__button',
          )
        await expect.poll(button).toBeTruthy()
        // Прогрев сортирует другую колонку: замер — первый клик по колонке имён.
        let warmed = false
        const result = await measureInteractionWork(
          async () => {
            const target = warmed ? 'name' : 'status'
            warmed = true
            document
              .querySelector<HTMLElement>(
                `.data-grid__head-cell[data-column-id="${target}"] .column-sort__button`,
              )!
              .click()
          },
          { afterWarmup: () => expect(sortOf('status')).not.toBe('none') },
        )
        expect([sortOf('name'), sortOf('status')]).toEqual([
          expect.not.stringMatching(/^none$/),
          'none',
        ])
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const typed = medianRun(runs.variant, r => r.longestMs)
      // Collator с числами по значению против alphanumeric TanStack — запас как у OS11.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.5, plusMs: 300 })
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('DT11-base', 'сортировка текста без типа', base, false)
      await record('DT11', 'сортировка текста по типу', typed, true)

      expect(
        typed.longestMs,
        `по типу longest=${typed.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Поиск по показанному тексту (ADR 0172, DT16): применение поиска на 100 000 строк в условиях
// FL35 — колонки с типами и форматом (деньги, числа, вариант с подписями, дата-строка) против
// тех же колонок без типа. Прогрев считает тексты, замер — следующий запрос по ним.
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]
const pad2 = (value: number) => String(value).padStart(2, '0')
const TYPED_SEARCH: Record<string, Record<string, unknown>> = {
  age: { dataType: 'number', format: { maximumFractionDigits: 0 } },
  visits: { dataType: 'number', format: { minimumIntegerDigits: 2 } },
  total: { dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  gender: { dataType: 'select', options: GENDERS },
}
const searchColumns = (typed: boolean) => [
  ...makeColumns(SEARCH_SIZE.columnCount - 1).map(column =>
    typed
      ? { ...column, ...TYPED_SEARCH[column.id as string] }
      : { ...column, dataType: undefined },
  ),
  {
    id: 'joined',
    header: 'Joined',
    size: 150,
    accessorFn: (row: { age: number; visits: number }) =>
      `2026-${pad2((row.visits % 12) + 1)}-${pad2((row.age % 28) + 1)}`,
    ...(typed ? { dataType: 'dateString' } : {}),
  },
]

describe('Отзывчивость — поиск по показанному тексту', () => {
  test(
    'DT16: поиск по 100 000 строк с типами и форматом — против тех же строк без типа (база FL35)',
    async () => {
      const measure = async (typed: boolean) => {
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          ...SEARCH,
          columnsOverride: searchColumns(typed),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect.poll(quickSearchInput).not.toBeNull()
        const result = await measureInteractionWork(
          async () => alternate(quickSearchInput()!, 'a', 'e'),
          { afterWarmup: () => expect(quickSearchInput()!.value).toBe('a') },
        )
        expect(quickSearchInput()!.value).toBe('e')
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const typed = medianRun(runs.variant, r => r.longestMs)
      // Тексты посчитаны прогревом и взяты из кеша: замер — сравнение строк, как у базы.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 50 })
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('DT16-base', 'поиск без типов', base, false)
      await record('DT16', 'поиск по показанному тексту', typed, true)

      expect(
        typed.longestMs,
        `по типам longest=${typed.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Склеенный текст строки (ADR 0201): цена числа колонок поиска и первый поиск после монтирования.
// QT8 — 10 колонок поиска против одной (прочие исключены `enableGlobalFilter: false`) на тех же
// строках и колонках: прогрев считает тексты, замер — следующий запрос по ним.
const SEARCHED_ALONE = 'firstName'
const searchedColumns = (alone: boolean) =>
  makeColumns(SEARCH_SIZE.columnCount).map(column =>
    alone && column.id !== SEARCHED_ALONE
      ? { ...column, enableGlobalFilter: false }
      : column,
  )

describe('Отзывчивость — склеенный текст строки', () => {
  const recordSearch = (
    id: string,
    label: string,
    r: Awaited<ReturnType<typeof measureInteractionWork>>,
    ceilingMs?: number,
  ) =>
    recordPerf({
      id,
      label,
      operation: 'interaction',
      size: '100 000×10',
      plugins: 'all',
      cpuThrottle: CPU_THROTTLE_RATE,
      metrics: [
        {
          kind: 'load',
          metric: 'longest',
          valueMs: r.longestMs,
          targetMs: INTERACTION_BUDGET_MS,
          ceilingMs,
          ...r,
        },
      ],
    })

  test(
    'QT8: поиск по 100 000 строк с 10 колонками поиска — против одной колонки поиска, прочие исключены enableGlobalFilter: false',
    async () => {
      const measure = async (all: boolean) => {
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          ...SEARCH,
          columnsOverride: searchedColumns(!all),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect.poll(quickSearchInput).not.toBeNull()
        const result = await measureInteractionWork(
          async () => alternate(quickSearchInput()!, 'a', 'e'),
          { afterWarmup: () => expect(quickSearchInput()!.value).toBe('a') },
        )
        expect(quickSearchInput()!.value).toBe('e')
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const all = medianRun(runs.variant, r => r.longestMs)
      // Одна проверка склеенного текста на строку: число колонок поиска почти ничего не стоит.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.2, plusMs: 30 })
      await recordSearch('QT8-base', 'поиск по одной колонке', base)
      await recordSearch('QT8', 'поиск по 10 колонкам', all, ceiling)
      expect(
        all.longestMs,
        `10 колонок longest=${all.longestMs.toFixed(1)}ms, одна ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )

  test(
    'QT9: первый поиск после монтирования, 100 000×10, тексты строк не посчитаны',
    async () => {
      await renderGrid({
        ...SEARCH_SIZE,
        ...ALL_PLUGINS,
        ...SEARCH,
      } as Parameters<typeof renderGrid>[0])
      await waitForGrid()
      await expect.poll(quickSearchInput).not.toBeNull()
      expect(quickSearchInput()!.value).toBe('')
      const result = await measureInteractionWork(
        async () => alternate(quickSearchInput()!, 'a', 'e'),
        { warmup: false },
      )
      expect(quickSearchInput()!.value).toBe('a')
      await cleanup()
      // Без гейта: значение — в дашборд против цели INP.
      await recordSearch('QT9', 'первый поиск, тексты не посчитаны', result)
    },
    PERF_TIMEOUT,
  )
})

// Фильтр записи с фасетами по ключу (ADR 0174, TY15): отметка варианта на 100 000 строк —
// колонка менеджера-записи `object` против той же колонки `select` с вариантами (база SF25).
const GENDER_NAMES: Record<string, string> = { male: 'Male', female: 'Female' }
const OBJECT_FILTERING = {
  ...FILTERING,
  columnsOverride: OPTION_FILTERING.columnsOverride.map(column =>
    column.id === 'gender'
      ? {
          id: 'gender',
          header: 'Gender',
          size: 150,
          dataType: 'object',
          accessorFn: (row: { gender: string }) => ({
            id: row.gender,
            name: GENDER_NAMES[row.gender],
          }),
        }
      : column,
  ),
}

describe('Отзывчивость — фильтр записи', () => {
  test(
    'TY15: применение фильтра записи с фасетами по ключу на 100 000 строк — против фильтра select (база SF25)',
    async () => {
      const measure = async (records: boolean) => {
        const filtering = records ? OBJECT_FILTERING : OPTION_FILTERING
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          ...filtering,
          ...inlineHeaderActions(filtering.columnsOverride),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await openOptionFilter('gender')()
        // Прогрев отмечает «male», замер — «female»: оба щелчка применяют фильтр.
        const result = await measureInteractionWork(
          async () =>
            optionCheckbox(
              optionCheckbox('male')!.getAttribute('aria-checked') === 'true'
                ? 'female'
                : 'male',
            )!.click(),
          {
            afterWarmup: () =>
              expect(optionCheckbox('male')!.getAttribute('aria-checked')).toBe(
                'true',
              ),
          },
        )
        expect(optionCheckbox('female')!.getAttribute('aria-checked')).toBe(
          'true',
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const records = medianRun(runs.variant, r => r.longestMs)
      // Ключ записи считается на строку при каждом проходе фасетов и условия.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 50 })
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('TY15-base', 'фильтр select', base, false)
      await record('TY15', 'фильтр записи по ключу', records, true)

      expect(
        records.longestMs,
        `запись longest=${records.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Сортировка десятичных строк (ADR 0174, TY14): первый клик сортировки колонки сумм на
// 100 000 строк — суммы строкой `numberString` против тех же сумм числом `number`.
const amountColumns = (decimal: boolean) => {
  const others = mockColumns.slice(0, SEARCH_SIZE.columnCount - 1)
  // Обе колонки замера — первыми: широкие колонки справа уходят за окно виртуализации.
  return [
    {
      id: 'amount',
      header: 'Amount',
      size: 150,
      dataType: decimal ? 'numberString' : 'number',
      accessorFn: (row: { total: number; visits: number }) =>
        decimal
          ? `${row.total}.${String(row.visits).padStart(2, '0')}`
          : row.total + row.visits / 100,
    },
    ...others.filter(column => column.id === 'age'),
    ...others.filter(column => column.id !== 'age'),
  ]
}

describe('Отзывчивость — сортировка десятичных строк', () => {
  test(
    'TY14: сортировка 100 000 строк numberString — против тех же значений типом number',
    async () => {
      const measure = async (decimal: boolean) => {
        const columns = amountColumns(decimal)
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          ...inlineHeaderActions(columns),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const button = (columnId: string) =>
          document.querySelector<HTMLElement>(
            `.data-grid__head-cell[data-column-id="${columnId}"] .column-sort__button`,
          )
        await expect.poll(() => button('amount')).toBeTruthy()
        // Прогрев сортирует другую колонку: замер — первый клик по колонке сумм.
        let warmed = false
        const result = await measureInteractionWork(
          async () => {
            const target = warmed ? 'amount' : 'age'
            warmed = true
            button(target)!.click()
          },
          { afterWarmup: () => expect(sortOf('age')).not.toBe('none') },
        )
        expect([sortOf('amount'), sortOf('age')]).toEqual([
          expect.not.stringMatching(/^none$/),
          'none',
        ])
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const decimal = medianRun(runs.variant, r => r.longestMs)
      // Разбор строки и сравнение цифр против вычитания чисел — запас как у DT11.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.5, plusMs: 300 })
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('TY14-base', 'сортировка сумм числом', base, false)
      await record('TY14', 'сортировка сумм строкой', decimal, true)

      expect(
        decimal.longestMs,
        `строкой longest=${decimal.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
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
      const runs = await againstBase(isOurs =>
        measure(
          isOurs
            ? () => ownStage('sort', createTesseraSortedRowModel())
            : createSortedRowModel,
        ),
      )
      const theirs = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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
      const runs = await againstBase(isOurs =>
        measureInteractionWork(async () => {
          for (let i = 0; i < TREE_ARIA_REPEAT; i++) {
            if (isOurs) getTreeAria(rows)
            else treeAriaByObjects(rows)
          }
        }),
      )
      const theirs = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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
      /** Свежий грид: прогрев одним приходом, замер — один ответ или пачка из пяти. */
      const measure = async (isBatch: boolean) => {
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
        // Прогрев: JIT пути прихода. Строки раскрываются снизу вверх — дети
        // раскрытой строки не уводят остальные из окна.
        await arrive(['item-id-7'])
        const result = await arrive(
          isBatch
            ? ['item-id-5', 'item-id-4', 'item-id-3', 'item-id-2', 'item-id-1']
            : ['item-id-6'],
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const single = medianRun(runs.base, r => r.tbtMs)
      const batch = medianRun(runs.variant, r => r.tbtMs)
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
          metrics: [
            {
              kind: 'load',
              metric: 'tbt',
              valueMs: r.tbtMs,
              targetMs: TBT_TARGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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
    PERF_TIMEOUT * 6,
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

      const runs = await againstBase(isOurs =>
        isOurs ? incremental() : full(),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      // Словарь rowsById переходит новой модели без копии (ADR 0069).
      const ceiling = base.longestMs / 4
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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

      const runs = await againstBase(isOurs =>
        isOurs
          ? passes(
              ownStage('filter', createSearchAwareFilteredRowModel()),
              ownStage('group', createGroupStage()),
            )
          : passes(createFilteredRowModel(), createGroupedRowModel()),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 10
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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

      const runs = await againstBase(isOurs =>
        recompute(
          isOurs
            ? ownStage('expand', createIncrementalExpandedRowModel())
            : createExpandedRowModel(),
        ),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 4
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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
            sortedRowModel: ownStage('sort', createTesseraSortedRowModel()),
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
        // Выход стадии у движка, как его читает грид; снимок getSortedRowModel строится по
        // требованию и стоит прохода по всем строкам (ADR 0200, EN31).
        const sorted = () => rowsOf(table, 'sorted').rows
        sorted()
        let turn = 0
        return measureInteractionWork(async () => {
          const kids = LAZY_ANSWERS[turn++ % 2]!
          setLoadedAnswer(table, prev => ({ ...prev, r0: kids }))
          if (full) table.setSorting([{ id: 'name', desc: turn % 2 === 0 }])
          sorted()
        })
      }

      const runs = await againstBase(isOurs => arrival(!isOurs))
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 10
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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
  ...(i === 3
    ? { dataType: { name: 'dateString', base: 'dateString' as const } }
    : {}),
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
    'XL11: сборка .xlsx 100 000 × 10 — самая длинная задача главного потока не дольше половины синхронной сборки CSV того же объёма',
    async () => {
      const data = { columns: XLSX_COLUMNS, rows: XLSX_ROWS }
      let csvSize = 0
      let xlsxSize = 0
      const runs = await againstBase(isXlsx =>
        measureInteractionWork(async () => {
          if (isXlsx) xlsxSize = (await buildXlsx(data)).size
          else csvSize = exportFormats.csv().serialize(data).length
        }),
      )
      expect(csvSize).toBeGreaterThan(0)
      expect(xlsxSize).toBeGreaterThan(0)
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      // Генератор отдаёт поток по частям: его самая длинная задача короче синхронной
      // сборки CSV того же объёма.
      const ceiling = base.longestMs / 2
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
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
    PERF_TIMEOUT * 4,
  )
})

// Вложенные разделы меню (ADR 0079, NM18): вход в раздел со 100 пунктами из кебаба
// строки — против открытия кебаба с плоским меню из тех же 100 пунктов; возврат на
// корень — против открытия кебаба с корневым меню (ADR 0099, §1а).
const NM18_COST = { ratio: 1.3, plusMs: 20 }

describe('Отзывчивость — разделы меню', () => {
  test(
    'NM18: вход в раздел со 100 пунктами не дороже открытия плоского меню из них; возврат на корень не дороже открытия корневого меню',
    async () => {
      const leaves: MenuAction[] = Array.from({ length: 100 }, (_, i) => ({
        id: `perfLeaf${i}`,
        icon: () => null,
        label: () => `Destination ${i}`,
        onSelect: () => {},
      }))
      const section: RowAction = {
        id: 'perfSection',
        slot: 'actionRowSlot',
        order: 0,
        icon: () => null,
        label: () => 'Move to',
        onSelect: () => {},
        submenu: () => ({ title: 'Move to', items: leaves }),
      }
      const flat: RowAction[] = leaves.map((leaf, order) => ({
        ...leaf,
        slot: 'actionRowSlot',
        order,
      }))

      const menuItem = (label: string) =>
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          el =>
            el.querySelector('[data-popup-item-label]')?.textContent === label,
        )
      const items = () => document.querySelectorAll('[role="menuitem"]').length
      const backRow = () =>
        document.querySelector<HTMLElement>('[data-menu-back]')
      const kebab = () =>
        document.querySelector<HTMLElement>(
          `[aria-label^="${tableLabels.rowMenu}"]`,
        )
      const inSection = () => menuItem('Destination 99') !== undefined
      const closeMenu = async () => {
        ;(document.activeElement as HTMLElement | null)?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        )
        await expect.poll(items).toBe(0)
      }
      const mount = async (actions: RowAction[]) => {
        const screen = renderGrid({
          ...SMALL,
          enableRowActions: true,
          enableRowActionMenu: true,
          extraPlugins: [{ id: 'perfSections', slotActions: actions }],
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect.poll(kebab).not.toBeNull()
        return screen
      }
      /** Открытие кебаба: меню, в котором есть пункт `last`. */
      const openKebab = async (actions: RowAction[], last: string) => {
        const open = () => menuItem(last) !== undefined
        const screen = await mount(actions)
        const result = await measureInteractionWork(
          async () => kebab()!.click(),
          {
            afterWarmup: async () => {
              expect(open()).toBe(true)
              await closeMenu()
            },
          },
        )
        expect(open()).toBe(true)
        ;(await screen).unmount()
        return result
      }
      const enter = async () => {
        const screen = await mount([section])
        kebab()!.click()
        await expect.poll(() => menuItem('Move to')).toBeTruthy()
        const result = await measureInteractionWork(
          async () => menuItem('Move to')!.click(),
          {
            afterWarmup: async () => {
              expect(inSection()).toBe(true)
              backRow()!.click()
              await expect.poll(inSection).toBe(false)
            },
          },
        )
        expect(inSection()).toBe(true)
        ;(await screen).unmount()
        return result
      }
      const back = async () => {
        const screen = await mount([section])
        kebab()!.click()
        await expect.poll(() => menuItem('Move to')).toBeTruthy()
        menuItem('Move to')!.click()
        await expect.poll(inSection).toBe(true)
        const result = await measureInteractionWork(
          async () => backRow()!.click(),
          {
            afterWarmup: async () => {
              expect(inSection()).toBe(false)
              menuItem('Move to')!.click()
              await expect.poll(inSection).toBe(true)
            },
          },
        )
        expect(inSection()).toBe(false)
        ;(await screen).unmount()
        return result
      }

      const pairs = [
        {
          record: 'NM18',
          label: 'вход в раздел со 100 пунктами',
          baseLabel: 'открытие плоского меню из 100 пунктов',
          runs: await againstBase(isSection =>
            isSection ? enter() : openKebab(flat, 'Destination 99'),
          ),
        },
        {
          record: 'NM18-back',
          label: 'возврат из раздела со 100 пунктами',
          baseLabel: 'открытие корневого меню',
          runs: await againstBase(isBack =>
            isBack ? back() : openKebab([section], 'Move to'),
          ),
        },
      ]
      for (const { record: id, label, baseLabel, runs } of pairs) {
        const base = medianRun(runs.base, r => r.longestMs)
        const variant = medianRun(runs.variant, r => r.longestMs)
        const ceiling = ceilingOver(base.longestMs, NM18_COST)
        for (const [recordId, recordLabel, result, gated] of [
          [`${id}-base`, baseLabel, base, false],
          [id, label, variant, true],
        ] as const) {
          // eslint-disable-next-line no-await-in-loop
          await recordPerf({
            id: recordId,
            label: recordLabel,
            operation: 'interaction',
            size: '30×500',
            plugins: 'rowActions',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: result.longestMs,
                targetMs: INTERACTION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...result,
              },
            ],
          })
        }
        expect
          .soft(
            variant.longestMs,
            `${id} longest=${variant.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
          )
          .toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 6,
  )
})

// Лента (ADR 0081, IS16): ответ дописывает 100 строк к 100 000 загруженным — новая
// `data` и полная пересборка модели (инкрементальные модели этот случай не покрывают)
// плюс проверка края лентой — против подмены `data` той же длины на том же гриде.
interface FeedRow {
  id: string
  a: string
  b: number
  c: string
}
const feedRows = (from: number, count: number): FeedRow[] =>
  Array.from({ length: count }, (_, k) => ({
    id: `f${from + k}`,
    a: `Name ${from + k}`,
    b: from + k,
    c: `City ${(from + k) % 50}`,
  }))
const FEED_COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', size: 200 },
  { id: 'b', accessorKey: 'b', header: 'B', size: 120 },
  { id: 'c', accessorKey: 'c', header: 'C', size: 200 },
]
let setFeedRows: (update: (prev: FeedRow[]) => FeedRow[]) => void
let feedLength = 0
const FeedGrid = ({ initial }: { initial: FeedRow[] }) => {
  const [rows, setRows] = useState(initial)
  setFeedRows = setRows
  feedLength = rows.length
  const table = useCreateTable({
    columns: FEED_COLUMNS as never,
    data: rows,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      infiniteScroll({
        hasMore: true,
        onLoadMore: () => new Promise<void>(() => {}),
      }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** Дописать 100 строк к 100 000 в ленте или подменить `data` той же длины. */
const measureFeed = async (append: boolean) => {
  const initial = feedRows(0, 100_000)
  await render(<FeedGrid initial={initial} />)
  await waitForGrid()
  const result = await measureInteractionWork(
    async () => {
      setFeedRows(prev =>
        append ? prev.concat(feedRows(prev.length, 100)) : prev.slice(),
      )
    },
    {
      afterWarmup: () =>
        expect
          .poll(
            () => document.querySelectorAll('.data-grid__body-row').length > 0,
          )
          .toBe(true),
    },
  )
  // Прогрев и замер — по действию: дописано дважды по 100 строк.
  await expect.poll(() => feedLength).toBe(append ? 100_200 : 100_000)
  await cleanup()
  return result
}

describe('Отзывчивость взаимодействий — лента', () => {
  test(
    'IS16: дописать блок из 100 строк к 100 000 не хуже подмены data той же длины',
    async () => {
      // Самая длинная задача одного ответа на 100 000 строк шумит на ±40 мс: пять раундов.
      const runs = await againstBase(measureFeed, 5)
      const base = medianRun(runs.base, r => r.longestMs)
      const fed = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.15, plusMs: 40 })
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
          size: '100 000×3',
          plugins: 'infiniteScroll',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('IS16-base', 'подмена data той же длины', base, false)
      await record('IS16', 'дописать 100 строк к 100 000', fed, true)
      expect(
        fed.longestMs,
        `дописать longest=${fed.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Длинный текст (ADR 0083, TX12): открытие кебаба строки с 20 пунктами, подписи
// которых переносятся на несколько строк, против тех же пунктов с короткими подписями.
const TX12_COST = { ratio: 1.3, plusMs: 20 }

describe('Отзывчивость — длинные подписи меню', () => {
  test(
    'TX12: открытие меню с 20 длинными пунктами не дороже меню с короткими',
    async () => {
      const measure = async (long: boolean) => {
        const actions: RowAction[] = Array.from({ length: 20 }, (_, i) => ({
          id: `textAction${i}`,
          slot: 'actionRowSlot',
          order: i,
          icon: () => null,
          label: () =>
            long
              ? `Action ${i}: reassign the account to another manager in the same regional office`
              : `Action ${i}`,
          onSelect: () => {},
        }))
        const screen = renderGrid({
          ...SMALL,
          enableRowActions: true,
          enableRowActionMenu: true,
          actionsDemo: 'none',
          extraPlugins: [{ id: 'textActions', slotActions: actions }],
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const kebab = () =>
          document.querySelector<HTMLElement>(
            `[aria-label^="${tableLabels.rowMenu}"]`,
          )
        const open = () =>
          document.querySelectorAll('[role="menuitem"]').length === 20
        await expect.poll(kebab).not.toBeNull()
        const result = await measureInteractionWork(
          async () => kebab()!.click(),
          {
            afterWarmup: async () => {
              expect(open()).toBe(true)
              document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
              )
              ;(document.activeElement as HTMLElement | null)?.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
              )
              await expect.poll(open).toBe(false)
            },
          },
        )
        expect(open()).toBe(true)
        if (long) {
          const label = document.querySelector('[data-popup-item-label]')!
          expect(label.getBoundingClientRect().height).toBeGreaterThan(
            parseFloat(getComputedStyle(label).lineHeight) * 1.5,
          )
        }
        ;(await screen).unmount()
        return result
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const long = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, TX12_COST)
      for (const [id, label, result, gated] of [
        ['TX12-base', 'меню из 20 коротких пунктов', base, false],
        ['TX12', 'меню из 20 пунктов с переносом подписи', long, true],
      ] as const) {
        await recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '30×500',
          plugins: 'rowActions',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...result,
            },
          ],
        })
      }
      expect(
        long.longestMs,
        `TX12 longest=${long.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 4,
  )
})

// Кит поповеров (ADR 0183, PK10): меню колонки с 20 пунктами и «Колонки» на 1000 колонок. Предел —
// 10 % к ревизии до кита: сверяет `npm run perf:compare -- <ref> --cases PK10`, здесь — запись и цель.
describe('Отзывчивость — кит поповеров', () => {
  test(
    'PK10: открытие меню колонки с 20 пунктами и «Колонок» на 1000 колонок укладывается в цель',
    async () => {
      const actions: HeaderAction[] = Array.from({ length: 20 }, (_, i) => ({
        id: `kitAction${i}`,
        slot: 'rightHeaderSlot',
        order: i,
        icon: () => null,
        label: () => `Action ${i}`,
        onSelect: () => {},
      }))
      const measureMenu = async () => {
        const screen = renderGrid({
          ...SMALL,
          enableHeaderActionMenu: true,
          headerActionMenuMode: 'always',
          extraPlugins: [{ id: 'kitActions', slotActions: actions }],
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const kebab = () =>
          document.querySelector<HTMLElement>(
            `[aria-label^="${tableLabels.headerMenu}"]`,
          )
        const open = () =>
          document.querySelectorAll('[role="menuitem"]').length >= 20
        await expect.poll(kebab).not.toBeNull()
        const result = await measureInteractionWork(
          async () => kebab()!.click(),
          {
            afterWarmup: async () => {
              expect(open()).toBe(true)
              ;(document.activeElement as HTMLElement | null)?.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
              )
              await expect.poll(open).toBe(false)
            },
          },
        )
        expect(open()).toBe(true)
        ;(await screen).unmount()
        return result
      }
      const measureColumns = async () => {
        const screen = renderGrid({
          ...LARGE,
          ...ALL_PLUGINS,
          ...COLUMN_VISIBILITY,
        })
        await waitForColumnsButton()
        await openSettings()
        const result = await measureInteractionWork(
          async () => columnsRow()!.click(),
          {
            afterWarmup: async () => {
              expect(isColumnsMenuOpen()).toBe(true)
              await leaveColumnsMenu()
            },
          },
        )
        expect(isColumnsMenuOpen()).toBe(true)
        ;(await screen).unmount()
        return result
      }
      for (const [id, label, size, plugins, result] of [
        [
          'PK10',
          'меню колонки с 20 пунктами на компонентах кита',
          '30×500',
          'headerActionMenu',
          await measureMenu(),
        ],
        [
          'PK10-columns',
          '«Колонки» на 1000 колонок на компонентах кита',
          '1000×1000',
          'all',
          await measureColumns(),
        ],
      ] as const) {
        await recordPerf({
          id,
          label,
          operation: 'interaction',
          size,
          plugins,
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ...result,
            },
          ],
        })
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Прокрутка к строке (ADR 0104, SV11): `table.scrollToRow` к строке в середине 100 000
// строк против прямого `scrollTo` на то же место. Прогрев — к строке 30 000, замер — к
// 60 000; оба по началу окна тела.
const SCROLL_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
}))
const SCROLL_COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

describe('Отзывчивость — прокрутка к строке', () => {
  test(
    'SV11: прокрутка к строке в середине 100 000 строк не дороже прямой установки scrollTop на ту же позицию больше чем на 30 % или 4 мс',
    async () => {
      const measure = async (variant: boolean) => {
        let table:
          | {
              scrollToRow: (
                id: string,
                options?: { align?: 'start' },
              ) => Promise<boolean>
            }
          | undefined
        const ScrollGrid = () => {
          const created = useCreateTable({
            columns: SCROLL_COLUMNS as never,
            data: SCROLL_ROWS,
            getRowId: (row: { id: string }) => row.id,
            plugins: [],
          })
          table = created as never
          return (
            <div style={{ width: 600, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<ScrollGrid />)
        await waitForGrid()
        const scroller = document.querySelector<HTMLElement>(
          '.data-grid__container',
        )!
        const rowHeight = document
          .querySelector('.data-grid__body-row')!
          .getBoundingClientRect().height
        const mounted = (index: number) =>
          document.querySelector(
            `.data-grid__body-row[data-row-id="r${index}"]`,
          )
        let target = 30_000
        const result = await measureInteractionWork(
          async () => {
            const index = target
            target = 60_000
            if (variant) {
              expect(
                await table!.scrollToRow(`r${index}`, { align: 'start' }),
              ).toBe(true)
            } else {
              scroller.scrollTo({ top: index * rowHeight, behavior: 'instant' })
              await expect.poll(() => mounted(index)).not.toBeNull()
            }
          },
          { afterWarmup: () => expect(mounted(30_000)).not.toBeNull() },
        )
        expect(mounted(60_000)).not.toBeNull()
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const scrolled = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 4 })
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
          size: '100 000×1',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SV11-base', 'прямой scrollTo на ту же позицию', base, false)
      await record('SV11', 'scrollToRow к строке 60 000', scrolled, true)

      expect(
        scrolled.longestMs,
        `scrollToRow longest=${scrolled.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Движение строк (ADR 0107, RM20): цена FLIP против той же смены без движения —
// сортировка 100 000 строк (отзывчивость), раскрытие 100 детей на 1000×1000 (кадры во
// время движения) и спокойная прокрутка 1000×1000 без смены модели.
const MOTION_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  rank: (i * 7919) % 100_000,
}))
const MOTION_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'rank', accessorKey: 'rank', header: 'Rank' },
]
/** Цена движения по ADR 0107, RM20: сортировка платит за копии уходящих строк. */
const RM20_COST = { ratio: 1.3, plusMs: 8 }
/** Раскрытие: призраки группами и проявление детей, цена на 2026-10-16 с запасом (RM31). */
const RM20_EXPAND_COST = { ratio: 1.3, plusMs: 18 }
const RM20_SORT_COST = { ratio: 1.45, plusMs: 8 }
const MOTION_SETTLE_MS = 400

const motionTree = () => {
  const rows = getData(1000)
  rows[0].subRows = getData(100).map((row: { id: string }) => ({
    ...row,
    id: `${rows[0].id}-${row.id}`,
  }))
  return rows
}

describe('Отзывчивость — движение строк', () => {
  test(
    'RM20: движение строк против той же смены без него — сортировка 100 000 строк до +45 % или 8 мс, раскрытие 100 детей на 1000×1000 до +30 % или 18 мс, спокойная прокрутка до +30 % или 8 мс',
    async () => {
      // Сортировка 100 000 строк: в окне уцелевает строка r0 (rank 0) — движение есть.
      const sort = async (motion: boolean) => {
        let table:
          | { setSorting: (sorting: { id: string; desc: boolean }[]) => void }
          | undefined
        const SortGrid = () => {
          const created = useCreateTable({
            columns: MOTION_COLUMNS as never,
            data: MOTION_ROWS,
            getRowId: (row: { id: string }) => row.id,
            plugins: [columnSorting()],
            enableRowAnimation: motion,
          })
          table = created as never
          return (
            <div style={{ width: 600, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<SortGrid />)
        await waitForGrid()
        const firstId = () =>
          document
            .querySelector('.data-grid__body-row[data-index="1"]')
            ?.getAttribute('data-row-id')
        const result = await measureInteractionWork(
          async () => {
            table!.setSorting([{ id: 'rank', desc: false }])
            await expect.poll(firstId).not.toBe('r1')
          },
          {
            afterWarmup: async () => {
              table!.setSorting([])
              await expect.poll(firstId).toBe('r1')
              await new Promise(resolve =>
                setTimeout(resolve, MOTION_SETTLE_MS),
              )
            },
          },
        )
        await cleanup()
        return result
      }

      // Раскрытие 100 детей на 1000×1000: кадры, пока строки ниже едут.
      const expand = async (motion: boolean) => {
        const screen = await renderGrid({
          ...LARGE,
          enableRowExpanding: true,
          enableRowAnimation: motion,
          dataOverride: motionTree(),
          initialExpanded: {},
        })
        await waitForGrid()
        const toggle = () =>
          document.querySelector<HTMLElement>(
            '.data-grid__body-row[data-row-id="item-id-0"] .row-expand-button',
          )!
        let started = 0
        const result = await measureTransitionWork(
          async () => {
            started = performance.now()
            toggle().click()
          },
          () => performance.now() - started > MOTION_SETTLE_MS,
        )
        expect(toggle().getAttribute('aria-expanded')).toBe('true')
        await screen.unmount()
        return result
      }

      // Спокойная прокрутка 1000×1000: модель не меняется — движение ничего не стоит.
      const scroll = async (motion: boolean) => {
        const screen = await renderGrid({
          ...LARGE,
          enableRowAnimation: motion,
        })
        await waitForGrid()
        const result = await measureScrollWork('y', CONTENT_SCROLL.y)
        await screen.unmount()
        return result
      }

      const cases = [
        ['sort', sort, 'longestMs', '100 000×2', 'interaction', RM20_SORT_COST],
        ['expand', expand, 'p95Ms', '1000×1000', 'animation', RM20_EXPAND_COST],
        ['scroll', scroll, 'p95Ms', '1000×1000', 'animation', RM20_COST],
      ] as const
      for (const [name, measure, metric, size, kind, cost] of cases) {
        const runs = await againstBase(measure)
        const base = medianRun(runs.base, r => r[metric])
        const variant = medianRun(runs.variant, r => r[metric])
        const ceiling = ceilingOver(base[metric], cost)
        const record = (
          id: string,
          label: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id,
            label,
            operation: kind === 'interaction' ? 'interaction' : 'scroll',
            size,
            plugins: 'none',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: kind === 'interaction' ? 'load' : 'animation',
                metric: metric === 'longestMs' ? 'longest' : 'p95',
                valueMs: r[metric],
                targetMs:
                  kind === 'interaction'
                    ? INTERACTION_BUDGET_MS
                    : ANIMATION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        await record(`RM20-${name}-base`, `${name} без движения`, base, false)
        await record(`RM20-${name}`, `${name} с движением строк`, variant, true)
        expect(
          variant[metric],
          `${name}: ${metric}=${variant[metric].toFixed(1)}ms, база ${base[metric].toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 6,
  )
})

// Превью броска строки (ADR 0108, PV7): проекция линий по окну на каждую смену места
// при автопрокрутке над деревом в 100 000 строк — против той же сессии без линий.
const DROP_TREE = makeData({
  shape: 'tree',
  count: 25_000,
  depth: 2,
  breadth: 3,
})
const PV7_COST = { ratio: 1.3, plusMs: 8 }
const PV7_DRAG_MS = 1000

describe('Кадры — превью броска строки', () => {
  test(
    'PV7: перетаскивание с автопрокруткой над раскрытым деревом в 100 000 строк с линиями против той же сессии без линий — p95 кадра до +30 % или 8 мс',
    async () => {
      const session = async (lines: boolean) => {
        const screen = await renderGrid({
          columnCount: 6,
          dataOverride: DROP_TREE,
          enableRowDragging: true,
          enableRowExpanding: true,
          rowExpandingMaxDepth: 1,
          enableTreeLines: lines,
          initialExpanded: true,
        })
        await waitForGrid()
        const scroller = getScroller()
        const handle = document.querySelector<HTMLElement>(
          `.data-grid__body-row[data-index="1"] ${HANDLE}`,
        )!
        const { hx } = await beginDrag(handle)
        const edge = scroller.getBoundingClientRect().bottom - 4
        let started = 0
        const result = await measureTransitionWork(
          async () => {
            started = performance.now()
            firePointer('pointermove', document, hx, edge)
          },
          () => performance.now() - started > PV7_DRAG_MS,
        )
        // Сессия мерила автопрокрутку, а не стоящий грид.
        expect(scroller.scrollTop).toBeGreaterThan(0)
        firePointer('pointerup', document, hx, edge)
        await screen.unmount()
        return result
      }
      const runs = await againstBase(session)
      const base = medianRun(runs.base, r => r.p95Ms)
      const variant = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, PV7_COST)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'scroll',
          size: '100 000 дерево',
          plugins: 'rowDragging, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'animation',
              metric: 'p95',
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('PV7-base', 'перетаскивание без линий', base, false)
      await record('PV7', 'перетаскивание с превью линий', variant, true)
      expect(
        variant.p95Ms,
        `p95=${variant.p95Ms.toFixed(1)}ms, база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 4,
  )
})

// Перенос в ленивом дереве (ADR 0112, LT12): перестановка ребёнка ленивой группы с
// клавиатуры — строка встаёт стадией исходной модели, промис `onRowDragEnd` ждёт —
// против той же перестановки ребёнка группы, чьи 100 детей лежат в данных, на 100 000
// корней. Прогрев переставляет одного ребёнка, замер — следующего: переставленная
// строка ждёт промиса и не переносится.
const LT12_GROUP = LAZY_ROOTS[0]!
const lt12Child = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      `.data-grid__body-row[data-row-id^='${LT12_GROUP}-k']`,
    ),
  ].find(row => !row.hasAttribute('aria-busy'))
const lt12Move = async () => {
  lt12Child()!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }),
  )
}

describe('Отзывчивость — перенос в ленивом дереве', () => {
  test(
    'LT12: перестановка ребёнка ленивой группы со стадией ожидающих переносов на 100 000 корней не дороже той же перестановки в данных',
    async () => {
      const measure = async (lazy: boolean) => {
        const data = [...getData(SEARCH_SIZE.dataCount)] as {
          id: string
          subRows?: unknown[]
        }[]
        if (!lazy) {
          const at = data.findIndex(row => row.id === LT12_GROUP)
          data[at] = { ...data[at]!, subRows: lazyKids(LT12_GROUP) }
        }
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          enableRowExpanding: true,
          dataOverride: data,
          ...(lazy
            ? {
                rowExpandingHasChildren: (row: { id: string }) =>
                  row.id === LT12_GROUP,
                rowExpandingLoadChildren: (row: { id: string }) =>
                  lazyKids(row.id),
              }
            : {}),
          // Промис не выполняется: переставленные строки ждут, ленивые — стадией.
          onRowDragEnd: () => new Promise(() => {}),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const toggle = () =>
          document.querySelector<HTMLElement>(
            `.data-grid__body-row[data-row-id='${LT12_GROUP}'] .row-expand-button`,
          )
        await expect.poll(toggle).toBeTruthy()
        toggle()!.click()
        await expect.poll(lt12Child).toBeTruthy()
        const result = await measureInteractionWork(lt12Move, {
          afterWarmup: () =>
            expect(
              document.querySelectorAll(
                `.data-grid__body-row[data-row-id^='${LT12_GROUP}-k'][aria-busy]`,
              ),
            ).toHaveLength(1),
        })
        expect(
          document.querySelectorAll(
            `.data-grid__body-row[data-row-id^='${LT12_GROUP}-k'][aria-busy]`,
          ),
        ).toHaveLength(2)
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const staged = medianRun(runs.variant, r => r.longestMs)
      // Стадия правит только ответ группы — не дороже пересборки данных; запас на шум.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1, plusMs: 30 })
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
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record(
        'LT12-base',
        'перестановка ребёнка группы в данных, промис ждёт',
        base,
        false,
      )
      await record(
        'LT12',
        'перестановка ребёнка ленивой группы стадией модели',
        staged,
        true,
      )
      expect(
        staged.longestMs,
        `стадия longest=${staged.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Движение колонок (ADR 0115, CN13): перенос колонки на 1000×1000 через `setColumnOrder` —
// отзывчивость переноса и кадры, пока колонки едут, — против того же переноса без движения.
// Фокус не трогается: прокрутка к фокусу оборвала бы движение (ADR 0115, «Границы»).
/**
 * Цена движения по ADR 0115, CN13: перенос платит за замер шапки и запуск анимаций ячеек
 * в коммите, кадры движения — за слои композитора едущих ячеек.
 */
const CN13_MOVE_COST = { ratio: 1.45, plusMs: 8 }
const CN13_GLIDE_COST = { ratio: 1.3, plusMs: 12 }
const COLUMN_MOTION_SETTLE_MS = 400
const MOTION_COLUMN_IDS = Array.from({ length: 1000 }, (_, i) => `c${i}`)
const MOTION_GRID_COLUMNS = MOTION_COLUMN_IDS.map((id, i) => ({
  id,
  header: id.toUpperCase(),
  accessorFn: (row: { n: number }) => row.n * 1000 + i,
  size: 150,
}))
const MOTION_GRID_ROWS = Array.from({ length: 1000 }, (_, n) => ({
  id: `r${n}`,
  n,
}))
/** c1 на место c2 — колонка у левого края, видна до и после переноса. */
const MOTION_SWAPPED = ['c0', 'c2', 'c1', ...MOTION_COLUMN_IDS.slice(3)]

describe('Отзывчивость — движение колонок', () => {
  test(
    'CN13: перенос колонки на 1000×1000 с движением против того же без него — перенос до +45 % или 8 мс, самый долгий кадр движения до +30 % или 12 мс',
    async () => {
      const mount = async (motion: boolean) => {
        let table: { setColumnOrder: (order: string[]) => void } | undefined
        const MotionGrid = () => {
          const created = useCreateTable({
            columns: MOTION_GRID_COLUMNS as never,
            data: MOTION_GRID_ROWS,
            getRowId: (row: { id: string }) => row.id,
            enableColumnAnimation: motion,
          })
          table = created as never
          return (
            <div style={{ width: 1200, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<MotionGrid />)
        await waitForGrid()
        return table!
      }
      const secondId = () =>
        document
          .querySelectorAll<HTMLElement>(
            '.data-grid__head-cell[data-column-id]',
          )[1]
          ?.getAttribute('data-column-id')
      /** Ячейки, которые едут, — анимации `translate` в кадре после переноса. */
      const gliding = () =>
        document
          .getAnimations()
          .filter(animation =>
            (animation.effect as KeyframeEffect)
              .getKeyframes()
              .some(frame => 'translate' in frame),
          ).length

      const move = async (motion: boolean) => {
        const table = await mount(motion)
        const result = await measureInteractionWork(
          async () => {
            table.setColumnOrder(MOTION_SWAPPED)
            await expect.poll(secondId).toBe('c2')
          },
          {
            afterWarmup: async () => {
              table.setColumnOrder([])
              await expect.poll(secondId).toBe('c1')
              await new Promise(resolve =>
                setTimeout(resolve, COLUMN_MOTION_SETTLE_MS),
              )
            },
          },
        )
        await cleanup()
        return result
      }

      // Кадры после коммита, пока колонки едут: цена самого движения. Коммит — в `move`.
      const glide = async (motion: boolean) => {
        const table = await mount(motion)
        const started = performance.now()
        table.setColumnOrder(MOTION_SWAPPED)
        await new Promise(resolve => requestAnimationFrame(resolve))
        const glided = gliding()
        const result = await measureTransitionWork(
          async () => {},
          () => performance.now() - started > COLUMN_MOTION_SETTLE_MS,
        )
        expect(secondId()).toBe('c2')
        expect(glided > 0, 'колонки ехали').toBe(motion)
        await cleanup()
        return result
      }

      const cases = [
        ['move', move, 'longestMs', 'interaction', CN13_MOVE_COST],
        ['glide', glide, 'longestMs', 'animation', CN13_GLIDE_COST],
      ] as const
      for (const [name, measure, metric, kind, cost] of cases) {
        const runs = await againstBase(measure)
        const base = medianRun(runs.base, r => r[metric])
        const variant = medianRun(runs.variant, r => r[metric])
        const ceiling = ceilingOver(base[metric], cost)
        const record = (
          id: string,
          label: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id,
            label,
            operation: kind === 'interaction' ? 'interaction' : 'scroll',
            size: '1000×1000',
            plugins: 'none',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: kind === 'interaction' ? 'load' : 'animation',
                metric: 'longest',
                valueMs: r[metric],
                targetMs:
                  kind === 'interaction'
                    ? INTERACTION_BUDGET_MS
                    : ANIMATION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        await record(`CN13-${name}-base`, `${name} без движения`, base, false)
        await record(
          `CN13-${name}`,
          `${name} с движением колонок`,
          variant,
          true,
        )
        expect(
          variant[metric],
          `${name}: ${metric}=${variant[metric].toFixed(1)}ms, база ${base[metric].toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 4,
  )
})

// Линия границы колонки (ADR 0197, RL11): те же шаги ширины по кадру на 1000×1000 — с
// активным грипом (фокус клавиатуры, линия во всю высоту) против того же без него.
/** Цена линии: замер черты и запись положения слоя на каждом шаге ширины. */
const RL11_COST = { ratio: 1.1, plusMs: 2 }
const RESIZE_STEPS = 40

describe('Кадры — линия границы колонки', () => {
  test(
    'RL11: кадр протяжки ширины на 1000×1000 с линией не дороже той же протяжки без неё — до +10 % или 2 мс',
    async () => {
      const resize = async (line: boolean) => {
        let table:
          | {
              setColumnSizing: (
                updater: (
                  old: Record<string, number>,
                ) => Record<string, number>,
              ) => void
            }
          | undefined
        const ResizeGrid = () => {
          const created = useCreateTable({
            columns: MOTION_GRID_COLUMNS as never,
            data: MOTION_GRID_ROWS,
            getRowId: (row: { id: string }) => row.id,
            plugins: [columnSizing()],
          })
          table = created as never
          return (
            <div style={{ width: 1200, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<ResizeGrid />)
        await waitForGrid()
        const separator = document.querySelector<HTMLElement>(
          '.data-grid__head-cell[data-column-id="c1"] [role="separator"]',
        )!
        const shown = () =>
          document.querySelector('[data-column-resize-line]:not([hidden])') !==
          null
        if (line) {
          separator.focus()
          separator.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }),
          )
          await expect.poll(shown).toBe(true)
        }
        let step = 0
        const result = await measureTransitionWork(
          async () => {
            const next = () => {
              step++
              table!.setColumnSizing(old => ({ ...old, c1: 150 + step * 5 }))
              if (step < RESIZE_STEPS) requestAnimationFrame(next)
            }
            requestAnimationFrame(next)
          },
          () => step >= RESIZE_STEPS,
        )
        expect(shown(), 'линия во время шагов').toBe(line)
        await cleanup()
        return result
      }

      const runs = await againstBase(resize)
      const base = medianRun(runs.base, r => r.p95Ms)
      const variant = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, RL11_COST)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'scroll',
          size: '1000×1000',
          plugins: 'columnSizing',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'animation',
              metric: 'p95',
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('RL11-base', 'шаги ширины без линии', base, false)
      await record('RL11', 'шаги ширины с линией границы', variant, true)
      expect(
        variant.p95Ms,
        `p95=${variant.p95Ms.toFixed(1)}ms, база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Маркер угла выделения (ADR 0198, HN16): кадр протяжки маркера на 1000×1000 против протяжки
// выделения от ячейки по тем же ячейкам.
/** Цена маркера: поиск ячейки под указателем и место маркера на каждом шаге. */
const HN16_COST = { ratio: 1.1, plusMs: 2 }
const HANDLE_STEPS = 40

describe('Кадры — маркер угла выделения', () => {
  test(
    'HN16: кадр протяжки маркера на 1000×1000 не дороже протяжки выделения от ячейки — до +10 % или 2 мс',
    async () => {
      const drag = async (handle: boolean) => {
        const HandleGrid = () => {
          const created = useCreateTable({
            columns: MOTION_GRID_COLUMNS as never,
            data: MOTION_GRID_ROWS,
            getRowId: (row: { id: string }) => row.id,
            plugins: [cellSelection()],
          })
          return (
            <div style={{ width: 1200, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<HandleGrid />)
        await waitForGrid()
        const cellOf = (row: number, column: number) =>
          document.querySelector<HTMLElement>(
            `.data-grid__body-row[data-index="${row}"] .data-grid__body-cell[data-column-id="c${column}"]`,
          )!
        const centerOf = (el: Element) => {
          const r = el.getBoundingClientRect()
          return {
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
          }
        }
        const mouse = (type: string, target: EventTarget, at: object) =>
          target.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              button: 0,
              buttons: type === 'mouseup' ? 0 : 1,
              ...at,
            }),
          )
        const pointer = (type: string, target: EventTarget, at: object) =>
          target.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              button: 0,
              buttons: type === 'pointerup' ? 0 : 1,
              pointerType: 'mouse',
              isPrimary: true,
              ...at,
            }),
          )
        const marker = () =>
          document.querySelector<HTMLElement>(
            '[data-range-handle]:not([hidden])',
          )
        // Угол — в окне: строки 1–8, колонки 1–5; шаг меняет ячейку под указателем.
        const target = (step: number) =>
          cellOf(1 + (step % 8), 1 + (Math.floor(step / 8) % 5))
        const start = cellOf(1, 1)
        if (handle) {
          mouse('mousedown', start, centerOf(start))
          mouse('mouseup', document, centerOf(start))
          await expect.poll(marker).not.toBeNull()
          pointer('pointerdown', marker()!, centerOf(marker()!))
        } else {
          mouse('mousedown', start, centerOf(start))
        }
        let step = 0
        const result = await measureTransitionWork(
          async () => {
            const next = () => {
              step++
              const cell = target(step)
              if (handle) pointer('pointermove', document, centerOf(cell))
              else mouse('mouseover', cell, centerOf(cell))
              if (step < HANDLE_STEPS) requestAnimationFrame(next)
            }
            requestAnimationFrame(next)
          },
          () => step >= HANDLE_STEPS,
        )
        const last = target(HANDLE_STEPS)
        expect(
          last.hasAttribute('data-cell-selected'),
          'угол протяжки выделен',
        ).toBe(true)
        expect(
          marker()?.hasAttribute('data-dragging') ?? false,
          'протяжка маркером',
        ).toBe(handle)
        if (handle) pointer('pointerup', document, centerOf(last))
        else mouse('mouseup', document, centerOf(last))
        await cleanup()
        return result
      }

      const runs = await againstBase(drag)
      const base = medianRun(runs.base, r => r.p95Ms)
      const variant = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, HN16_COST)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'scroll',
          size: '1000×1000',
          plugins: 'cellSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'animation',
              metric: 'p95',
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('HN16-base', 'протяжка выделения от ячейки', base, false)
      await record('HN16', 'протяжка маркера угла выделения', variant, true)
      expect(
        variant.p95Ms,
        `p95=${variant.p95Ms.toFixed(1)}ms, база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Серверная модель строк (ADR 0138, SD32): приход блока из 10 строк при итоге 1 000 000
// против того же прихода при итоге 1000 — работа прихода не растёт с итогом.
interface ServerCall {
  start: number
  end: number
  resolve: (response: { rows: FeedRow[] }) => void
}
let serverCalls: ServerCall[] = []
const SSRM_BLOCK = 10
const ServerGrid = ({ total }: { total: number }) => {
  const table = useCreateTable({
    rowCount: total,
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: SSRM_BLOCK,
        getRows: ({ start, end }) =>
          new Promise<{ rows: FeedRow[] }>(resolve => {
            serverCalls.push({ start, end, resolve })
          }),
      }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}
const NO_FEED: FeedRow[] = []

describe('Отзывчивость взаимодействий — серверная модель строк', () => {
  test(
    'SD32: приход блока при итоге 1 000 000 не дороже того же прихода при итоге 1000',
    async () => {
      const measure = async (large: boolean) => {
        serverCalls = []
        await render(<ServerGrid total={large ? 1_000_000 : 1000} />)
        // В окне — несколько блоков: прогрев и замер принимают по одному.
        await expect.poll(() => serverCalls.length).toBeGreaterThanOrEqual(2)
        /** Первая строка блока с началом `start` — с данными. */
        const arrived = (start: number) =>
          document.querySelector(
            `.data-grid__body-row[data-index="${start}"][data-row-id]`,
          ) !== null
        let answered = 0
        const result = await measureInteractionWork(
          async () => {
            const call = serverCalls[answered++]!
            call.resolve({ rows: feedRows(call.start, call.end - call.start) })
            await expect.poll(() => arrived(call.start)).toBe(true)
          },
          {
            afterWarmup: () => {
              expect(arrived(0)).toBe(true)
              expect(arrived(SSRM_BLOCK)).toBe(false)
            },
          },
        )
        expect(arrived(SSRM_BLOCK)).toBe(true)
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const large = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
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
          size: gated ? '1 000 000×3' : '1000×3',
          plugins: 'serverRowModel',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SD32-base', 'итог 1000', base, false)
      await record('SD32', 'итог 1 000 000', large, true)
      expect(
        large.longestMs,
        `longest=${large.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Транзакции строк SSRM (ADR 0157, RT12): вставка 100 строк одной транзакцией при итоге
// 1 000 000 против 100 вызовов `setRowData` той же таблицы — пересборка блоков на месте не
// дороже замены строк.
interface TransactionGridTable {
  applyRowTransaction: (transaction: object) => unknown
  setRowData: (id: string, updater: (row: FeedRow) => FeedRow) => void
}
let transactionTable: TransactionGridTable | undefined
const TransactionGrid = () => {
  const table = useCreateTable({
    rowCount: 1_000_000,
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: 100,
        getRows: ({ start, end }) =>
          Promise.resolve({ rows: feedRows(start, end - start) }),
      }),
    ] as never,
  })
  transactionTable = table as unknown as TransactionGridTable
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — транзакции строк SSRM', () => {
  test(
    'RT12: вставка 100 строк при итоге 1 000 000 не дороже 100 вызовов setRowData',
    async () => {
      const ROWS = 100
      const cell = (index: number) =>
        document.querySelector(
          `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id="a"]`,
        )?.textContent
      const measure = async (insert: boolean) => {
        await render(<TransactionGrid />)
        await expect.poll(() => cell(0)).toBe('Name 0')
        let round = 0
        const result = await measureInteractionWork(async () => {
          const tag = `t${round++}`
          if (insert) {
            transactionTable!.applyRowTransaction({
              add: Array.from({ length: ROWS }, (_, k) => ({
                ...feedRows(k, 1)[0],
                id: `${tag}-${k}`,
                a: `${tag} ${k}`,
              })),
              index: 0,
            })
          } else {
            for (let k = 0; k < ROWS; k++) {
              transactionTable!.setRowData(`f${k}`, row => ({
                ...row,
                a: `${tag} ${k}`,
              }))
            }
          }
          await expect.poll(() => cell(0)).toBe(`${tag} 0`)
        })
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const inserted = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
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
          size: '1 000 000×3',
          plugins: 'serverRowModel',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('RT12-base', '100 × setRowData', base, false)
      await record('RT12', 'транзакция из 100 строк', inserted, true)
      expect(
        inserted.longestMs,
        `longest=${inserted.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Пагинация в SSRM (ADR 0158, SP11): переход между загруженными страницами по 100 строк
// при итоге 1 000 000 против клиентской смены страницы того же размера на 100 000 строк.
const PAGED_ROWS = 100
const CLIENT_PAGED_DATA = feedRows(0, 100_000)
const PagedGrid = ({ server }: { server: boolean }) => {
  const table = useCreateTable({
    rowCount: 1_000_000,
    columns: FEED_COLUMNS as never,
    data: server ? NO_FEED : CLIENT_PAGED_DATA,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      ...(server
        ? [
            serverRowModel({
              blockSize: PAGED_ROWS,
              getRows: ({ start, end }) =>
                Promise.resolve({ rows: feedRows(start, end - start) }),
            }),
          ]
        : []),
      pagination({ initialPageSize: PAGED_ROWS }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — пагинация SSRM', () => {
  test(
    'SP11: переход на страницу из кэша при итоге 1 000 000 не дороже клиентской смены страницы того же размера',
    async () => {
      const measure = async (server: boolean) => {
        await render(<PagedGrid server={server} />)
        await expect.poll(firstRowId).toBe('f0')
        // Вторая страница загружена до замера: переход — из кэша.
        pageButton('next')!.click()
        await expect.poll(firstRowId).toBe(`f${PAGED_ROWS}`)
        pageButton('previous')!.click()
        await expect.poll(firstRowId).toBe('f0')
        let forward = true
        const result = await measureInteractionWork(async () => {
          pageButton(forward ? 'next' : 'previous')!.click()
          await expect.poll(firstRowId).toBe(forward ? `f${PAGED_ROWS}` : 'f0')
          forward = !forward
        })
        await cleanup()
        return result
      }
      const runs = await againstBase(server => measure(server))
      const base = medianRun(runs.base, r => r.longestMs)
      const paged = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
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
          size: gated ? '1 000 000×3' : '100 000×3',
          plugins: gated ? 'serverRowModel, pagination' : 'pagination',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SP11-base', 'клиентская смена страницы', base, false)
      await record('SP11', 'страница SSRM из кэша', paged, true)
      expect(
        paged.longestMs,
        `longest=${paged.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Перенос строки в SSRM (ADR 0159, MV11): запись переноса при итоге 1 000 000 против того
// же переноса в клиентском режиме на 100 000 строк — путь броска, меню и клавиш один.
let moveTable: unknown
const CLIENT_MOVE_DATA = feedRows(0, 100_000)
const MoveGrid = ({ server }: { server: boolean }) => {
  const [rows, setRows] = useState(CLIENT_MOVE_DATA)
  const table = useCreateTable({
    rowCount: 1_000_000,
    columns: FEED_COLUMNS as never,
    data: server ? NO_FEED : rows,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      ...(server
        ? [
            serverRowModel({
              blockSize: 100,
              getRows: ({ start, end }) =>
                Promise.resolve({ rows: feedRows(start, end - start) }),
            }),
          ]
        : []),
      rowDragging({ onRowOrderChange: setRows as never }),
    ] as never,
  })
  moveTable = table
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — перенос строки SSRM', () => {
  test(
    'MV11: бросок при итоге 1 000 000 не дороже броска в клиентском режиме на 100 000 строк',
    async () => {
      const idAt = (index: number) =>
        document.querySelector<HTMLElement>(
          `.data-grid__body-row[data-index="${index}"]`,
        )?.dataset.rowId
      const rowOf = (id: string) =>
        (
          moveTable as {
            getRowSource: () => { byId: (id: string) => unknown }
          }
        )
          .getRowSource()
          .byId(id)
      const measure = async (server: boolean) => {
        await render(<MoveGrid server={server} />)
        await expect.poll(() => idAt(2)).toBe('f2')
        let down = true
        const result = await measureInteractionWork(async () => {
          moveRow(rowOf('f2'), moveTable, down ? 1 : -1)
          await expect.poll(() => idAt(down ? 3 : 2)).toBe('f2')
          down = !down
        })
        await cleanup()
        return result
      }
      const runs = await againstBase(server => measure(server))
      const base = medianRun(runs.base, r => r.longestMs)
      const moved = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
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
          size: gated ? '1 000 000×3' : '100 000×3',
          plugins: gated ? 'serverRowModel, rowDragging' : 'rowDragging',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('MV11-base', 'перенос строки на клиенте', base, false)
      await record('MV11', 'перенос строки SSRM', moved, true)
      expect(
        moved.longestMs,
        `longest=${moved.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Ленивые дети в SSRM (ADR 0138, SD46): раскрытие ветки со 100 детьми при 1 000 000 корней
// против того же раскрытия при 1000 корней. Цена — пересчёт размеров виртуализатора на
// миллион строк (§14): он растёт с числом строк, раскладка веток — нет.
interface ServerTreeCall {
  start: number
  end: number
  parentId?: string
  resolve: (response: { rows: FeedRow[]; rowCount?: number }) => void
}
let treeCalls: ServerTreeCall[] = []
const BRANCH = 100
const ServerTreeGrid = ({ total }: { total: number }) => {
  const table = useCreateTable({
    rowCount: total,
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: BRANCH,
        getRows: ({ start, end, parentId }) =>
          new Promise<{ rows: FeedRow[]; rowCount?: number }>(resolve => {
            treeCalls.push({ start, end, parentId, resolve })
          }),
      }),
      rowExpanding({ hasChildren: row => row.depth === 0 }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** Раскрытие ветки со 100 детьми при 1 000 000 корней или при 1000. */
const measureServerBranch = async (large: boolean) => {
  treeCalls = []
  await render(<ServerTreeGrid total={large ? 1_000_000 : 1000} />)
  await expect.poll(() => treeCalls.length).toBeGreaterThanOrEqual(1)
  const roots = treeCalls[0]!
  roots.resolve({ rows: feedRows(roots.start, roots.end - roots.start) })
  const rowOf = (id: string) =>
    document.querySelector<HTMLElement>(
      `.data-grid__body-row[data-row-id="${id}"]`,
    )
  const toggleOf = (id: string) =>
    rowOf(id)!.querySelector<HTMLElement>('.row-expand-button')!
  await expect.poll(() => rowOf('f1')).not.toBeNull()
  const parents = ['f0', 'f1']
  let expanded = 0
  const result = await measureInteractionWork(
    async () => {
      const id = parents[expanded++]!
      const asked = treeCalls.length
      toggleOf(id).click()
      await expect.poll(() => treeCalls.length).toBe(asked + 1)
      const call = treeCalls.at(-1)!
      call.resolve({
        rows: feedRows(0, BRANCH).map((row, k) => ({
          ...row,
          id: `${id}.${k}`,
        })),
        rowCount: BRANCH,
      })
      await expect.poll(() => rowOf(`${id}.0`)).not.toBeNull()
    },
    {
      // Ветка строки 0 свёрнута — строка 1 снова в окне.
      afterWarmup: async () => {
        expect(treeCalls.at(-1)!.parentId).toBe('f0')
        toggleOf('f0').click()
        await expect.poll(() => rowOf('f0.0')).toBeNull()
      },
    },
  )
  expect(treeCalls.at(-1)!.parentId).toBe('f1')
  await cleanup()
  return result
}

describe('Отзывчивость взаимодействий — ленивые дети серверной модели строк', () => {
  test(
    'SD46: раскрытие ветки со 100 детьми при 1 000 000 корней не дороже того же раскрытия при 1000 корней плюс 60 мс',
    async () => {
      const runs = await againstBase(measureServerBranch)
      const base = medianRun(runs.base, r => r.longestMs)
      const large = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 60 })
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
          size: gated ? '1 000 000×3' : '1000×3',
          plugins: 'serverRowModel, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SD46-base', '1000 корней', base, false)
      await record('SD46', '1 000 000 корней', large, true)
      expect(
        large.longestMs,
        `longest=${large.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// «Раскрыть всё» в SSRM (ADR 0160, EA11): кнопка в шапке при 1 000 000 корней против
// раскрытия одной ветки (замер SD46) — детей просят только ветки окна.
/** Кнопкой «Раскрыть всё» при 1 000 000 корней: работа и запросы веток. */
const measureServerExpandAll = async () => {
  treeCalls = []
  await render(<ServerTreeGrid total={1_000_000} />)
  await expect.poll(() => treeCalls.length).toBeGreaterThanOrEqual(1)
  const roots = treeCalls[0]!
  roots.resolve({ rows: feedRows(roots.start, roots.end - roots.start) })
  const rowOf = (id: string) =>
    document.querySelector<HTMLElement>(
      `.data-grid__body-row[data-row-id="${id}"]`,
    )
  const button = () =>
    document.querySelector<HTMLElement>('.row-expand-all-button')!
  await expect.poll(() => rowOf('f1')).not.toBeNull()
  const answerBranches = () => {
    for (const call of treeCalls) {
      if (!call.parentId) continue
      call.resolve({
        rows: feedRows(0, BRANCH).map((row, k) => ({
          ...row,
          id: `${call.parentId}.${k}`,
        })),
        rowCount: BRANCH,
      })
    }
  }
  const result = await measureInteractionWork(
    // Ветка окна приходит ответом, при повторе — из кэша.
    async () => {
      button().click()
      await expect
        .poll(() => {
          answerBranches()
          return rowOf('f0.0')
        })
        .not.toBeNull()
    },
    {
      // «Свернуть всё» — та же кнопка: замер снова раскрывает всё.
      afterWarmup: async () => {
        button().click()
        await expect.poll(() => rowOf('f0.0')).toBeNull()
      },
    },
  )
  // Ветки окна ответили — новых запросов нет: окно занимает ветка первой строки.
  await new Promise(resolve => setTimeout(resolve, 200))
  const branchRequests = treeCalls.filter(call => call.parentId).length
  await cleanup()
  return { ...result, branchRequests }
}

describe('Отзывчивость взаимодействий — «раскрыть всё» в серверной модели строк', () => {
  test(
    'EA11: «раскрыть всё» в SSRM при 1 000 000 корней — запросов не больше, чем блоков окна; кадр не дороже раскрытия одной ветки (как SD46)',
    async () => {
      const runs = await againstBase(variant =>
        variant
          ? measureServerExpandAll()
          : measureServerBranch(true).then(run => ({
              ...run,
              branchRequests: 0,
            })),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const all = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 30 })
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
          size: '1 000 000×3',
          plugins: 'serverRowModel, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('EA11-base', 'раскрытие одной ветки', base, false)
      await record('EA11', '«раскрыть всё»', all, true)
      // Блок ветки — 100 строк: окно в 600px целиком в ветке первой строки.
      for (const run of runs.variant) {
        expect(run.branchRequests).toBeGreaterThan(0)
        expect(run.branchRequests).toBeLessThanOrEqual(2)
      }
      expect(
        all.longestMs,
        `longest=${all.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Подсказка виртуализатору (ADR 0145, HV8): раскрытие ветки при 1 000 000 корней в SSRM и
// дописывание 100 строк к 100 000 в ленте — с подсказкой против сверки ключей.
const HV8_CASES = [
  {
    id: 'HV8-ssrm',
    label: 'раскрытие ветки при 1 000 000 корней',
    size: '1 000 000×3',
    plugins: 'serverRowModel, rowExpanding',
    measure: () => measureServerBranch(true),
  },
  {
    id: 'HV8-feed',
    label: 'дописать 100 строк к 100 000',
    size: '100 000×3',
    plugins: 'infiniteScroll',
    measure: () => measureFeed(true),
  },
] as const
/** С подсказкой — не меньше чем на 5 % дешевле сверки (замер 2026-10-27: 17–20 %). */
const HV8_GAIN = 0.95
describe('Отзывчивость взаимодействий — подсказка виртуализатору', () => {
  test(
    'HV8: раскрытие ветки при 1 000 000 корней в SSRM и дописывание 100 строк к 100 000 в ленте с подсказкой не меньше чем на 5 % дешевле, чем со сверкой ключей',
    async () => {
      const results: string[] = []
      for (const { id, label, size, plugins, measure } of HV8_CASES) {
        const runs = await againstBase(async (hinted: boolean) => {
          rowChangeHints.enabled = hinted
          try {
            return await measure()
          } finally {
            rowChangeHints.enabled = true
          }
        })
        const base = medianRun(runs.base, r => r.longestMs)
        const hinted = medianRun(runs.variant, r => r.longestMs)
        const ceiling = base.longestMs * HV8_GAIN
        const record = (suffix: string, r: typeof base, gated: boolean) =>
          recordPerf({
            id: `${id}${suffix}`,
            label: `${label}, ${gated ? 'подсказка' : 'сверка ключей'}`,
            operation: 'interaction',
            size,
            plugins,
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: r.longestMs,
                targetMs: INTERACTION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        await record('-base', base, false)
        await record('', hinted, true)
        results.push(
          `${id}: подсказка ${hinted.longestMs.toFixed(1)}ms, сверка ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
        )
        expect(hinted.longestMs, results.at(-1)).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 4,
  )
})

// Серверная группировка (ADR 0144, GS12): раскрытие группы со 100 строками при 100 000 групп
// против раскрытия ленивой ветки со 100 детьми при 100 000 корней (как SD46).
const GS12_ROOTS = 100_000
interface GroupCall extends ServerTreeCall {
  groupKeys: unknown[]
}
let groupCalls: GroupCall[] = []
const ServerGroupedGrid = () => {
  const table = useCreateTable({
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: BRANCH,
        getGroupChildCount: () => BRANCH,
        getRows: ({ start, end, parentId, groupKeys }) =>
          new Promise<{ rows: FeedRow[]; rowCount?: number }>(resolve => {
            groupCalls.push({ start, end, parentId, groupKeys, resolve })
          }),
      }),
      rowGrouping({ initialGrouping: ['a'] }),
      rowExpanding(),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — серверная группировка', () => {
  test(
    'GS12: раскрытие группы при 100 000 групп не дороже раскрытия ветки при 100 000 корней больше чем на 15 % (или 20 мс)',
    async () => {
      const rowOf = (id: string) =>
        document.querySelector<HTMLElement>(
          `.data-grid__body-row[data-row-id='${id}']`,
        )
      const toggleOf = (id: string) =>
        rowOf(id)!.querySelector<HTMLElement>('.row-expand-button')!
      const measure = async (grouped: boolean) => {
        treeCalls = []
        groupCalls = []
        const calls = () => (grouped ? groupCalls : treeCalls)
        await render(
          grouped ? (
            <ServerGroupedGrid />
          ) : (
            <ServerTreeGrid total={GS12_ROOTS} />
          ),
        )
        await expect.poll(() => calls().length).toBeGreaterThanOrEqual(1)
        const roots = calls()[0]!
        const rows = feedRows(roots.start, roots.end - roots.start)
        roots.resolve({
          rows: grouped ? rows.map(row => ({ ...row, id: '' })) : rows,
          rowCount: GS12_ROOTS,
        })
        const parents = grouped
          ? [
              `group:${JSON.stringify([rows[0]!.a])}`,
              `group:${JSON.stringify([rows[1]!.a])}`,
            ]
          : ['f0', 'f1']
        await expect.poll(() => rowOf(parents[1]!)).not.toBeNull()
        let expanded = 0
        const result = await measureInteractionWork(
          async () => {
            const id = parents[expanded++]!
            const asked = calls().length
            toggleOf(id).click()
            await expect.poll(() => calls().length).toBe(asked + 1)
            const call = calls().at(-1)!
            call.resolve({
              rows: feedRows(0, BRANCH).map((row, k) => ({
                ...row,
                id: `${id}.${k}`,
              })),
              rowCount: BRANCH,
            })
            await expect.poll(() => rowOf(`${id}.0`)).not.toBeNull()
          },
          {
            // Ветка первой строки свёрнута — вторая снова в окне.
            afterWarmup: async () => {
              expect(calls().at(-1)!.parentId).toBe(parents[0])
              toggleOf(parents[0]!).click()
              await expect.poll(() => rowOf(`${parents[0]}.0`)).toBeNull()
            },
          },
        )
        expect(calls().at(-1)!.parentId).toBe(parents[1])
        if (grouped) {
          expect(groupCalls.at(-1)!.groupKeys).toEqual([rows[1]!.a])
        }
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const grouped = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.15, plusMs: 20 })
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
          size: '100 000×3',
          plugins: gated
            ? 'serverRowModel, rowGrouping, rowExpanding'
            : 'serverRowModel, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('GS12-base', 'ветка при 100 000 корней', base, false)
      await record('GS12', 'группа при 100 000 групп', grouped, true)
      expect(
        grouped.longestMs,
        `longest=${grouped.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Копирование в серверной модели строк (ADR 0146, XC15): сборка буфера 10 000 строк × 10
// колонок с догрузкой строк (мгновенный ответ) против той же копии в клиентском режиме.
const XC15_ROWS = 10_000
const XC15_COLUMNS = Array.from({ length: 10 }, (_, k) => ({
  id: `c${k}`,
  accessorKey: `c${k}`,
  header: `C${k}`,
}))
type CopyRow = Record<string, string> & { id: string }
let copyPool: CopyRow[] | undefined
const copyRowsOf = () =>
  (copyPool ??= Array.from({ length: XC15_ROWS }, (_, i) => {
    const row: CopyRow = { id: `x${i}` }
    for (let k = 0; k < 10; k++) row[`c${k}`] = `v${i}-${k}`
    return row
  }))
const NO_COPY_ROWS: CopyRow[] = []
let copyTable: { selectAllCells: () => void } | undefined
const CopyGrid = ({ server }: { server: boolean }) => {
  const table = useCreateTable({
    rowCount: XC15_ROWS,
    columns: XC15_COLUMNS as never,
    data: server ? NO_COPY_ROWS : copyRowsOf(),
    getRowId: (row: CopyRow) => row.id,
    plugins: [
      ...(server
        ? [
            serverRowModel({
              getRows: ({ start, end }) => ({
                rows: copyRowsOf().slice(start, end),
              }),
            }),
          ]
        : []),
      cellSelection(),
    ] as never,
  })
  copyTable = table as never
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}
const XC15_COST = { ratio: 1.3, plusMs: 40 }

describe('Отзывчивость взаимодействий — копирование в серверной модели строк', () => {
  test(
    'XC15: сборка буфера 10 000 строк × 10 колонок в SSRM не дороже той же копии в клиентском режиме',
    async () => {
      const clipboard = navigator.clipboard
      const measure = async (server: boolean) => {
        let written: string[] = []
        // Окно теста писать в буфер не вправе: запись подменена, текст сохраняется.
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            write: async (items: ClipboardItem[]) => {
              for (const item of items) {
                written.push(await (await item.getType('text/plain')).text())
              }
            },
            writeText: async (text: string) => {
              written.push(text)
            },
          },
        })
        try {
          await render(<CopyGrid server={server} />)
          await waitForGrid()
          copyTable!.selectAllCells()
          const result = await measureInteractionWork(async () => {
            written = []
            const clipboardData = new DataTransfer()
            document
              .querySelector('.data-grid__body-cell[data-column-id="c0"]')!
              .dispatchEvent(
                new ClipboardEvent('copy', {
                  bubbles: true,
                  cancelable: true,
                  clipboardData,
                }),
              )
            const sync = clipboardData.getData('text/plain')
            if (sync) written.push(sync)
            await expect.poll(() => written.length).toBe(1)
          })
          // Замер копировал всё выделение.
          expect(written[0]!.split('\n')).toHaveLength(XC15_ROWS)
          await cleanup()
          return result
        } finally {
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: clipboard,
          })
        }
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const server = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, XC15_COST)
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
          size: '10 000×10',
          plugins: gated ? 'serverRowModel, cellSelection' : 'cellSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('XC15-base', 'клиентский режим', base, false)
      await record('XC15', 'серверная модель, догрузка строк', server, true)
      expect(
        server.longestMs,
        `longest=${server.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Открытие редакторов по типу (ADR 0175, ED14): поле с поиском на 1000 вариантов и календарь
// даты против текстового поля той же таблицы.
const EDIT_OPTIONS = Array.from({ length: 1000 }, (_, i) => ({
  value: `v${i}`,
  label: `Value ${String(i).padStart(4, '0')}`,
}))
const EDIT_ROWS = Array.from({ length: 200 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  code: `v${i}`,
  day: '2026-03-15',
}))
const EDIT_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', dataType: 'text' },
  {
    id: 'code',
    accessorKey: 'code',
    header: 'Code',
    dataType: 'select',
    options: EDIT_OPTIONS,
  },
  { id: 'day', accessorKey: 'day', header: 'Day', dataType: 'dateString' },
]
const EDIT_PLUGINS = [cellEditing({ onCellEdit: () => {} })]

const EditHost = () => {
  const table = useCreateTable({
    columns: EDIT_COLUMNS as never,
    data: EDIT_ROWS,
    plugins: EDIT_PLUGINS,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table} />
    </div>
  )
}

const editCell = (column: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="r0"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
/** Редактор ячейки открыт: поле, поле с поиском или календарь. */
const editorOpen = (column: string) =>
  column === 'day'
    ? !!document.querySelector('[data-testid="edit-calendar"]')
    : !!editCell(column).querySelector('input')

describe('Отзывчивость — редакторы по типу', () => {
  test(
    'ED14: открытие редактора с 1000 вариантов и открытие календаря — против текстового поля, гейт против базы',
    async () => {
      const measureOpen = async (column: string) => {
        await render(<EditHost />)
        await waitForGrid()
        const open = async () => {
          editCell(column)
            .querySelector<HTMLElement>('.cell__button button')!
            .click()
          await expect.poll(() => editorOpen(column)).toBe(true)
        }
        const close = async () => {
          document.activeElement?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          )
          await expect.poll(() => editorOpen(column)).toBe(false)
        }
        const result = await measureInteractionWork(open, {
          afterWarmup: close,
        })
        expect(editorOpen(column)).toBe(true)
        await cleanup()
        return result
      }
      for (const [id, column, label] of [
        ['ED14-select', 'code', 'поле с поиском на 1000 вариантов'],
        ['ED14-date', 'day', 'календарь даты'],
      ] as const) {
        // eslint-disable-next-line no-await-in-loop
        const runs = await againstBase(variant =>
          measureOpen(variant ? column : 'name'),
        )
        const base = medianRun(runs.base, r => r.longestMs)
        const editor = medianRun(runs.variant, r => r.longestMs)
        // Поповер и окно списка или сетка дней месяца с выбором месяца и года — сверх поля
        // ввода; потолок — в пределах бюджета взаимодействия.
        const ceiling = ceilingOver(base.longestMs, { ratio: 2, plusMs: 80 })
        const record = (
          recordId: string,
          recordLabel: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id: recordId,
            label: recordLabel,
            operation: 'interaction',
            size: '200×3',
            plugins: 'cellEditing',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: r.longestMs,
                targetMs: INTERACTION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        // eslint-disable-next-line no-await-in-loop
        await record(`${id}-base`, 'текстовое поле', base, false)
        // eslint-disable-next-line no-await-in-loop
        await record(id, label, editor, true)
        expect(
          editor.longestMs,
          `${label} longest=${editor.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 4,
  )
})

// «Применить всё» при многих черновиках (ADR 0178, DR26): 10 000 черновиков ячеек против 1000
// с синхронным ответом — разбор ответа одной записью в каждый срез, работа растёт линейно.
const DR26_RATIO = 20
const DR26_COLUMNS = Array.from({ length: 10 }, (_, i) => `col_${i}`)
describe('Применить всё — много черновиков', () => {
  test(
    'DR26: «Применить всё» с 10 000 черновиками ячеек и синхронным ответом не дороже, чем с 1000, больше чем в 20 раз',
    async () => {
      const measure = async (rows: number) => {
        let table: unknown
        const screen = renderPluginsGrid({
          ...LARGE,
          plugins: [
            cellEditing({
              saveMode: 'manual',
              onCommitEdits: () => undefined,
            } as never),
            {
              id: 'perfDrafts',
              setup: t => {
                table = t
              },
            },
          ],
        })
        await expect.poll(() => table).toBeTruthy()
        const seed = () =>
          setPluginState(
            table,
            DRAFTS,
            Array.from({ length: rows }, (_, row) =>
              DR26_COLUMNS.map(column => ({
                kind: 'cellValue',
                target: { cell: [`item-id-${row}`, column] },
                value: { value: `v${row}`, text: `v${row}` },
              })),
            ).flat(),
          )
        seed()
        const result = await measureInteractionWork(
          async () => {
            applyAllDrafts(table)
          },
          {
            afterWarmup: () => {
              // Прогрев применил все черновики — замер повторяет то же на новом наборе.
              expect(readDrafts(table)).toHaveLength(0)
              seed()
            },
          },
        )
        expect(readDrafts(table)).toHaveLength(0)
        ;(await screen).unmount()
        return result
      }

      const runs = await againstBase(isMany => measure(isMany ? 1000 : 100))
      const base = medianRun(runs.base, r => r.longestMs)
      const many = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs * DR26_RATIO
      const record = (
        id: string,
        label: string,
        r: typeof many,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '1000×1000',
          plugins: 'cellEditing',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('DR26-base', '1000 черновиков', base, false)
      await record('DR26', '10 000 черновиков', many, true)

      expect(
        many.longestMs,
        `10 000: longest=${many.longestMs.toFixed(1)}ms, 1000: ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Флажок группы (ADR 0185, CG13): группа со 100 000 строк против «Выбрать всё» той же выборки:
// один проход по строкам и одна запись среза. Прогрев выбирает, замер снимает.
const CG13_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  group: 'g',
  name: `Name ${i}`,
}))
const CG13_COLUMNS = [
  { id: 'group', accessorKey: 'group', header: 'Group' },
  { id: 'name', accessorKey: 'name', header: 'Name' },
]
const groupFlag = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__body-row[data-row-id="group:g"] .row-select-checkbox',
  )
const headFlag = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell .row-select-checkbox',
  )
const WholeGroupGrid = () => {
  const table = useCreateTable({
    columns: CG13_COLUMNS as never,
    data: CG13_ROWS,
    getRowId: (row: { id: string }) => row.id,
    plugins: [
      rowExpanding(),
      rowGrouping({ initialGrouping: ['group'] }),
      rowSelection(),
    ] as never,
  })
  return (
    <div style={{ padding: 16, height: 600 }}>
      <DataGrid table={table as never} height={500} />
    </div>
  )
}

describe('Отзывчивость — флажок группы', () => {
  test(
    'CG13: нажатие на флажок группы со 100 000 потомков не дороже «Выбрать всё» на той же выборке',
    async () => {
      const measure = async (group: boolean) => {
        const screen = render(<WholeGroupGrid />)
        await expect.poll(groupFlag).toBeTruthy()
        const flag = group ? groupFlag : headFlag
        const result = await measureInteractionWork(
          async () => flag()!.click(),
          {
            afterWarmup: () =>
              expect(flag()!.getAttribute('aria-checked')).toBe('true'),
          },
        )
        expect(flag()!.getAttribute('aria-checked')).toBe('false')
        ;(await screen).unmount()
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const group = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.5, plusMs: 50 })
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
          size: '100 000×2',
          plugins: 'rowGrouping, rowExpanding, rowSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('CG13-base', '«Выбрать всё»', base, false)
      await record('CG13', 'флажок группы', group, true)

      expect(
        group.longestMs,
        `флажок группы longest=${group.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Перенос между группами (ADR 0186, GM10): стадия модели группировки на 100 000 строк в 100 группах
// против той же смены значения записью в данные: стадия пересобирает группировку, запись — ещё и
// исходную модель. Строка ходит между двумя группами, прогрев и замер — по одному переносу.
const GM10_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  group: `g${Math.floor(i / 1000)}`,
  name: `Name ${i}`,
}))
type GM10Row = (typeof GM10_ROWS)[number]
let gm10: {
  table: unknown
  setData: (change: (rows: GM10Row[]) => GM10Row[]) => void
}
const GroupMoveGrid = () => {
  const [data, setData] = useState(GM10_ROWS)
  const table = useCreateTable({
    columns: CG13_COLUMNS as never,
    data,
    getRowId: (row: GM10Row) => row.id,
    plugins: [
      rowExpanding({ initialExpanded: true }),
      rowGrouping({ initialGrouping: ['group'] }),
      rowDragging({ onRowDragEnd: () => Promise.resolve() }),
    ] as never,
  })
  gm10 = { table, setData }
  return (
    <div style={{ padding: 16, height: 600 }}>
      <DataGrid table={table as never} height={500} />
    </div>
  )
}

describe('Отзывчивость — перенос между группами', () => {
  test(
    'GM10: бросок на 100 000 строк в группах не дороже той же смены значения записью в данные, больше чем на цену прохода группировки',
    async () => {
      const measure = async (staged: boolean) => {
        const screen = render(<GroupMoveGrid />)
        const leaf = () =>
          document.querySelector('.data-grid__body-row[data-row-id="r0"]')
        await expect.poll(leaf).toBeTruthy()
        let target = 'g1'
        const result = await measureInteractionWork(async () => {
          const value = target
          target = target === 'g1' ? 'g0' : 'g1'
          if (!staged) {
            gm10.setData(rows =>
              rows.map(row =>
                row.id === 'r0' ? { ...row, group: value } : row,
              ),
            )
            return
          }
          const table = gm10.table as {
            getRow: (id: string, loose: boolean) => never
            getRowModel: () => { rowsById: Record<string, never> }
          }
          moveRowToGroup(
            table,
            table.getRow('r0', true),
            table.getRowModel().rowsById[`group:${value}`]!,
          )
        })
        ;(await screen).unmount()
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const staged = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 100 })
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
          size: '100 000×2',
          plugins: 'rowGrouping, rowExpanding, rowDragging',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('GM10-base', 'смена значения записью в данные', base, false)
      await record('GM10', 'перенос со стадией', staged, true)

      expect(
        staged.longestMs,
        `стадия longest=${staged.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Охват «Выбрать всё» (ADR 0179, SE16): флажок шапки на 100 000 строк по 100 на странице —
// охват 'filtered' (все страницы) против 'currentPage' той же выборки. Прогрев выбирает
// строки охвата, замер снимает выбор.
const headSelectAll = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell .row-select-checkbox',
  )

describe('Отзывчивость — охват «Выбрать всё»', () => {
  test(
    "SE16: флажок шапки с охватом 'filtered' на 100 000 строк — против 'currentPage' той же выборки",
    async () => {
      const measure = async (filtered: boolean) => {
        await renderGrid({
          ...PAGED,
          ...ALL_PLUGINS,
          ...PAGINATION,
          paginationInitialPageSize: 100,
          rowSelectionSelectAll: filtered ? 'filtered' : 'currentPage',
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect.poll(headSelectAll).toBeTruthy()
        const result = await measureInteractionWork(
          async () => headSelectAll()!.click(),
          {
            afterWarmup: () =>
              expect(headSelectAll()!.hasAttribute('data-checked')).toBe(true),
          },
        )
        expect(headSelectAll()!.hasAttribute('data-checked')).toBe(false)
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const filtered = medianRun(runs.variant, r => r.longestMs)
      // Снятие выбора со 100 000 строк — один проход по ним и одна запись среза.
      const ceiling = ceilingOver(base.longestMs, { ratio: 2, plusMs: 150 })
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
          size: '100 000×30',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record(
        'SE16-base',
        "флажок шапки, охват 'currentPage'",
        base,
        false,
      )
      await record('SE16', "флажок шапки, охват 'filtered'", filtered, true)

      expect(
        filtered.longestMs,
        `'filtered' longest=${filtered.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Подпись записи журнала — по справочнику при показе (ADR 0182, AN11): открытие журнала с 1000
// записями-действиями против тех же записей с готовым именем от приложения.
const AN11_COST = { ratio: 1.1, plusMs: 8 }
describe('Справочник действий — открытие журнала', () => {
  test(
    'AN11: открытие журнала с 1000 записями-действиями не дороже тех же записей с именем от приложения больше чем на 10 %',
    async () => {
      const measure = async (named: boolean) => {
        let table: any
        const screen = renderPluginsGrid({
          ...LARGE,
          plugins: [
            failureLog(),
            {
              id: 'perfFailures',
              setup: (t: unknown) => {
                table = t
              },
            },
          ],
        })
        await expect.poll(() => table).toBeTruthy()
        for (let i = 0; i < 1000; i++)
          table.reportFailure({
            key: `perf-${i}`,
            ...(named
              ? { action: { plugin: 'core', action: 'search' } }
              : { label: 'Search' }),
            target: { row: `item-id-${i}` },
            reason: 'Server down',
          })
        const log = () =>
          document.querySelector<HTMLElement>('[data-testid="failure-log"]')
        const button = () =>
          document.querySelector<HTMLElement>(
            '[data-testid="failure-log-button"]',
          )!
        await expect.poll(button).toBeTruthy()
        const result = await measureInteractionWork(
          async () => {
            button().click()
            await expect.poll(log).not.toBeNull()
          },
          {
            afterWarmup: async () => {
              expect(log()!.textContent).toContain('Search')
              button().click()
              await expect.poll(log).toBeNull()
            },
          },
        )
        expect(log()!.textContent).toContain('Search')
        ;(await screen).unmount()
        return result
      }
      const runs = await againstBase(isNamed => measure(isNamed))
      const base = medianRun(runs.base, r => r.longestMs)
      const named = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, AN11_COST)
      const record = (
        id: string,
        label: string,
        r: typeof named,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '1000×1000',
          plugins: 'failureLog',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('AN11-base', '1000 записей с именем', base, false)
      await record('AN11', '1000 записей-действий', named, true)
      expect(
        named.longestMs,
        `действия: ${named.longestMs.toFixed(1)}ms, имена: ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Итоги колонок (ADR 0184, CT11): смена поиска на 100 000 строк с тремя итогами против той же
// без них; футер есть в обоих замерах. Итог — проход по найденным строкам на колонку.
const CT11_COST = { ratio: 1.3, plusMs: 30 }
const TOTALS_ROWS = Array.from({ length: 100_000 }, (_, index) => ({
  id: `r${index}`,
  name: `Name ${index % 10}`,
  a: index,
  b: index * 2,
  c: index * 3,
}))
const TOTALS_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', enableGlobalFilter: true },
  ...['a', 'b', 'c'].map(id => ({
    id,
    accessorKey: id,
    header: id,
    aggregationFn: 'sum',
    enableGlobalFilter: false,
  })),
]
let totalsTable: {
  setGlobalFilter: (value: string) => void
  getColumnTotal: (columnId: string) => unknown
}
const TotalsGrid = ({ totals }: { totals: boolean }) => {
  const table = useCreateTable({
    columns: TOTALS_COLUMNS as never,
    data: TOTALS_ROWS,
    getRowId: (row: { id: string }) => row.id,
    enableFooter: true,
    plugins: [quickSearchModel(), ...(totals ? [columnTotals()] : [])] as never,
  })
  totalsTable = table as never
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость — итоги колонок', () => {
  test(
    'CT11: смена поиска на 100 000 строк с тремя итогами — против той же без них',
    async () => {
      const measure = async (totals: boolean) => {
        await render(<TotalsGrid totals={totals} />)
        await waitForGrid()
        let query = 0
        const footerA = () =>
          document
            .querySelector('.data-grid__footer-cell[data-column-id="a"]')
            ?.textContent?.trim()
        const result = await measureInteractionWork(
          async () => totalsTable.setGlobalFilter(`Name ${++query}`),
          {
            afterWarmup: () => {
              if (totals) return expect.poll(footerA).not.toBe('')
              return undefined
            },
          },
        )
        expect(totalsTable.getColumnTotal('a')).toEqual(
          totals ? expect.any(Number) : undefined,
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const withTotals = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, CT11_COST)
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
          size: '100 000×4',
          plugins: 'footer',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('CT11-base', 'поиск без итогов', base, false)
      await record('CT11', 'поиск с тремя итогами', withTotals, true)

      expect(
        withTotals.longestMs,
        `итоги longest=${withTotals.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Различия серверной модели с клиентом (ADR 0188–0190): нажатие на флажок страницы, вложение и
// сборка файла против той же работы в базе без догрузки.
const headBox = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell .row-select-checkbox',
  )
const rowIdAt = (index: number) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"]`,
  )?.dataset.rowId
const recordGap = (
  id: string,
  label: string,
  size: string,
  plugins: string,
  r: Awaited<ReturnType<typeof measureInteractionWork>>,
  ceilingMs?: number,
) =>
  recordPerf({
    id,
    label,
    operation: 'interaction',
    size,
    plugins: plugins as never,
    cpuThrottle: CPU_THROTTLE_RATE,
    metrics: [
      {
        kind: 'load',
        metric: 'longest',
        valueMs: r.longestMs,
        targetMs: INTERACTION_BUDGET_MS,
        ceilingMs,
        ...r,
      },
    ],
  })

const PAGE_SIZE = 100
const PageSelectGrid = ({ server }: { server: boolean }) => {
  const table = useCreateTable({
    rowCount: 1_000_000,
    columns: FEED_COLUMNS as never,
    data: server ? NO_FEED : feedRows(0, 1000),
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      ...(server
        ? [
            serverRowModel({
              blockSize: PAGE_SIZE,
              getRows: ({ start, end }) =>
                Promise.resolve({ rows: feedRows(start, end - start) }),
            }),
          ]
        : []),
      pagination({ initialPageSize: PAGE_SIZE }),
      rowSelection({ selectAll: 'currentPage' }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — флажок страницы SSRM', () => {
  test(
    'PA10: нажатие на флажок шапки при итоге 1 000 000 против той же страницы на клиенте',
    async () => {
      const measure = async (server: boolean) => {
        await render(<PageSelectGrid server={server} />)
        await expect.poll(() => rowIdAt(0)).toBe('f0')
        await expect.poll(headBox).not.toBeNull()
        const result = await measureInteractionWork(async () => {
          const was = headBox()!.hasAttribute('data-checked')
          headBox()!.click()
          await expect
            .poll(() => headBox()!.hasAttribute('data-checked'))
            .toBe(!was)
        })
        await cleanup()
        return result
      }
      const runs = await againstBase(server => measure(server))
      const base = medianRun(runs.base, r => r.longestMs)
      const paged = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
      await recordGap(
        'PA10-base',
        'флажок страницы на клиенте',
        '1000×3',
        'pagination, rowSelection',
        base,
      )
      await recordGap(
        'PA10',
        'флажок страницы SSRM',
        '1 000 000×3',
        'serverRowModel, pagination, rowSelection',
        paged,
        ceiling,
      )
      expect(
        paged.longestMs,
        `longest=${paged.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

let nestTable: unknown
const NestGrid = () => {
  const table = useCreateTable({
    rowCount: 1_000_000,
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: 100,
        getRows: ({ start, end, parentId }) =>
          Promise.resolve(
            parentId
              ? { rows: feedRows(2_000_000, 2), rowCount: 2 }
              : { rows: feedRows(start, end - start) },
          ),
      }),
      rowDragging(),
      rowExpanding({
        hasChildren: row => (row as { id: string }).id === 'f1',
      }),
    ] as never,
  })
  nestTable = table
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — вложение строки SSRM', () => {
  test(
    'NT13: вложение при итоге 1 000 000 не дороже броска при том же итоге',
    async () => {
      const rowOf = (id: string) =>
        (nestTable as { getRowSource: () => { byId: (id: string) => any } })
          .getRowSource()
          .byId(id)
      const measure = async (nest: boolean) => {
        await render(<NestGrid />)
        await expect.poll(() => rowIdAt(1)).toBe('f1')
        rowOf('f1').toggleExpanded(true)
        await expect.poll(() => rowOf('f2000000')).toBeTruthy()
        let inside = false
        let down = true
        const result = await measureInteractionWork(async () => {
          if (nest) {
            if (inside) unnestRow(rowOf('f2'), nestTable)
            else nestRow(rowOf('f2'), nestTable)
            inside = !inside
            await expect
              .poll(() => rowOf('f2').parentId)
              .toBe(inside ? 'f1' : undefined)
            return
          }
          const index = rowOf('f3').index
          moveRow(rowOf('f3'), nestTable, down ? 1 : -1)
          await expect
            .poll(() => rowOf('f3').index)
            .toBe(index + (down ? 1 : -1))
          down = !down
        })
        await cleanup()
        return result
      }
      const runs = await againstBase(nest => measure(nest))
      const base = medianRun(runs.base, r => r.longestMs)
      const nested = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
      await recordGap(
        'NT13-base',
        'перенос среди соседей SSRM',
        '1 000 000×3',
        'serverRowModel, rowDragging, rowExpanding',
        base,
      )
      await recordGap(
        'NT13',
        'вложение и вынос SSRM',
        '1 000 000×3',
        'serverRowModel, rowDragging, rowExpanding',
        nested,
        ceiling,
      )
      expect(
        nested.longestMs,
        `longest=${nested.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

let viewExports = 0
const ViewExportGrid = ({ server }: { server: boolean }) => {
  const table = useCreateTable({
    rowCount: XC15_ROWS,
    columns: XC15_COLUMNS as never,
    data: server ? NO_COPY_ROWS : copyRowsOf(),
    getRowId: (row: CopyRow) => row.id,
    plugins: [
      ...(server
        ? [
            serverRowModel({
              blockSize: 1000,
              getRows: ({ start, end }) => ({
                rows: copyRowsOf().slice(start, end),
              }),
            }),
          ]
        : []),
      columnSorting(),
      dataExport({
        onExported: () => {
          viewExports++
        },
      }),
    ] as never,
  })
  viewTable = table as never
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}
let viewTable:
  { exportData: (settings: { rows: 'view' }) => Promise<void> } | undefined

describe('Отзывчивость взаимодействий — выгрузка выборки SSRM', () => {
  test(
    'XV10: сборка 10 000 загруженных строк против той же сборки на клиенте',
    async () => {
      const click = HTMLAnchorElement.prototype.click
      HTMLAnchorElement.prototype.click = () => {}
      try {
        const measure = async (server: boolean) => {
          await render(<ViewExportGrid server={server} />)
          await waitForGrid()
          viewExports = 0
          const result = await measureInteractionWork(async () => {
            await viewTable!.exportData({ rows: 'view' })
          })
          expect(viewExports).toBeGreaterThan(0)
          await cleanup()
          return result
        }
        const runs = await againstBase(server => measure(server))
        const base = medianRun(runs.base, r => r.longestMs)
        const loaded = medianRun(runs.variant, r => r.longestMs)
        // Обход блоков вместо модели — около 42 мс под троттлингом, в бюджете взаимодействия.
        const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 60 })
        await recordGap(
          'XV10-base',
          'выгрузка выборки на клиенте',
          '10 000×10',
          'dataExport',
          base,
        )
        await recordGap(
          'XV10',
          'выгрузка выборки SSRM',
          '10 000×10',
          'serverRowModel, dataExport',
          loaded,
          ceiling,
        )
        expect(
          loaded.longestMs,
          `longest=${loaded.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling)
      } finally {
        HTMLAnchorElement.prototype.click = click
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Предикат, созданный в рендере хоста (ADR 0193, RP7): хост перерисовывается на каждый выбор
// строки и передаёт новый canEditCell с прежними ответами. Читатели пересчитывают свой ответ —
// второго прохода по таблице нет, выбор не дороже того же со стабильным предикатом.
const PredicateHost = ({ inline }: { inline: boolean }) => {
  const [, setTick] = useState(0)
  const columns = useMemo(() => makeColumns(SMALL.columnCount), [])
  const data = useMemo(() => getData(SMALL.dataCount), [])
  const stable = useCallback(() => true, [])
  const table = useCreateTable({
    columns: columns as never,
    data,
    // Как I1: клавиатурная навигация включена, строка выбора озвучивает aria-selected.
    enableKeyboardNavigation: true,
    plugins: [
      rowSelection({ onSelectRow: () => setTick(tick => tick + 1) }),
      cellEditing({ canEditCell: inline ? () => true : stable }),
      cellSelection(),
    ] as never,
  })
  return (
    <div
      style={{
        padding: 16,
        height: 600,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DataGrid table={table as never} height={500} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — предикат в рендере хоста', () => {
  test(
    'RP7: выбор строки с canEditCell, созданным в рендере хоста на каждое нажатие, не дороже выбора со стабильным предикатом больше чем на 10 % или 10 мс',
    async () => {
      const measure = async (inline: boolean) => {
        render(<PredicateHost inline={inline} />)
        await waitForGrid()
        const result = await measureInteractionWork(
          clickRowCheckbox,
          SELECT_CHECKS,
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const inline = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.1, plusMs: 10 })
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
          size: '30×500',
          plugins: 'cellEditing',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record(
        'RP7-base',
        'выбор строки, стабильный canEditCell',
        base,
        false,
      )
      await record(
        'RP7',
        'выбор строки, canEditCell в рендере хоста',
        inline,
        true,
      )
      expect(
        inline.longestMs,
        `в рендере longest=${inline.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Смена data из прежней модели (ADR 0194, IU13–IU14): правка одной строки и вставка 100 строк
// транзакцией на 100 000 строк — против той же смены, где каждая строка — новый объект: так
// модели строк собираются полностью, как до ADR 0194. Грид рисуется в обоих вариантах.
interface ChangeRow {
  id: string
  a: string
  b: number
  c: string
}
const changeRows = (from: number, count: number): ChangeRow[] =>
  Array.from({ length: count }, (_, k) => ({
    id: `r${from + k}`,
    a: `Name ${from + k}`,
    b: (from + k) % 997,
    c: `City ${(from + k) % 50}`,
  }))
const CHANGE_COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', size: 200 },
  { id: 'b', accessorKey: 'b', header: 'B', size: 120 },
  { id: 'c', accessorKey: 'c', header: 'C', size: 200 },
]
let setChangeRows: (update: (prev: ChangeRow[]) => ChangeRow[]) => void
let changeTable: {
  applyRowTransaction: (transaction: object) => unknown
  getRowModel: () => { rows: unknown[] }
}
const ChangeGrid = ({
  initial,
  plugins,
  copyAll,
}: {
  initial: ChangeRow[]
  plugins: () => unknown[]
  /** База: приложение отдаёт каждую строку новым объектом. */
  copyAll: boolean
}) => {
  const [rows, setRows] = useState(initial)
  const [entries] = useState(plugins)
  setChangeRows = setRows
  const table = useCreateTable({
    columns: CHANGE_COLUMNS as never,
    data: rows,
    getRowId: (row: ChangeRow) => row.id,
    onDataChange: (next: ChangeRow[]) =>
      setRows(copyAll ? next.map(row => ({ ...row })) : next),
    plugins: entries as never,
  })
  changeTable = table as never
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const measureChange = async (
  plugins: () => unknown[],
  copyAll: boolean,
  act: (turn: number) => void,
) => {
  await render(
    <ChangeGrid
      initial={changeRows(0, 100_000)}
      plugins={plugins}
      copyAll={copyAll}
    />,
  )
  await waitForGrid()
  let turn = 0
  const result = await measureInteractionWork(async () => act(turn++))
  // Прогрев и замер — по действию: изменения дошли до модели.
  await expect.poll(() => turn).toBe(2)
  await cleanup()
  return result
}

const recordChange = (
  id: string,
  label: string,
  plugins:
    'none' | 'columnSorting' | 'columnSorting, columnFiltering, rowGrouping',
  r: Awaited<ReturnType<typeof measureInteractionWork>>,
  ceilingMs?: number,
) =>
  recordPerf({
    id,
    label,
    operation: 'interaction',
    size: '100 000×3',
    plugins,
    cpuThrottle: CPU_THROTTLE_RATE,
    metrics: [
      {
        kind: 'load',
        metric: 'longest',
        valueMs: r.longestMs,
        targetMs: INTERACTION_BUDGET_MS,
        ceilingMs,
        ...r,
      },
    ],
  })

describe('Смена data из прежней модели', () => {
  test(
    'IU13: правка одной ячейки на 100 000 строк при сортировке, фильтре и группировке — не дольше четверти полной сборки',
    async () => {
      const plugins = () => [
        columnSortingModel({ initialSorting: [{ id: 'b', desc: false }] }),
        columnFilteringModel({
          initialColumnFilters: [
            { id: 'a', value: { operator: 'contains', value: 'Name' } },
          ],
        }),
        rowGroupingModel({ initialGrouping: ['c'] }),
      ]
      const edit = (copyAll: boolean) => (turn: number) =>
        setChangeRows(prev =>
          prev.map((row, i) =>
            i === 500
              ? { ...row, b: row.b + turn + 1 }
              : copyAll
                ? { ...row }
                : row,
          ),
        )
      const runs = await againstBase(isOurs =>
        measureChange(plugins, !isOurs, edit(!isOurs)),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 4
      const used = 'columnSorting, columnFiltering, rowGrouping' as const
      await recordChange('IU13-base', 'полная сборка', used, base)
      await recordChange(
        'IU13',
        'правка строки из прежней модели',
        used,
        ours,
        ceiling,
      )
      expect(
        ours.longestMs,
        `правка longest=${ours.longestMs.toFixed(1)}ms, полная ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )

  test(
    'IU14: вставка 100 строк транзакцией без места на 100 000 строк при сортировке — не дольше четверти полной сборки',
    async () => {
      const plugins = () => [
        columnSortingModel({ initialSorting: [{ id: 'b', desc: false }] }),
      ]
      const insert = (turn: number) =>
        changeTable.applyRowTransaction({
          add: changeRows(200_000 + turn * 100, 100),
        })
      const runs = await againstBase(isOurs =>
        measureChange(plugins, !isOurs, insert),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 4
      await recordChange('IU14-base', 'полная сборка', 'columnSorting', base)
      await recordChange(
        'IU14',
        'вставка транзакцией из прежней модели',
        'columnSorting',
        ours,
        ceiling,
      )
      expect(
        ours.longestMs,
        `вставка longest=${ours.longestMs.toFixed(1)}ms, полная ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Сдвиги в середине data (ADR 0199, MS9–MS11): вставка и удаление 100 строк в середине 100 000
// при сортировке — против дописывания тех же 100 строк в конец; перенос строки через 50 000
// позиций — против полной сборки. Грид рисуется во всех вариантах.
const MIDDLE = 50_000
const SHIFT_COST = 1.3
const sortedPlugins = () => [
  columnSortingModel({ initialSorting: [{ id: 'b', desc: false }] }),
]
const append = (turn: number) =>
  changeTable.applyRowTransaction({
    add: changeRows(200_000 + turn * 100, 100),
  })

describe('Сдвиги в середине data', () => {
  test(
    'MS9: вставка 100 строк транзакцией в середину 100 000 при сортировке — не дороже дописывания тех же 100 строк в конец больше чем в 1,3 раза',
    async () => {
      const insert = (turn: number) =>
        changeTable.applyRowTransaction({
          add: changeRows(200_000 + turn * 100, 100),
          index: MIDDLE,
        })
      const runs = await againstBase(isOurs =>
        measureChange(sortedPlugins, false, isOurs ? insert : append),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs * SHIFT_COST
      await recordChange(
        'MS9-base',
        'дописывание в конец',
        'columnSorting',
        base,
      )
      await recordChange(
        'MS9',
        'вставка в середину',
        'columnSorting',
        ours,
        ceiling,
      )
      expect(
        ours.longestMs,
        `вставка longest=${ours.longestMs.toFixed(1)}ms, в конец ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )

  test(
    'MS10: удаление 100 строк из середины 100 000 при сортировке — не дороже дописывания 100 строк в конец больше чем в 1,3 раза',
    async () => {
      const remove = (turn: number) =>
        changeTable.applyRowTransaction({
          remove: changeRows(MIDDLE + turn * 100, 100).map(row => row.id),
        })
      const runs = await againstBase(isOurs =>
        measureChange(sortedPlugins, false, isOurs ? remove : append),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs * SHIFT_COST
      await recordChange(
        'MS10-base',
        'дописывание в конец',
        'columnSorting',
        base,
      )
      await recordChange(
        'MS10',
        'удаление из середины',
        'columnSorting',
        ours,
        ceiling,
      )
      expect(
        ours.longestMs,
        `удаление longest=${ours.longestMs.toFixed(1)}ms, в конец ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )

  test(
    'MS11: перенос одной строки через 50 000 позиций на 100 000 строк — не дольше четверти полной сборки',
    async () => {
      // Перенос, как после броска перетаскивания: тот же объект строки на новом месте.
      const move = (copyAll: boolean) => (turn: number) =>
        setChangeRows(prev => {
          const next = prev.slice()
          const [row] = next.splice(10 + turn, 1)
          next.splice(MIDDLE, 0, row!)
          return copyAll ? next.map(item => ({ ...item })) : next
        })
      const runs = await againstBase(isOurs =>
        measureChange(() => [], !isOurs, move(!isOurs)),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 4
      await recordChange('MS11-base', 'полная сборка', 'none', base)
      await recordChange('MS11', 'перенос строки', 'none', ours, ceiling)
      expect(
        ours.longestMs,
        `перенос longest=${ours.longestMs.toFixed(1)}ms, полная ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Флекс-колонки и автоподбор ширины (ADR 0216 FX10, ADR 0217 AZ10): 1000 × 1000 с
// `columnSizing`. Гейт — против той же операции без фичи; цена — из требования.
const FX10_COST = { ratio: 1.3, plusMs: 30 }
const AZ10_COST = { ratio: 1.3, plusMs: 300 }
const SIZING_COLUMNS = makeColumns(LARGE.columnCount)
const SIZING_DATA = getData(LARGE.dataCount)

interface SizingTable {
  autosizeColumns: (ids?: string[]) => Promise<boolean>
  setColumnSizing: (sizing: Record<string, number>) => void
  store: { state: { columnSizing: Record<string, number> } }
}

let sizingTable: SizingTable | null = null
let setSizingWidth: ((width: number) => void) | null = null

const SizingGrid = ({ flex }: { flex: boolean }) => {
  const [plugins] = useState(() => [columnSizing()])
  const [width, setWidth] = useState(1200)
  setSizingWidth = setWidth
  const table = useCreateTable({
    columns: SIZING_COLUMNS as never,
    data: SIZING_DATA,
    defaultColumn: flex ? { flex: 1 } : undefined,
    plugins: plugins as never,
  })
  sizingTable = table as unknown as SizingTable
  return (
    <div style={{ width, height: 600 }}>
      <DataGrid table={table as never} height={500} />
    </div>
  )
}

const recordSizing = (
  id: string,
  label: string,
  r: Awaited<ReturnType<typeof measureInteractionWork>>,
  ceiling: number | undefined,
) =>
  recordPerf({
    id,
    label,
    operation: 'interaction',
    size: '1000×1000',
    plugins: 'columnSizing',
    cpuThrottle: CPU_THROTTLE_RATE,
    metrics: [
      {
        kind: 'load',
        metric: 'longest',
        valueMs: r.longestMs,
        targetMs: INTERACTION_BUDGET_MS,
        ceilingMs: ceiling,
        ...r,
      },
    ],
  })

describe('Отзывчивость — флекс-колонки и автоподбор ширины', () => {
  test(
    'FX10: пересчёт флекс-ширин при смене ширины контейнера на 1000 колонок не дороже той же смены без флекс-колонок с ценой',
    async () => {
      const measure = async (flex: boolean) => {
        await render(<SizingGrid flex={flex} />)
        await waitForGrid()
        let wide = true
        const result = await measureInteractionWork(
          async () => {
            wide = !wide
            setSizingWidth!(wide ? 1200 : 1000)
          },
          {
            afterWarmup: async () => {
              // У колонок мока minSize равен size: флекс-ширины — те же, что без флекса, замер —
              // цена самого пересчёта. Слой флекс-ширин есть у всех 1000 колонок.
              const sized = Object.keys(sizingTable!.store.state.columnSizing)
              expect(sized.length).toBe(flex ? LARGE.columnCount : 0)
            },
          },
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, FX10_COST)
      await recordSizing(
        'FX10-base',
        'контейнер без флекс-колонок',
        base,
        undefined,
      )
      await recordSizing('FX10', 'контейнер с флекс-колонками', ours, ceiling)
      expect(
        ours.longestMs,
        `флекс ${ours.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )

  test(
    'AZ10: «Подогнать все» на 1000 × 1000 не дороже протяжки одной колонки с ценой',
    async () => {
      const measure = async (autosize: boolean) => {
        await render(<SizingGrid flex={false} />)
        await waitForGrid()
        let step = 0
        let fitted = false
        const result = await measureInteractionWork(
          async () => {
            step += 1
            if (autosize) fitted = await sizingTable!.autosizeColumns()
            else
              sizingTable!.setColumnSizing({
                [(SIZING_COLUMNS[0] as { id: string }).id]:
                  step % 2 ? 180 : 200,
              })
          },
          {
            afterWarmup: () => {
              // Прогрев подогнал колонки.
              if (autosize) expect(fitted).toBe(true)
            },
          },
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, AZ10_COST)
      await recordSizing('AZ10-base', 'протяжка одной колонки', base, undefined)
      await recordSizing('AZ10', '«Подогнать все» 1000 колонок', ours, ceiling)
      expect(
        ours.longestMs,
        `подгонка ${ours.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Протяжка значения маркером (ADR 0219, WR38): кадр протяжки квадрата в режиме 'fill' — рамка
// цели вместо смены диапазона — против той же протяжки в режиме 'range'.
const WR38_COST = { ratio: 1.1, plusMs: 2 }

describe('Кадры — протяжка значения маркером', () => {
  test(
    "WR38: кадр протяжки маркера в режиме 'fill' на 1000×1000 против режима 'range' — потолок базы ×1,1 или +2 мс",
    async () => {
      const drag = async (fill: boolean) => {
        const FillGrid = () => {
          const created = useCreateTable({
            columns: MOTION_GRID_COLUMNS as never,
            data: MOTION_GRID_ROWS,
            getRowId: (row: { id: string }) => row.id,
            plugins: [
              cellEditing({ onCommitEdits: () => {} } as never),
              cellSelection({ handle: { mode: fill ? 'fill' : 'range' } }),
            ],
          })
          return (
            <div style={{ width: 1200, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<FillGrid />)
        await waitForGrid()
        const cellOf = (row: number, column: number) =>
          document.querySelector<HTMLElement>(
            `.data-grid__body-row[data-index="${row}"] .data-grid__body-cell[data-column-id="c${column}"]`,
          )!
        const centerOf = (el: Element) => {
          const r = el.getBoundingClientRect()
          return {
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
          }
        }
        const pointer = (type: string, target: EventTarget, at: object) =>
          target.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              button: 0,
              buttons: type === 'pointerup' ? 0 : 1,
              pointerType: 'mouse',
              isPrimary: true,
              ...at,
            }),
          )
        const marker = () =>
          document.querySelector<HTMLElement>(
            '[data-range-handle]:not([hidden])',
          )
        // Окно дорисовывается порциями (ADR 0202): протяжка — по уже отрисованным строкам.
        await expect
          .poll(() => [1, 2, 3, 4, 5, 6, 7, 8].every(row => !!cellOf(row, 5)))
          .toBe(true)
        const start = cellOf(1, 1)
        start.dispatchEvent(
          new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            ...centerOf(start),
          }),
        )
        document.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, ...centerOf(start) }),
        )
        await expect.poll(marker).not.toBeNull()
        pointer('pointerdown', marker()!, centerOf(marker()!))
        // Угол — в окне: строки 2–8 и колонки 1–5 — шаг меняет ячейку под указателем.
        const target = (step: number) =>
          cellOf(2 + (step % 7), 1 + (Math.floor(step / 7) % 5))
        let step = 0
        const result = await measureTransitionWork(
          async () => {
            const next = () => {
              step++
              pointer('pointermove', document, centerOf(target(step)))
              if (step < HANDLE_STEPS) requestAnimationFrame(next)
            }
            requestAnimationFrame(next)
          },
          () => step >= HANDLE_STEPS,
        )
        // Протяжка значения — рамка цели, диапазона — новый угол выделения.
        const frame = document.querySelector('[data-fill-frame]:not([hidden])')
        expect(!!frame, 'рамка цели протяжки').toBe(fill)
        expect(
          target(HANDLE_STEPS).hasAttribute('data-cell-selected'),
          'угол протяжки выделения',
        ).toBe(!fill)
        // Escape — без записи: замер только кадров жеста.
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        )
        pointer('pointerup', document, centerOf(target(HANDLE_STEPS)))
        await cleanup()
        return result
      }

      const runs = await againstBase(drag)
      const base = medianRun(runs.base, r => r.p95Ms)
      const variant = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, WR38_COST)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'scroll',
          size: '1000×1000',
          plugins: 'cellEditing, cellSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'animation',
              metric: 'p95',
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record(
        'WR38-base',
        "протяжка маркера в режиме 'range'",
        base,
        false,
      )
      await record('WR38', "протяжка маркера в режиме 'fill'", variant, true)
      expect(
        variant.p95Ms,
        `p95=${variant.p95Ms.toFixed(1)}ms, база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Вставка из буфера (ADR 0219, WR35–WR36): объём и одно значение в большой диапазон.
type PasteTable = {
  getRowSource: () => { at: (index: number) => { id: string } | undefined }
  getCellSelectionColumnIndexes: () => Record<string, number>
  setCellSelection: (updater: () => unknown[]) => void
}

/** Грид для вставки: правка с ответом сервера и выделение; таблица — из `setup`. */
const mountPasteGrid = async (columnCount: number, dataCount: number) => {
  let table: PasteTable | undefined
  const screen = renderPluginsGrid({
    columnCount,
    dataCount,
    plugins: [
      cellEditing({ onCommitEdits: () => Promise.resolve() } as never),
      cellSelection(),
      {
        id: 'perfPaste',
        setup: t => {
          table = t as never
        },
      },
    ],
  })
  await expect.poll(() => table).toBeTruthy()
  await waitForGrid()
  const columns = Object.entries(table!.getCellSelectionColumnIndexes())
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)
  /** Выделить `rows` строк первой колонки от первой строки. */
  const select = (rows: number) =>
    table!.setCellSelection(() => [
      {
        anchorRowId: table!.getRowSource().at(0)!.id,
        anchorColumnId: columns[0]!,
        focusRowId: table!.getRowSource().at(rows - 1)!.id,
        focusColumnId: columns[0]!,
      },
    ])
  return { table: table!, screen, select }
}

const WR35_RATIO = 12
/** Самая длинная задача: перерисовка окна, не объём (ADR 0219, §10). */
const WR35_LONGEST_RATIO = 1.5
const WR35_COLUMNS = 10
describe('Вставка из буфера — объём', () => {
  test(
    'WR35: вставка 100 000 ячеек против 10 000 — работа главного потока не больше ×12, самая длинная задача не больше ×1,5',
    async () => {
      const measure = async (rows: number) => {
        const { table, screen, select } = await mountPasteGrid(
          WR35_COLUMNS,
          10_000,
        )
        select(1)
        const text = Array.from({ length: rows }, (_, row) =>
          Array.from({ length: WR35_COLUMNS }, (_, column) =>
            String((row + column) % 90),
          ).join('\t'),
        ).join('\n')
        const result = await measureInteractionWork(() =>
          pasteData(table, { text, html: '' }, 'api'),
        )
        ;(await screen).unmount()
        return result
      }

      const runs = await againstBase(isMany => measure(isMany ? 10_000 : 1000))
      const base = medianRun(runs.base, r => r.totalMs)
      const many = medianRun(runs.variant, r => r.totalMs)
      const baseLongest = medianRun(runs.base, r => r.longestMs).longestMs
      const manyLongest = medianRun(runs.variant, r => r.longestMs).longestMs
      const ceiling = {
        total: base.totalMs * WR35_RATIO,
        longest: baseLongest * WR35_LONGEST_RATIO,
      }
      const record = (
        id: string,
        label: string,
        r: typeof many,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '10 000×10',
          plugins: 'cellEditing, cellSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            // Гейт — работа и самая длинная задача против базы (проверки ниже).
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling.longest : undefined,
              ...r,
            },
          ],
        })
      await record('WR35-base', 'вставка 10 000 ячеек', base, false)
      await record('WR35', 'вставка 100 000 ячеек', many, true)

      const summary = `100 000: total=${many.totalMs.toFixed(0)}ms longest=${many.longestMs.toFixed(0)}ms; 10 000: total=${base.totalMs.toFixed(0)}ms longest=${base.longestMs.toFixed(0)}ms long=${base.longTasks}; 100 000 long=${many.longTasks}; медианы longest: ${manyLongest.toFixed(0)} против ${baseLongest.toFixed(0)}ms`
      expect(many.totalMs, summary).toBeLessThanOrEqual(ceiling.total)
      expect(manyLongest, summary).toBeLessThanOrEqual(ceiling.longest)
    },
    PERF_TIMEOUT * 4,
  )
})

// Отмена вставки (ADR 0222, UD23): обратная запись тем же каналом — кусками, как сама вставка.
const UD23_COST = { ratio: 1.1, plusMs: 5 }
const UD23_COLUMNS = 10
describe('Отмена вставки — объём', () => {
  test(
    'UD23: отмена вставки 100 000 ячеек — самая длинная задача не дороже самой вставки больше чем на 10 % (или 5 мс)',
    async () => {
      const measure = async (undo: boolean) => {
        let table: (PasteTable & { undo: () => Promise<boolean> }) | undefined
        const screen = renderPluginsGrid({
          columnCount: UD23_COLUMNS,
          dataCount: 10_000,
          plugins: [
            cellEditing({ onCommitEdits: () => Promise.resolve() } as never),
            cellSelection(),
            editHistory(),
            {
              id: 'perfUndo',
              setup: t => {
                table = t as never
              },
            },
          ],
        })
        await expect.poll(() => table).toBeTruthy()
        await waitForGrid()
        const columns = Object.entries(table!.getCellSelectionColumnIndexes())
          .sort((a, b) => a[1] - b[1])
          .map(([id]) => id)
        table!.setCellSelection(() => [
          {
            anchorRowId: table!.getRowSource().at(0)!.id,
            anchorColumnId: columns[0]!,
            focusRowId: table!.getRowSource().at(0)!.id,
            focusColumnId: columns[0]!,
          },
        ])
        const text = Array.from({ length: 10_000 }, (_, row) =>
          Array.from({ length: UD23_COLUMNS }, (_, column) =>
            String((row + column) % 90),
          ).join('\t'),
        ).join('\n')
        const paste = () => pasteData(table!, { text, html: '' }, 'api')
        let result
        if (undo) {
          await paste()
          await expect
            .poll(() =>
              (table as never as { canUndo: () => boolean }).canUndo(),
            )
            .toBe(true)
          result = await measureInteractionWork(async () => {
            await table!.undo()
          })
        } else result = await measureInteractionWork(paste)
        ;(await screen).unmount()
        return result
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const undo = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, UD23_COST)
      const record = (
        id: string,
        label: string,
        r: typeof undo,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '10 000×10',
          plugins: 'cellEditing, cellSelection, editHistory',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('UD23-base', 'вставка 100 000 ячеек', base, false)
      await record('UD23', 'отмена вставки 100 000 ячеек', undo, true)
      expect(
        undo.longestMs,
        `отмена longest=${undo.longestMs.toFixed(0)}ms, вставка longest=${base.longestMs.toFixed(0)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 4,
  )
})

const WR36_COST = { ratio: 3, plusMs: 30 }
describe('Вставка из буфера — одно значение в диапазон', () => {
  test(
    'WR36: Ctrl+V одного значения в диапазон 1000 ячеек против вставки в одну ячейку — потолок базы ×3 или +30 мс',
    async () => {
      const measure = async (wide: boolean) => {
        const { table, screen, select } = await mountPasteGrid(
          LARGE.columnCount,
          LARGE.dataCount,
        )
        select(wide ? 1000 : 1)
        const result = await measureInteractionWork(() =>
          pasteData(table, { text: '7', html: '' }, 'api'),
        )
        ;(await screen).unmount()
        return result
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const wide = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, WR36_COST)
      const record = (
        id: string,
        label: string,
        r: typeof wide,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '1000×1000',
          plugins: 'cellEditing, cellSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('WR36-base', 'вставка в одну ячейку', base, false)
      await record('WR36', 'вставка в 1000 ячеек', wide, true)

      expect(
        wide.longestMs,
        `1000 ячеек: longest=${wide.longestMs.toFixed(1)}ms, одна: ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Вспышка при смене значения извне (ADR 0221, VC18): тик сокета — 20 строк окна с новым значением
// первой колонки новым `data` на 1000×1000 — с плагином против той же смены без него. Сторож
// значения стоит в каждой смонтированной ячейке: цена — по окну, а не по данным.
const TICK_COLUMNS = Array.from({ length: 1000 }, (_, k) => ({
  id: `c${k}`,
  accessorKey: `c${k}`,
  header: `C${k}`,
  size: 100,
}))
type TickRow = Record<string, number | string>
const tickRows = (): TickRow[] =>
  Array.from({ length: 1000 }, (_, r) => {
    const row: TickRow = { id: `r${r}` }
    for (let k = 0; k < 1000; k++) row[`c${k}`] = r * 1000 + k
    return row
  })
let tick: (turn: number) => void
const TickGrid = ({ flash }: { flash: boolean }) => {
  const [rows, setRows] = useState(tickRows)
  const [plugins] = useState(() => (flash ? [valueChangeFlash()] : []))
  tick = turn =>
    setRows(prev =>
      prev.map((row, r) =>
        r < 20 ? { ...row, c0: (row.c0 as number) + turn + 1 } : row,
      ),
    )
  const table = useCreateTable({
    columns: TICK_COLUMNS as never,
    data: rows,
    getRowId: (row: TickRow) => row.id as string,
    plugins: plugins as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}
const VC18_COST = { ratio: 1.15, plusMs: 3 }

describe('Вспышка при смене значения извне', () => {
  test(
    'VC18: тик сокета — 20 ячеек окна новым data на 1000×1000 — с плагином не дороже той же смены без него больше чем на 15 % (или 3 мс)',
    async () => {
      const measure = async (flash: boolean) => {
        await render(<TickGrid flash={flash} />)
        await waitForGrid()
        let turn = 0
        const result = await measureInteractionWork(async () => tick(turn++))
        // Тик дошёл до ячеек: вспышка у варианта, новое значение у обоих.
        await expect.poll(() => turn).toBe(2)
        await expect
          .poll(() => document.querySelector('[data-flash="changed"]') !== null)
          .toBe(flash)
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const lit = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, VC18_COST)
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
          size: '1000×1000',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('VC18-base', 'без плагина', base, false)
      await record('VC18', 'valueChangeFlash', lit, true)
      expect(
        lit.longestMs,
        `с плагином ${lit.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

import { Meta, StoryObj } from '@storybook/react'
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  Ellipsis,
  FileDown,
  Grip,
  ListFilter,
  SlidersHorizontal,
} from 'lucide-react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrModes, vrStates } from './__mocks__/catalog'
import { getData } from './__mocks__/data'
import { expect, userEvent, waitFor } from 'storybook/test'
import {
  applyPseudoStates,
  bodyRow,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Ядро грида: все тумблеры, загрузка, заглушка, футер, подписи и иконки. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core',
} satisfies Meta<StoryProps>

export default meta

export const AllFeatures: StoryObj<StoryProps> = {
  name: 'All features',
  // Все тумблеры грида по группам панели Controls (общие для всех историй). Мок
  // вложенный: дети у каждой 10-й строки видны с «Раскрытием строк»; ядро и плагины
  // по умолчанию выключены.
  args: {
    dataNesting: 'nested',
    containerHeight: '600',
    height: '500',
    maxHeight: '500',
  },
}

/**
 * Обновление данных (ADR 0094): свечение под шапкой и приглушённое тело — во всех
 * режимах осей. Показ — после задержки `refreshOptions.delayMs`.
 */
export const Loading: StoryObj<StoryProps> = {
  name: 'Loading',
  tags: ['vr-modes'],
  parameters: {
    ...vrModes(vrStates('body.refreshing')),
    ...showControls(['loading', 'skeletonOptions', 'refreshOptions']),
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    await until(() =>
      expect(
        canvasElement.querySelector('[data-refreshing] .data-grid__loader'),
      ).not.toBeNull(),
    )
    await settle()
  },
  args: {
    loading: 'refresh',
  },
}

export const Stub: StoryObj<StoryProps> = {
  name: 'Empty (stub)',
  parameters: { ...vrStates('body.empty'), ...showControls(['showStub']) },
  args: {
    containerHeight: '460',
    height: '360',
    showStub: true,
  },
}

export const WithFooter: StoryObj<StoryProps> = {
  name: 'Footer',
  parameters: { ...vrStates('head.footer'), ...showControls(['enableFooter']) },
  args: {
    // Только колонки моков: Total — последняя, её сумма — в футере.
    columnCount: 7,
    enableFooter: true,
  },
}

export const Localization: StoryObj<StoryProps> = {
  name: 'Localization',
  parameters: showControls([
    'locale',
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
    'enableColumnVisibility',
    'enableHeaderActionMenu',
    'headerActionMenuMode',
    'headerActionMenuThreshold',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enableQuickSearch',
    'quickSearchDebounceMs',
    'quickSearchFilteredCount',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'columnFilteringTimeZone',
    'enablePagination',
    'paginationInitialPageSize',
    'paginationPageSizes',
    'paginationRevertOnReject',
    'enableDataExport',
    'dataExportAllow',
    'dataExportFilename',
  ]),
  // Русский словарь подписей (`localization`): тулбар, фильтры, пагинация, экспорт,
  // меню. Контрол `locale` переключает язык в любой истории.
  args: {
    locale: 'ru',
    dataCount: 120,
    enableColumnSorting: true,
    enableColumnFiltering: true,
    enableQuickSearch: true,
    enableColumnVisibility: true,
    enableDataExport: true,
    enablePagination: true,
    enableRowSelection: true,
    rowSelectionSelectedCount: true,
    enableHeaderActionMenu: true,
  },
}

export const CustomIcons: StoryObj<StoryProps> = {
  name: 'Custom icons',
  parameters: showControls([
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
    'enableRowDragging',
    'rowDraggingExpandDelay',
    'rowDraggingRevertOnReject',
    'enableRowActions',
    'rowActionsWidth',
    'rowActionsCollapsedWidth',
    'rowActionsColumn',
    'enableRowActionMenu',
    'rowActionMenuMode',
    'rowActionMenuThreshold',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'columnFilteringTimeZone',
    'enableDataExport',
    'dataExportAllow',
    'dataExportFilename',
  ]),
  // Проп `icons` заменяет иконки по ключу, остальные — по умолчанию: сортировка,
  // фильтр, перетаскивание, меню, экспорт.
  args: {
    icons: {
      sort: ArrowUpDown,
      sortAsc: ArrowUpNarrowWide,
      sortDesc: ArrowDownWideNarrow,
      filter: SlidersHorizontal,
      filterActive: ListFilter,
      drag: Grip,
      menu: Ellipsis,
      download: FileDown,
    },
    enableColumnSorting: true,
    enableColumnFiltering: true,
    enableRowDragging: true,
    enableRowActions: true,
    enableRowActionMenu: true,
    enableDataExport: true,
  },
  argTypes: { icons: { control: false } },
}

/**
 * Наведённые строки (ADR 0093, VR4, VR8): обычная и выбранная; наведение — псевдо-состояние,
 * а не курсор.
 */
const HOVERED_ROWS = ['item-id-2', 'item-id-4'].map(
  id => `.data-grid__body-row[data-row-id="${id}"]`,
)

export const CoreStateHoveredRow: StoryObj<StoryProps> = {
  name: 'State: hovered row',
  tags: ['vr-modes'],
  parameters: {
    ...vrModes({
      ...vrStates('body.hover'),
      requirements: ['VR8'],
      pseudo: {
        hover: HOVERED_ROWS.flatMap(row => [
          row,
          `${row} .data-grid__body-cell`,
        ]),
      },
    }),
    ...showControls([
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableRowActions',
      'rowActionsWidth',
      'rowActionsCollapsedWidth',
      'rowActionsColumn',
      'enableCellEditing',
    ]),
  },
  args: {
    enableRowSelection: true,
    enableCellEditing: true,
    enableRowActions: true,
    // Строки — с первого рендера: псевдо-состояние ставится на смонтированные узлы.
    dataOverride: getData(12),
    dataCount: 12,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  play: async ({ canvasElement, id, parameters }) => {
    await waitForRows(canvasElement)
    await userEvent.click(
      bodyRow(canvasElement, 'item-id-4').querySelector('[role="checkbox"]')!,
    )
    ;(document.activeElement as HTMLElement | null)?.blur()
    await until(() =>
      expect(bodyRow(canvasElement, 'item-id-4')).toHaveAttribute(
        'data-selected',
        'true',
      ),
    )
    await applyPseudoStates(id, parameters.pseudo)
    // Кнопки наведённой строки видны, у соседней — нет: вид не зависит от указателя.
    const hidden = (row: string) =>
      [
        ...canvasElement.querySelectorAll<HTMLElement>(
          `.data-grid__body-row[data-row-id="${row}"] .cell__button--hidden`,
        ),
      ].map(button => getComputedStyle(button).opacity)
    await waitFor(() => expect(hidden('item-id-2')).toContain('1'))
    expect(hidden('item-id-3').every(opacity => opacity === '0')).toBe(true)
    // Чип действий строки — тоже: значок наведённой строки закрашен, у соседней прозрачен.
    const chipColor = (row: string) =>
      getComputedStyle(
        canvasElement.querySelector(
          `.data-grid__body-row[data-row-id="${row}"] .row__button--hidden > button`,
        )!,
      ).color
    await waitFor(() =>
      expect(chipColor('item-id-2')).not.toBe('rgba(0, 0, 0, 0)'),
    )
    expect(chipColor('item-id-3')).toBe('rgba(0, 0, 0, 0)')
  },
}

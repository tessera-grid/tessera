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

/** Ядро грида: все тумблеры, скелет, загрузка, заглушка, футер, подписи и иконки. */
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
    containerHeight: 600,
    height: 500,
    maxHeight: 500,
  },
}

export const Skeletons: StoryObj<StoryProps> = {
  name: 'Skeleton',
  parameters: vrStates('body.skeleton'),
  // Скелет первой загрузки повторяет раскладку грида (ADR 0060): служебные колонки,
  // закрепление, шапку и пагинатор. Выключите enableSkeleton — данные встанут на
  // место без сдвига; skeletonOptions.rowsCount числом задаёт строки вручную.
  args: {
    // Вложенный мок: колонка раскрытия появляется, только если есть строки с детьми.
    dataNesting: 'nested',
    enableSkeleton: true,
    enableRowSelection: true,
    showSelectedCount: true,
    enableRowDragging: true,
    enableRowExpanding: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enablePagination: true,
    enableFooter: true,
  },
}

/**
 * Обновление данных (ADR 0094): свечение под шапкой и приглушённое тело — во всех
 * режимах осей. Показ — после задержки `loadingOptions.delayMs`.
 */
export const Loading: StoryObj<StoryProps> = {
  name: 'Loading',
  tags: ['vr-modes'],
  parameters: vrModes(vrStates('body.refreshing')),
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
    enableLoading: true,
  },
}

export const Stub: StoryObj<StoryProps> = {
  name: 'Empty (stub)',
  parameters: vrStates('body.empty'),
  args: {
    showStub: true,
  },
}

export const WithFooter: StoryObj<StoryProps> = {
  name: 'Footer',
  parameters: vrStates('head.footer'),
  args: {
    enableFooter: true,
  },
}

export const Localization: StoryObj<StoryProps> = {
  name: 'Localization',
  // Русский словарь подписей (`localization`): тулбар, фильтры, пагинация, экспорт,
  // меню. Контрол `locale` переключает язык в любой истории.
  args: {
    locale: 'ru',
    dataCount: 120,
    enableColumnSorting: true,
    enableColumnFiltering: true,
    enableQuickSearch: true,
    enableColumnVisibility: true,
    enableExport: true,
    enablePagination: true,
    enableRowSelection: true,
    showSelectedCount: true,
    enableHeaderActionMenu: true,
  },
}

export const CustomIcons: StoryObj<StoryProps> = {
  name: 'Custom icons',
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
    enableExport: true,
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
  parameters: vrModes({
    ...vrStates('body.hover'),
    requirements: ['VR8'],
    pseudo: {
      hover: HOVERED_ROWS.flatMap(row => [row, `${row} .data-grid__body-cell`]),
    },
  }),
  args: {
    enableRowSelection: true,
    enableCellEditing: true,
    enableRowActions: true,
    // Строки — с первого рендера: псевдо-состояние ставится на смонтированные узлы.
    dataOverride: getData(12),
    dataCount: 12,
    containerHeight: 460,
    height: 360,
    maxHeight: 360,
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
  },
}

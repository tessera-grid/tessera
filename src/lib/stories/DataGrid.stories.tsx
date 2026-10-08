import { Meta, StoryObj } from '@storybook/react'
import { Grid } from './_shims'
import { statusBarDemoPlugins } from './statusBarDemo'
import { toolbarDemoPlugins } from './toolbarDemo'
import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../lib/plugins/rowActions'
import { DEFAULT_SKELETON_OPTIONS } from '../../lib/core/skeletonOptions'
import {
  columnCountType,
  containerHeightType,
  dataCountType,
  dataNestingType,
  enableAnnouncementsType,
  inCategory,
  paginationPageSizeType,
  rowActionsColumnType,
  rowExpandingColumnType,
  rowExpandingMaxDepthType,
  rowExpandingTreeLinesType,
  enableCellEditingType,
  enableCellSelectionType,
  enableColumnDraggingType,
  enableColumnPinningType,
  enableColumnResizingType,
  enableColumnSortingType,
  enableColumnVisibilityType,
  enableContextMenuType,
  enableExportType,
  enableColumnFilteringType,
  enableQuickSearchType,
  enableHeaderActionMenuType,
  enableKeyboardNavigationType,
  enableLeafPinningType,
  enablePaginationType,
  enableRowActionMenuType,
  enableFooterType,
  enableToolbarType,
  enableStatusBarType,
  enableGroupingType,
  enableLoadingType,
  enableMultiSortType,
  enableRowActionsType,
  enableRowDraggingType,
  enableRowExpandingType,
  enableRowSelectionType,
  enableSkeletonType,
  enableSortingRemovalType,
  enableSubRowSelectionType,
  numberHeightType,
  numberMaxHeightType,
  rowActionsOptionsType,
  serverColumnSortingType,
  showHeaderGroupsType,
  showSelectedCountType,
  showStubType,
  skeletonOptionsType,
} from './__mocks__/utils/argTypes'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { RowGrouping } from './DataGrid.Rows.stories'
import { filteringColumns, filteringData } from './__mocks__/filteringData'

/** Общие истории: все фичи, загрузка, заглушка, футер, ручная проверка доступности. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid',
} satisfies Meta<StoryProps>

export default meta

export const AllFeatures: StoryObj<StoryProps> = {
  name: 'All Features',
  // Все тумблеры грида по группам панели Controls. Мок вложенный: дети у каждой 10-й
  // строки видны с «Раскрытием строк»; ядро и плагины по умолчанию выключены.
  args: {
    dataNesting: 'nested',
    containerHeight: 600,
    height: 500,
    maxHeight: 500,
    showStub: false,
    showHeaderGroups: false,

    enableSkeleton: false,
    skeletonOptions: DEFAULT_SKELETON_OPTIONS,
    enableLoading: false,
    enableFooter: false,
    enableAnnouncements: true,

    enableColumnSorting: false,
    enableSortingRemoval: true,
    enableMultiSort: true,
    serverColumnSorting: false,
    enableColumnResizing: false,
    enableColumnDragging: false,
    enableColumnPinning: false,
    enableLeafPinning: false,
    enableColumnVisibility: false,
    enableHeaderActionMenu: false,

    enableRowSelection: false,
    enableSubRowSelection: false,
    showSelectedCount: false,
    enableRowExpanding: false,
    rowExpandingMaxDepth: 1,
    rowExpandingColumn: 'auto',
    rowExpandingTreeLines: false,
    enableRowDragging: false,
    enableGrouping: false,
    enableRowActions: false,
    rowActionsOptions: DEFAULT_ROW_ACTIONS_OPTIONS,
    rowActionsColumn: 'auto',
    enableRowActionMenu: false,

    enableCellEditing: false,
    enableCellSelection: false,
    enableContextMenu: false,
    enableKeyboardNavigation: false,

    enableQuickSearch: false,
    enableColumnFiltering: false,
    enablePagination: false,
    paginationPageSize: 25,
    enableExport: false,
  },
  argTypes: {
    ...inCategory('Данные и размеры', {
      columnCount: columnCountType,
      dataCount: dataCountType,
      dataNesting: dataNestingType,
      containerHeight: containerHeightType,
      height: numberHeightType,
      maxHeight: numberMaxHeightType,
      showStub: showStubType,
      showHeaderGroups: showHeaderGroupsType,
    }),
    ...inCategory('Ядро: панели и состояния', {
      enableSkeleton: enableSkeletonType,
      skeletonOptions: skeletonOptionsType,
      enableLoading: enableLoadingType,
      enableFooter: enableFooterType,
      enableToolbar: enableToolbarType,
      enableStatusBar: enableStatusBarType,
      enableAnnouncements: enableAnnouncementsType,
    }),
    ...inCategory(
      'Колонки',
      {
        enableColumnSorting: enableColumnSortingType,
        enableSortingRemoval: enableSortingRemovalType,
        enableMultiSort: enableMultiSortType,
        serverColumnSorting: serverColumnSortingType,
      },
      'Сортировка',
    ),
    ...inCategory(
      'Колонки',
      {
        enableColumnPinning: enableColumnPinningType,
        enableLeafPinning: enableLeafPinningType,
      },
      'Закрепление',
    ),
    ...inCategory(
      'Колонки',
      {
        enableColumnResizing: enableColumnResizingType,
        enableColumnDragging: enableColumnDraggingType,
        enableColumnVisibility: enableColumnVisibilityType,
        enableHeaderActionMenu: enableHeaderActionMenuType,
      },
      'Ширина, порядок, видимость',
    ),
    ...inCategory(
      'Строки',
      {
        enableRowSelection: enableRowSelectionType,
        enableSubRowSelection: enableSubRowSelectionType,
        showSelectedCount: showSelectedCountType,
      },
      'Выбор',
    ),
    ...inCategory(
      'Строки',
      {
        enableRowExpanding: enableRowExpandingType,
        rowExpandingMaxDepth: rowExpandingMaxDepthType,
        rowExpandingColumn: rowExpandingColumnType,
        rowExpandingTreeLines: rowExpandingTreeLinesType,
      },
      'Раскрытие',
    ),
    ...inCategory(
      'Строки',
      {
        enableRowDragging: enableRowDraggingType,
        enableGrouping: enableGroupingType,
      },
      'Порядок и группировка',
    ),
    ...inCategory(
      'Строки',
      {
        enableRowActions: enableRowActionsType,
        rowActionsOptions: rowActionsOptionsType,
        rowActionsColumn: rowActionsColumnType,
        enableRowActionMenu: enableRowActionMenuType,
      },
      'Действия',
    ),
    ...inCategory('Ячейки и клавиатура', {
      enableCellEditing: enableCellEditingType,
      enableCellSelection: enableCellSelectionType,
      enableContextMenu: enableContextMenuType,
      enableKeyboardNavigation: enableKeyboardNavigationType,
    }),
    ...inCategory('Поиск, фильтры, страницы, экспорт', {
      enableQuickSearch: enableQuickSearchType,
      enableColumnFiltering: enableColumnFilteringType,
      enablePagination: enablePaginationType,
      paginationPageSize: paginationPageSizeType,
      enableExport: enableExportType,
    }),
  },
}

export const Skeletons: StoryObj<StoryProps> = {
  name: 'Skeletons',
  // Скелет первой загрузки повторяет раскладку грида (ADR 0060): служебные колонки,
  // закрепление, шапку и пагинатор. Выключите enableSkeleton — данные встанут на
  // место без сдвига; skeletonOptions.rowsCount числом задаёт строки вручную.
  args: {
    // Вложенный мок: колонка раскрытия появляется, только если есть строки с детьми.
    dataNesting: 'nested',
    enableSkeleton: true,
    skeletonOptions: DEFAULT_SKELETON_OPTIONS,
    enableRowSelection: true,
    showSelectedCount: true,
    enableRowDragging: true,
    enableRowExpanding: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enablePagination: true,
    enableFooter: true,
  },
  argTypes: {
    columnCount: columnCountType,
    dataCount: dataCountType,

    enableSkeleton: enableSkeletonType,
    skeletonOptions: skeletonOptionsType,
  },
}

export const Loading: StoryObj<StoryProps> = {
  name: 'Loading',
  args: {
    enableLoading: true,
  },
  argTypes: {
    columnCount: columnCountType,
    dataCount: dataCountType,

    enableLoading: enableLoadingType,
  },
}

export const Stub: StoryObj<StoryProps> = {
  name: 'Stub',
  args: {
    showStub: true,
  },
  argTypes: {
    columnCount: columnCountType,
    dataCount: dataCountType,

    showStub: showStubType,
  },
}

export const WithFooter: StoryObj<StoryProps> = {
  name: 'With Footer',
  args: {
    enableFooter: true,
  },
}

export const WithToolbar: StoryObj<StoryProps> = {
  name: 'With Toolbar',
  args: {
    // Демо-кнопки в двух подгруппах (`view` и `data`): видны порядок, разделитель
    // и состояния F4 — активное (Settings) и disabled (Export). Тулбар вызывают
    // сами кнопки — флаг не нужен (ADR 0046).
    extraPlugins: toolbarDemoPlugins,
  },
}

export const ToolbarAllButtons: StoryObj<StoryProps> = {
  name: 'Toolbar — all buttons',
  args: {
    // Все встроенные кнопки разом (ADR 0051): слева поиск и «Фильтры», справа
    // «Колонки», затем «Экспорт». Порядок задают группы search → view → data, а не
    // порядок плагинов. Сузьте окно — поле поиска сжимается, стороны не наезжают.
    columnsOverride: filteringColumns,
    dataOverride: filteringData,
    enableQuickSearch: true,
    enableColumnFiltering: true,
    enableColumnVisibility: true,
    enableExport: true,
  },
}

export const ColumnVisibility: StoryObj<StoryProps> = {
  name: 'Column Visibility',
  args: {
    // Кнопка «Колонки» в тулбаре: поиск, дерево, «Показать все» / «Сбросить».
    // Включите showHeaderGroups — меню покажет группы вложенной шапки.
    enableColumnVisibility: true,
    enableRowSelection: true,
  },
}

export const ColumnVisibilityWithHeaderMenu: StoryObj<StoryProps> = {
  name: 'Column Visibility + Header Menu',
  args: {
    // Всё вместе: кнопка «Колонки» в тулбаре и «Скрыть колонку» в кебабе заголовка.
    // Пин — обычное действие, остаётся кнопкой; «Скрыть колонку» (`placement:
    // 'menu'`) — только в кебабе. Кебаб считается в пороге (3) одной кнопкой:
    // включите enableColumnSorting — пин + сортировка + кебаб = 3, всё уйдёт в кебаб.
    // Включите showHeaderGroups — у групп в кебабе появится «Скрыть группу».
    enableColumnVisibility: true,
    enableHeaderActionMenu: true,
    enableColumnPinning: true,
    enableRowSelection: true,
  },
}

export const WithEmptyToolbar: StoryObj<StoryProps> = {
  name: 'With Toolbar (empty)',
  args: {
    // Пустой тулбар держит только явный enableToolbar: true (ADR 0046).
    enableToolbar: true,
  },
}

export const Pagination: StoryObj<StoryProps> = {
  name: 'Pagination',
  args: {
    // Пагинация в нижней панели: размер страницы, диапазон и кнопки. Включите
    // enableColumnSorting — смена сортировки вернёт на первую страницу.
    enablePagination: true,
    dataCount: 1000,
  },
}

export const SelectedCount: StoryObj<StoryProps> = {
  name: 'Selected Count',
  args: {
    // Счётчик выбранных строк слева в нижней панели, пагинация справа: выбор на
    // других страницах тоже считается.
    enableRowSelection: true,
    showSelectedCount: true,
    enablePagination: true,
    dataCount: 1000,
  },
}

export const WithStatusBar: StoryObj<StoryProps> = {
  name: 'With Status Bar',
  args: {
    // Демо-слоты нижней панели: один слева, два справа (порядок по `order`).
    // Включите enableFooter — панель встанет под футером одной линией.
    extraPlugins: statusBarDemoPlugins,
  },
}

// --- Ручная проверка доступности (docs/testing/screen-readers.md) ------------------

export const A11yGrid: StoryObj<StoryProps> = {
  name: 'A11y: Grid',
  args: {
    // Сценарии чеклиста для скринридеров: навигация, сортировка, выбор строк и
    // ячеек, правка с проверкой значения, закрепление, ширина, контекстное меню,
    // футер. Немного строк и колонок — чтобы дерево было обозримым.
    enableKeyboardNavigation: true,
    enableColumnSorting: true,
    enableColumnPinning: true,
    enableColumnResizing: true,
    enableRowSelection: true,
    enableCellSelection: true,
    enableCellEditing: true,
    enableContextMenu: true,
    enableFooter: true,
    validateCellEdit: (value: string) =>
      value.trim() ? null : 'Value is required',
    columnCount: 8,
    dataCount: 30,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

export const A11yTreeGrid: StoryObj<StoryProps> = {
  name: 'A11y: Tree Grid',
  args: {
    // treegrid: группировка по gender с раскрытием — уровни строк и фокус на строке.
    ...RowGrouping.args,
    enableKeyboardNavigation: true,
    enableRowExpanding: true,
    initialGrouping: ['gender'],
  },
}

export const A11yRowMoving: StoryObj<StoryProps> = {
  name: 'A11y: Row Moving',
  args: {
    // Перестановка строк и колонок с клавиатуры (Alt+Shift+стрелки) на дереве.
    dataNesting: 'nested',
    enableKeyboardNavigation: true,
    enableRowDragging: true,
    enableRowExpanding: true,
    enableColumnDragging: true,
    initialExpanded: true,
    dataCount: 20,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

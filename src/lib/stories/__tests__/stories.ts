// Истории DataGrid как фикстуры тестов: все группы в одном объекте (по имени экспорта).
import { composeStories } from '@storybook/react-vite'
import { makeData } from '../__mocks__/data'
import {
  optionFilteringColumns,
  optionFilteringData,
} from '../__mocks__/filteringData'

import * as accessibility from '../DataGrid.Accessibility.stories'
import * as screenReaders from '../ScreenReaders.dev.stories'
import * as cellsContextMenu from '../DataGrid.Cells.ContextMenu.stories'
import * as cellsEditing from '../DataGrid.Cells.Editing.stories'
import * as cellsKeyboard from '../DataGrid.Cells.Keyboard.stories'
import * as cellsSelection from '../DataGrid.Cells.Selection.stories'
import * as columnsHeaderGroups from '../DataGrid.Columns.HeaderGroups.stories'
import * as columnsHeaderMenu from '../DataGrid.Columns.HeaderMenu.stories'
import * as columnsPinning from '../DataGrid.Columns.Pinning.stories'
import * as columnsDragging from '../DataGrid.Columns.Dragging.stories'
import * as columnsResizing from '../DataGrid.Columns.Resizing.stories'
import * as columnsSorting from '../DataGrid.Columns.Sorting.stories'
import * as columnsVisibility from '../DataGrid.Columns.Visibility.stories'
import * as playground from '../DataGrid.Playground.stories'
import * as coreSkeleton from '../DataGrid.DataLoading.Skeleton.stories'
import * as coreLongText from '../DataGrid.Core.LongText.stories'
import * as coreTouch from '../DataGrid.Core.Touch.stories'
import * as coreLoadError from '../DataGrid.DataLoading.LoadError.stories'
import * as coreIncreasedContrast from '../Customization.IncreasedContrast.stories'
import * as dataInfiniteScroll from '../DataGrid.DataLoading.InfiniteScroll.stories'
import * as coreSizing from '../DataGrid.Core.Sizing.stories'
import * as exportStories from '../DataGrid.Export.stories'
import * as filtering from '../DataGrid.Filtering.stories'
import * as panelsPagination from '../DataGrid.Panels.Pagination.stories'
import * as panelsPresence from '../DataGrid.Panels.Presence.stories'
import * as panelsStatusBar from '../DataGrid.Panels.StatusBar.stories'
import * as panelsToolbar from '../DataGrid.Panels.Toolbar.stories'
import * as pluginApi from '../DataGrid.PluginApi.stories'
import * as rowsActions from '../DataGrid.Rows.Actions.stories'
import * as rowsBackToTop from '../DataGrid.Rows.BackToTop.stories'
import * as rowsDragging from '../DataGrid.Rows.Dragging.stories'
import * as rowsExpanding from '../DataGrid.Rows.Expanding.stories'
import * as rowsGrouping from '../DataGrid.Rows.Grouping.stories'
import * as rowsHighlight from '../DataGrid.Rows.Highlight.stories'
import * as rowsSelection from '../DataGrid.Rows.Selection.stories'

export const composed = {
  ...composeStories(accessibility),
  ...composeStories(screenReaders),
  ...composeStories(cellsContextMenu),
  ...composeStories(cellsEditing),
  ...composeStories(cellsKeyboard),
  ...composeStories(cellsSelection),
  ...composeStories(columnsHeaderGroups),
  ...composeStories(columnsHeaderMenu),
  ...composeStories(columnsPinning),
  ...composeStories(columnsResizing),
  ...composeStories(columnsDragging),
  ...composeStories(columnsSorting),
  ...composeStories(columnsVisibility),
  ...composeStories(playground),
  ...composeStories(coreSkeleton),
  ...composeStories(coreLongText),
  ...composeStories(coreTouch),
  ...composeStories(coreLoadError),
  ...composeStories(coreIncreasedContrast),
  ...composeStories(dataInfiniteScroll),
  ...composeStories(coreSizing),
  ...composeStories(exportStories),
  ...composeStories(filtering),
  ...composeStories(panelsPagination),
  ...composeStories(panelsPresence),
  ...composeStories(panelsStatusBar),
  ...composeStories(panelsToolbar),
  ...composeStories(pluginApi),
  ...composeStories(rowsActions),
  ...composeStories(rowsBackToTop),
  ...composeStories(rowsDragging),
  ...composeStories(rowsExpanding),
  ...composeStories(rowsGrouping),
  ...composeStories(rowsHighlight),
  ...composeStories(rowsSelection),
}

/** Колонки с вариантами: статус из списка, менеджер из справочника (ADR 0063). */
export const optionLabelsArgs = {
  columnsOverride: optionFilteringColumns,
  dataOverride: optionFilteringData,
}

/** Группировка без начального состояния `Playground`: строки списком, раскрытия нет. */
export const plainGroupingArgs = {
  initialGrouping: undefined,
  enableRowExpanding: undefined,
  initialExpanded: undefined,
}

/** Счётчик выбранных строк и пейджер в нижней панели (ADR 0038, RS19–RS22). */
export const selectedCountArgs = {
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enablePagination: true,
  dataCount: 1000,
  extraPlugins: [],
}

/** Колонка действий с меню строки — фикстура тестов меню (ADR 0024, 0025). */
export const rowMenuArgs = {
  enableRowActions: true,
  enableRowActionMenu: true,
  dataCount: 30,
  containerHeight: '400',
  height: '300',
  maxHeight: '300',
} as const

/** Действия строки с ответом «сервера» (ADR 0078). */
export const rowAsyncArgs = { ...rowMenuArgs, actionsDemo: 'async' } as const

/** Действия строки с вложенными разделами, ещё и в контекстном меню (ADR 0079). */
export const rowNestedArgs = {
  ...rowMenuArgs,
  actionsDemo: 'nested',
  enableContextMenu: true,
} as const

/** Дерево в 4 уровня, раскрытое целиком, с линиями (ADR 0058, 0102). */
export const treeLinesArgs = {
  dataOverride: makeData({ shape: 'tree', count: 6, depth: 4, breadth: 2 }),
  enableRowExpanding: true,
  rowExpandingMaxDepth: 4,
  enableTreeLines: true,
  initialExpanded: true,
  containerHeight: '640',
  height: '540',
  maxHeight: '540',
} as const

/** Раскрытие и выбор на плоских данных: раскрывать нечего (ADR 0050). */
export const flatExpandingArgs = {
  dataOverride: makeData({ shape: 'flat', count: 12 }),
  enableRowExpanding: true,
  enableRowSelection: true,
} as const

/** Дерево 4 × 3, раскрытое, с выбором детей вместе с родителем (ADR 0014). */
export const subRowSelectionArgs = {
  dataOverride: makeData({ shape: 'tree', count: 4, depth: 2, breadth: 3 }),
  initialExpanded: true,
  enableRowSelection: true,
  rowSelectionSubRows: true,
  enableRowExpanding: true,
} as const

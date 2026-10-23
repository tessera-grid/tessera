// Истории DataGrid как фикстуры тестов: все группы в одном объекте (по имени экспорта).
import { composeStories } from '@storybook/react-vite'

import * as accessibility from '../DataGrid.Accessibility.stories'
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

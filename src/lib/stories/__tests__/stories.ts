// Истории DataGrid как фикстуры тестов: все группы в одном объекте (по имени экспорта).
import { composeStories } from '@storybook/react-vite'

import * as accessibility from '../DataGrid.Accessibility.stories'
import * as cellsContextMenu from '../DataGrid.Cells.ContextMenu.stories'
import * as cellsEditing from '../DataGrid.Cells.Editing.stories'
import * as cellsKeyboard from '../DataGrid.Cells.Keyboard.stories'
import * as cellsOverflowTooltip from '../DataGrid.Cells.OverflowTooltip.stories'
import * as cellsSelection from '../DataGrid.Cells.Selection.stories'
import * as columnsHeaderGroups from '../DataGrid.Columns.HeaderGroups.stories'
import * as columnsHeaderMenu from '../DataGrid.Columns.HeaderMenu.stories'
import * as columnsPinning from '../DataGrid.Columns.Pinning.stories'
import * as columnsResizingDragging from '../DataGrid.Columns.ResizingDragging.stories'
import * as columnsSorting from '../DataGrid.Columns.Sorting.stories'
import * as columnsVisibility from '../DataGrid.Columns.Visibility.stories'
import * as core from '../DataGrid.Core.stories'
import * as dataInfiniteScroll from '../DataGrid.Data.InfiniteScroll.stories'
import * as coreSizing from '../DataGrid.Core.Sizing.stories'
import * as exportStories from '../DataGrid.Export.stories'
import * as filtering from '../DataGrid.Filtering.stories'
import * as panelsPagination from '../DataGrid.Panels.Pagination.stories'
import * as panelsPresence from '../DataGrid.Panels.Presence.stories'
import * as panelsStatusBar from '../DataGrid.Panels.StatusBar.stories'
import * as panelsToolbar from '../DataGrid.Panels.Toolbar.stories'
import * as pluginApi from '../DataGrid.PluginApi.stories'
import * as rowsActions from '../DataGrid.Rows.Actions.stories'
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
  ...composeStories(cellsOverflowTooltip),
  ...composeStories(cellsSelection),
  ...composeStories(columnsHeaderGroups),
  ...composeStories(columnsHeaderMenu),
  ...composeStories(columnsPinning),
  ...composeStories(columnsResizingDragging),
  ...composeStories(columnsSorting),
  ...composeStories(columnsVisibility),
  ...composeStories(core),
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
  ...composeStories(rowsDragging),
  ...composeStories(rowsExpanding),
  ...composeStories(rowsGrouping),
  ...composeStories(rowsHighlight),
  ...composeStories(rowsSelection),
}

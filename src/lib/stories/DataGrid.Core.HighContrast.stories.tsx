import { Meta } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { type TwinSource, forced } from './__mocks__/catalog'
import cellsContextMenuMeta, {
  ContextMenuStateOpen,
} from './DataGrid.Cells.ContextMenu.stories'
import cellsEditingMeta, {
  EditingStateEditing,
  EditingStateSaving,
  EditingStateError,
} from './DataGrid.Cells.Editing.stories'
import cellsKeyboardMeta, {
  KeyboardStateFocusedCell,
} from './DataGrid.Cells.Keyboard.stories'
import cellsSelectionMeta, {
  CellSelectionStateRange,
} from './DataGrid.Cells.Selection.stories'
import columnsHeaderGroupsMeta, {
  HeaderGroups,
} from './DataGrid.Columns.HeaderGroups.stories'
import columnsHeaderMenuMeta, {
  ActiveActionIndicator,
  HeaderMenuStateKebab,
  HeaderMenuStateOpen,
} from './DataGrid.Columns.HeaderMenu.stories'
import columnsPinningMeta, {
  PinningStateBothSides,
} from './DataGrid.Columns.Pinning.stories'
import columnsResizingDraggingMeta, {
  ResizingStateHandle,
} from './DataGrid.Columns.ResizingDragging.stories'
import columnsSortingMeta, {
  SortingStateSorted,
  SortingStateTooltip,
} from './DataGrid.Columns.Sorting.stories'
import columnsVisibilityMeta, {
  VisibilityStatePanel,
} from './DataGrid.Columns.Visibility.stories'
import coreFooterMeta, { FooterDefault } from './DataGrid.Core.Footer.stories'
import coreLoadErrorMeta, {
  LoadErrorRefresh,
  LoadErrorFirstLoad,
} from './DataGrid.Core.LoadError.stories'
import coreSkeletonMeta, {
  SkeletonDefault,
} from './DataGrid.Core.Skeleton.stories'
import coreMeta, { Loading, CoreStateHoveredRow } from './DataGrid.Core.stories'
import coreStubsMeta, { StubsDefault } from './DataGrid.Core.Stubs.stories'
import dataMeta, { Grouped } from './DataGrid.Data.stories'
import exportMeta, { ExportStatePanel } from './DataGrid.Export.stories'
import filteringMeta, {
  FilteringStateText,
  FilteringStateDate,
  FilteringStateOptions,
} from './DataGrid.Filtering.stories'
import panelsPaginationMeta, {
  Pagination,
} from './DataGrid.Panels.Pagination.stories'
import panelsStatusBarMeta, {
  WithStatusBar,
  PanelsNarrowStatusBar,
} from './DataGrid.Panels.StatusBar.stories'
import panelsToolbarMeta, {
  ToolbarAllButtons,
} from './DataGrid.Panels.Toolbar.stories'
import rowsActionsMeta, {
  ActionsStateSection,
} from './DataGrid.Rows.Actions.stories'
import rowsExpandingMeta, {
  RowExpandingTreeLines,
} from './DataGrid.Rows.Expanding.stories'
import rowsHighlightMeta, {
  HighlightStateLit,
} from './DataGrid.Rows.Highlight.stories'
import rowsSelectionMeta, {
  RowSelectionStateSelected,
} from './DataGrid.Rows.Selection.stories'

/**
 * Высокая контрастность (ADR 0087): каждое состояние каталога — близнец своей истории со
 * снимком Chromatic в `forced-colors` (ADR 0093, VR17). Включите в DevTools Rendering →
 * «Emulate CSS media feature forced-colors: active» или контрастную тему Windows.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/High contrast',
  tags: ['done'],
} satisfies Meta<StoryProps>

export default meta

const twin = <S extends TwinSource>(source: TwinSource, story: S) =>
  forced(source, story, meta)

export const HighContrastContextMenuStateOpen = {
  ...twin(cellsContextMenuMeta, ContextMenuStateOpen),
  name: 'Cells/Context menu — State: open',
  tags: ['!test'],
}

export const HighContrastEditingStateEditing = {
  ...twin(cellsEditingMeta, EditingStateEditing),
  name: 'Cells/Editing — State: editing',
  tags: ['!test'],
}

export const HighContrastEditingStateSaving = {
  ...twin(cellsEditingMeta, EditingStateSaving),
  name: 'Cells/Editing — State: saving',
  tags: ['!test'],
}

export const HighContrastEditingStateError = {
  ...twin(cellsEditingMeta, EditingStateError),
  name: 'Cells/Editing — State: save error',
  tags: ['!test'],
}

export const HighContrastKeyboardStateFocusedCell = {
  ...twin(cellsKeyboardMeta, KeyboardStateFocusedCell),
  name: 'Cells/Keyboard — State: focused cell',
  tags: ['!test'],
}

export const HighContrastCellSelectionStateRange = {
  ...twin(cellsSelectionMeta, CellSelectionStateRange),
  name: 'Cells/Selection — State: cell range',
  tags: ['!test'],
}

export const HighContrastHeaderGroups = {
  ...twin(columnsHeaderGroupsMeta, HeaderGroups),
  name: 'Columns/Header groups — Basic',
  tags: ['!test'],
}

export const HighContrastActiveActionIndicator = {
  ...twin(columnsHeaderMenuMeta, ActiveActionIndicator),
  name: 'Columns/Header menu — Active indicator',
  tags: ['!test'],
}

export const HighContrastHeaderMenuStateKebab = {
  ...twin(columnsHeaderMenuMeta, HeaderMenuStateKebab),
  name: 'Columns/Header menu — State: kebab',
  tags: ['!test'],
}

export const HighContrastHeaderMenuStateOpen = {
  ...twin(columnsHeaderMenuMeta, HeaderMenuStateOpen),
  name: 'Columns/Header menu — State: menu open',
  tags: ['!test'],
}

export const HighContrastPinningStateBothSides = {
  ...twin(columnsPinningMeta, PinningStateBothSides),
  name: 'Columns/Pinning — State: pinned both sides',
  tags: ['!test'],
}

export const HighContrastResizingStateHandle = {
  ...twin(columnsResizingDraggingMeta, ResizingStateHandle),
  name: 'Columns/Resizing & dragging — State: resize handle',
  tags: ['!test'],
}

export const HighContrastSortingStateSorted = {
  ...twin(columnsSortingMeta, SortingStateSorted),
  name: 'Columns/Sorting — State: sorted',
  tags: ['!test'],
}

export const HighContrastSortingStateTooltip = {
  ...twin(columnsSortingMeta, SortingStateTooltip),
  name: 'Columns/Sorting — State: tooltip',
  tags: ['!test'],
}

export const HighContrastVisibilityStatePanel = {
  ...twin(columnsVisibilityMeta, VisibilityStatePanel),
  name: 'Columns/Visibility — State: columns panel',
  tags: ['!test'],
}

export const HighContrastFooterDefault = {
  ...twin(coreFooterMeta, FooterDefault),
  name: 'Core/Footer — Default',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefresh = {
  ...twin(coreLoadErrorMeta, LoadErrorRefresh),
  name: 'Core/Load error — Refresh error',
  tags: ['!test'],
}

export const HighContrastLoadErrorFirstLoad = {
  ...twin(coreLoadErrorMeta, LoadErrorFirstLoad),
  name: 'Core/Load error — First load error',
  tags: ['!test'],
}

export const HighContrastSkeletonDefault = {
  ...twin(coreSkeletonMeta, SkeletonDefault),
  name: 'Core/Skeleton — Default',
  tags: ['!test'],
}

export const HighContrastLoading = {
  ...twin(coreMeta, Loading),
  name: 'Core — Loading',
  tags: ['!test'],
}

export const HighContrastCoreStateHoveredRow = {
  ...twin(coreMeta, CoreStateHoveredRow),
  name: 'Core — State: hovered row',
  tags: ['!test'],
}

export const HighContrastStubsDefault = {
  ...twin(coreStubsMeta, StubsDefault),
  name: 'Core/Stubs — Default',
  tags: ['!test'],
}

export const HighContrastGrouped = {
  ...twin(dataMeta, Grouped),
  name: 'Data & scale — Grouped & aggregated',
  tags: ['!test'],
}

export const HighContrastExportStatePanel = {
  ...twin(exportMeta, ExportStatePanel),
  name: 'Export — State: export panel',
  tags: ['!test'],
}

export const HighContrastFilteringStateText = {
  ...twin(filteringMeta, FilteringStateText),
  name: 'Filtering — State: text filter',
  tags: ['!test'],
}

export const HighContrastFilteringStateDate = {
  ...twin(filteringMeta, FilteringStateDate),
  name: 'Filtering — State: date filter',
  tags: ['!test'],
}

export const HighContrastFilteringStateOptions = {
  ...twin(filteringMeta, FilteringStateOptions),
  name: 'Filtering — State: options filter',
  tags: ['!test'],
}

export const HighContrastPagination = {
  ...twin(panelsPaginationMeta, Pagination),
  name: 'Panels/Pagination — Basic',
  tags: ['!test'],
}

export const HighContrastWithStatusBar = {
  ...twin(panelsStatusBarMeta, WithStatusBar),
  name: 'Panels/Status bar — Basic',
  tags: ['!test'],
}

export const HighContrastPanelsNarrowStatusBar = {
  ...twin(panelsStatusBarMeta, PanelsNarrowStatusBar),
  name: 'Panels/Status bar — Narrow',
  tags: ['!test'],
}

export const HighContrastToolbarAllButtons = {
  ...twin(panelsToolbarMeta, ToolbarAllButtons),
  name: 'Panels/Toolbar — All buttons',
  tags: ['!test'],
}

export const HighContrastActionsStateSection = {
  ...twin(rowsActionsMeta, ActionsStateSection),
  name: 'Rows/Actions — State: nested section',
  tags: ['!test'],
}

export const HighContrastRowExpandingTreeLines = {
  ...twin(rowsExpandingMeta, RowExpandingTreeLines),
  name: 'Rows/Expanding — Tree lines',
  tags: ['!test'],
}

export const HighContrastHighlightStateLit = {
  ...twin(rowsHighlightMeta, HighlightStateLit),
  name: 'Rows/Highlight — State: highlights',
  tags: ['!test'],
}

export const HighContrastRowSelectionStateSelected = {
  ...twin(rowsSelectionMeta, RowSelectionStateSelected),
  name: 'Rows/Selection — State: selected rows',
  tags: ['!test'],
}

import { Meta } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { type TwinSource, forced } from './__mocks__/catalog'
import { forcedStep } from './__mocks__/catalogPlay'
import * as cellsSelectionStories from './DataGrid.Cells.Selection.stories'
import * as columnsSortingStories from './DataGrid.Columns.Sorting.stories'
import * as coreFooterStories from './DataGrid.Core.Footer.stories'
import * as customizationLocalizationStories from './Customization.Localization.stories'
import * as coreIncreasedContrastStories from './Customization.IncreasedContrast.stories'
import * as coreSizingStories from './DataGrid.Core.Sizing.stories'
import * as coreSkeletonStories from './DataGrid.DataLoading.Skeleton.stories'
import * as coreStubsStories from './DataGrid.Core.Stubs.stories'
import * as exportStories from './DataGrid.Export.stories'
import * as filteringStories from './DataGrid.Filtering.stories'
import * as panelsPaginationStories from './DataGrid.Panels.Pagination.stories'
import * as panelsToolbarStories from './DataGrid.Panels.Toolbar.stories'
import * as pluginApiStories from './DataGrid.PluginApi.stories'
import * as columnsDraggingStories from './DataGrid.Columns.Dragging.stories'
import * as columnsResizingStories from './DataGrid.Columns.Resizing.stories'
import * as rowsDraggingStories from './DataGrid.Rows.Dragging.stories'
import * as rowsGroupingStories from './DataGrid.Rows.Grouping.stories'
import * as rowsSelectionStories from './DataGrid.Rows.Selection.stories'
import * as rowsTreeDataStories from './DataGrid.Rows.TreeData.stories'
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
  HeaderGroupsPlayground,
} from './DataGrid.Columns.HeaderGroups.stories'
import * as columnsHeaderGroupsStories from './DataGrid.Columns.HeaderGroups.stories'
import * as columnsHeaderMenuStories from './DataGrid.Columns.HeaderMenu.stories'
import * as columnsPinningStories from './DataGrid.Columns.Pinning.stories'
import columnsSortingMeta, {
  SortingStateSorted,
  SortingStateTooltip,
} from './DataGrid.Columns.Sorting.stories'
import * as columnsVisibilityStories from './DataGrid.Columns.Visibility.stories'
import * as coreLongTextStories from './DataGrid.Core.LongText.stories'
import columnsVisibilityMeta, {
  VisibilityStatePanel,
} from './DataGrid.Columns.Visibility.stories'
import coreFooterMeta, {
  FooterPlayground,
} from './DataGrid.Core.Footer.stories'
import * as coreLoadErrorStories from './DataGrid.DataLoading.LoadError.stories'
import coreSkeletonMeta, {
  SkeletonPlayground,
} from './DataGrid.DataLoading.Skeleton.stories'
import catalogStatesMeta, {
  ColumnsStateResizeHandle,
  CoreStateHoveredRow,
} from './CatalogStates.vr.stories'
import * as customizationIconsStories from './Customization.Icons.stories'
import * as dataLoadingRefreshStories from './DataGrid.DataLoading.Refresh.stories'
import refreshMeta, {
  RefreshPlayground,
} from './DataGrid.DataLoading.Refresh.stories'
import coreStubsMeta, { StubsPlayground } from './DataGrid.Core.Stubs.stories'
import dataMeta, { Grouped } from './DataGrid.Data.stories'
import exportMeta, { ExportStatePanel } from './DataGrid.Export.stories'
import filteringMeta, {
  FilteringStateText,
  FilteringStateDate,
  FilteringStateOptions,
} from './DataGrid.Filtering.stories'
import panelsPaginationMeta, {
  PaginationPlayground,
} from './DataGrid.Panels.Pagination.stories'
import panelsStatusBarMeta, {
  StatusBarPlayground,
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
 * Без эмуляции близнец повторяет исходную историю: раздел — в Common и в сборке для
 * Chromatic, в публичном Storybook его нет (ADR 0117 §8).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Common/High contrast',
  tags: ['done'],
} satisfies Meta<StoryProps>

export default meta

const twin = <S extends TwinSource>(source: TwinSource, story: S) =>
  forced(source, story, meta)

/** Близнец шага `step` истории сценария (ADR 0130, DG3). */
const twinStep = <S extends TwinSource>(
  module: { default: TwinSource },
  story: S,
  step: number,
) => forcedStep(module.default, story, step, meta)

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

export const HighContrastHeaderGroupsPlayground = {
  ...twin(columnsHeaderGroupsMeta, HeaderGroupsPlayground),
  name: 'Columns/Header groups — Playground',
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

export const HighContrastFooterPlayground = {
  ...twin(coreFooterMeta, FooterPlayground),
  name: 'Core/Footer — Playground',
  tags: ['!test'],
}

export const HighContrastSkeletonPlayground = {
  ...twin(coreSkeletonMeta, SkeletonPlayground),
  name: 'Data loading/Skeleton — Playground',
  tags: ['!test'],
}

export const HighContrastRefreshPlayground = {
  ...twin(refreshMeta, RefreshPlayground),
  name: 'Data loading/Refresh — Playground',
  tags: ['!test'],
}

export const HighContrastCoreStateHoveredRow = {
  ...twin(catalogStatesMeta, CoreStateHoveredRow),
  name: 'Common/Catalog states — State: hovered row',
  tags: ['!test'],
}

export const HighContrastColumnsStateResizeHandle = {
  ...twin(catalogStatesMeta, ColumnsStateResizeHandle),
  name: 'Common/Catalog states — State: resize handle',
  tags: ['!test'],
}

export const HighContrastStubsPlayground = {
  ...twin(coreStubsMeta, StubsPlayground),
  name: 'Core/Stubs — Playground',
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

export const HighContrastPaginationPlayground = {
  ...twin(panelsPaginationMeta, PaginationPlayground),
  name: 'Panels/Pagination — Playground',
  tags: ['!test'],
}

export const HighContrastStatusBarPlayground = {
  ...twin(panelsStatusBarMeta, StatusBarPlayground),
  name: 'Panels/Status bar — Playground',
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

// --- Шаги гайдов (ADR 0130, DG3): близнец у каждого шага каждого гайда ---

export const HighContrastCellSelectionByCommandStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionByCommand,
    1,
  ),
  name: 'Cells/Selection — By command, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionByCommandStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionByCommand,
    2,
  ),
  name: 'Cells/Selection — By command, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionByCommandStep3 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionByCommand,
    3,
  ),
  name: 'Cells/Selection — By command, шаг 3',
  tags: ['!test'],
}

export const HighContrastSortingExternalControlsStep1 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.SortingExternalControls,
    1,
  ),
  name: 'Columns/Sorting — External controls, шаг 1',
  tags: ['!test'],
}

export const HighContrastSortingExternalControlsStep2 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.SortingExternalControls,
    2,
  ),
  name: 'Columns/Sorting — External controls, шаг 2',
  tags: ['!test'],
}

export const HighContrastSortingExternalControlsStep3 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.SortingExternalControls,
    3,
  ),
  name: 'Columns/Sorting — External controls, шаг 3',
  tags: ['!test'],
}

export const HighContrastPinnedFooterStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.PinnedFooter, 1),
  name: 'Core/Footer — Pinned, шаг 1',
  tags: ['!test'],
}

export const HighContrastPinnedFooterStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.PinnedFooter, 2),
  name: 'Core/Footer — Pinned, шаг 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooter, 1),
  name: 'Core/Footer — Inline, шаг 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooter, 2),
  name: 'Core/Footer — Inline, шаг 2',
  tags: ['!test'],
}

export const HighContrastFooterPositionSwitchStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterPositionSwitch, 1),
  name: 'Core/Footer — Position switch, шаг 1',
  tags: ['!test'],
}

export const HighContrastFooterPositionSwitchStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterPositionSwitch, 2),
  name: 'Core/Footer — Position switch, шаг 2',
  tags: ['!test'],
}

export const HighContrastFooterKeyboardStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterKeyboard, 1),
  name: 'Core/Footer — Keyboard, шаг 1',
  tags: ['!test'],
}

export const HighContrastFooterKeyboardStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterKeyboard, 2),
  name: 'Core/Footer — Keyboard, шаг 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterInfiniteScrollStep1 = {
  ...twinStep(
    coreFooterStories,
    coreFooterStories.InlineFooterInfiniteScroll,
    1,
  ),
  name: 'Core/Footer — Inline — infinite scroll, шаг 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterInfiniteScrollStep2 = {
  ...twinStep(
    coreFooterStories,
    coreFooterStories.InlineFooterInfiniteScroll,
    2,
  ),
  name: 'Core/Footer — Inline — infinite scroll, шаг 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterPaginationStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterPagination, 1),
  name: 'Core/Footer — Inline — pagination, шаг 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterPaginationStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterPagination, 2),
  name: 'Core/Footer — Inline — pagination, шаг 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterScrollToRowStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterScrollToRow, 1),
  name: 'Core/Footer — Inline — scroll to row, шаг 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterScrollToRowStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterScrollToRow, 2),
  name: 'Core/Footer — Inline — scroll to row, шаг 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterEmptySearchStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterEmptySearch, 1),
  name: 'Core/Footer — Inline — empty search, шаг 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterEmptySearchStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterEmptySearch, 2),
  name: 'Core/Footer — Inline — empty search, шаг 2',
  tags: ['!test'],
}

export const HighContrastFooterAutoHeightStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterAutoHeight, 1),
  name: 'Core/Footer — Auto height, шаг 1',
  tags: ['!test'],
}

export const HighContrastFooterAutoHeightStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterAutoHeight, 2),
  name: 'Core/Footer — Auto height, шаг 2',
  tags: ['!test'],
}

export const HighContrastSizingFixedHeightStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFixedHeight, 1),
  name: 'Core/Sizing — Fixed height, шаг 1',
  tags: ['!test'],
}

export const HighContrastSizingFixedHeightStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFixedHeight, 2),
  name: 'Core/Sizing — Fixed height, шаг 2',
  tags: ['!test'],
}

export const HighContrastSizingFillContainerStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFillContainer, 1),
  name: 'Core/Sizing — Fill container, шаг 1',
  tags: ['!test'],
}

export const HighContrastSizingFillContainerStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFillContainer, 2),
  name: 'Core/Sizing — Fill container, шаг 2',
  tags: ['!test'],
}

export const HighContrastSizingFillContainerStep3 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFillContainer, 3),
  name: 'Core/Sizing — Fill container, шаг 3',
  tags: ['!test'],
}

export const HighContrastSizingFlexLayoutStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFlexLayout, 1),
  name: 'Core/Sizing — Flex layout, шаг 1',
  tags: ['!test'],
}

export const HighContrastSizingFlexLayoutStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFlexLayout, 2),
  name: 'Core/Sizing — Flex layout, шаг 2',
  tags: ['!test'],
}

export const HighContrastSizingContentHeightStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingContentHeight, 1),
  name: 'Core/Sizing — Content height, шаг 1',
  tags: ['!test'],
}

export const HighContrastSizingContentHeightStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingContentHeight, 2),
  name: 'Core/Sizing — Content height, шаг 2',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 1),
  name: 'Core/Sizing — Row height, шаг 1',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 2),
  name: 'Core/Sizing — Row height, шаг 2',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep3 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 3),
  name: 'Core/Sizing — Row height, шаг 3',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep4 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 4),
  name: 'Core/Sizing — Row height, шаг 4',
  tags: ['!test'],
}

export const HighContrastSizingHeaderHeightStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingHeaderHeight, 1),
  name: 'Core/Sizing — Header height, шаг 1',
  tags: ['!test'],
}

export const HighContrastSizingHeaderHeightStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingHeaderHeight, 2),
  name: 'Core/Sizing — Header height, шаг 2',
  tags: ['!test'],
}

export const HighContrastResizingDefaultColumnWidthStep1 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingDefaultColumnWidth,
    1,
  ),
  name: 'Columns/Resizing — Default column width, шаг 1',
  tags: ['!test'],
}

export const HighContrastResizingDefaultColumnWidthStep2 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingDefaultColumnWidth,
    2,
  ),
  name: 'Columns/Resizing — Default column width, шаг 2',
  tags: ['!test'],
}

export const HighContrastResizingDefaultColumnWidthStep3 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingDefaultColumnWidth,
    3,
  ),
  name: 'Columns/Resizing — Default column width, шаг 3',
  tags: ['!test'],
}

export const HighContrastSizingThemeTokensStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingThemeTokens, 1),
  name: 'Core/Sizing — Theme tokens, шаг 1',
  tags: ['!test'],
}

export const HighContrastSizingThemeTokensStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingThemeTokens, 2),
  name: 'Core/Sizing — Theme tokens, шаг 2',
  tags: ['!test'],
}

export const HighContrastSizingThemeTokensStep3 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingThemeTokens, 3),
  name: 'Core/Sizing — Theme tokens, шаг 3',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastEnableStep1 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastEnable,
    1,
  ),
  name: 'Customization/Increased contrast — Enable increased contrast, шаг 1',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastEnableStep2 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastEnable,
    2,
  ),
  name: 'Customization/Increased contrast — Enable increased contrast, шаг 2',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastEnableStep3 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastEnable,
    3,
  ),
  name: 'Customization/Increased contrast — Enable increased contrast, шаг 3',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastEnableStep4 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastEnable,
    4,
  ),
  name: 'Customization/Increased contrast — Enable increased contrast, шаг 4',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastRecipeStep1 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastRecipe,
    1,
  ),
  name: 'Customization/Increased contrast — Own levers and palette, шаг 1',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastRecipeStep2 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastRecipe,
    2,
  ),
  name: 'Customization/Increased contrast — Own levers and palette, шаг 2',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep1 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 1),
  name: 'Data loading/Skeleton — Data arrives, шаг 1',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep2 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 2),
  name: 'Data loading/Skeleton — Data arrives, шаг 2',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep3 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 3),
  name: 'Data loading/Skeleton — Data arrives, шаг 3',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep4 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 4),
  name: 'Data loading/Skeleton — Data arrives, шаг 4',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep5 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 5),
  name: 'Data loading/Skeleton — Data arrives, шаг 5',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep6 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 6),
  name: 'Data loading/Skeleton — Data arrives, шаг 6',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep1 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 1),
  name: 'Data loading/Skeleton — Rows count, шаг 1',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep2 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 2),
  name: 'Data loading/Skeleton — Rows count, шаг 2',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep3 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 3),
  name: 'Data loading/Skeleton — Rows count, шаг 3',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep4 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 4),
  name: 'Data loading/Skeleton — Rows count, шаг 4',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep5 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 5),
  name: 'Data loading/Skeleton — Rows count, шаг 5',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep6 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 6),
  name: 'Data loading/Skeleton — Rows count, шаг 6',
  tags: ['!test'],
}

export const HighContrastSkeletonColumnsCountStep1 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonColumnsCount, 1),
  name: 'Data loading/Skeleton — Columns count, шаг 1',
  tags: ['!test'],
}

export const HighContrastSkeletonColumnsCountStep2 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonColumnsCount, 2),
  name: 'Data loading/Skeleton — Columns count, шаг 2',
  tags: ['!test'],
}

export const HighContrastSkeletonColumnsCountStep3 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonColumnsCount, 3),
  name: 'Data loading/Skeleton — Columns count, шаг 3',
  tags: ['!test'],
}

export const HighContrastStubsNoColumnsStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsNoColumns, 1),
  name: 'Core/Stubs — No columns, шаг 1',
  tags: ['!test'],
}

export const HighContrastStubsNoColumnsStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsNoColumns, 2),
  name: 'Core/Stubs — No columns, шаг 2',
  tags: ['!test'],
}

export const HighContrastStubsColumnsHiddenStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsColumnsHidden, 1),
  name: 'Core/Stubs — All columns hidden, шаг 1',
  tags: ['!test'],
}

export const HighContrastStubsColumnsHiddenStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsColumnsHidden, 2),
  name: 'Core/Stubs — All columns hidden, шаг 2',
  tags: ['!test'],
}

export const HighContrastStubsNoDataStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsNoData, 1),
  name: 'Core/Stubs — No data, шаг 1',
  tags: ['!test'],
}

export const HighContrastStubsNoDataStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsNoData, 2),
  name: 'Core/Stubs — No data, шаг 2',
  tags: ['!test'],
}

export const HighContrastStubsPluginReasonStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsPluginReason, 1),
  name: 'Core/Stubs — Plugin reason, шаг 1',
  tags: ['!test'],
}

export const HighContrastStubsPluginReasonStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsPluginReason, 2),
  name: 'Core/Stubs — Plugin reason, шаг 2',
  tags: ['!test'],
}

export const HighContrastExportOwnButtonStep1 = {
  ...twinStep(exportStories, exportStories.ExportOwnButton, 1),
  name: 'Export — Own button, шаг 1',
  tags: ['!test'],
}

export const HighContrastExportOwnButtonStep2 = {
  ...twinStep(exportStories, exportStories.ExportOwnButton, 2),
  name: 'Export — Own button, шаг 2',
  tags: ['!test'],
}

export const HighContrastExportServerInitialLoadingStep1 = {
  ...twinStep(exportStories, exportStories.ExportServerInitialLoading, 1),
  name: 'Export — Server, initial loading, шаг 1',
  tags: ['!test'],
}

export const HighContrastExportServerInitialLoadingStep2 = {
  ...twinStep(exportStories, exportStories.ExportServerInitialLoading, 2),
  name: 'Export — Server, initial loading, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringExternalFormStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringExternalForm, 1),
  name: 'Filtering — External form, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringExternalFormStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringExternalForm, 2),
  name: 'Filtering — External form, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringExternalFormStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringExternalForm, 3),
  name: 'Filtering — External form, шаг 3',
  tags: ['!test'],
}

export const HighContrastSavedViewRestoreStep1 = {
  ...twinStep(filteringStories, filteringStories.SavedViewRestore, 1),
  name: 'Filtering — Saved view, шаг 1',
  tags: ['!test'],
}

export const HighContrastSavedViewRestoreStep2 = {
  ...twinStep(filteringStories, filteringStories.SavedViewRestore, 2),
  name: 'Filtering — Saved view, шаг 2',
  tags: ['!test'],
}

export const HighContrastSavedViewRestoreStep3 = {
  ...twinStep(filteringStories, filteringStories.SavedViewRestore, 3),
  name: 'Filtering — Saved view, шаг 3',
  tags: ['!test'],
}

export const HighContrastPaginationOwnPagerStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationOwnPager,
    1,
  ),
  name: 'Panels/Pagination — Own pager, шаг 1',
  tags: ['!test'],
}

export const HighContrastPaginationOwnPagerStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationOwnPager,
    2,
  ),
  name: 'Panels/Pagination — Own pager, шаг 2',
  tags: ['!test'],
}

export const HighContrastPaginationOwnPagerStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationOwnPager,
    3,
  ),
  name: 'Panels/Pagination — Own pager, шаг 3',
  tags: ['!test'],
}

export const HighContrastToolbarInitialLoadingStep1 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarInitialLoading,
    1,
  ),
  name: 'Panels/Toolbar — Initial loading, шаг 1',
  tags: ['!test'],
}

export const HighContrastToolbarInitialLoadingStep2 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarInitialLoading,
    2,
  ),
  name: 'Panels/Toolbar — Initial loading, шаг 2',
  tags: ['!test'],
}

export const HighContrastToolbarSearchBeforeDataServerStep1 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarSearchBeforeDataServer,
    1,
  ),
  name: 'Panels/Toolbar — Search before data (server), шаг 1',
  tags: ['!test'],
}

export const HighContrastToolbarSearchBeforeDataServerStep2 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarSearchBeforeDataServer,
    2,
  ),
  name: 'Panels/Toolbar — Search before data (server), шаг 2',
  tags: ['!test'],
}

export const HighContrastToolbarSearchBeforeDataServerStep3 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarSearchBeforeDataServer,
    3,
  ),
  name: 'Panels/Toolbar — Search before data (server), шаг 3',
  tags: ['!test'],
}

export const HighContrastToolbarColumnsArriveStep1 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarColumnsArrive,
    1,
  ),
  name: 'Panels/Toolbar — Columns arrive, шаг 1',
  tags: ['!test'],
}

export const HighContrastToolbarColumnsArriveStep2 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarColumnsArrive,
    2,
  ),
  name: 'Panels/Toolbar — Columns arrive, шаг 2',
  tags: ['!test'],
}

export const HighContrastToolbarColumnsArriveStep3 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarColumnsArrive,
    3,
  ),
  name: 'Panels/Toolbar — Columns arrive, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiDebugActionsStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiDebugActions, 1),
  name: 'Plugin API — Debug actions, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiDebugActionsStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiDebugActions, 2),
  name: 'Plugin API — Debug actions, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiDebugActionsStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiDebugActions, 3),
  name: 'Plugin API — Debug actions, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiReportActionStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReportAction, 1),
  name: 'Plugin API — Report action, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiReportActionStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReportAction, 2),
  name: 'Plugin API — Report action, шаг 2',
  tags: ['!test'],
}

export const HighContrastGroupingByApplicationStep1 = {
  ...twinStep(
    rowsGroupingStories,
    rowsGroupingStories.GroupingByApplication,
    1,
  ),
  name: 'Rows/Grouping — By application, шаг 1',
  tags: ['!test'],
}

export const HighContrastGroupingByApplicationStep2 = {
  ...twinStep(
    rowsGroupingStories,
    rowsGroupingStories.GroupingByApplication,
    2,
  ),
  name: 'Rows/Grouping — By application, шаг 2',
  tags: ['!test'],
}

export const HighContrastGroupingByApplicationStep3 = {
  ...twinStep(
    rowsGroupingStories,
    rowsGroupingStories.GroupingByApplication,
    3,
  ),
  name: 'Rows/Grouping — By application, шаг 3',
  tags: ['!test'],
}

export const HighContrastSelectionByRowClickStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionByRowClick,
    1,
  ),
  name: 'Rows/Selection — By row click, шаг 1',
  tags: ['!test'],
}

export const HighContrastSelectionByRowClickStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionByRowClick,
    2,
  ),
  name: 'Rows/Selection — By row click, шаг 2',
  tags: ['!test'],
}

export const HighContrastSelectionByRowClickStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionByRowClick,
    3,
  ),
  name: 'Rows/Selection — By row click, шаг 3',
  tags: ['!test'],
}

export const HighContrastTreeDataReadOnlyStep1 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataReadOnly, 1),
  name: 'Rows/Tree data — Read only, шаг 1',
  tags: ['!test'],
}

export const HighContrastTreeDataReadOnlyStep2 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataReadOnly, 2),
  name: 'Rows/Tree data — Read only, шаг 2',
  tags: ['!test'],
}

export const HighContrastTreeDataReadOnlyStep3 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataReadOnly, 3),
  name: 'Rows/Tree data — Read only, шаг 3',
  tags: ['!test'],
}

export const HighContrastTreeDataWithToggleStep1 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataWithToggle, 1),
  name: 'Rows/Tree data — With toggle, шаг 1',
  tags: ['!test'],
}

export const HighContrastTreeDataWithToggleStep2 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataWithToggle, 2),
  name: 'Rows/Tree data — With toggle, шаг 2',
  tags: ['!test'],
}

export const HighContrastTreeDataWithToggleStep3 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataWithToggle, 3),
  name: 'Rows/Tree data — With toggle, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep1 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 1),
  name: 'Rows/Dragging — Move, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep2 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 2),
  name: 'Rows/Dragging — Move, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep3 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 3),
  name: 'Rows/Dragging — Move, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep4 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 4),
  name: 'Rows/Dragging — Move, шаг 4',
  tags: ['!test'],
}

export const HighContrastRowDraggingCollapsedGroupsStep1 = {
  ...twinStep(
    rowsDraggingStories,
    rowsDraggingStories.RowDraggingCollapsedGroups,
    1,
  ),
  name: 'Rows/Dragging — Collapsed groups, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowDraggingCollapsedGroupsStep2 = {
  ...twinStep(
    rowsDraggingStories,
    rowsDraggingStories.RowDraggingCollapsedGroups,
    2,
  ),
  name: 'Rows/Dragging — Collapsed groups, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowDraggingCollapsedGroupsStep3 = {
  ...twinStep(
    rowsDraggingStories,
    rowsDraggingStories.RowDraggingCollapsedGroups,
    3,
  ),
  name: 'Rows/Dragging — Collapsed groups, шаг 3',
  tags: ['!test'],
}

export const HighContrastColumnDraggingMoveStep1 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingMove,
    1,
  ),
  name: 'Columns/Dragging — Move, шаг 1',
  tags: ['!test'],
}

export const HighContrastColumnDraggingMoveStep2 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingMove,
    2,
  ),
  name: 'Columns/Dragging — Move, шаг 2',
  tags: ['!test'],
}

export const HighContrastColumnDraggingMoveStep3 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingMove,
    3,
  ),
  name: 'Columns/Dragging — Move, шаг 3',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep1 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    1,
  ),
  name: 'Columns/Dragging — Dragging — Server, шаг 1',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep2 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    2,
  ),
  name: 'Columns/Dragging — Dragging — Server, шаг 2',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep3 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    3,
  ),
  name: 'Columns/Dragging — Dragging — Server, шаг 3',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep4 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    4,
  ),
  name: 'Columns/Dragging — Dragging — Server, шаг 4',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep5 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    5,
  ),
  name: 'Columns/Dragging — Dragging — Server, шаг 5',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep1 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 1),
  name: 'Rows/Dragging — Lazy tree (server), шаг 1',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep2 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 2),
  name: 'Rows/Dragging — Lazy tree (server), шаг 2',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep3 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 3),
  name: 'Rows/Dragging — Lazy tree (server), шаг 3',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep4 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 4),
  name: 'Rows/Dragging — Lazy tree (server), шаг 4',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep5 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 5),
  name: 'Rows/Dragging — Lazy tree (server), шаг 5',
  tags: ['!test'],
}

export const HighContrastLocalizationFromJsonStep1 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFromJson,
    1,
  ),
  name: 'Customization/Localization — From JSON, шаг 1',
  tags: ['!test'],
}

export const HighContrastLocalizationFromJsonStep2 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFromJson,
    2,
  ),
  name: 'Customization/Localization — From JSON, шаг 2',
  tags: ['!test'],
}

export const HighContrastLocalizationFromJsonStep3 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFromJson,
    3,
  ),
  name: 'Customization/Localization — From JSON, шаг 3',
  tags: ['!test'],
}

export const HighContrastLocalizationFromJsonStep4 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFromJson,
    4,
  ),
  name: 'Customization/Localization — From JSON, шаг 4',
  tags: ['!test'],
}

export const HighContrastLocalizationSwitchStep1 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationSwitch,
    1,
  ),
  name: 'Customization/Localization — Switch language, шаг 1',
  tags: ['!test'],
}

export const HighContrastLocalizationSwitchStep2 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationSwitch,
    2,
  ),
  name: 'Customization/Localization — Switch language, шаг 2',
  tags: ['!test'],
}

export const HighContrastLocalizationOverridesStep1 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationOverrides,
    1,
  ),
  name: 'Customization/Localization — Own wording, шаг 1',
  tags: ['!test'],
}

export const HighContrastLocalizationOverridesStep2 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationOverrides,
    2,
  ),
  name: 'Customization/Localization — Own wording, шаг 2',
  tags: ['!test'],
}

export const HighContrastLocalizationFunctionStep1 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFunction,
    1,
  ),
  name: 'Customization/Localization — Function label, шаг 1',
  tags: ['!test'],
}

export const HighContrastLocalizationFunctionStep2 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFunction,
    2,
  ),
  name: 'Customization/Localization — Function label, шаг 2',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep1 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    1,
  ),
  name: 'Columns/Visibility — Toggle all, шаг 1',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep2 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    2,
  ),
  name: 'Columns/Visibility — Toggle all, шаг 2',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep3 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    3,
  ),
  name: 'Columns/Visibility — Toggle all, шаг 3',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep4 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    4,
  ),
  name: 'Columns/Visibility — Toggle all, шаг 4',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityNestedTreeStep1 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityNestedTree,
    1,
  ),
  name: 'Columns/Visibility — Nested headers, шаг 1',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityNestedTreeStep2 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityNestedTree,
    2,
  ),
  name: 'Columns/Visibility — Nested headers, шаг 2',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityNestedTreeStep3 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityNestedTree,
    3,
  ),
  name: 'Columns/Visibility — Nested headers, шаг 3',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefreshStep1 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorRefresh, 1),
  name: 'Data loading/Load error — Refresh error, шаг 1',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefreshStep2 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorRefresh, 2),
  name: 'Data loading/Load error — Refresh error, шаг 2',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefreshStep3 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorRefresh, 3),
  name: 'Data loading/Load error — Refresh error, шаг 3',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefreshStep4 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorRefresh, 4),
  name: 'Data loading/Load error — Refresh error, шаг 4',
  tags: ['!test'],
}

export const HighContrastLoadErrorFirstLoadStep1 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorFirstLoad, 1),
  name: 'Data loading/Load error — First load error, шаг 1',
  tags: ['!test'],
}

export const HighContrastLoadErrorFirstLoadStep2 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorFirstLoad, 2),
  name: 'Data loading/Load error — First load error, шаг 2',
  tags: ['!test'],
}

export const HighContrastLoadErrorFirstLoadStep3 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorFirstLoad, 3),
  name: 'Data loading/Load error — First load error, шаг 3',
  tags: ['!test'],
}

export const HighContrastRefreshDataUpdateStep1 = {
  ...twinStep(
    dataLoadingRefreshStories,
    dataLoadingRefreshStories.RefreshDataUpdate,
    1,
  ),
  name: 'Data loading/Refresh — Data update, шаг 1',
  tags: ['!test'],
}

export const HighContrastRefreshDataUpdateStep2 = {
  ...twinStep(
    dataLoadingRefreshStories,
    dataLoadingRefreshStories.RefreshDataUpdate,
    2,
  ),
  name: 'Data loading/Refresh — Data update, шаг 2',
  tags: ['!test'],
}

export const HighContrastRefreshDataUpdateStep3 = {
  ...twinStep(
    dataLoadingRefreshStories,
    dataLoadingRefreshStories.RefreshDataUpdate,
    3,
  ),
  name: 'Data loading/Refresh — Data update, шаг 3',
  tags: ['!test'],
}

export const HighContrastIconsOwnSetStep1 = {
  ...twinStep(
    customizationIconsStories,
    customizationIconsStories.IconsOwnSet,
    1,
  ),
  name: 'Customization/Icons — Own icons, шаг 1',
  tags: ['!test'],
}

export const HighContrastIconsOwnSetStep2 = {
  ...twinStep(
    customizationIconsStories,
    customizationIconsStories.IconsOwnSet,
    2,
  ),
  name: 'Customization/Icons — Own icons, шаг 2',
  tags: ['!test'],
}

export const HighContrastLongTextCellsStep1 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextCells, 1),
  name: 'Core/Long text — Cells, шаг 1',
  tags: ['!test'],
}

export const HighContrastLongTextCellsStep2 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextCells, 2),
  name: 'Core/Long text — Cells, шаг 2',
  tags: ['!test'],
}

export const HighContrastLongTextMenusStep1 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextMenus, 1),
  name: 'Core/Long text — Menus and panels, шаг 1',
  tags: ['!test'],
}

export const HighContrastLongTextMenusStep2 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextMenus, 2),
  name: 'Core/Long text — Menus and panels, шаг 2',
  tags: ['!test'],
}

export const HighContrastHeaderGroupedStep1 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGrouped,
    1,
  ),
  name: 'Columns/Header groups — Grouped columns, шаг 1',
  tags: ['!test'],
}

export const HighContrastHeaderGroupedStep2 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGrouped,
    2,
  ),
  name: 'Columns/Header groups — Grouped columns, шаг 2',
  tags: ['!test'],
}

export const HighContrastHeaderGroupedStep3 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGrouped,
    3,
  ),
  name: 'Columns/Header groups — Grouped columns, шаг 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuInMenuStep1 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuInMenu,
    1,
  ),
  name: 'Columns/Header menu — Actions in menu, шаг 1',
  tags: ['!test'],
}

export const HighContrastHeaderMenuInMenuStep2 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuInMenu,
    2,
  ),
  name: 'Columns/Header menu — Actions in menu, шаг 2',
  tags: ['!test'],
}

export const HighContrastHeaderMenuInMenuStep3 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuInMenu,
    3,
  ),
  name: 'Columns/Header menu — Actions in menu, шаг 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuInMenuStep4 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuInMenu,
    4,
  ),
  name: 'Columns/Header menu — Actions in menu, шаг 4',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep1 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    1,
  ),
  name: 'Columns/Header menu — Active actions, шаг 1',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep2 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    2,
  ),
  name: 'Columns/Header menu — Active actions, шаг 2',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep3 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    3,
  ),
  name: 'Columns/Header menu — Active actions, шаг 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep4 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    4,
  ),
  name: 'Columns/Header menu — Active actions, шаг 4',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep5 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    5,
  ),
  name: 'Columns/Header menu — Active actions, шаг 5',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep6 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    6,
  ),
  name: 'Columns/Header menu — Active actions, шаг 6',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep1 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    1,
  ),
  name: 'Columns/Header menu — Async actions, шаг 1',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep2 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    2,
  ),
  name: 'Columns/Header menu — Async actions, шаг 2',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep3 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    3,
  ),
  name: 'Columns/Header menu — Async actions, шаг 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep4 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    4,
  ),
  name: 'Columns/Header menu — Async actions, шаг 4',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep5 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    5,
  ),
  name: 'Columns/Header menu — Async actions, шаг 5',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep1 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 1),
  name: 'Columns/Pinning — Pin columns, шаг 1',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep2 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 2),
  name: 'Columns/Pinning — Pin columns, шаг 2',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep3 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 3),
  name: 'Columns/Pinning — Pin columns, шаг 3',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep4 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 4),
  name: 'Columns/Pinning — Pin columns, шаг 4',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep5 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 5),
  name: 'Columns/Pinning — Pin columns, шаг 5',
  tags: ['!test'],
}

export const HighContrastPinningNestedStep1 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningNested, 1),
  name: 'Columns/Pinning — Header groups, шаг 1',
  tags: ['!test'],
}

export const HighContrastPinningNestedStep2 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningNested, 2),
  name: 'Columns/Pinning — Header groups, шаг 2',
  tags: ['!test'],
}

export const HighContrastPinningNestedStep3 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningNested, 3),
  name: 'Columns/Pinning — Header groups, шаг 3',
  tags: ['!test'],
}

export const HighContrastResizingColumnsStep1 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingColumns,
    1,
  ),
  name: 'Columns/Resizing — Resize columns, шаг 1',
  tags: ['!test'],
}

export const HighContrastResizingColumnsStep2 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingColumns,
    2,
  ),
  name: 'Columns/Resizing — Resize columns, шаг 2',
  tags: ['!test'],
}

export const HighContrastResizingColumnsStep3 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingColumns,
    3,
  ),
  name: 'Columns/Resizing — Resize columns, шаг 3',
  tags: ['!test'],
}

export const HighContrastDraggingNestedStep1 = {
  ...twinStep(columnsDraggingStories, columnsDraggingStories.DraggingNested, 1),
  name: 'Columns/Dragging — Header groups, шаг 1',
  tags: ['!test'],
}

export const HighContrastDraggingNestedStep2 = {
  ...twinStep(columnsDraggingStories, columnsDraggingStories.DraggingNested, 2),
  name: 'Columns/Dragging — Header groups, шаг 2',
  tags: ['!test'],
}

export const HighContrastDraggingNestedStep3 = {
  ...twinStep(columnsDraggingStories, columnsDraggingStories.DraggingNested, 3),
  name: 'Columns/Dragging — Header groups, шаг 3',
  tags: ['!test'],
}

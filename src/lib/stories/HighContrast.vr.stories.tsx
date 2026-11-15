import { Meta } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { type TwinSource, forced } from './__mocks__/catalog'
import { forcedStep } from './__mocks__/catalogPlay'
import * as cellsActionStatusStories from './DataGrid.Cells.ActionStatus.stories'
import * as cellsSelectionStories from './DataGrid.Cells.Selection.stories'
import * as columnsSortingStories from './DataGrid.Columns.Sorting.stories'
import * as coreColumnTotalsStories from './DataGrid.Core.ColumnTotals.stories'
import * as columnsSummaryStories from './DataGrid.Columns.Summary.stories'
import * as coreFooterStories from './DataGrid.Core.Footer.stories'
import * as customizationLocalizationStories from './Customization.Localization.stories'
import * as coreIncreasedContrastStories from './Customization.IncreasedContrast.stories'
import * as themingStories from './Theming.stories'
import * as uiPopupAssembledStories from './UI.PopupAssembled.stories'
import * as coreSizingStories from './DataGrid.Core.Sizing.stories'
import * as coreSkeletonStories from './DataGrid.DataLoading.Skeleton.stories'
import * as coreStubsStories from './DataGrid.Core.Stubs.stories'
import * as exportStories from './DataGrid.Export.stories'
import * as filteringStories from './DataGrid.Filtering.stories'
import * as panelsPaginationStories from './DataGrid.Panels.Pagination.stories'
import * as panelsToolbarStories from './DataGrid.Panels.Toolbar.stories'
import * as panelsViewSettingsStories from './DataGrid.Panels.ViewSettings.stories'
import panelsFailureLogMeta, * as panelsFailureLogStories from './DataGrid.Panels.FailureLog.stories'
import panelsUnsavedChangesMeta, * as panelsUnsavedChangesStories from './DataGrid.Panels.UnsavedChanges.stories'
import rowsEditingMeta, * as rowsEditingStories from './DataGrid.Rows.Editing.stories'
import * as pluginApiStories from './DataGrid.PluginApi.stories'
import * as infiniteScrollStories from './DataGrid.DataLoading.InfiniteScroll.stories'
import * as serverRowModelStories from './DataGrid.DataLoading.ServerRowModel.stories'
import * as serverGroupingStories from './DataGrid.DataLoading.ServerRowModel.Grouping.stories'
import * as serverExportStories from './DataGrid.DataLoading.ServerRowModel.Export.stories'
import * as serverSelectionStories from './DataGrid.DataLoading.ServerRowModel.Selection.stories'
import * as serverCellSelectionStories from './DataGrid.DataLoading.ServerRowModel.CellSelection.stories'
import * as serverEditingStories from './DataGrid.DataLoading.ServerRowModel.Editing.stories'
import * as serverTransactionsStories from './DataGrid.DataLoading.ServerRowModel.Transactions.stories'
import * as clientTransactionsStories from './DataGrid.DataLoading.ClientTransactions.stories'
import * as clientRowModelStories from './DataGrid.DataLoading.ClientRowModel.stories'
import * as serverPaginationStories from './DataGrid.DataLoading.ServerRowModel.Pagination.stories'
import * as serverDraggingStories from './DataGrid.DataLoading.ServerRowModel.Dragging.stories'
import * as serverLazyChildrenStories from './DataGrid.DataLoading.ServerRowModel.LazyChildren.stories'
import * as columnsDraggingStories from './DataGrid.Columns.Dragging.stories'
import * as columnsResizingStories from './DataGrid.Columns.Resizing.stories'
import * as columnsFlexWidthStories from './DataGrid.Columns.FlexWidth.stories'
import * as columnsTextWrapStories from './DataGrid.Columns.TextWrap.stories'
import * as rowsDraggingStories from './DataGrid.Rows.Dragging.stories'
import * as rowsGroupingStories from './DataGrid.Rows.Grouping.stories'
import * as rowsSelectionStories from './DataGrid.Rows.Selection.stories'
import * as rowsTreeDataStories from './DataGrid.Rows.TreeData.stories'
import * as cellsContextMenuStories from './DataGrid.Cells.ContextMenu.stories'
import * as cellsEditingStories from './DataGrid.Cells.Editing.stories'
import * as cellsPasteFillStories from './DataGrid.Cells.PasteFill.stories'
import * as cellsUndoRedoStories from './DataGrid.Cells.UndoRedo.stories'
import * as columnsDataTypesStories from './DataGrid.Columns.DataTypes.stories'
import * as columnsDataTypesBooleanStories from './DataGrid.Columns.DataTypes.Boolean.stories'
import * as columnsDataTypesDateStories from './DataGrid.Columns.DataTypes.Date.stories'
import * as columnsDataTypesDateTimeStories from './DataGrid.Columns.DataTypes.DateTime.stories'
import * as columnsDataTypesDecimalStringStories from './DataGrid.Columns.DataTypes.DecimalString.stories'
import * as columnsDataTypesMultiSelectStories from './DataGrid.Columns.DataTypes.MultiSelect.stories'
import * as columnsDataTypesNumberStories from './DataGrid.Columns.DataTypes.Number.stories'
import * as columnsDataTypesObjectStories from './DataGrid.Columns.DataTypes.Object.stories'
import * as columnsDataTypesSelectStories from './DataGrid.Columns.DataTypes.Select.stories'
import * as columnsDataTypesTextStories from './DataGrid.Columns.DataTypes.Text.stories'
import * as cellsErrorsStories from './DataGrid.Cells.Errors.stories'
import * as cellsKeyboardStories from './DataGrid.Cells.Keyboard.stories'
import columnsHeaderGroupsMeta, {
  HeaderGroupsPlayground,
} from './DataGrid.Columns.HeaderGroups.stories'
import * as columnsHeaderGroupsStories from './DataGrid.Columns.HeaderGroups.stories'
import * as columnsHeaderMenuStories from './DataGrid.Columns.HeaderMenu.stories'
import * as columnsPinningStories from './DataGrid.Columns.Pinning.stories'
import * as columnsVisibilityStories from './DataGrid.Columns.Visibility.stories'
import * as coreLongTextStories from './DataGrid.Core.LongText.stories'
import coreFooterMeta, {
  FooterPlayground,
} from './DataGrid.Core.Footer.stories'
import * as coreLoadErrorStories from './DataGrid.DataLoading.LoadError.stories'
import * as dataLoadingServerActionsStories from './DataGrid.DataLoading.ServerActions.stories'
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
import panelsPaginationMeta, {
  PaginationPlayground,
} from './DataGrid.Panels.Pagination.stories'
import panelsStatusBarMeta, {
  StatusBarPlayground,
} from './DataGrid.Panels.StatusBar.stories'
import * as panelsStatusBarStories from './DataGrid.Panels.StatusBar.stories'
import panelsToolbarMeta, {
  ToolbarPlayground,
} from './DataGrid.Panels.Toolbar.stories'
import * as rowsActionsStories from './DataGrid.Rows.Actions.stories'
import * as rowsExpandingStories from './DataGrid.Rows.Expanding.stories'
import * as rowsBackToTopStories from './DataGrid.Rows.BackToTop.stories'
import * as rowsHighlightStories from './DataGrid.Rows.Highlight.stories'
import * as rowsMotionStories from './DataGrid.Rows.Motion.stories'
import * as rowsScrollToRowStories from './DataGrid.Rows.ScrollToRow.stories'
import * as cellsValueChangeFlashStories from './DataGrid.Cells.ValueChangeFlash.stories'

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

export const HighContrastKeyboardMovingStep1 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardMoving, 1),
  name: 'Cells/Keyboard — Move around, step 1',
  tags: ['!test'],
}

export const HighContrastKeyboardMovingStep2 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardMoving, 2),
  name: 'Cells/Keyboard — Move around, step 2',
  tags: ['!test'],
}

export const HighContrastKeyboardMovingStep3 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardMoving, 3),
  name: 'Cells/Keyboard — Move around, step 3',
  tags: ['!test'],
}

export const HighContrastKeyboardActionsStep1 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardActions, 1),
  name: 'Cells/Keyboard — Actions without a mouse, step 1',
  tags: ['!test'],
}

export const HighContrastKeyboardActionsStep2 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardActions, 2),
  name: 'Cells/Keyboard — Actions without a mouse, step 2',
  tags: ['!test'],
}

export const HighContrastKeyboardActionsStep3 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardActions, 3),
  name: 'Cells/Keyboard — Actions without a mouse, step 3',
  tags: ['!test'],
}

export const HighContrastKeyboardActionsStep4 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardActions, 4),
  name: 'Cells/Keyboard — Actions without a mouse, step 4',
  tags: ['!test'],
}

export const HighContrastHeaderGroupsPlayground = {
  ...twin(columnsHeaderGroupsMeta, HeaderGroupsPlayground),
  name: 'Columns/Header groups — Playground',
  tags: ['!test'],
}

export const HighContrastColumnMultiSortingStep1 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnMultiSorting,
    1,
  ),
  name: 'Columns/Sorting — Multi-sort, step 1',
  tags: ['!test'],
}

export const HighContrastColumnMultiSortingStep2 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnMultiSorting,
    2,
  ),
  name: 'Columns/Sorting — Multi-sort, step 2',
  tags: ['!test'],
}

export const HighContrastColumnMultiSortingStep3 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnMultiSorting,
    3,
  ),
  name: 'Columns/Sorting — Multi-sort, step 3',
  tags: ['!test'],
}

export const HighContrastColumnMultiSortingStep4 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnMultiSorting,
    4,
  ),
  name: 'Columns/Sorting — Multi-sort, step 4',
  tags: ['!test'],
}

export const HighContrastColumnSortingOptionLabelsStep1 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnSortingOptionLabels,
    1,
  ),
  name: 'Columns/Sorting — Option labels, step 1',
  tags: ['!test'],
}

export const HighContrastColumnSortingOptionLabelsStep2 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnSortingOptionLabels,
    2,
  ),
  name: 'Columns/Sorting — Option labels, step 2',
  tags: ['!test'],
}

export const HighContrastColumnSortingOptionLabelsStep3 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnSortingOptionLabels,
    3,
  ),
  name: 'Columns/Sorting — Option labels, step 3',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityWithHeaderMenuStep1 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityWithHeaderMenu,
    1,
  ),
  name: 'Columns/Visibility — With header menu, step 1',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityWithHeaderMenuStep2 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityWithHeaderMenu,
    2,
  ),
  name: 'Columns/Visibility — With header menu, step 2',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityWithHeaderMenuStep3 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityWithHeaderMenu,
    3,
  ),
  name: 'Columns/Visibility — With header menu, step 3',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityWithHeaderMenuStep4 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityWithHeaderMenu,
    4,
  ),
  name: 'Columns/Visibility — With header menu, step 4',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollUnknownTotalStep1 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollUnknownTotal,
    1,
  ),
  name: 'Data loading/Infinite scroll — Unknown total, step 1',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollUnknownTotalStep2 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollUnknownTotal,
    2,
  ),
  name: 'Data loading/Infinite scroll — Unknown total, step 2',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollUnknownTotalStep3 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollUnknownTotal,
    3,
  ),
  name: 'Data loading/Infinite scroll — Unknown total, step 3',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollErrorsStep1 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollErrors,
    1,
  ),
  name: 'Data loading/Infinite scroll — Errors, step 1',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollErrorsStep2 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollErrors,
    2,
  ),
  name: 'Data loading/Infinite scroll — Errors, step 2',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollErrorsStep3 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollErrors,
    3,
  ),
  name: 'Data loading/Infinite scroll — Errors, step 3',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollServerQueryStep1 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollServerQuery,
    1,
  ),
  name: 'Data loading/Infinite scroll — Server sort & filter, step 1',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollServerQueryStep2 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollServerQuery,
    2,
  ),
  name: 'Data loading/Infinite scroll — Server sort & filter, step 2',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollServerQueryStep3 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollServerQuery,
    3,
  ),
  name: 'Data loading/Infinite scroll — Server sort & filter, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelJumpStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelJump,
    1,
  ),
  name: 'Data loading/Server row model — Jump to the middle, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelJumpStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelJump,
    2,
  ),
  name: 'Data loading/Server row model — Jump to the middle, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelJumpStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelJump,
    3,
  ),
  name: 'Data loading/Server row model — Jump to the middle, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelBlockErrorStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelBlockError,
    1,
  ),
  name: 'Data loading/Server row model — Block error, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelBlockErrorStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelBlockError,
    2,
  ),
  name: 'Data loading/Server row model — Block error, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelBlockErrorStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelBlockError,
    3,
  ),
  name: 'Data loading/Server row model — Block error, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelUnknownTotalStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelUnknownTotal,
    1,
  ),
  name: 'Data loading/Server row model — Unknown total, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelUnknownTotalStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelUnknownTotal,
    2,
  ),
  name: 'Data loading/Server row model — Unknown total, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelUnknownTotalStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelUnknownTotal,
    3,
  ),
  name: 'Data loading/Server row model — Unknown total, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelUnknownTotalStep4 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelUnknownTotal,
    4,
  ),
  name: 'Data loading/Server row model — Unknown total, step 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    1,
  ),
  name: 'Data loading/Server row model — Sorting, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    2,
  ),
  name: 'Data loading/Server row model — Sorting, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    3,
  ),
  name: 'Data loading/Server row model — Sorting, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep4 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    4,
  ),
  name: 'Data loading/Server row model — Sorting, step 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep5 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    5,
  ),
  name: 'Data loading/Server row model — Sorting, step 5',
  tags: ['!test'],
}

export const HighContrastServerRowModelOpenAtRecordStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelOpenAtRecord,
    1,
  ),
  name: 'Data loading/Server row model — Open at record, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelOpenAtRecordStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelOpenAtRecord,
    2,
  ),
  name: 'Data loading/Server row model — Open at record, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelOpenAtRecordStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelOpenAtRecord,
    3,
  ),
  name: 'Data loading/Server row model — Open at record, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelSelectAllExceptStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerRowModelSelectAllExcept,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Select all except, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelSelectAllExceptStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerRowModelSelectAllExcept,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Select all except, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelSelectAllExceptStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerRowModelSelectAllExcept,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Select all except, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelSelectAllExceptStep4 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerRowModelSelectAllExcept,
    4,
  ),
  name: 'Data loading/Server row model/Selection — Select all except, step 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelLazyChildrenStep1 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerRowModelLazyChildren,
    1,
  ),
  name: 'Data loading/Server row model/Lazy children — Lazy children, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelLazyChildrenStep2 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerRowModelLazyChildren,
    2,
  ),
  name: 'Data loading/Server row model/Lazy children — Lazy children, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelLazyChildrenStep3 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerRowModelLazyChildren,
    3,
  ),
  name: 'Data loading/Server row model/Lazy children — Lazy children, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelEditCellStep1 = {
  ...twinStep(
    serverEditingStories,
    serverEditingStories.ServerRowModelEditCell,
    1,
  ),
  name: 'Data loading/Server row model/Editing — Edit a cell, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelEditCellStep2 = {
  ...twinStep(
    serverEditingStories,
    serverEditingStories.ServerRowModelEditCell,
    2,
  ),
  name: 'Data loading/Server row model/Editing — Edit a cell, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelEditCellStep3 = {
  ...twinStep(
    serverEditingStories,
    serverEditingStories.ServerRowModelEditCell,
    3,
  ),
  name: 'Data loading/Server row model/Editing — Edit a cell, step 3',
  tags: ['!test'],
}

export const HighContrastServerTransactionAddStep1 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionAdd,
    1,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row, step 1',
  tags: ['!test'],
}

export const HighContrastServerTransactionAddStep2 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionAdd,
    2,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row, step 2',
  tags: ['!test'],
}

export const HighContrastServerTransactionAddStep3 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionAdd,
    3,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row, step 3',
  tags: ['!test'],
}

export const HighContrastServerTransactionAddStep4 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionAdd,
    4,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row, step 4',
  tags: ['!test'],
}

export const HighContrastServerTransactionRemoveStep1 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRemove,
    1,
  ),
  name: 'Data loading/Server row model/Transactions — Remove selected rows, step 1',
  tags: ['!test'],
}

export const HighContrastServerTransactionRemoveStep2 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRemove,
    2,
  ),
  name: 'Data loading/Server row model/Transactions — Remove selected rows, step 2',
  tags: ['!test'],
}

export const HighContrastServerTransactionRemoveStep3 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRemove,
    3,
  ),
  name: 'Data loading/Server row model/Transactions — Remove selected rows, step 3',
  tags: ['!test'],
}

export const HighContrastServerTransactionLiveStep1 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionLive,
    1,
  ),
  name: 'Data loading/Server row model/Transactions — Live updates, step 1',
  tags: ['!test'],
}

export const HighContrastServerTransactionLiveStep2 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionLive,
    2,
  ),
  name: 'Data loading/Server row model/Transactions — Live updates, step 2',
  tags: ['!test'],
}

export const HighContrastServerTransactionRefetchStep1 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRefetch,
    1,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row without a place, step 1',
  tags: ['!test'],
}

export const HighContrastServerTransactionRefetchStep2 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRefetch,
    2,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row without a place, step 2',
  tags: ['!test'],
}

export const HighContrastServerTransactionRefetchStep3 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRefetch,
    3,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row without a place, step 3',
  tags: ['!test'],
}

export const HighContrastServerPaginationPagesStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationPages,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Load pages, step 1',
  tags: ['!test'],
}

export const HighContrastServerPaginationPagesStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationPages,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Load pages, step 2',
  tags: ['!test'],
}

export const HighContrastServerPaginationPagesStep3 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationPages,
    3,
  ),
  name: 'Data loading/Server row model/Pagination — Load pages, step 3',
  tags: ['!test'],
}

export const HighContrastServerPaginationPagesStep4 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationPages,
    4,
  ),
  name: 'Data loading/Server row model/Pagination — Load pages, step 4',
  tags: ['!test'],
}

export const HighContrastServerPaginationUnknownTotalStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationUnknownTotal,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Unknown total, step 1',
  tags: ['!test'],
}

export const HighContrastServerPaginationUnknownTotalStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationUnknownTotal,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Unknown total, step 2',
  tags: ['!test'],
}

export const HighContrastServerPaginationGroupsStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationGroups,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Groups on pages, step 1',
  tags: ['!test'],
}

export const HighContrastServerPaginationGroupsStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationGroups,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Groups on pages, step 2',
  tags: ['!test'],
}

export const HighContrastServerPaginationGroupsStep3 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationGroups,
    3,
  ),
  name: 'Data loading/Server row model/Pagination — Groups on pages, step 3',
  tags: ['!test'],
}

export const HighContrastServerPaginationEditingStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationEditing,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Draft across pages, step 1',
  tags: ['!test'],
}

export const HighContrastServerPaginationEditingStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationEditing,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Draft across pages, step 2',
  tags: ['!test'],
}

export const HighContrastServerPaginationEditingStep3 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationEditing,
    3,
  ),
  name: 'Data loading/Server row model/Pagination — Draft across pages, step 3',
  tags: ['!test'],
}

export const HighContrastServerPaginationEditingStep4 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationEditing,
    4,
  ),
  name: 'Data loading/Server row model/Pagination — Draft across pages, step 4',
  tags: ['!test'],
}

export const HighContrastServerDragMoveStep1 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragMove, 1),
  name: 'Data loading/Server row model/Dragging — Move a row, step 1',
  tags: ['!test'],
}

export const HighContrastServerDragMoveStep2 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragMove, 2),
  name: 'Data loading/Server row model/Dragging — Move a row, step 2',
  tags: ['!test'],
}

export const HighContrastServerDragMoveStep3 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragMove, 3),
  name: 'Data loading/Server row model/Dragging — Move a row, step 3',
  tags: ['!test'],
}

export const HighContrastServerDragRefusedStep1 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerDragRefused,
    1,
  ),
  name: 'Data loading/Server row model/Dragging — Move refused, step 1',
  tags: ['!test'],
}

export const HighContrastServerDragRefusedStep2 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerDragRefused,
    2,
  ),
  name: 'Data loading/Server row model/Dragging — Move refused, step 2',
  tags: ['!test'],
}

export const HighContrastServerDragRefusedStep3 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerDragRefused,
    3,
  ),
  name: 'Data loading/Server row model/Dragging — Move refused, step 3',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep1 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 1),
  name: 'Data loading/Server row model/Dragging — Move into a branch, step 1',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep2 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 2),
  name: 'Data loading/Server row model/Dragging — Move into a branch, step 2',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep3 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 3),
  name: 'Data loading/Server row model/Dragging — Move into a branch, step 3',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep4 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 4),
  name: 'Data loading/Server row model/Dragging — Move into a branch, step 4',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep5 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 5),
  name: 'Data loading/Server row model/Dragging — Move into a branch, step 5',
  tags: ['!test'],
}

export const HighContrastServerDragGroupsStep1 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragGroups, 1),
  name: 'Data loading/Server row model/Dragging — Move to another group, step 1',
  tags: ['!test'],
}

export const HighContrastServerDragGroupsStep2 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragGroups, 2),
  name: 'Data loading/Server row model/Dragging — Move to another group, step 2',
  tags: ['!test'],
}

export const HighContrastServerDragGroupsStep3 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragGroups, 3),
  name: 'Data loading/Server row model/Dragging — Move to another group, step 3',
  tags: ['!test'],
}

export const HighContrastServerDragGroupsStep4 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragGroups, 4),
  name: 'Data loading/Server row model/Dragging — Move to another group, step 4',
  tags: ['!test'],
}

export const HighContrastServerGroupingExpandAllStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerGroupingExpandAll,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Expand all, step 1',
  tags: ['!test'],
}

export const HighContrastServerGroupingExpandAllStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerGroupingExpandAll,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Expand all, step 2',
  tags: ['!test'],
}

export const HighContrastServerGroupingExpandAllStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerGroupingExpandAll,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Expand all, step 3',
  tags: ['!test'],
}

export const HighContrastExpandingExpandAllStep1 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingExpandAll, 1),
  name: 'Rows/Expanding — Expand all, step 1',
  tags: ['!test'],
}

export const HighContrastExpandingExpandAllStep2 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingExpandAll, 2),
  name: 'Rows/Expanding — Expand all, step 2',
  tags: ['!test'],
}

export const HighContrastExpandingExpandAllStep3 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingExpandAll, 3),
  name: 'Rows/Expanding — Expand all, step 3',
  tags: ['!test'],
}

export const HighContrastGroupingStickyRowsStep1 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupingStickyRows, 1),
  name: 'Rows/Grouping — Sticky group rows, step 1',
  tags: ['!test'],
}

export const HighContrastGroupingStickyRowsStep2 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupingStickyRows, 2),
  name: 'Rows/Grouping — Sticky group rows, step 2',
  tags: ['!test'],
}

export const HighContrastGroupingStickyRowsStep3 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupingStickyRows, 3),
  name: 'Rows/Grouping — Sticky group rows, step 3',
  tags: ['!test'],
}

export const HighContrastGroupingStickyRowsStep4 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupingStickyRows, 4),
  name: 'Rows/Grouping — Sticky group rows, step 4',
  tags: ['!test'],
}

export const HighContrastServerStickyBranchesStep1 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerStickyBranches,
    1,
  ),
  name: 'Data loading/Server row model/Lazy children — Sticky branches, step 1',
  tags: ['!test'],
}

export const HighContrastServerStickyBranchesStep2 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerStickyBranches,
    2,
  ),
  name: 'Data loading/Server row model/Lazy children — Sticky branches, step 2',
  tags: ['!test'],
}

export const HighContrastServerStickyBranchesStep3 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerStickyBranches,
    3,
  ),
  name: 'Data loading/Server row model/Lazy children — Sticky branches, step 3',
  tags: ['!test'],
}

export const HighContrastServerTreeLinesStep1 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerTreeLines,
    1,
  ),
  name: 'Data loading/Server row model/Lazy children — Tree lines, step 1',
  tags: ['!test'],
}

export const HighContrastServerTreeLinesStep2 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerTreeLines,
    2,
  ),
  name: 'Data loading/Server row model/Lazy children — Tree lines, step 2',
  tags: ['!test'],
}

export const HighContrastServerTreeLinesStep3 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerTreeLines,
    3,
  ),
  name: 'Data loading/Server row model/Lazy children — Tree lines, step 3',
  tags: ['!test'],
}

export const HighContrastServerTreeLinesStep4 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerTreeLines,
    4,
  ),
  name: 'Data loading/Server row model/Lazy children — Tree lines, step 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelMillionRowsStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelMillionRows,
    1,
  ),
  name: 'Data loading/Server row model — Million rows, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelMillionRowsStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelMillionRows,
    2,
  ),
  name: 'Data loading/Server row model — Million rows, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelMillionRowsStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelMillionRows,
    3,
  ),
  name: 'Data loading/Server row model — Million rows, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelMillionRowsStep4 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelMillionRows,
    4,
  ),
  name: 'Data loading/Server row model — Million rows, step 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupByStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupBy,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Group by a column, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupByStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupBy,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Group by a column, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupByStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupBy,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Group by a column, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelExpandGroupStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelExpandGroup,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Expand a group, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelExpandGroupStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelExpandGroup,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Expand a group, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelExpandGroupStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelExpandGroup,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Expand a group, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelTotalsStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelTotals,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Totals in the footer, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelTotalsStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelTotals,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Totals in the footer, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelTotalsStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelTotals,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Totals in the footer, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupingRefusedStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupingRefused,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Grouping refused, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupingRefusedStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupingRefused,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Grouping refused, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupingRefusedStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupingRefused,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Grouping refused, step 3',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, step 1',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, step 2',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, step 3',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep4 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    4,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, step 4',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep5 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    5,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, step 5',
  tags: ['!test'],
}

export const HighContrastServerCopyLoadsRowsStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyLoadsRows,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy loads the rows, step 1',
  tags: ['!test'],
}

export const HighContrastServerCopyLoadsRowsStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyLoadsRows,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy loads the rows, step 2',
  tags: ['!test'],
}

export const HighContrastServerCopyLoadsRowsStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyLoadsRows,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy loads the rows, step 3',
  tags: ['!test'],
}

export const HighContrastServerCopyLoadsRowsStep4 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyLoadsRows,
    4,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy loads the rows, step 4',
  tags: ['!test'],
}

export const HighContrastServerCopyOverLimitStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyOverLimit,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy over the limit, step 1',
  tags: ['!test'],
}

export const HighContrastServerCopyOverLimitStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyOverLimit,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy over the limit, step 2',
  tags: ['!test'],
}

export const HighContrastServerCopyOverLimitStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyOverLimit,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy over the limit, step 3',
  tags: ['!test'],
}

export const HighContrastServerCopyRefusedStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyRefused,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastServerCopyRefusedStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyRefused,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy refused by the server, step 2',
  tags: ['!test'],
}

export const HighContrastServerCopyRefusedStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyRefused,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy refused by the server, step 3',
  tags: ['!test'],
}

export const HighContrastServerCopyRefusedStep4 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyRefused,
    4,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy refused by the server, step 4',
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

export const HighContrastRowGroupingPlayground = {
  ...twin(
    rowsGroupingStories.default,
    rowsGroupingStories.RowGroupingPlayground,
  ),
  name: 'Rows/Grouping — Playground',
  tags: ['!test'],
}

export const HighContrastFilteringTextStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringText, 1),
  name: 'Filtering — Text filter, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringTextStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringText, 2),
  name: 'Filtering — Text filter, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringTextStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringText, 3),
  name: 'Filtering — Text filter, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringEmptyStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringEmpty, 1),
  name: 'Filtering — Empty result, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringEmptyStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringEmpty, 2),
  name: 'Filtering — Empty result, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringEmptyStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringEmpty, 3),
  name: 'Filtering — Empty result, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringServer, 1),
  name: 'Filtering — Server, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringServer, 2),
  name: 'Filtering — Server, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringServer, 3),
  name: 'Filtering — Server, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringServer, 4),
  name: 'Filtering — Server, step 4',
  tags: ['!test'],
}

export const HighContrastFilteringServerFiltersClientSearchStep1 = {
  ...twinStep(
    filteringStories,
    filteringStories.FilteringServerFiltersClientSearch,
    1,
  ),
  name: 'Filtering — Server filters, client search, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerFiltersClientSearchStep2 = {
  ...twinStep(
    filteringStories,
    filteringStories.FilteringServerFiltersClientSearch,
    2,
  ),
  name: 'Filtering — Server filters, client search, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerFiltersClientSearchStep3 = {
  ...twinStep(
    filteringStories,
    filteringStories.FilteringServerFiltersClientSearch,
    3,
  ),
  name: 'Filtering — Server filters, client search, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringTreeStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringTree, 1),
  name: 'Filtering — Tree, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringTreeStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringTree, 2),
  name: 'Filtering — Tree, step 2',
  tags: ['!test'],
}

export const HighContrastQuickSearchNoColumnsStep1 = {
  ...twinStep(filteringStories, filteringStories.QuickSearchNoColumns, 1),
  name: 'Filtering — Quick search, no searchable columns, step 1',
  tags: ['!test'],
}

export const HighContrastQuickSearchNoColumnsStep2 = {
  ...twinStep(filteringStories, filteringStories.QuickSearchNoColumns, 2),
  name: 'Filtering — Quick search, no searchable columns, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 1),
  name: 'Filtering — Dates, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 2),
  name: 'Filtering — Dates, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 3),
  name: 'Filtering — Dates, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 4),
  name: 'Filtering — Dates, step 4',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep5 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 5),
  name: 'Filtering — Dates, step 5',
  tags: ['!test'],
}

export const HighContrastFilteringOptionsStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringOptions, 1),
  name: 'Filtering — Select & multiselect, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringOptionsStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringOptions, 2),
  name: 'Filtering — Select & multiselect, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringOptionsStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringOptions, 3),
  name: 'Filtering — Select & multiselect, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringOptionsStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringOptions, 4),
  name: 'Filtering — Select & multiselect, step 4',
  tags: ['!test'],
}

export const HighContrastFilteringLookupServerStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringLookupServer, 1),
  name: 'Filtering — Lookup (server), step 1',
  tags: ['!test'],
}

export const HighContrastFilteringLookupServerStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringLookupServer, 2),
  name: 'Filtering — Lookup (server), step 2',
  tags: ['!test'],
}

export const HighContrastFilteringLookupServerStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringLookupServer, 3),
  name: 'Filtering — Lookup (server), step 3',
  tags: ['!test'],
}

export const HighContrastFilteringLookupServerStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringLookupServer, 4),
  name: 'Filtering — Lookup (server), step 4',
  tags: ['!test'],
}

export const HighContrastExportDirectStep1 = {
  ...twinStep(exportStories, exportStories.ExportDirect, 1),
  name: 'Export — Direct click, step 1',
  tags: ['!test'],
}

export const HighContrastExportDirectStep2 = {
  ...twinStep(exportStories, exportStories.ExportDirect, 2),
  name: 'Export — Direct click, step 2',
  tags: ['!test'],
}

export const HighContrastExportPresetsStep1 = {
  ...twinStep(exportStories, exportStories.ExportPresets, 1),
  name: 'Export — Settings and quick sets, step 1',
  tags: ['!test'],
}

export const HighContrastExportPresetsStep2 = {
  ...twinStep(exportStories, exportStories.ExportPresets, 2),
  name: 'Export — Settings and quick sets, step 2',
  tags: ['!test'],
}

export const HighContrastExportPresetsStep3 = {
  ...twinStep(exportStories, exportStories.ExportPresets, 3),
  name: 'Export — Settings and quick sets, step 3',
  tags: ['!test'],
}

export const HighContrastExportPresetsStep4 = {
  ...twinStep(exportStories, exportStories.ExportPresets, 4),
  name: 'Export — Settings and quick sets, step 4',
  tags: ['!test'],
}

export const HighContrastExportServerStep1 = {
  ...twinStep(exportStories, exportStories.ExportServer, 1),
  name: 'Export — Server, step 1',
  tags: ['!test'],
}

export const HighContrastExportServerStep2 = {
  ...twinStep(exportStories, exportStories.ExportServer, 2),
  name: 'Export — Server, step 2',
  tags: ['!test'],
}

export const HighContrastExportServerStep3 = {
  ...twinStep(exportStories, exportStories.ExportServer, 3),
  name: 'Export — Server, step 3',
  tags: ['!test'],
}

export const HighContrastExportServerStep4 = {
  ...twinStep(exportStories, exportStories.ExportServer, 4),
  name: 'Export — Server, step 4',
  tags: ['!test'],
}

export const HighContrastExportServerStep5 = {
  ...twinStep(exportStories, exportStories.ExportServer, 5),
  name: 'Export — Server, step 5',
  tags: ['!test'],
}

export const HighContrastExportExcelStep1 = {
  ...twinStep(exportStories, exportStories.ExportExcel, 1),
  name: 'Export — Excel, step 1',
  tags: ['!test'],
}

export const HighContrastExportExcelStep2 = {
  ...twinStep(exportStories, exportStories.ExportExcel, 2),
  name: 'Export — Excel, step 2',
  tags: ['!test'],
}

export const HighContrastExportExcelStep3 = {
  ...twinStep(exportStories, exportStories.ExportExcel, 3),
  name: 'Export — Excel, step 3',
  tags: ['!test'],
}

export const HighContrastExportExcelStep4 = {
  ...twinStep(exportStories, exportStories.ExportExcel, 4),
  name: 'Export — Excel, step 4',
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

export const HighContrastToolbarPlayground = {
  ...twin(panelsToolbarMeta, ToolbarPlayground),
  name: 'Panels/Toolbar — Playground',
  tags: ['!test'],
}

export const HighContrastRowActionMenuStep1 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionMenu, 1),
  name: 'Rows/Actions — Action menu, step 1',
  tags: ['!test'],
}

export const HighContrastRowActionMenuStep2 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionMenu, 2),
  name: 'Rows/Actions — Action menu, step 2',
  tags: ['!test'],
}

export const HighContrastRowActionMenuStep3 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionMenu, 3),
  name: 'Rows/Actions — Action menu, step 3',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep1 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 1),
  name: 'Rows/Actions — Nested sections, step 1',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep2 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 2),
  name: 'Rows/Actions — Nested sections, step 2',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep3 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 3),
  name: 'Rows/Actions — Nested sections, step 3',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep4 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 4),
  name: 'Rows/Actions — Nested sections, step 4',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep5 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 5),
  name: 'Rows/Actions — Nested sections, step 5',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep6 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 6),
  name: 'Rows/Actions — Nested sections, step 6',
  tags: ['!test'],
}

export const HighContrastRowActionsAsyncStep1 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsAsync, 1),
  name: 'Rows/Actions — Async action, step 1',
  tags: ['!test'],
}

export const HighContrastRowActionsAsyncStep2 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsAsync, 2),
  name: 'Rows/Actions — Async action, step 2',
  tags: ['!test'],
}

export const HighContrastRowActionsAsyncStep3 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsAsync, 3),
  name: 'Rows/Actions — Async action, step 3',
  tags: ['!test'],
}

export const HighContrastRowHighlightPlayground = {
  ...twin(
    rowsHighlightStories.default,
    rowsHighlightStories.RowHighlightPlayground,
  ),
  name: 'Rows/Highlight — Playground',
  tags: ['!test'],
}

export const HighContrastRowSelectionPlayground = {
  ...twin(
    rowsSelectionStories.default,
    rowsSelectionStories.RowSelectionPlayground,
  ),
  name: 'Rows/Selection — Playground',
  tags: ['!test'],
}

export const HighContrastBackToTopReturnStep1 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopReturn, 1),
  name: 'Rows/Back to top — Return to top, step 1',
  tags: ['!test'],
}

export const HighContrastBackToTopReturnStep2 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopReturn, 2),
  name: 'Rows/Back to top — Return to top, step 2',
  tags: ['!test'],
}

export const HighContrastBackToTopReturnStep3 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopReturn, 3),
  name: 'Rows/Back to top — Return to top, step 3',
  tags: ['!test'],
}

export const HighContrastBackToTopWideStep1 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopWide, 1),
  name: 'Rows/Back to top — Wide table, step 1',
  tags: ['!test'],
}

export const HighContrastBackToTopWideStep2 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopWide, 2),
  name: 'Rows/Back to top — Wide table, step 2',
  tags: ['!test'],
}

export const HighContrastBackToTopWideStep3 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopWide, 3),
  name: 'Rows/Back to top — Wide table, step 3',
  tags: ['!test'],
}

export const HighContrastExpandingConfirmedStep1 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingConfirmed, 1),
  name: 'Rows/Expanding — Expand confirmed by the server, step 1',
  tags: ['!test'],
}

export const HighContrastExpandingConfirmedStep2 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingConfirmed, 2),
  name: 'Rows/Expanding — Expand confirmed by the server, step 2',
  tags: ['!test'],
}

export const HighContrastExpandingConfirmedStep3 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingConfirmed, 3),
  name: 'Rows/Expanding — Expand confirmed by the server, step 3',
  tags: ['!test'],
}

export const HighContrastExpandingLazyRestoredStep1 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyRestored,
    1,
  ),
  name: 'Rows/Expanding — Expanded on open, step 1',
  tags: ['!test'],
}

export const HighContrastExpandingLazyRestoredStep2 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyRestored,
    2,
  ),
  name: 'Rows/Expanding — Expanded on open, step 2',
  tags: ['!test'],
}

export const HighContrastExpandingLazyRestoredStep3 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyRestored,
    3,
  ),
  name: 'Rows/Expanding — Expanded on open, step 3',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep1 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    1,
  ),
  name: 'Rows/Expanding — Lazy children (server), step 1',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep2 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    2,
  ),
  name: 'Rows/Expanding — Lazy children (server), step 2',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep3 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    3,
  ),
  name: 'Rows/Expanding — Lazy children (server), step 3',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep4 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    4,
  ),
  name: 'Rows/Expanding — Lazy children (server), step 4',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep5 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    5,
  ),
  name: 'Rows/Expanding — Lazy children (server), step 5',
  tags: ['!test'],
}

export const HighContrastHighlightDeleteConfirmationStep1 = {
  ...twinStep(
    rowsHighlightStories,
    rowsHighlightStories.HighlightDeleteConfirmation,
    1,
  ),
  name: 'Rows/Highlight — Delete confirmation, step 1',
  tags: ['!test'],
}

export const HighContrastHighlightDeleteConfirmationStep2 = {
  ...twinStep(
    rowsHighlightStories,
    rowsHighlightStories.HighlightDeleteConfirmation,
    2,
  ),
  name: 'Rows/Highlight — Delete confirmation, step 2',
  tags: ['!test'],
}

export const HighContrastHighlightDeleteConfirmationStep3 = {
  ...twinStep(
    rowsHighlightStories,
    rowsHighlightStories.HighlightDeleteConfirmation,
    3,
  ),
  name: 'Rows/Highlight — Delete confirmation, step 3',
  tags: ['!test'],
}

export const HighContrastHighlightDeleteConfirmationStep4 = {
  ...twinStep(
    rowsHighlightStories,
    rowsHighlightStories.HighlightDeleteConfirmation,
    4,
  ),
  name: 'Rows/Highlight — Delete confirmation, step 4',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep1 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 1),
  name: 'Rows/Highlight — Search, cell and column, step 1',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep2 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 2),
  name: 'Rows/Highlight — Search, cell and column, step 2',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep3 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 3),
  name: 'Rows/Highlight — Search, cell and column, step 3',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep4 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 4),
  name: 'Rows/Highlight — Search, cell and column, step 4',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep5 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 5),
  name: 'Rows/Highlight — Search, cell and column, step 5',
  tags: ['!test'],
}

export const HighContrastGroupSelectionStep1 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.GroupSelection, 1),
  name: 'Rows/Selection — Select a group, step 1',
  tags: ['!test'],
}

export const HighContrastGroupSelectionStep2 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.GroupSelection, 2),
  name: 'Rows/Selection — Select a group, step 2',
  tags: ['!test'],
}

export const HighContrastGroupSelectionStep3 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.GroupSelection, 3),
  name: 'Rows/Selection — Select a group, step 3',
  tags: ['!test'],
}

export const HighContrastGroupSelectFilteredStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.GroupSelectFiltered,
    1,
  ),
  name: 'Rows/Selection — Select a group while searching, step 1',
  tags: ['!test'],
}

export const HighContrastGroupSelectFilteredStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.GroupSelectFiltered,
    2,
  ),
  name: 'Rows/Selection — Select a group while searching, step 2',
  tags: ['!test'],
}

export const HighContrastGroupSelectFilteredStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.GroupSelectFiltered,
    3,
  ),
  name: 'Rows/Selection — Select a group while searching, step 3',
  tags: ['!test'],
}

export const HighContrastGroupSelectFilteredStep4 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.GroupSelectFiltered,
    4,
  ),
  name: 'Rows/Selection — Select a group while searching, step 4',
  tags: ['!test'],
}

export const HighContrastGroupSelectRegroupStep1 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.GroupSelectRegroup, 1),
  name: 'Rows/Selection — Change grouping with a selection, step 1',
  tags: ['!test'],
}

export const HighContrastGroupSelectRegroupStep2 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.GroupSelectRegroup, 2),
  name: 'Rows/Selection — Change grouping with a selection, step 2',
  tags: ['!test'],
}

export const HighContrastGroupSelectRegroupStep3 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.GroupSelectRegroup, 3),
  name: 'Rows/Selection — Change grouping with a selection, step 3',
  tags: ['!test'],
}

export const HighContrastGroupDragMoveStep1 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.GroupDragMove, 1),
  name: 'Rows/Dragging — Move to another group, step 1',
  tags: ['!test'],
}

export const HighContrastGroupDragMoveStep2 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.GroupDragMove, 2),
  name: 'Rows/Dragging — Move to another group, step 2',
  tags: ['!test'],
}

export const HighContrastGroupDragMoveStep3 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.GroupDragMove, 3),
  name: 'Rows/Dragging — Move to another group, step 3',
  tags: ['!test'],
}

export const HighContrastGroupDragRefusedStep1 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.GroupDragRefused, 1),
  name: 'Rows/Dragging — Move refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastGroupDragRefusedStep2 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.GroupDragRefused, 2),
  name: 'Rows/Dragging — Move refused by the server, step 2',
  tags: ['!test'],
}

export const HighContrastGroupDragRefusedStep3 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.GroupDragRefused, 3),
  name: 'Rows/Dragging — Move refused by the server, step 3',
  tags: ['!test'],
}

export const HighContrastRowMotionTreeStep1 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionTree, 1),
  name: 'Rows/Motion — Tree, step 1',
  tags: ['!test'],
}

export const HighContrastRowMotionTreeStep2 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionTree, 2),
  name: 'Rows/Motion — Tree, step 2',
  tags: ['!test'],
}

export const HighContrastRowMotionTreeStep3 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionTree, 3),
  name: 'Rows/Motion — Tree, step 3',
  tags: ['!test'],
}

export const HighContrastRowMotionSearchStep1 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionSearch, 1),
  name: 'Rows/Motion — Sort and search, step 1',
  tags: ['!test'],
}

export const HighContrastRowMotionSearchStep2 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionSearch, 2),
  name: 'Rows/Motion — Sort and search, step 2',
  tags: ['!test'],
}

export const HighContrastRowMotionSearchStep3 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionSearch, 3),
  name: 'Rows/Motion — Sort and search, step 3',
  tags: ['!test'],
}

export const HighContrastRowMotionDeleteStep1 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionDelete, 1),
  name: 'Rows/Motion — Delete a row, step 1',
  tags: ['!test'],
}

export const HighContrastRowMotionDeleteStep2 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionDelete, 2),
  name: 'Rows/Motion — Delete a row, step 2',
  tags: ['!test'],
}

export const HighContrastScrollToRowShowStep1 = {
  ...twinStep(
    rowsScrollToRowStories,
    rowsScrollToRowStories.ScrollToRowShow,
    1,
  ),
  name: 'Rows/Scroll to row — Show a row, step 1',
  tags: ['!test'],
}

export const HighContrastScrollToRowShowStep2 = {
  ...twinStep(
    rowsScrollToRowStories,
    rowsScrollToRowStories.ScrollToRowShow,
    2,
  ),
  name: 'Rows/Scroll to row — Show a row, step 2',
  tags: ['!test'],
}

export const HighContrastScrollToRowShowStep3 = {
  ...twinStep(
    rowsScrollToRowStories,
    rowsScrollToRowStories.ScrollToRowShow,
    3,
  ),
  name: 'Rows/Scroll to row — Show a row, step 3',
  tags: ['!test'],
}

export const HighContrastBatchRowSelectionStep1 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.BatchRowSelection, 1),
  name: 'Rows/Selection — Select all rows, step 1',
  tags: ['!test'],
}

export const HighContrastBatchRowSelectionStep2 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.BatchRowSelection, 2),
  name: 'Rows/Selection — Select all rows, step 2',
  tags: ['!test'],
}

export const HighContrastBatchRowSelectionStep3 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.BatchRowSelection, 3),
  name: 'Rows/Selection — Select all rows, step 3',
  tags: ['!test'],
}

export const HighContrastSubRowSelectionStep1 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.SubRowSelection, 1),
  name: 'Rows/Selection — Parent with children, step 1',
  tags: ['!test'],
}

export const HighContrastSubRowSelectionStep2 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.SubRowSelection, 2),
  name: 'Rows/Selection — Parent with children, step 2',
  tags: ['!test'],
}

export const HighContrastSubRowSelectionStep3 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.SubRowSelection, 3),
  name: 'Rows/Selection — Parent with children, step 3',
  tags: ['!test'],
}

export const HighContrastSelectionSubRowsSelfStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionSubRowsSelf,
    1,
  ),
  name: 'Rows/Selection — Each row on its own, step 1',
  tags: ['!test'],
}

export const HighContrastSelectionSubRowsSelfStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionSubRowsSelf,
    2,
  ),
  name: 'Rows/Selection — Each row on its own, step 2',
  tags: ['!test'],
}

export const HighContrastSelectionSubRowsSelfStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionSubRowsSelf,
    3,
  ),
  name: 'Rows/Selection — Each row on its own, step 3',
  tags: ['!test'],
}

// --- Шаги гайдов (ADR 0130, DG3): близнец у каждого шага каждого гайда ---

export const HighContrastCellSelectionByCommandStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionByCommand,
    1,
  ),
  name: 'Cells/Selection — By command, step 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionByCommandStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionByCommand,
    2,
  ),
  name: 'Cells/Selection — By command, step 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionByCommandStep3 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionByCommand,
    3,
  ),
  name: 'Cells/Selection — By command, step 3',
  tags: ['!test'],
}

export const HighContrastSortingExternalControlsStep1 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.SortingExternalControls,
    1,
  ),
  name: 'Columns/Sorting — External controls, step 1',
  tags: ['!test'],
}

export const HighContrastSortingExternalControlsStep2 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.SortingExternalControls,
    2,
  ),
  name: 'Columns/Sorting — External controls, step 2',
  tags: ['!test'],
}

export const HighContrastSortingExternalControlsStep3 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.SortingExternalControls,
    3,
  ),
  name: 'Columns/Sorting — External controls, step 3',
  tags: ['!test'],
}

export const HighContrastPinnedFooterStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.PinnedFooter, 1),
  name: 'Core/Footer — Pinned, step 1',
  tags: ['!test'],
}

export const HighContrastPinnedFooterStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.PinnedFooter, 2),
  name: 'Core/Footer — Pinned, step 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooter, 1),
  name: 'Core/Footer — Inline, step 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooter, 2),
  name: 'Core/Footer — Inline, step 2',
  tags: ['!test'],
}

export const HighContrastFooterPositionSwitchStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterPositionSwitch, 1),
  name: 'Core/Footer — Position switch, step 1',
  tags: ['!test'],
}

export const HighContrastFooterPositionSwitchStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterPositionSwitch, 2),
  name: 'Core/Footer — Position switch, step 2',
  tags: ['!test'],
}

export const HighContrastFooterPositionSwitchStep3 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterPositionSwitch, 3),
  name: 'Core/Footer — Position switch, step 3',
  tags: ['!test'],
}

export const HighContrastFooterKeyboardStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterKeyboard, 1),
  name: 'Core/Footer — Keyboard, step 1',
  tags: ['!test'],
}

export const HighContrastFooterKeyboardStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterKeyboard, 2),
  name: 'Core/Footer — Keyboard, step 2',
  tags: ['!test'],
}

export const HighContrastFooterKeyboardStep3 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterKeyboard, 3),
  name: 'Core/Footer — Keyboard, step 3',
  tags: ['!test'],
}

export const HighContrastInlineFooterInfiniteScrollStep1 = {
  ...twinStep(
    coreFooterStories,
    coreFooterStories.InlineFooterInfiniteScroll,
    1,
  ),
  name: 'Core/Footer — Inline — infinite scroll, step 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterInfiniteScrollStep2 = {
  ...twinStep(
    coreFooterStories,
    coreFooterStories.InlineFooterInfiniteScroll,
    2,
  ),
  name: 'Core/Footer — Inline — infinite scroll, step 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterInfiniteScrollStep3 = {
  ...twinStep(
    coreFooterStories,
    coreFooterStories.InlineFooterInfiniteScroll,
    3,
  ),
  name: 'Core/Footer — Inline — infinite scroll, step 3',
  tags: ['!test'],
}

export const HighContrastInlineFooterPaginationStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterPagination, 1),
  name: 'Core/Footer — Inline — pagination, step 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterPaginationStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterPagination, 2),
  name: 'Core/Footer — Inline — pagination, step 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterScrollToRowStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterScrollToRow, 1),
  name: 'Core/Footer — Inline — scroll to row, step 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterScrollToRowStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterScrollToRow, 2),
  name: 'Core/Footer — Inline — scroll to row, step 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterScrollToRowStep3 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterScrollToRow, 3),
  name: 'Core/Footer — Inline — scroll to row, step 3',
  tags: ['!test'],
}

export const HighContrastInlineFooterEmptySearchStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterEmptySearch, 1),
  name: 'Core/Footer — Inline — empty search, step 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterEmptySearchStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterEmptySearch, 2),
  name: 'Core/Footer — Inline — empty search, step 2',
  tags: ['!test'],
}

export const HighContrastFooterAutoHeightStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterAutoHeight, 1),
  name: 'Core/Footer — Auto height, step 1',
  tags: ['!test'],
}

export const HighContrastFooterAutoHeightStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.FooterAutoHeight, 2),
  name: 'Core/Footer — Auto height, step 2',
  tags: ['!test'],
}

export const HighContrastInlineFooterRowExpandingStep1 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterRowExpanding, 1),
  name: 'Core/Footer — Inline — row expanding, step 1',
  tags: ['!test'],
}

export const HighContrastInlineFooterRowExpandingStep2 = {
  ...twinStep(coreFooterStories, coreFooterStories.InlineFooterRowExpanding, 2),
  name: 'Core/Footer — Inline — row expanding, step 2',
  tags: ['!test'],
}

export const HighContrastSizingFixedHeightStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFixedHeight, 1),
  name: 'Core/Sizing — Fixed height, step 1',
  tags: ['!test'],
}

export const HighContrastSizingFixedHeightStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFixedHeight, 2),
  name: 'Core/Sizing — Fixed height, step 2',
  tags: ['!test'],
}

export const HighContrastSizingFillContainerStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFillContainer, 1),
  name: 'Core/Sizing — Fill container, step 1',
  tags: ['!test'],
}

export const HighContrastSizingFillContainerStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFillContainer, 2),
  name: 'Core/Sizing — Fill container, step 2',
  tags: ['!test'],
}

export const HighContrastSizingFillContainerStep3 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFillContainer, 3),
  name: 'Core/Sizing — Fill container, step 3',
  tags: ['!test'],
}

export const HighContrastSizingFlexLayoutStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFlexLayout, 1),
  name: 'Core/Sizing — Flex layout, step 1',
  tags: ['!test'],
}

export const HighContrastSizingFlexLayoutStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingFlexLayout, 2),
  name: 'Core/Sizing — Flex layout, step 2',
  tags: ['!test'],
}

export const HighContrastSizingContentHeightStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingContentHeight, 1),
  name: 'Core/Sizing — Content height, step 1',
  tags: ['!test'],
}

export const HighContrastSizingContentHeightStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingContentHeight, 2),
  name: 'Core/Sizing — Content height, step 2',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 1),
  name: 'Core/Sizing — Row height, step 1',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 2),
  name: 'Core/Sizing — Row height, step 2',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep3 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 3),
  name: 'Core/Sizing — Row height, step 3',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep4 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 4),
  name: 'Core/Sizing — Row height, step 4',
  tags: ['!test'],
}

export const HighContrastSizingRowHeightStep5 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingRowHeight, 5),
  name: 'Core/Sizing — Row height, step 5',
  tags: ['!test'],
}

export const HighContrastSizingHeaderHeightStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingHeaderHeight, 1),
  name: 'Core/Sizing — Header height, step 1',
  tags: ['!test'],
}

export const HighContrastSizingHeaderHeightStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingHeaderHeight, 2),
  name: 'Core/Sizing — Header height, step 2',
  tags: ['!test'],
}

export const HighContrastResizingDefaultColumnWidthStep1 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingDefaultColumnWidth,
    1,
  ),
  name: 'Columns/Resizing — Default column width, step 1',
  tags: ['!test'],
}

export const HighContrastResizingDefaultColumnWidthStep2 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingDefaultColumnWidth,
    2,
  ),
  name: 'Columns/Resizing — Default column width, step 2',
  tags: ['!test'],
}

export const HighContrastResizingDefaultColumnWidthStep3 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingDefaultColumnWidth,
    3,
  ),
  name: 'Columns/Resizing — Default column width, step 3',
  tags: ['!test'],
}

export const HighContrastSizingThemeTokensStep1 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingThemeTokens, 1),
  name: 'Core/Sizing — Theme tokens, step 1',
  tags: ['!test'],
}

export const HighContrastSizingThemeTokensStep2 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingThemeTokens, 2),
  name: 'Core/Sizing — Theme tokens, step 2',
  tags: ['!test'],
}

export const HighContrastSizingThemeTokensStep3 = {
  ...twinStep(coreSizingStories, coreSizingStories.SizingThemeTokens, 3),
  name: 'Core/Sizing — Theme tokens, step 3',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastEnableStep1 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastEnable,
    1,
  ),
  name: 'Customization/Increased contrast — Enable increased contrast, step 1',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastEnableStep2 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastEnable,
    2,
  ),
  name: 'Customization/Increased contrast — Enable increased contrast, step 2',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastEnableStep3 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastEnable,
    3,
  ),
  name: 'Customization/Increased contrast — Enable increased contrast, step 3',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastEnableStep4 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastEnable,
    4,
  ),
  name: 'Customization/Increased contrast — Enable increased contrast, step 4',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastRecipeStep1 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastRecipe,
    1,
  ),
  name: 'Customization/Increased contrast — Own levers and palette, step 1',
  tags: ['!test'],
}

export const HighContrastIncreasedContrastRecipeStep2 = {
  ...twinStep(
    coreIncreasedContrastStories,
    coreIncreasedContrastStories.IncreasedContrastRecipe,
    2,
  ),
  name: 'Customization/Increased contrast — Own levers and palette, step 2',
  tags: ['!test'],
}

export const HighContrastThemingGridButtonSizeStep1 = {
  ...twinStep(themingStories, themingStories.ThemingGridButtonSize, 1),
  name: 'Theming — Grid button size, step 1',
  tags: ['!test'],
}

export const HighContrastThemingGridButtonSizeStep2 = {
  ...twinStep(themingStories, themingStories.ThemingGridButtonSize, 2),
  name: 'Theming — Grid button size, step 2',
  tags: ['!test'],
}

export const HighContrastThemeSourcesStep1 = {
  ...twinStep(themingStories, themingStories.ThemeSources, 1),
  name: 'Theming — Theme sources, step 1',
  tags: ['!test'],
}

export const HighContrastThemeSourcesStep2 = {
  ...twinStep(themingStories, themingStories.ThemeSources, 2),
  name: 'Theming — Theme sources, step 2',
  tags: ['!test'],
}

export const HighContrastThemeSourcesStep3 = {
  ...twinStep(themingStories, themingStories.ThemeSources, 3),
  name: 'Theming — Theme sources, step 3',
  tags: ['!test'],
}

export const HighContrastThemeSourcesStep4 = {
  ...twinStep(themingStories, themingStories.ThemeSources, 4),
  name: 'Theming — Theme sources, step 4',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep1 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 1),
  name: 'Data loading/Skeleton — Data arrives, step 1',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep2 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 2),
  name: 'Data loading/Skeleton — Data arrives, step 2',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep3 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 3),
  name: 'Data loading/Skeleton — Data arrives, step 3',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep4 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 4),
  name: 'Data loading/Skeleton — Data arrives, step 4',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep5 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 5),
  name: 'Data loading/Skeleton — Data arrives, step 5',
  tags: ['!test'],
}

export const HighContrastSkeletonDataArrivesStep6 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonDataArrives, 6),
  name: 'Data loading/Skeleton — Data arrives, step 6',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep1 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 1),
  name: 'Data loading/Skeleton — Rows count, step 1',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep2 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 2),
  name: 'Data loading/Skeleton — Rows count, step 2',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep3 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 3),
  name: 'Data loading/Skeleton — Rows count, step 3',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep4 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 4),
  name: 'Data loading/Skeleton — Rows count, step 4',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep5 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 5),
  name: 'Data loading/Skeleton — Rows count, step 5',
  tags: ['!test'],
}

export const HighContrastSkeletonRowsCountStep6 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonRowsCount, 6),
  name: 'Data loading/Skeleton — Rows count, step 6',
  tags: ['!test'],
}

export const HighContrastSkeletonColumnsCountStep1 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonColumnsCount, 1),
  name: 'Data loading/Skeleton — Columns count, step 1',
  tags: ['!test'],
}

export const HighContrastSkeletonColumnsCountStep2 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonColumnsCount, 2),
  name: 'Data loading/Skeleton — Columns count, step 2',
  tags: ['!test'],
}

export const HighContrastSkeletonColumnsCountStep3 = {
  ...twinStep(coreSkeletonStories, coreSkeletonStories.SkeletonColumnsCount, 3),
  name: 'Data loading/Skeleton — Columns count, step 3',
  tags: ['!test'],
}

export const HighContrastStubsNoColumnsStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsNoColumns, 1),
  name: 'Core/Stubs — No columns, step 1',
  tags: ['!test'],
}

export const HighContrastStubsNoColumnsStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsNoColumns, 2),
  name: 'Core/Stubs — No columns, step 2',
  tags: ['!test'],
}

export const HighContrastStubsColumnsHiddenStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsColumnsHidden, 1),
  name: 'Core/Stubs — All columns hidden, step 1',
  tags: ['!test'],
}

export const HighContrastStubsColumnsHiddenStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsColumnsHidden, 2),
  name: 'Core/Stubs — All columns hidden, step 2',
  tags: ['!test'],
}

export const HighContrastStubsNoDataStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsNoData, 1),
  name: 'Core/Stubs — No data, step 1',
  tags: ['!test'],
}

export const HighContrastStubsNoDataStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsNoData, 2),
  name: 'Core/Stubs — No data, step 2',
  tags: ['!test'],
}

export const HighContrastStubsCustomStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsCustom, 1),
  name: 'Core/Stubs — Custom stubs, step 1',
  tags: ['!test'],
}

export const HighContrastStubsCustomStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsCustom, 2),
  name: 'Core/Stubs — Custom stubs, step 2',
  tags: ['!test'],
}

export const HighContrastStubsPluginReasonStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsPluginReason, 1),
  name: 'Core/Stubs — Plugin reason, step 1',
  tags: ['!test'],
}

export const HighContrastStubsPluginReasonStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsPluginReason, 2),
  name: 'Core/Stubs — Plugin reason, step 2',
  tags: ['!test'],
}

export const HighContrastExportOwnButtonStep1 = {
  ...twinStep(exportStories, exportStories.ExportOwnButton, 1),
  name: 'Export — Own button, step 1',
  tags: ['!test'],
}

export const HighContrastExportOwnButtonStep2 = {
  ...twinStep(exportStories, exportStories.ExportOwnButton, 2),
  name: 'Export — Own button, step 2',
  tags: ['!test'],
}

export const HighContrastExportServerInitialLoadingStep1 = {
  ...twinStep(exportStories, exportStories.ExportServerInitialLoading, 1),
  name: 'Export — Server, initial loading, step 1',
  tags: ['!test'],
}

export const HighContrastExportServerInitialLoadingStep2 = {
  ...twinStep(exportStories, exportStories.ExportServerInitialLoading, 2),
  name: 'Export — Server, initial loading, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringExternalFormStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringExternalForm, 1),
  name: 'Filtering — External form, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringExternalFormStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringExternalForm, 2),
  name: 'Filtering — External form, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringExternalFormStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringExternalForm, 3),
  name: 'Filtering — External form, step 3',
  tags: ['!test'],
}

export const HighContrastSavedViewRestoreStep1 = {
  ...twinStep(filteringStories, filteringStories.SavedViewRestore, 1),
  name: 'Filtering — Saved view, step 1',
  tags: ['!test'],
}

export const HighContrastSavedViewRestoreStep2 = {
  ...twinStep(filteringStories, filteringStories.SavedViewRestore, 2),
  name: 'Filtering — Saved view, step 2',
  tags: ['!test'],
}

export const HighContrastSavedViewRestoreStep3 = {
  ...twinStep(filteringStories, filteringStories.SavedViewRestore, 3),
  name: 'Filtering — Saved view, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationOwnPagerStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationOwnPager,
    1,
  ),
  name: 'Panels/Pagination — Own pager, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationOwnPagerStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationOwnPager,
    2,
  ),
  name: 'Panels/Pagination — Own pager, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationOwnPagerStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationOwnPager,
    3,
  ),
  name: 'Panels/Pagination — Own pager, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationServerStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServer,
    1,
  ),
  name: 'Panels/Pagination — Server, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationServerStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServer,
    2,
  ),
  name: 'Panels/Pagination — Server, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationServerStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServer,
    3,
  ),
  name: 'Panels/Pagination — Server, step 3',
  tags: ['!test'],
}

export const HighContrastSelectedCountStep1 = {
  ...twinStep(panelsStatusBarStories, panelsStatusBarStories.SelectedCount, 1),
  name: 'Panels/Status bar — Selected count, step 1',
  tags: ['!test'],
}

export const HighContrastSelectedCountStep2 = {
  ...twinStep(panelsStatusBarStories, panelsStatusBarStories.SelectedCount, 2),
  name: 'Panels/Status bar — Selected count, step 2',
  tags: ['!test'],
}

export const HighContrastSelectedCountStep3 = {
  ...twinStep(panelsStatusBarStories, panelsStatusBarStories.SelectedCount, 3),
  name: 'Panels/Status bar — Selected count, step 3',
  tags: ['!test'],
}

export const HighContrastPanelsNarrowStatusBarStep1 = {
  ...twinStep(
    panelsStatusBarStories,
    panelsStatusBarStories.PanelsNarrowStatusBar,
    1,
  ),
  name: 'Panels/Status bar — Narrow, step 1',
  tags: ['!test'],
}

export const HighContrastPanelsNarrowStatusBarStep2 = {
  ...twinStep(
    panelsStatusBarStories,
    panelsStatusBarStories.PanelsNarrowStatusBar,
    2,
  ),
  name: 'Panels/Status bar — Narrow, step 2',
  tags: ['!test'],
}

export const HighContrastPanelsNarrowStatusBarStep3 = {
  ...twinStep(
    panelsStatusBarStories,
    panelsStatusBarStories.PanelsNarrowStatusBar,
    3,
  ),
  name: 'Panels/Status bar — Narrow, step 3',
  tags: ['!test'],
}

export const HighContrastToolbarInitialLoadingStep1 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarInitialLoading,
    1,
  ),
  name: 'Panels/Toolbar — Initial loading, step 1',
  tags: ['!test'],
}

export const HighContrastToolbarInitialLoadingStep2 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarInitialLoading,
    2,
  ),
  name: 'Panels/Toolbar — Initial loading, step 2',
  tags: ['!test'],
}

export const HighContrastToolbarSearchBeforeDataServerStep1 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarSearchBeforeDataServer,
    1,
  ),
  name: 'Panels/Toolbar — Search before data (server), step 1',
  tags: ['!test'],
}

export const HighContrastToolbarSearchBeforeDataServerStep2 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarSearchBeforeDataServer,
    2,
  ),
  name: 'Panels/Toolbar — Search before data (server), step 2',
  tags: ['!test'],
}

export const HighContrastToolbarSearchBeforeDataServerStep3 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarSearchBeforeDataServer,
    3,
  ),
  name: 'Panels/Toolbar — Search before data (server), step 3',
  tags: ['!test'],
}

export const HighContrastToolbarColumnsArriveStep1 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarColumnsArrive,
    1,
  ),
  name: 'Panels/Toolbar — Columns arrive, step 1',
  tags: ['!test'],
}

export const HighContrastToolbarColumnsArriveStep2 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarColumnsArrive,
    2,
  ),
  name: 'Panels/Toolbar — Columns arrive, step 2',
  tags: ['!test'],
}

export const HighContrastToolbarColumnsArriveStep3 = {
  ...twinStep(
    panelsToolbarStories,
    panelsToolbarStories.ToolbarColumnsArrive,
    3,
  ),
  name: 'Panels/Toolbar — Columns arrive, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiReactiveArgsStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReactiveArgs, 1),
  name: 'Plugin API — Reactive arguments, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiReactiveArgsStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReactiveArgs, 2),
  name: 'Plugin API — Reactive arguments, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiReactiveArgsStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReactiveArgs, 3),
  name: 'Plugin API — Reactive arguments, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiReactiveArgsStep4 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReactiveArgs, 4),
  name: 'Plugin API — Reactive arguments, step 4',
  tags: ['!test'],
}

export const HighContrastSessionCallbacksStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.SessionCallbacks, 1),
  name: 'Plugin API — Drag callbacks, step 1',
  tags: ['!test'],
}

export const HighContrastSessionCallbacksStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.SessionCallbacks, 2),
  name: 'Plugin API — Drag callbacks, step 2',
  tags: ['!test'],
}

export const HighContrastSessionCallbacksStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.SessionCallbacks, 3),
  name: 'Plugin API — Drag callbacks, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiDebugActionsStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiDebugActions, 1),
  name: 'Plugin API — Debug actions, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiDebugActionsStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiDebugActions, 2),
  name: 'Plugin API — Debug actions, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiDebugActionsStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiDebugActions, 3),
  name: 'Plugin API — Debug actions, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiReportActionStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReportAction, 1),
  name: 'Plugin API — Report action, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiReportActionStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReportAction, 2),
  name: 'Plugin API — Report action, step 2',
  tags: ['!test'],
}

export const HighContrastOutcomeFlashFromAppStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.OutcomeFlashFromApp, 1),
  name: 'Plugin API — Outcome flash, step 1',
  tags: ['!test'],
}

export const HighContrastOutcomeFlashFromAppStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.OutcomeFlashFromApp, 2),
  name: 'Plugin API — Outcome flash, step 2',
  tags: ['!test'],
}

export const HighContrastOutcomeFlashFromAppStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.OutcomeFlashFromApp, 3),
  name: 'Plugin API — Outcome flash, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiRevokeEditingStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiRevokeEditing, 1),
  name: 'Plugin API — Revoke editing, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiRevokeEditingStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiRevokeEditing, 2),
  name: 'Plugin API — Revoke editing, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiRevokeEditingStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiRevokeEditing, 3),
  name: 'Plugin API — Revoke editing, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiResizeCallbacksStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiResizeCallbacks, 1),
  name: 'Plugin API — Resize callbacks, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiResizeCallbacksStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiResizeCallbacks, 2),
  name: 'Plugin API — Resize callbacks, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiResizeCallbacksStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiResizeCallbacks, 3),
  name: 'Plugin API — Resize callbacks, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiCellButtonStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCellButton, 1),
  name: 'Plugin API — Cell button, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiCellButtonStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCellButton, 2),
  name: 'Plugin API — Cell button, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiCellButtonStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCellButton, 3),
  name: 'Plugin API — Cell button, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiControlledStateStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiControlledState, 1),
  name: 'Plugin API — Controlled state, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiControlledStateStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiControlledState, 2),
  name: 'Plugin API — Controlled state, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiControlledStateStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiControlledState, 3),
  name: 'Plugin API — Controlled state, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiServiceColumnStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiServiceColumn, 1),
  name: 'Plugin API — Service column, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiServiceColumnStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiServiceColumn, 2),
  name: 'Plugin API — Service column, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiPluginCrashStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiPluginCrash, 1),
  name: 'Plugin API — Plugin crash, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiPluginCrashStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiPluginCrash, 2),
  name: 'Plugin API — Plugin crash, step 2',
  tags: ['!test'],
}

export const HighContrastGroupingByApplicationStep1 = {
  ...twinStep(
    rowsGroupingStories,
    rowsGroupingStories.GroupingByApplication,
    1,
  ),
  name: 'Rows/Grouping — By application, step 1',
  tags: ['!test'],
}

export const HighContrastGroupingByApplicationStep2 = {
  ...twinStep(
    rowsGroupingStories,
    rowsGroupingStories.GroupingByApplication,
    2,
  ),
  name: 'Rows/Grouping — By application, step 2',
  tags: ['!test'],
}

export const HighContrastGroupingByApplicationStep3 = {
  ...twinStep(
    rowsGroupingStories,
    rowsGroupingStories.GroupingByApplication,
    3,
  ),
  name: 'Rows/Grouping — By application, step 3',
  tags: ['!test'],
}

export const HighContrastSelectionByRowClickStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionByRowClick,
    1,
  ),
  name: 'Rows/Selection — By row click, step 1',
  tags: ['!test'],
}

export const HighContrastSelectionByRowClickStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionByRowClick,
    2,
  ),
  name: 'Rows/Selection — By row click, step 2',
  tags: ['!test'],
}

export const HighContrastSelectionByRowClickStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionByRowClick,
    3,
  ),
  name: 'Rows/Selection — By row click, step 3',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    1,
  ),
  name: 'Rows/Selection — Select all found rows, step 1',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    2,
  ),
  name: 'Rows/Selection — Select all found rows, step 2',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    3,
  ),
  name: 'Rows/Selection — Select all found rows, step 3',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep4 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    4,
  ),
  name: 'Rows/Selection — Select all found rows, step 4',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep5 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    5,
  ),
  name: 'Rows/Selection — Select all found rows, step 5',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllCurrentPageStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllCurrentPage,
    1,
  ),
  name: 'Rows/Selection — Select all on the page, step 1',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllCurrentPageStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllCurrentPage,
    2,
  ),
  name: 'Rows/Selection — Select all on the page, step 2',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllCurrentPageStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllCurrentPage,
    3,
  ),
  name: 'Rows/Selection — Select all on the page, step 3',
  tags: ['!test'],
}

export const HighContrastTreeDataReadOnlyStep1 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataReadOnly, 1),
  name: 'Rows/Tree data — Read only, step 1',
  tags: ['!test'],
}

export const HighContrastTreeDataReadOnlyStep2 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataReadOnly, 2),
  name: 'Rows/Tree data — Read only, step 2',
  tags: ['!test'],
}

export const HighContrastTreeDataReadOnlyStep3 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataReadOnly, 3),
  name: 'Rows/Tree data — Read only, step 3',
  tags: ['!test'],
}

export const HighContrastTreeDataWithToggleStep1 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataWithToggle, 1),
  name: 'Rows/Tree data — With toggle, step 1',
  tags: ['!test'],
}

export const HighContrastTreeDataWithToggleStep2 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataWithToggle, 2),
  name: 'Rows/Tree data — With toggle, step 2',
  tags: ['!test'],
}

export const HighContrastTreeDataWithToggleStep3 = {
  ...twinStep(rowsTreeDataStories, rowsTreeDataStories.TreeDataWithToggle, 3),
  name: 'Rows/Tree data — With toggle, step 3',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep1 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 1),
  name: 'Rows/Dragging — Move, step 1',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep2 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 2),
  name: 'Rows/Dragging — Move, step 2',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep3 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 3),
  name: 'Rows/Dragging — Move, step 3',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep4 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 4),
  name: 'Rows/Dragging — Move, step 4',
  tags: ['!test'],
}

export const HighContrastRowDraggingMoveStep5 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 5),
  name: 'Rows/Dragging — Move, step 5',
  tags: ['!test'],
}

export const HighContrastRowDraggingCollapsedGroupsStep1 = {
  ...twinStep(
    rowsDraggingStories,
    rowsDraggingStories.RowDraggingCollapsedGroups,
    1,
  ),
  name: 'Rows/Dragging — Collapsed groups, step 1',
  tags: ['!test'],
}

export const HighContrastRowDraggingCollapsedGroupsStep2 = {
  ...twinStep(
    rowsDraggingStories,
    rowsDraggingStories.RowDraggingCollapsedGroups,
    2,
  ),
  name: 'Rows/Dragging — Collapsed groups, step 2',
  tags: ['!test'],
}

export const HighContrastRowDraggingCollapsedGroupsStep3 = {
  ...twinStep(
    rowsDraggingStories,
    rowsDraggingStories.RowDraggingCollapsedGroups,
    3,
  ),
  name: 'Rows/Dragging — Collapsed groups, step 3',
  tags: ['!test'],
}

export const HighContrastColumnDraggingMoveStep1 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingMove,
    1,
  ),
  name: 'Columns/Dragging — Move, step 1',
  tags: ['!test'],
}

export const HighContrastColumnDraggingMoveStep2 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingMove,
    2,
  ),
  name: 'Columns/Dragging — Move, step 2',
  tags: ['!test'],
}

export const HighContrastColumnDraggingMoveStep3 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingMove,
    3,
  ),
  name: 'Columns/Dragging — Move, step 3',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep1 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    1,
  ),
  name: 'Columns/Dragging — Dragging — Server, step 1',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep2 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    2,
  ),
  name: 'Columns/Dragging — Dragging — Server, step 2',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep3 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    3,
  ),
  name: 'Columns/Dragging — Dragging — Server, step 3',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep4 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    4,
  ),
  name: 'Columns/Dragging — Dragging — Server, step 4',
  tags: ['!test'],
}

export const HighContrastColumnDraggingServerStep5 = {
  ...twinStep(
    columnsDraggingStories,
    columnsDraggingStories.ColumnDraggingServer,
    5,
  ),
  name: 'Columns/Dragging — Dragging — Server, step 5',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep1 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 1),
  name: 'Rows/Dragging — Lazy tree (server), step 1',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep2 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 2),
  name: 'Rows/Dragging — Lazy tree (server), step 2',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep3 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 3),
  name: 'Rows/Dragging — Lazy tree (server), step 3',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep4 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 4),
  name: 'Rows/Dragging — Lazy tree (server), step 4',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep5 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 5),
  name: 'Rows/Dragging — Lazy tree (server), step 5',
  tags: ['!test'],
}

export const HighContrastRowDraggingLazyTreeStep6 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingLazyTree, 6),
  name: 'Rows/Dragging — Lazy tree (server), step 6',
  tags: ['!test'],
}

export const HighContrastLocalizationFromJsonStep1 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFromJson,
    1,
  ),
  name: 'Customization/Localization — From JSON, step 1',
  tags: ['!test'],
}

export const HighContrastLocalizationFromJsonStep2 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFromJson,
    2,
  ),
  name: 'Customization/Localization — From JSON, step 2',
  tags: ['!test'],
}

export const HighContrastLocalizationFromJsonStep3 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFromJson,
    3,
  ),
  name: 'Customization/Localization — From JSON, step 3',
  tags: ['!test'],
}

export const HighContrastLocalizationFromJsonStep4 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFromJson,
    4,
  ),
  name: 'Customization/Localization — From JSON, step 4',
  tags: ['!test'],
}

export const HighContrastLocalizationSwitchStep1 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationSwitch,
    1,
  ),
  name: 'Customization/Localization — Switch language, step 1',
  tags: ['!test'],
}

export const HighContrastLocalizationSwitchStep2 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationSwitch,
    2,
  ),
  name: 'Customization/Localization — Switch language, step 2',
  tags: ['!test'],
}

export const HighContrastLocalizationSwitchStep3 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationSwitch,
    3,
  ),
  name: 'Customization/Localization — Switch language, step 3',
  tags: ['!test'],
}

export const HighContrastLocalizationOverridesStep1 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationOverrides,
    1,
  ),
  name: 'Customization/Localization — Own wording, step 1',
  tags: ['!test'],
}

export const HighContrastLocalizationOverridesStep2 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationOverrides,
    2,
  ),
  name: 'Customization/Localization — Own wording, step 2',
  tags: ['!test'],
}

export const HighContrastLocalizationFunctionStep1 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFunction,
    1,
  ),
  name: 'Customization/Localization — Function label, step 1',
  tags: ['!test'],
}

export const HighContrastLocalizationFunctionStep2 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFunction,
    2,
  ),
  name: 'Customization/Localization — Function label, step 2',
  tags: ['!test'],
}

export const HighContrastLocalizationFunctionStep3 = {
  ...twinStep(
    customizationLocalizationStories,
    customizationLocalizationStories.LocalizationFunction,
    3,
  ),
  name: 'Customization/Localization — Function label, step 3',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep1 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    1,
  ),
  name: 'Columns/Visibility — Toggle all, step 1',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep2 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    2,
  ),
  name: 'Columns/Visibility — Toggle all, step 2',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep3 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    3,
  ),
  name: 'Columns/Visibility — Toggle all, step 3',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep4 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    4,
  ),
  name: 'Columns/Visibility — Toggle all, step 4',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityToggleAllStep5 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityToggleAll,
    5,
  ),
  name: 'Columns/Visibility — Toggle all, step 5',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityNestedTreeStep1 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityNestedTree,
    1,
  ),
  name: 'Columns/Visibility — Nested headers, step 1',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityNestedTreeStep2 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityNestedTree,
    2,
  ),
  name: 'Columns/Visibility — Nested headers, step 2',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityNestedTreeStep3 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityNestedTree,
    3,
  ),
  name: 'Columns/Visibility — Nested headers, step 3',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityNestedTreeStep4 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityNestedTree,
    4,
  ),
  name: 'Columns/Visibility — Nested headers, step 4',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefreshStep1 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorRefresh, 1),
  name: 'Data loading/Load error — Refresh error, step 1',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefreshStep2 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorRefresh, 2),
  name: 'Data loading/Load error — Refresh error, step 2',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefreshStep3 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorRefresh, 3),
  name: 'Data loading/Load error — Refresh error, step 3',
  tags: ['!test'],
}

export const HighContrastLoadErrorRefreshStep4 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorRefresh, 4),
  name: 'Data loading/Load error — Refresh error, step 4',
  tags: ['!test'],
}

export const HighContrastLoadErrorFirstLoadStep1 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorFirstLoad, 1),
  name: 'Data loading/Load error — First load error, step 1',
  tags: ['!test'],
}

export const HighContrastLoadErrorFirstLoadStep2 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorFirstLoad, 2),
  name: 'Data loading/Load error — First load error, step 2',
  tags: ['!test'],
}

export const HighContrastLoadErrorFirstLoadStep3 = {
  ...twinStep(coreLoadErrorStories, coreLoadErrorStories.LoadErrorFirstLoad, 3),
  name: 'Data loading/Load error — First load error, step 3',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep1 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    1,
  ),
  name: 'Data loading/Server actions — Refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep2 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    2,
  ),
  name: 'Data loading/Server actions — Refused by the server, step 2',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep3 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    3,
  ),
  name: 'Data loading/Server actions — Refused by the server, step 3',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep4 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    4,
  ),
  name: 'Data loading/Server actions — Refused by the server, step 4',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep5 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    5,
  ),
  name: 'Data loading/Server actions — Refused by the server, step 5',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep6 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    6,
  ),
  name: 'Data loading/Server actions — Refused by the server, step 6',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep7 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    7,
  ),
  name: 'Data loading/Server actions — Refused by the server, step 7',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep8 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    8,
  ),
  name: 'Data loading/Server actions — Refused by the server, step 8',
  tags: ['!test'],
}

export const HighContrastRefreshDataUpdateStep1 = {
  ...twinStep(
    dataLoadingRefreshStories,
    dataLoadingRefreshStories.RefreshDataUpdate,
    1,
  ),
  name: 'Data loading/Refresh — Data update, step 1',
  tags: ['!test'],
}

export const HighContrastRefreshDataUpdateStep2 = {
  ...twinStep(
    dataLoadingRefreshStories,
    dataLoadingRefreshStories.RefreshDataUpdate,
    2,
  ),
  name: 'Data loading/Refresh — Data update, step 2',
  tags: ['!test'],
}

export const HighContrastRefreshDataUpdateStep3 = {
  ...twinStep(
    dataLoadingRefreshStories,
    dataLoadingRefreshStories.RefreshDataUpdate,
    3,
  ),
  name: 'Data loading/Refresh — Data update, step 3',
  tags: ['!test'],
}

export const HighContrastIconsOwnSetStep1 = {
  ...twinStep(
    customizationIconsStories,
    customizationIconsStories.IconsOwnSet,
    1,
  ),
  name: 'Customization/Icons — Own icons, step 1',
  tags: ['!test'],
}

export const HighContrastIconsOwnSetStep2 = {
  ...twinStep(
    customizationIconsStories,
    customizationIconsStories.IconsOwnSet,
    2,
  ),
  name: 'Customization/Icons — Own icons, step 2',
  tags: ['!test'],
}

export const HighContrastLongTextCellsStep1 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextCells, 1),
  name: 'Core/Long text — Cells, step 1',
  tags: ['!test'],
}

export const HighContrastLongTextCellsStep2 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextCells, 2),
  name: 'Core/Long text — Cells, step 2',
  tags: ['!test'],
}

export const HighContrastLongTextMenusStep1 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextMenus, 1),
  name: 'Core/Long text — Menus and panels, step 1',
  tags: ['!test'],
}

export const HighContrastLongTextMenusStep2 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextMenus, 2),
  name: 'Core/Long text — Menus and panels, step 2',
  tags: ['!test'],
}

export const HighContrastLongTextMenusStep3 = {
  ...twinStep(coreLongTextStories, coreLongTextStories.LongTextMenus, 3),
  name: 'Core/Long text — Menus and panels, step 3',
  tags: ['!test'],
}

export const HighContrastHeaderGroupedStep1 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGrouped,
    1,
  ),
  name: 'Columns/Header groups — Grouped columns, step 1',
  tags: ['!test'],
}

export const HighContrastHeaderGroupedStep2 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGrouped,
    2,
  ),
  name: 'Columns/Header groups — Grouped columns, step 2',
  tags: ['!test'],
}

export const HighContrastHeaderGroupedStep3 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGrouped,
    3,
  ),
  name: 'Columns/Header groups — Grouped columns, step 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuInMenuStep1 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuInMenu,
    1,
  ),
  name: 'Columns/Header menu — Actions in menu, step 1',
  tags: ['!test'],
}

export const HighContrastHeaderMenuInMenuStep2 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuInMenu,
    2,
  ),
  name: 'Columns/Header menu — Actions in menu, step 2',
  tags: ['!test'],
}

export const HighContrastHeaderMenuInMenuStep3 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuInMenu,
    3,
  ),
  name: 'Columns/Header menu — Actions in menu, step 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuInMenuStep4 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuInMenu,
    4,
  ),
  name: 'Columns/Header menu — Actions in menu, step 4',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep1 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    1,
  ),
  name: 'Columns/Header menu — Active actions, step 1',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep2 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    2,
  ),
  name: 'Columns/Header menu — Active actions, step 2',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep3 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    3,
  ),
  name: 'Columns/Header menu — Active actions, step 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep4 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    4,
  ),
  name: 'Columns/Header menu — Active actions, step 4',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep5 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    5,
  ),
  name: 'Columns/Header menu — Active actions, step 5',
  tags: ['!test'],
}

export const HighContrastHeaderMenuActiveActionsStep6 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuActiveActions,
    6,
  ),
  name: 'Columns/Header menu — Active actions, step 6',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep1 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    1,
  ),
  name: 'Columns/Header menu — Async actions, step 1',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep2 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    2,
  ),
  name: 'Columns/Header menu — Async actions, step 2',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep3 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    3,
  ),
  name: 'Columns/Header menu — Async actions, step 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep4 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    4,
  ),
  name: 'Columns/Header menu — Async actions, step 4',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep5 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    5,
  ),
  name: 'Columns/Header menu — Async actions, step 5',
  tags: ['!test'],
}

export const HighContrastHeaderMenuAsyncActionsStep6 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuAsyncActions,
    6,
  ),
  name: 'Columns/Header menu — Async actions, step 6',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep1 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    1,
  ),
  name: 'Columns/Header menu — Narrow column, step 1',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep2 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    2,
  ),
  name: 'Columns/Header menu — Narrow column, step 2',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep3 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    3,
  ),
  name: 'Columns/Header menu — Narrow column, step 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep4 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    4,
  ),
  name: 'Columns/Header menu — Narrow column, step 4',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep5 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    5,
  ),
  name: 'Columns/Header menu — Narrow column, step 5',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep6 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    6,
  ),
  name: 'Columns/Header menu — Narrow column, step 6',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep1 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 1),
  name: 'Columns/Pinning — Pin columns, step 1',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep2 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 2),
  name: 'Columns/Pinning — Pin columns, step 2',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep3 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 3),
  name: 'Columns/Pinning — Pin columns, step 3',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep4 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 4),
  name: 'Columns/Pinning — Pin columns, step 4',
  tags: ['!test'],
}

export const HighContrastPinningColumnsStep5 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningColumns, 5),
  name: 'Columns/Pinning — Pin columns, step 5',
  tags: ['!test'],
}

export const HighContrastPinningNestedStep1 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningNested, 1),
  name: 'Columns/Pinning — Header groups, step 1',
  tags: ['!test'],
}

export const HighContrastPinningNestedStep2 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningNested, 2),
  name: 'Columns/Pinning — Header groups, step 2',
  tags: ['!test'],
}

export const HighContrastPinningNestedStep3 = {
  ...twinStep(columnsPinningStories, columnsPinningStories.PinningNested, 3),
  name: 'Columns/Pinning — Header groups, step 3',
  tags: ['!test'],
}

export const HighContrastResizingColumnsStep1 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingColumns,
    1,
  ),
  name: 'Columns/Resizing — Resize columns, step 1',
  tags: ['!test'],
}

export const HighContrastResizingColumnsStep2 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingColumns,
    2,
  ),
  name: 'Columns/Resizing — Resize columns, step 2',
  tags: ['!test'],
}

export const HighContrastResizingColumnsStep3 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingColumns,
    3,
  ),
  name: 'Columns/Resizing — Resize columns, step 3',
  tags: ['!test'],
}

export const HighContrastResizingColumnsStep4 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingColumns,
    4,
  ),
  name: 'Columns/Resizing — Resize columns, step 4',
  tags: ['!test'],
}

export const HighContrastResizingPastEdgeStep1 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingPastEdge,
    1,
  ),
  name: 'Columns/Resizing — Resize past the edge, step 1',
  tags: ['!test'],
}

export const HighContrastResizingPastEdgeStep2 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingPastEdge,
    2,
  ),
  name: 'Columns/Resizing — Resize past the edge, step 2',
  tags: ['!test'],
}

export const HighContrastResizingPastEdgeStep3 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.ResizingPastEdge,
    3,
  ),
  name: 'Columns/Resizing — Resize past the edge, step 3',
  tags: ['!test'],
}

export const HighContrastDraggingNestedStep1 = {
  ...twinStep(columnsDraggingStories, columnsDraggingStories.DraggingNested, 1),
  name: 'Columns/Dragging — Header groups, step 1',
  tags: ['!test'],
}

export const HighContrastDraggingNestedStep2 = {
  ...twinStep(columnsDraggingStories, columnsDraggingStories.DraggingNested, 2),
  name: 'Columns/Dragging — Header groups, step 2',
  tags: ['!test'],
}

export const HighContrastDraggingNestedStep3 = {
  ...twinStep(columnsDraggingStories, columnsDraggingStories.DraggingNested, 3),
  name: 'Columns/Dragging — Header groups, step 3',
  tags: ['!test'],
}

export const HighContrastEditingValueStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingValue, 1),
  name: 'Cells/Editing — Edit a value, step 1',
  tags: ['!test'],
}

export const HighContrastEditingValueStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingValue, 2),
  name: 'Cells/Editing — Edit a value, step 2',
  tags: ['!test'],
}

export const HighContrastEditingValueStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingValue, 3),
  name: 'Cells/Editing — Edit a value, step 3',
  tags: ['!test'],
}

export const HighContrastEditingServerStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 1),
  name: 'Cells/Editing — Server save, step 1',
  tags: ['!test'],
}

export const HighContrastEditingServerStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 2),
  name: 'Cells/Editing — Server save, step 2',
  tags: ['!test'],
}

export const HighContrastEditingServerStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 3),
  name: 'Cells/Editing — Server save, step 3',
  tags: ['!test'],
}

export const HighContrastEditingServerStep4 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 4),
  name: 'Cells/Editing — Server save, step 4',
  tags: ['!test'],
}

export const HighContrastEditingServerStep5 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 5),
  name: 'Cells/Editing — Server save, step 5',
  tags: ['!test'],
}

export const HighContrastEditingRevertedWhileAwayStep1 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.EditingRevertedWhileAway,
    1,
  ),
  name: 'Cells/Editing — Refused while editing another cell, step 1',
  tags: ['!test'],
}

export const HighContrastEditingRevertedWhileAwayStep2 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.EditingRevertedWhileAway,
    2,
  ),
  name: 'Cells/Editing — Refused while editing another cell, step 2',
  tags: ['!test'],
}

export const HighContrastEditingRevertedWhileAwayStep3 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.EditingRevertedWhileAway,
    3,
  ),
  name: 'Cells/Editing — Refused while editing another cell, step 3',
  tags: ['!test'],
}

export const HighContrastEditingRevertedWhileAwayStep4 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.EditingRevertedWhileAway,
    4,
  ),
  name: 'Cells/Editing — Refused while editing another cell, step 4',
  tags: ['!test'],
}

export const HighContrastExpandingRejectedStep1 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingRejected, 1),
  name: 'Rows/Expanding — Expand refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastExpandingRejectedStep2 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingRejected, 2),
  name: 'Rows/Expanding — Expand refused by the server, step 2',
  tags: ['!test'],
}

export const HighContrastExpandingRejectedStep3 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingRejected, 3),
  name: 'Rows/Expanding — Expand refused by the server, step 3',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 1),
  name: 'Cells/Editing — Draft survives, step 1',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 2),
  name: 'Cells/Editing — Draft survives, step 2',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 3),
  name: 'Cells/Editing — Draft survives, step 3',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep4 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 4),
  name: 'Cells/Editing — Draft survives, step 4',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep5 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 5),
  name: 'Cells/Editing — Draft survives, step 5',
  tags: ['!test'],
}

export const HighContrastEditingConflictStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingConflict, 1),
  name: 'Cells/Editing — Conflict blocks save, step 1',
  tags: ['!test'],
}

export const HighContrastEditingConflictStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingConflict, 2),
  name: 'Cells/Editing — Conflict blocks save, step 2',
  tags: ['!test'],
}

export const HighContrastEditingConflictStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingConflict, 3),
  name: 'Cells/Editing — Conflict blocks save, step 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    1,
  ),
  name: 'Cells/Selection — Select and copy, step 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    2,
  ),
  name: 'Cells/Selection — Select and copy, step 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep3 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    3,
  ),
  name: 'Cells/Selection — Select and copy, step 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep4 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    4,
  ),
  name: 'Cells/Selection — Select and copy, step 4',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep5 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    5,
  ),
  name: 'Cells/Selection — Select and copy, step 5',
  tags: ['!test'],
}

export const HighContrastCellSelectionPredicateStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionPredicate,
    1,
  ),
  name: 'Cells/Selection — Forbidden column, step 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionPredicateStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionPredicate,
    2,
  ),
  name: 'Cells/Selection — Forbidden column, step 2',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    1,
  ),
  name: 'Cells/Context menu — Menu on a cell, step 1',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    2,
  ),
  name: 'Cells/Context menu — Menu on a cell, step 2',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    3,
  ),
  name: 'Cells/Context menu — Menu on a cell, step 3',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    4,
  ),
  name: 'Cells/Context menu — Menu on a cell, step 4',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep5 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    5,
  ),
  name: 'Cells/Context menu — Menu on a cell, step 5',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectionStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelection,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Select a group, step 1',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectionStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelection,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Select a group, step 2',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectionStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelection,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Select a group, step 3',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectionStep4 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelection,
    4,
  ),
  name: 'Data loading/Server row model/Selection — Select a group, step 4',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectResetStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectReset,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Regrouping clears the selection, step 1',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectResetStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectReset,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Regrouping clears the selection, step 2',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectResetStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectReset,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Regrouping clears the selection, step 3',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectCountStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectCount,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Count without group sizes, step 1',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectCountStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectCount,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Count without group sizes, step 2',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectCountStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectCount,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Count without group sizes, step 3',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, step 1',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, step 2',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, step 3',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep4 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    4,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, step 4',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep5 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    5,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, step 5',
  tags: ['!test'],
}

export const HighContrastCellErrorsFixValuesStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsFixValues, 1),
  name: 'Cells/Errors — Fix invalid values, step 1',
  tags: ['!test'],
}

export const HighContrastCellErrorsFixValuesStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsFixValues, 2),
  name: 'Cells/Errors — Fix invalid values, step 2',
  tags: ['!test'],
}

export const HighContrastCellErrorsReadOnlyStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsReadOnly, 1),
  name: 'Cells/Errors — Read-only table, step 1',
  tags: ['!test'],
}

export const HighContrastCellErrorsReadOnlyStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsReadOnly, 2),
  name: 'Cells/Errors — Read-only table, step 2',
  tags: ['!test'],
}

export const HighContrastCellErrorsRefusalStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsRefusal, 1),
  name: 'Cells/Errors — Refusal and data error, step 1',
  tags: ['!test'],
}

export const HighContrastCellErrorsRefusalStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsRefusal, 2),
  name: 'Cells/Errors — Refusal and data error, step 2',
  tags: ['!test'],
}

export const HighContrastCellErrorsRefusalStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsRefusal, 3),
  name: 'Cells/Errors — Refusal and data error, step 3',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 1),
  name: 'Cells/Errors — Refused edit and retry, step 1',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 2),
  name: 'Cells/Errors — Refused edit and retry, step 2',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 3),
  name: 'Cells/Errors — Refused edit and retry, step 3',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep4 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 4),
  name: 'Cells/Errors — Refused edit and retry, step 4',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep5 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 5),
  name: 'Cells/Errors — Refused edit and retry, step 5',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscard, 1),
  name: 'Cells/Errors — Refused checkbox, discard, step 1',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscard, 2),
  name: 'Cells/Errors — Refused checkbox, discard, step 2',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscard, 3),
  name: 'Cells/Errors — Refused checkbox, discard, step 3',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardStep4 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscard, 4),
  name: 'Cells/Errors — Refused checkbox, discard, step 4',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardMenuStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscardMenu, 1),
  name: 'Cells/Errors — Discard from the menu, step 1',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardMenuStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscardMenu, 2),
  name: 'Cells/Errors — Discard from the menu, step 2',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardMenuStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscardMenu, 3),
  name: 'Cells/Errors — Discard from the menu, step 3',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardMenuStep4 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscardMenu, 4),
  name: 'Cells/Errors — Discard from the menu, step 4',
  tags: ['!test'],
}

export const HighContrastCellFailureExternalChangeStep1 = {
  ...twinStep(
    cellsErrorsStories,
    cellsErrorsStories.CellFailureExternalChange,
    1,
  ),
  name: 'Cells/Errors — Value changed elsewhere, step 1',
  tags: ['!test'],
}

export const HighContrastCellFailureExternalChangeStep2 = {
  ...twinStep(
    cellsErrorsStories,
    cellsErrorsStories.CellFailureExternalChange,
    2,
  ),
  name: 'Cells/Errors — Value changed elsewhere, step 2',
  tags: ['!test'],
}

export const HighContrastCellFailureExternalChangeStep3 = {
  ...twinStep(
    cellsErrorsStories,
    cellsErrorsStories.CellFailureExternalChange,
    3,
  ),
  name: 'Cells/Errors — Value changed elsewhere, step 3',
  tags: ['!test'],
}

export const HighContrastCellFailureExternalChangeStep4 = {
  ...twinStep(
    cellsErrorsStories,
    cellsErrorsStories.CellFailureExternalChange,
    4,
  ),
  name: 'Cells/Errors — Value changed elsewhere, step 4',
  tags: ['!test'],
}

export const HighContrastCellFailureAppResetStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureAppReset, 1),
  name: 'Cells/Errors — Reset by the application, step 1',
  tags: ['!test'],
}

export const HighContrastCellFailureAppResetStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureAppReset, 2),
  name: 'Cells/Errors — Reset by the application, step 2',
  tags: ['!test'],
}

export const HighContrastCellFailureAppResetStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureAppReset, 3),
  name: 'Cells/Errors — Reset by the application, step 3',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    1,
  ),
  name: 'Cells/Context menu — Async items, step 1',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    2,
  ),
  name: 'Cells/Context menu — Async items, step 2',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    3,
  ),
  name: 'Cells/Context menu — Async items, step 3',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    4,
  ),
  name: 'Cells/Context menu — Async items, step 4',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep5 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    5,
  ),
  name: 'Cells/Context menu — Async items, step 5',
  tags: ['!test'],
}

export const HighContrastContextMenuRefusedOnSelectionStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuRefusedOnSelection,
    1,
  ),
  name: 'Cells/Context menu — Refused on a selection, step 1',
  tags: ['!test'],
}

export const HighContrastContextMenuRefusedOnSelectionStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuRefusedOnSelection,
    2,
  ),
  name: 'Cells/Context menu — Refused on a selection, step 2',
  tags: ['!test'],
}

export const HighContrastContextMenuRefusedOnSelectionStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuRefusedOnSelection,
    3,
  ),
  name: 'Cells/Context menu — Refused on a selection, step 3',
  tags: ['!test'],
}

export const HighContrastContextMenuRefusedOnSelectionStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuRefusedOnSelection,
    4,
  ),
  name: 'Cells/Context menu — Refused on a selection, step 4',
  tags: ['!test'],
}

export const HighContrastContextMenuDangerActionStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuDangerAction,
    1,
  ),
  name: 'Cells/Context menu — Own dangerous action, step 1',
  tags: ['!test'],
}

export const HighContrastContextMenuDangerActionStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuDangerAction,
    2,
  ),
  name: 'Cells/Context menu — Own dangerous action, step 2',
  tags: ['!test'],
}

export const HighContrastContextMenuDangerActionStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuDangerAction,
    3,
  ),
  name: 'Cells/Context menu — Own dangerous action, step 3',
  tags: ['!test'],
}

export const HighContrastRowActionsCancelStep1 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsCancel, 1),
  name: 'Rows/Actions — Cancel an action, step 1',
  tags: ['!test'],
}

export const HighContrastRowActionsCancelStep2 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsCancel, 2),
  name: 'Rows/Actions — Cancel an action, step 2',
  tags: ['!test'],
}

export const HighContrastRowActionsCancelStep3 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsCancel, 3),
  name: 'Rows/Actions — Cancel an action, step 3',
  tags: ['!test'],
}

export const HighContrastRowActionsCancelStep4 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsCancel, 4),
  name: 'Rows/Actions — Cancel an action, step 4',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    1,
  ),
  name: 'Cells/Context menu — Cancel from the menu, step 1',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    2,
  ),
  name: 'Cells/Context menu — Cancel from the menu, step 2',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    3,
  ),
  name: 'Cells/Context menu — Cancel from the menu, step 3',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    4,
  ),
  name: 'Cells/Context menu — Cancel from the menu, step 4',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep5 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    5,
  ),
  name: 'Cells/Context menu — Cancel from the menu, step 5',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSearchStep1 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSearch,
    1,
  ),
  name: 'Data loading/Server actions — Cancel a search, step 1',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSearchStep2 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSearch,
    2,
  ),
  name: 'Data loading/Server actions — Cancel a search, step 2',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSearchStep3 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSearch,
    3,
  ),
  name: 'Data loading/Server actions — Cancel a search, step 3',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSearchStep4 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSearch,
    4,
  ),
  name: 'Data loading/Server actions — Cancel a search, step 4',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSortStep1 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSort,
    1,
  ),
  name: 'Data loading/Server actions — Cancel sorting, step 1',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSortStep2 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSort,
    2,
  ),
  name: 'Data loading/Server actions — Cancel sorting, step 2',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSortStep3 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSort,
    3,
  ),
  name: 'Data loading/Server actions — Cancel sorting, step 3',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSortStep4 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSort,
    4,
  ),
  name: 'Data loading/Server actions — Cancel sorting, step 4',
  tags: ['!test'],
}

export const HighContrastExportCancelStep1 = {
  ...twinStep(exportStories, exportStories.ExportCancel, 1),
  name: 'Export — Cancel an export, step 1',
  tags: ['!test'],
}

export const HighContrastExportCancelStep2 = {
  ...twinStep(exportStories, exportStories.ExportCancel, 2),
  name: 'Export — Cancel an export, step 2',
  tags: ['!test'],
}

export const HighContrastExportCancelStep3 = {
  ...twinStep(exportStories, exportStories.ExportCancel, 3),
  name: 'Export — Cancel an export, step 3',
  tags: ['!test'],
}

export const HighContrastExportCancelStep4 = {
  ...twinStep(exportStories, exportStories.ExportCancel, 4),
  name: 'Export — Cancel an export, step 4',
  tags: ['!test'],
}

export const HighContrastPluginApiCancelPendingStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCancelPending, 1),
  name: 'Plugin API — Cancel everything pending, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiCancelPendingStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCancelPending, 2),
  name: 'Plugin API — Cancel everything pending, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiCancelPendingStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCancelPending, 3),
  name: 'Plugin API — Cancel everything pending, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyAttributesStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyAttributes, 1),
  name: 'Plugin API — Body attributes, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyAttributesStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyAttributes, 2),
  name: 'Plugin API — Body attributes, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyAttributesStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyAttributes, 3),
  name: 'Plugin API — Body attributes, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyEventsStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyEvents, 1),
  name: 'Plugin API — Body events, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyEventsStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyEvents, 2),
  name: 'Plugin API — Body events, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyEventsStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyEvents, 3),
  name: 'Plugin API — Body events, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyKeysStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyKeys, 1),
  name: 'Plugin API — Body keys, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyKeysStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyKeys, 2),
  name: 'Plugin API — Body keys, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyKeysStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyKeys, 3),
  name: 'Plugin API — Body keys, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerCancelStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerCancel, 1),
  name: 'Filtering — Cancel a server filter, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerCancelStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerCancel, 2),
  name: 'Filtering — Cancel a server filter, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerCancelStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerCancel, 3),
  name: 'Filtering — Cancel a server filter, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerCancelStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerCancel, 4),
  name: 'Filtering — Cancel a server filter, step 4',
  tags: ['!test'],
}

export const HighContrastPaginationServerCancelStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerCancel,
    1,
  ),
  name: 'Panels/Pagination — Cancel a page change, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationServerCancelStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerCancel,
    2,
  ),
  name: 'Panels/Pagination — Cancel a page change, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationServerCancelStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerCancel,
    3,
  ),
  name: 'Panels/Pagination — Cancel a page change, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationServerCancelStep4 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerCancel,
    4,
  ),
  name: 'Panels/Pagination — Cancel a page change, step 4',
  tags: ['!test'],
}

export const HighContrastExpandingCancelStep1 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingCancel, 1),
  name: 'Rows/Expanding — Cancel loading children, step 1',
  tags: ['!test'],
}

export const HighContrastExpandingCancelStep2 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingCancel, 2),
  name: 'Rows/Expanding — Cancel loading children, step 2',
  tags: ['!test'],
}

export const HighContrastExpandingCancelStep3 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingCancel, 3),
  name: 'Rows/Expanding — Cancel loading children, step 3',
  tags: ['!test'],
}

export const HighContrastExpandingCancelStep4 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingCancel, 4),
  name: 'Rows/Expanding — Cancel loading children, step 4',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, step 1',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, step 2',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, step 3',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep4 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    4,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, step 4',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep5 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    5,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, step 5',
  tags: ['!test'],
}

export const HighContrastFilteringServerApplyStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerApply, 1),
  name: 'Filtering — Apply a server filter, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerApplyStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerApply, 2),
  name: 'Filtering — Apply a server filter, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerApplyStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerApply, 3),
  name: 'Filtering — Apply a server filter, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerApplyStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerApply, 4),
  name: 'Filtering — Apply a server filter, step 4',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 1),
  name: 'Filtering — Reapply after cancel, step 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 2),
  name: 'Filtering — Reapply after cancel, step 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 3),
  name: 'Filtering — Reapply after cancel, step 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 4),
  name: 'Filtering — Reapply after cancel, step 4',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep5 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 5),
  name: 'Filtering — Reapply after cancel, step 5',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableCancelStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTableCancel,
    1,
  ),
  name: 'Cells/Context menu — Whole table — Cancel, step 1',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableCancelStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTableCancel,
    2,
  ),
  name: 'Cells/Context menu — Whole table — Cancel, step 2',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableCancelStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTableCancel,
    3,
  ),
  name: 'Cells/Context menu — Whole table — Cancel, step 3',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableCancelStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTableCancel,
    4,
  ),
  name: 'Cells/Context menu — Whole table — Cancel, step 4',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    1,
  ),
  name: 'Cells/Context menu — Whole table, step 1',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    2,
  ),
  name: 'Cells/Context menu — Whole table, step 2',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    3,
  ),
  name: 'Cells/Context menu — Whole table, step 3',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    4,
  ),
  name: 'Cells/Context menu — Whole table, step 4',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep5 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    5,
  ),
  name: 'Cells/Context menu — Whole table, step 5',
  tags: ['!test'],
}

export const HighContrastActionStatusCheckboxStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusCheckbox,
    1,
  ),
  name: 'Cells/Action status — Checkbox in a cell, step 1',
  tags: ['!test'],
}

export const HighContrastActionStatusCheckboxStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusCheckbox,
    2,
  ),
  name: 'Cells/Action status — Checkbox in a cell, step 2',
  tags: ['!test'],
}

export const HighContrastActionStatusCheckboxStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusCheckbox,
    3,
  ),
  name: 'Cells/Action status — Checkbox in a cell, step 3',
  tags: ['!test'],
}

export const HighContrastActionStatusSwitchStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusSwitch,
    1,
  ),
  name: 'Cells/Action status — Switch refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastActionStatusSwitchStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusSwitch,
    2,
  ),
  name: 'Cells/Action status — Switch refused by the server, step 2',
  tags: ['!test'],
}

export const HighContrastActionStatusSwitchStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusSwitch,
    3,
  ),
  name: 'Cells/Action status — Switch refused by the server, step 3',
  tags: ['!test'],
}

export const HighContrastActionStatusSwitchStep4 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusSwitch,
    4,
  ),
  name: 'Cells/Action status — Switch refused by the server, step 4',
  tags: ['!test'],
}

export const HighContrastActionStatusDoubleClickStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusDoubleClick,
    1,
  ),
  name: 'Cells/Action status — Double-click without a control, step 1',
  tags: ['!test'],
}

export const HighContrastActionStatusDoubleClickStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusDoubleClick,
    2,
  ),
  name: 'Cells/Action status — Double-click without a control, step 2',
  tags: ['!test'],
}

export const HighContrastActionStatusDoubleClickStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusDoubleClick,
    3,
  ),
  name: 'Cells/Action status — Double-click without a control, step 3',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    1,
  ),
  name: 'Cells/Action status — Change while saving, step 1',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    2,
  ),
  name: 'Cells/Action status — Change while saving, step 2',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    3,
  ),
  name: 'Cells/Action status — Change while saving, step 3',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep4 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    4,
  ),
  name: 'Cells/Action status — Change while saving, step 4',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep5 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    5,
  ),
  name: 'Cells/Action status — Change while saving, step 5',
  tags: ['!test'],
}

export const HighContrastActionStatusRetryStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusRetry,
    1,
  ),
  name: 'Cells/Action status — Retry from the mark, step 1',
  tags: ['!test'],
}

export const HighContrastActionStatusRetryStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusRetry,
    2,
  ),
  name: 'Cells/Action status — Retry from the mark, step 2',
  tags: ['!test'],
}

export const HighContrastActionStatusRetryStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusRetry,
    3,
  ),
  name: 'Cells/Action status — Retry from the mark, step 3',
  tags: ['!test'],
}

export const HighContrastActionStatusRetryStep4 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusRetry,
    4,
  ),
  name: 'Cells/Action status — Retry from the mark, step 4',
  tags: ['!test'],
}

export const HighContrastCellSaveCancelMenuStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.CellSaveCancelMenu,
    1,
  ),
  name: 'Cells/Action status — Cancel saving from the menu, step 1',
  tags: ['!test'],
}

export const HighContrastCellSaveCancelMenuStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.CellSaveCancelMenu,
    2,
  ),
  name: 'Cells/Action status — Cancel saving from the menu, step 2',
  tags: ['!test'],
}

export const HighContrastCellSaveCancelMenuStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.CellSaveCancelMenu,
    3,
  ),
  name: 'Cells/Action status — Cancel saving from the menu, step 3',
  tags: ['!test'],
}

export const HighContrastCellSaveCancelMenuStep4 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.CellSaveCancelMenu,
    4,
  ),
  name: 'Cells/Action status — Cancel saving from the menu, step 4',
  tags: ['!test'],
}

export const HighContrastDataTypesCustomTypeStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesCustomType,
    1,
  ),
  name: 'Columns/Data types/Overview — Custom type, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesCustomTypeStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesCustomType,
    2,
  ),
  name: 'Columns/Data types/Overview — Custom type, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesOverrideBuiltInStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesOverrideBuiltIn,
    1,
  ),
  name: 'Columns/Data types/Overview — Override built-in type, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesOverrideBuiltInStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesOverrideBuiltIn,
    2,
  ),
  name: 'Columns/Data types/Overview — Override built-in type, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesLocaleStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesLocale,
    1,
  ),
  name: 'Columns/Data types/Overview — Switch language, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesLocaleStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesLocale,
    2,
  ),
  name: 'Columns/Data types/Overview — Switch language, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesLocaleStep3 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesLocale,
    3,
  ),
  name: 'Columns/Data types/Overview — Switch language, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesSearchStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesSearch,
    1,
  ),
  name: 'Columns/Data types/Overview — Search shown text, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesSearchStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesSearch,
    2,
  ),
  name: 'Columns/Data types/Overview — Search shown text, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesSearchStep3 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesSearch,
    3,
  ),
  name: 'Columns/Data types/Overview — Search shown text, step 3',
  tags: ['!test'],
}

export const HighContrastEditingTypeEditorStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.EditingTypeEditor,
    1,
  ),
  name: 'Columns/Data types/Overview — Editor of a data type, step 1',
  tags: ['!test'],
}

export const HighContrastEditingTypeEditorStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.EditingTypeEditor,
    2,
  ),
  name: 'Columns/Data types/Overview — Editor of a data type, step 2',
  tags: ['!test'],
}

export const HighContrastEditingTypeEditorStep3 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.EditingTypeEditor,
    3,
  ),
  name: 'Columns/Data types/Overview — Editor of a data type, step 3',
  tags: ['!test'],
}

export const HighContrastEditingBooleanStep1 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBoolean,
    1,
  ),
  name: 'Columns/Data types/Boolean — Toggle, step 1',
  tags: ['!test'],
}

export const HighContrastEditingBooleanStep2 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBoolean,
    2,
  ),
  name: 'Columns/Data types/Boolean — Toggle, step 2',
  tags: ['!test'],
}

export const HighContrastEditingBooleanStep3 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBoolean,
    3,
  ),
  name: 'Columns/Data types/Boolean — Toggle, step 3',
  tags: ['!test'],
}

export const HighContrastEditingBooleanKeyboardStep1 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBooleanKeyboard,
    1,
  ),
  name: 'Columns/Data types/Boolean — Toggle and select with the keyboard, step 1',
  tags: ['!test'],
}

export const HighContrastEditingBooleanKeyboardStep2 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBooleanKeyboard,
    2,
  ),
  name: 'Columns/Data types/Boolean — Toggle and select with the keyboard, step 2',
  tags: ['!test'],
}

export const HighContrastEditingBooleanKeyboardStep3 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBooleanKeyboard,
    3,
  ),
  name: 'Columns/Data types/Boolean — Toggle and select with the keyboard, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesBooleanFilterStep1 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.DataTypesBooleanFilter,
    1,
  ),
  name: 'Columns/Data types/Boolean — Filter, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesBooleanFilterStep2 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.DataTypesBooleanFilter,
    2,
  ),
  name: 'Columns/Data types/Boolean — Filter, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesBooleanFilterStep3 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.DataTypesBooleanFilter,
    3,
  ),
  name: 'Columns/Data types/Boolean — Filter, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesBooleanFilterStep4 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.DataTypesBooleanFilter,
    4,
  ),
  name: 'Columns/Data types/Boolean — Filter, step 4',
  tags: ['!test'],
}

export const HighContrastDataTypesFilterStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesFilter,
    1,
  ),
  name: 'Columns/Data types/Date — Filter, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesFilterStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesFilter,
    2,
  ),
  name: 'Columns/Data types/Date — Filter, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesFilterStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesFilter,
    3,
  ),
  name: 'Columns/Data types/Date — Filter, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesFilterStep4 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesFilter,
    4,
  ),
  name: 'Columns/Data types/Date — Filter, step 4',
  tags: ['!test'],
}

export const HighContrastEditingDateStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDate,
    1,
  ),
  name: 'Columns/Data types/Date — Edit, step 1',
  tags: ['!test'],
}

export const HighContrastEditingDateStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDate,
    2,
  ),
  name: 'Columns/Data types/Date — Edit, step 2',
  tags: ['!test'],
}

export const HighContrastEditingDateStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDate,
    3,
  ),
  name: 'Columns/Data types/Date — Edit, step 3',
  tags: ['!test'],
}

export const HighContrastEditingDateClearStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDateClear,
    1,
  ),
  name: 'Columns/Data types/Date — Clear, step 1',
  tags: ['!test'],
}

export const HighContrastEditingDateClearStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDateClear,
    2,
  ),
  name: 'Columns/Data types/Date — Clear, step 2',
  tags: ['!test'],
}

export const HighContrastEditingDateClearStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDateClear,
    3,
  ),
  name: 'Columns/Data types/Date — Clear, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesDateSortStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateSort,
    1,
  ),
  name: 'Columns/Data types/Date — Sort, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesDateSortStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateSort,
    2,
  ),
  name: 'Columns/Data types/Date — Sort, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesDateSortStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateSort,
    3,
  ),
  name: 'Columns/Data types/Date — Sort, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesDateExcelStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateExcel,
    1,
  ),
  name: 'Columns/Data types/Date — Export to Excel, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesDateExcelStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateExcel,
    2,
  ),
  name: 'Columns/Data types/Date — Export to Excel, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesDateExcelStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateExcel,
    3,
  ),
  name: 'Columns/Data types/Date — Export to Excel, step 3',
  tags: ['!test'],
}

export const HighContrastEditingDateTimeStep1 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.EditingDateTime,
    1,
  ),
  name: 'Columns/Data types/Date & time — Edit, step 1',
  tags: ['!test'],
}

export const HighContrastEditingDateTimeStep2 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.EditingDateTime,
    2,
  ),
  name: 'Columns/Data types/Date & time — Edit, step 2',
  tags: ['!test'],
}

export const HighContrastEditingDateTimeStep3 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.EditingDateTime,
    3,
  ),
  name: 'Columns/Data types/Date & time — Edit, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesDateTimeFilterStep1 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.DataTypesDateTimeFilter,
    1,
  ),
  name: 'Columns/Data types/Date & time — Filter, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesDateTimeFilterStep2 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.DataTypesDateTimeFilter,
    2,
  ),
  name: 'Columns/Data types/Date & time — Filter, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesDateTimeFilterStep3 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.DataTypesDateTimeFilter,
    3,
  ),
  name: 'Columns/Data types/Date & time — Filter, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringStep1 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberString,
    1,
  ),
  name: 'Columns/Data types/Decimal string — Exact order, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringStep2 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberString,
    2,
  ),
  name: 'Columns/Data types/Decimal string — Exact order, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringExportStep1 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberStringExport,
    1,
  ),
  name: 'Columns/Data types/Decimal string — Export to Excel, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringExportStep2 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberStringExport,
    2,
  ),
  name: 'Columns/Data types/Decimal string — Export to Excel, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringExportStep3 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberStringExport,
    3,
  ),
  name: 'Columns/Data types/Decimal string — Export to Excel, step 3',
  tags: ['!test'],
}

export const HighContrastEditingDecimalStringStep1 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.EditingDecimalString,
    1,
  ),
  name: 'Columns/Data types/Decimal string — Edit, step 1',
  tags: ['!test'],
}

export const HighContrastEditingDecimalStringStep2 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.EditingDecimalString,
    2,
  ),
  name: 'Columns/Data types/Decimal string — Edit, step 2',
  tags: ['!test'],
}

export const HighContrastEditingDecimalStringStep3 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.EditingDecimalString,
    3,
  ),
  name: 'Columns/Data types/Decimal string — Edit, step 3',
  tags: ['!test'],
}

export const HighContrastEditingMultiSelectStep1 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.EditingMultiSelect,
    1,
  ),
  name: 'Columns/Data types/Multi select — Choose several, step 1',
  tags: ['!test'],
}

export const HighContrastEditingMultiSelectStep2 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.EditingMultiSelect,
    2,
  ),
  name: 'Columns/Data types/Multi select — Choose several, step 2',
  tags: ['!test'],
}

export const HighContrastEditingMultiSelectStep3 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.EditingMultiSelect,
    3,
  ),
  name: 'Columns/Data types/Multi select — Choose several, step 3',
  tags: ['!test'],
}

export const HighContrastEditingMultiSelectStep4 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.EditingMultiSelect,
    4,
  ),
  name: 'Columns/Data types/Multi select — Choose several, step 4',
  tags: ['!test'],
}

export const HighContrastDataTypesMultiSelectFilterStep1 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.DataTypesMultiSelectFilter,
    1,
  ),
  name: 'Columns/Data types/Multi select — Filter, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesMultiSelectFilterStep2 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.DataTypesMultiSelectFilter,
    2,
  ),
  name: 'Columns/Data types/Multi select — Filter, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesMultiSelectFilterStep3 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.DataTypesMultiSelectFilter,
    3,
  ),
  name: 'Columns/Data types/Multi select — Filter, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesEditNumberStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesEditNumber,
    1,
  ),
  name: 'Columns/Data types/Number — Edit with a decimal comma, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesEditNumberStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesEditNumber,
    2,
  ),
  name: 'Columns/Data types/Number — Edit with a decimal comma, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesEditNumberStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesEditNumber,
    3,
  ),
  name: 'Columns/Data types/Number — Edit with a decimal comma, step 3',
  tags: ['!test'],
}

export const HighContrastEditingNumberStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.EditingNumber,
    1,
  ),
  name: 'Columns/Data types/Number — Edit, step 1',
  tags: ['!test'],
}

export const HighContrastEditingNumberStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.EditingNumber,
    2,
  ),
  name: 'Columns/Data types/Number — Edit, step 2',
  tags: ['!test'],
}

export const HighContrastEditingNumberStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.EditingNumber,
    3,
  ),
  name: 'Columns/Data types/Number — Edit, step 3',
  tags: ['!test'],
}

export const HighContrastEditingNumberStep4 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.EditingNumber,
    4,
  ),
  name: 'Columns/Data types/Number — Edit, step 4',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberSortStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberSort,
    1,
  ),
  name: 'Columns/Data types/Number — Sort, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberSortStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberSort,
    2,
  ),
  name: 'Columns/Data types/Number — Sort, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberSortStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberSort,
    3,
  ),
  name: 'Columns/Data types/Number — Sort, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberFilterStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberFilter,
    1,
  ),
  name: 'Columns/Data types/Number — Filter, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberFilterStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberFilter,
    2,
  ),
  name: 'Columns/Data types/Number — Filter, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberFilterStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberFilter,
    3,
  ),
  name: 'Columns/Data types/Number — Filter, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberExcelStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberExcel,
    1,
  ),
  name: 'Columns/Data types/Number — Export to Excel, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberExcelStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberExcel,
    2,
  ),
  name: 'Columns/Data types/Number — Export to Excel, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberExcelStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberExcel,
    3,
  ),
  name: 'Columns/Data types/Number — Export to Excel, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectStep1 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObject,
    1,
  ),
  name: 'Columns/Data types/Object — Sort and filter records, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectStep2 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObject,
    2,
  ),
  name: 'Columns/Data types/Object — Sort and filter records, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectStep3 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObject,
    3,
  ),
  name: 'Columns/Data types/Object — Sort and filter records, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectStep4 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObject,
    4,
  ),
  name: 'Columns/Data types/Object — Sort and filter records, step 4',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectLabelStep1 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObjectLabel,
    1,
  ),
  name: 'Columns/Data types/Object — Key and label, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectLabelStep2 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObjectLabel,
    2,
  ),
  name: 'Columns/Data types/Object — Key and label, step 2',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep1 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    1,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, step 1',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep2 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    2,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, step 2',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep3 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    3,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, step 3',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep4 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    4,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, step 4',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep5 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    5,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, step 5',
  tags: ['!test'],
}

export const HighContrastEditingRecordFromDataStep1 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingRecordFromData,
    1,
  ),
  name: 'Columns/Data types/Object — Choose a record from the table, step 1',
  tags: ['!test'],
}

export const HighContrastEditingRecordFromDataStep2 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingRecordFromData,
    2,
  ),
  name: 'Columns/Data types/Object — Choose a record from the table, step 2',
  tags: ['!test'],
}

export const HighContrastEditingRecordFromDataStep3 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingRecordFromData,
    3,
  ),
  name: 'Columns/Data types/Object — Choose a record from the table, step 3',
  tags: ['!test'],
}

export const HighContrastEditingSelectStep1 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.EditingSelect,
    1,
  ),
  name: 'Columns/Data types/Select — Choose, step 1',
  tags: ['!test'],
}

export const HighContrastEditingSelectStep2 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.EditingSelect,
    2,
  ),
  name: 'Columns/Data types/Select — Choose, step 2',
  tags: ['!test'],
}

export const HighContrastEditingSelectStep3 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.EditingSelect,
    3,
  ),
  name: 'Columns/Data types/Select — Choose, step 3',
  tags: ['!test'],
}

export const HighContrastEditingSelectStep4 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.EditingSelect,
    4,
  ),
  name: 'Columns/Data types/Select — Choose, step 4',
  tags: ['!test'],
}

export const HighContrastDataTypesSelectFilterStep1 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.DataTypesSelectFilter,
    1,
  ),
  name: 'Columns/Data types/Select — Filter, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesSelectFilterStep2 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.DataTypesSelectFilter,
    2,
  ),
  name: 'Columns/Data types/Select — Filter, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesSelectFilterStep3 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.DataTypesSelectFilter,
    3,
  ),
  name: 'Columns/Data types/Select — Filter, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesTextSortStep1 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextSort,
    1,
  ),
  name: 'Columns/Data types/Text — Sort, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesTextSortStep2 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextSort,
    2,
  ),
  name: 'Columns/Data types/Text — Sort, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesTextSortStep3 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextSort,
    3,
  ),
  name: 'Columns/Data types/Text — Sort, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesTextFilterStep1 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextFilter,
    1,
  ),
  name: 'Columns/Data types/Text — Filter, step 1',
  tags: ['!test'],
}

export const HighContrastDataTypesTextFilterStep2 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextFilter,
    2,
  ),
  name: 'Columns/Data types/Text — Filter, step 2',
  tags: ['!test'],
}

export const HighContrastDataTypesTextFilterStep3 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextFilter,
    3,
  ),
  name: 'Columns/Data types/Text — Filter, step 3',
  tags: ['!test'],
}

export const HighContrastDataTypesTextFilterStep4 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextFilter,
    4,
  ),
  name: 'Columns/Data types/Text — Filter, step 4',
  tags: ['!test'],
}

export const HighContrastEditingTextStep1 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.EditingText,
    1,
  ),
  name: 'Columns/Data types/Text — Edit, step 1',
  tags: ['!test'],
}

export const HighContrastEditingTextStep2 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.EditingText,
    2,
  ),
  name: 'Columns/Data types/Text — Edit, step 2',
  tags: ['!test'],
}

export const HighContrastEditingTextStep3 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.EditingText,
    3,
  ),
  name: 'Columns/Data types/Text — Edit, step 3',
  tags: ['!test'],
}

export const HighContrastFailureLogPlayground = {
  ...twin(panelsFailureLogMeta, panelsFailureLogStories.FailureLogPlayground),
  name: 'Panels/Failure log — Playground',
  tags: ['!test'],
}

export const HighContrastFailureLogRowStep1 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogRow,
    1,
  ),
  name: 'Panels/Failure log — Refused row action, step 1',
  tags: ['!test'],
}

export const HighContrastFailureLogRowStep2 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogRow,
    2,
  ),
  name: 'Panels/Failure log — Refused row action, step 2',
  tags: ['!test'],
}

export const HighContrastFailureLogRowStep3 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogRow,
    3,
  ),
  name: 'Panels/Failure log — Refused row action, step 3',
  tags: ['!test'],
}

export const HighContrastFailureLogRowStep4 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogRow,
    4,
  ),
  name: 'Panels/Failure log — Refused row action, step 4',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep1 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    1,
  ),
  name: 'Panels/Failure log — Failures off screen, step 1',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep2 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    2,
  ),
  name: 'Panels/Failure log — Failures off screen, step 2',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep3 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    3,
  ),
  name: 'Panels/Failure log — Failures off screen, step 3',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep4 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    4,
  ),
  name: 'Panels/Failure log — Failures off screen, step 4',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep5 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    5,
  ),
  name: 'Panels/Failure log — Failures off screen, step 5',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep6 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    6,
  ),
  name: 'Panels/Failure log — Failures off screen, step 6',
  tags: ['!test'],
}

export const HighContrastFilterDraftClosedPanelStep1 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftClosedPanel, 1),
  name: 'Filtering — Unapplied condition, step 1',
  tags: ['!test'],
}

export const HighContrastFilterDraftClosedPanelStep2 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftClosedPanel, 2),
  name: 'Filtering — Unapplied condition, step 2',
  tags: ['!test'],
}

export const HighContrastFilterDraftClosedPanelStep3 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftClosedPanel, 3),
  name: 'Filtering — Unapplied condition, step 3',
  tags: ['!test'],
}

export const HighContrastFilterDraftClosedPanelStep4 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftClosedPanel, 4),
  name: 'Filtering — Unapplied condition, step 4',
  tags: ['!test'],
}

export const HighContrastFilterDraftAfterRefusalStep1 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftAfterRefusal, 1),
  name: 'Filtering — Refused condition, step 1',
  tags: ['!test'],
}

export const HighContrastFilterDraftAfterRefusalStep2 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftAfterRefusal, 2),
  name: 'Filtering — Refused condition, step 2',
  tags: ['!test'],
}

export const HighContrastFilterDraftAfterRefusalStep3 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftAfterRefusal, 3),
  name: 'Filtering — Refused condition, step 3',
  tags: ['!test'],
}

export const HighContrastFilterDraftAfterRefusalStep4 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftAfterRefusal, 4),
  name: 'Filtering — Refused condition, step 4',
  tags: ['!test'],
}

export const HighContrastDraftsFromUrlStep1 = {
  ...twinStep(filteringStories, filteringStories.DraftsFromUrl, 1),
  name: 'Filtering — Restore unapplied conditions, step 1',
  tags: ['!test'],
}

export const HighContrastDraftsFromUrlStep2 = {
  ...twinStep(filteringStories, filteringStories.DraftsFromUrl, 2),
  name: 'Filtering — Restore unapplied conditions, step 2',
  tags: ['!test'],
}

export const HighContrastDraftsFromUrlStep3 = {
  ...twinStep(filteringStories, filteringStories.DraftsFromUrl, 3),
  name: 'Filtering — Restore unapplied conditions, step 3',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesPlayground = {
  ...twin(
    panelsUnsavedChangesMeta,
    panelsUnsavedChangesStories.UnsavedChangesPlayground,
  ),
  name: 'Panels/Unsaved changes — Playground',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesApplyStep1 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesApply,
    1,
  ),
  name: 'Panels/Unsaved changes — Apply from the panel, step 1',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesApplyStep2 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesApply,
    2,
  ),
  name: 'Panels/Unsaved changes — Apply from the panel, step 2',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesApplyStep3 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesApply,
    3,
  ),
  name: 'Panels/Unsaved changes — Apply from the panel, step 3',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesApplyStep4 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesApply,
    4,
  ),
  name: 'Panels/Unsaved changes — Apply from the panel, step 4',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesDangerActionsStep1 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesDangerActions,
    1,
  ),
  name: 'Panels/Unsaved changes — Discard from the panel, step 1',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesDangerActionsStep2 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesDangerActions,
    2,
  ),
  name: 'Panels/Unsaved changes — Discard from the panel, step 2',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesDangerActionsStep3 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesDangerActions,
    3,
  ),
  name: 'Panels/Unsaved changes — Discard from the panel, step 3',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesDangerActionsStep4 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesDangerActions,
    4,
  ),
  name: 'Panels/Unsaved changes — Discard from the panel, step 4',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesDotHintStep1 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesDotHint,
    1,
  ),
  name: 'Panels/Unsaved changes — Dot hint, step 1',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesDotHintStep2 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesDotHint,
    2,
  ),
  name: 'Panels/Unsaved changes — Dot hint, step 2',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesDotHintStep3 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesDotHint,
    3,
  ),
  name: 'Panels/Unsaved changes — Dot hint, step 3',
  tags: ['!test'],
}

export const HighContrastManualSaveCellsStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.ManualSaveCells, 1),
  name: 'Cells/Editing — Save by button, step 1',
  tags: ['!test'],
}

export const HighContrastManualSaveCellsStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.ManualSaveCells, 2),
  name: 'Cells/Editing — Save by button, step 2',
  tags: ['!test'],
}

export const HighContrastManualSaveCellsStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.ManualSaveCells, 3),
  name: 'Cells/Editing — Save by button, step 3',
  tags: ['!test'],
}

export const HighContrastManualSaveCellsStep4 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.ManualSaveCells, 4),
  name: 'Cells/Editing — Save by button, step 4',
  tags: ['!test'],
}

export const HighContrastManualSavePartialRefusalStep1 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.ManualSavePartialRefusal,
    1,
  ),
  name: 'Cells/Editing — Refused part of the batch, step 1',
  tags: ['!test'],
}

export const HighContrastManualSavePartialRefusalStep2 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.ManualSavePartialRefusal,
    2,
  ),
  name: 'Cells/Editing — Refused part of the batch, step 2',
  tags: ['!test'],
}

export const HighContrastManualSavePartialRefusalStep3 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.ManualSavePartialRefusal,
    3,
  ),
  name: 'Cells/Editing — Refused part of the batch, step 3',
  tags: ['!test'],
}

export const HighContrastCellDraftRollbackStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.CellDraftRollback, 1),
  name: 'Cells/Editing — Roll back an edit, step 1',
  tags: ['!test'],
}

export const HighContrastCellDraftRollbackStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.CellDraftRollback, 2),
  name: 'Cells/Editing — Roll back an edit, step 2',
  tags: ['!test'],
}

export const HighContrastCellDraftRollbackStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.CellDraftRollback, 3),
  name: 'Cells/Editing — Roll back an edit, step 3',
  tags: ['!test'],
}

export const HighContrastCellDraftRollbackStep4 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.CellDraftRollback, 4),
  name: 'Cells/Editing — Roll back an edit, step 4',
  tags: ['!test'],
}

export const HighContrastRowEditingPlayground = {
  ...twin(rowsEditingMeta, rowsEditingStories.RowEditingPlayground),
  name: 'Rows/Editing — Playground',
  tags: ['!test'],
}

export const HighContrastRowDraftSaveInPlaceStep1 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftSaveInPlace, 1),
  name: 'Rows/Editing — Save a row in place, step 1',
  tags: ['!test'],
}

export const HighContrastRowDraftSaveInPlaceStep2 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftSaveInPlace, 2),
  name: 'Rows/Editing — Save a row in place, step 2',
  tags: ['!test'],
}

export const HighContrastRowDraftSaveInPlaceStep3 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftSaveInPlace, 3),
  name: 'Rows/Editing — Save a row in place, step 3',
  tags: ['!test'],
}

export const HighContrastRowDraftInsertStep1 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftInsert, 1),
  name: 'Rows/Editing — Add a row, step 1',
  tags: ['!test'],
}

export const HighContrastRowDraftInsertStep2 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftInsert, 2),
  name: 'Rows/Editing — Add a row, step 2',
  tags: ['!test'],
}

export const HighContrastRowDraftInsertStep3 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftInsert, 3),
  name: 'Rows/Editing — Add a row, step 3',
  tags: ['!test'],
}

export const HighContrastRowDraftInsertStep4 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftInsert, 4),
  name: 'Rows/Editing — Add a row, step 4',
  tags: ['!test'],
}

export const HighContrastRowDraftDeleteStep1 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftDelete, 1),
  name: 'Rows/Editing — Delete and restore a row, step 1',
  tags: ['!test'],
}

export const HighContrastRowDraftDeleteStep2 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftDelete, 2),
  name: 'Rows/Editing — Delete and restore a row, step 2',
  tags: ['!test'],
}

export const HighContrastRowDraftDeleteStep3 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftDelete, 3),
  name: 'Rows/Editing — Delete and restore a row, step 3',
  tags: ['!test'],
}

export const HighContrastRowDraftsCommitRefusedStep1 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftsCommitRefused, 1),
  name: 'Rows/Editing — Refused new row, step 1',
  tags: ['!test'],
}

export const HighContrastRowDraftsCommitRefusedStep2 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftsCommitRefused, 2),
  name: 'Rows/Editing — Refused new row, step 2',
  tags: ['!test'],
}

export const HighContrastRowDraftsCommitRefusedStep3 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftsCommitRefused, 3),
  name: 'Rows/Editing — Refused new row, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationServerSelectAllExceptStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerSelectAllExcept,
    1,
  ),
  name: 'Panels/Pagination — Server, select all except, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationServerSelectAllExceptStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerSelectAllExcept,
    2,
  ),
  name: 'Panels/Pagination — Server, select all except, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationServerSelectAllExceptStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerSelectAllExcept,
    3,
  ),
  name: 'Panels/Pagination — Server, select all except, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationServerSelectAllExceptStep4 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerSelectAllExcept,
    4,
  ),
  name: 'Panels/Pagination — Server, select all except, step 4',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollSelectAllStep1 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollSelectAll,
    1,
  ),
  name: 'Data loading/Infinite scroll — Select all, step 1',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollSelectAllStep2 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollSelectAll,
    2,
  ),
  name: 'Data loading/Infinite scroll — Select all, step 2',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollSelectAllStep3 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollSelectAll,
    3,
  ),
  name: 'Data loading/Infinite scroll — Select all, step 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangesAnyModeStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.CellSelectionRangesAnyMode,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Read the selection, step 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangesAnyModeStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.CellSelectionRangesAnyMode,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Read the selection, step 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangesAnyModeStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.CellSelectionRangesAnyMode,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Read the selection, step 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionFollowsSortStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionFollowsSort,
    1,
  ),
  name: 'Cells/Selection — Follows sorting, step 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionFollowsSortStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionFollowsSort,
    2,
  ),
  name: 'Cells/Selection — Follows sorting, step 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionFollowsSortStep3 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionFollowsSort,
    3,
  ),
  name: 'Cells/Selection — Follows sorting, step 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionHandleStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionHandle,
    1,
  ),
  name: 'Cells/Selection — Range handle, step 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionHandleStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionHandle,
    2,
  ),
  name: 'Cells/Selection — Range handle, step 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionHandleStep3 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionHandle,
    3,
  ),
  name: 'Cells/Selection — Range handle, step 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionHandleStep4 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionHandle,
    4,
  ),
  name: 'Cells/Selection — Range handle, step 4',
  tags: ['!test'],
}

export const HighContrastCellSelectionTouchStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionTouch,
    1,
  ),
  name: 'Cells/Selection — Select by touch, step 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionTouchStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionTouch,
    2,
  ),
  name: 'Cells/Selection — Select by touch, step 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionTouchStep3 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionTouch,
    3,
  ),
  name: 'Cells/Selection — Select by touch, step 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionTouchStep4 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionTouch,
    4,
  ),
  name: 'Cells/Selection — Select by touch, step 4',
  tags: ['!test'],
}

export const HighContrastCellSelectionTouchStep5 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionTouch,
    5,
  ),
  name: 'Cells/Selection — Select by touch, step 5',
  tags: ['!test'],
}

export const HighContrastFailureLogLanguageSwitchStep1 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogLanguageSwitch,
    1,
  ),
  name: 'Panels/Failure log — Switch language, step 1',
  tags: ['!test'],
}

export const HighContrastFailureLogLanguageSwitchStep2 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogLanguageSwitch,
    2,
  ),
  name: 'Panels/Failure log — Switch language, step 2',
  tags: ['!test'],
}

export const HighContrastFailureLogLanguageSwitchStep3 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogLanguageSwitch,
    3,
  ),
  name: 'Panels/Failure log — Switch language, step 3',
  tags: ['!test'],
}

export const HighContrastPluginApiActionNamesStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiActionNames, 1),
  name: 'Plugin API — Action names, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiActionNamesStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiActionNames, 2),
  name: 'Plugin API — Action names, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiActionNamesStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiActionNames, 3),
  name: 'Plugin API — Action names, step 3',
  tags: ['!test'],
}

export const HighContrastActionStatusOwnLabelStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusOwnLabel,
    1,
  ),
  name: 'Cells/Action status — Own action label, step 1',
  tags: ['!test'],
}

export const HighContrastActionStatusOwnLabelStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusOwnLabel,
    2,
  ),
  name: 'Cells/Action status — Own action label, step 2',
  tags: ['!test'],
}

export const HighContrastActionStatusOwnLabelStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusOwnLabel,
    3,
  ),
  name: 'Cells/Action status — Own action label, step 3',
  tags: ['!test'],
}

export const HighContrastColumnTotalsSearchStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsSearch,
    1,
  ),
  name: 'Core/Column totals — Search changes the total, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsSearchStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsSearch,
    2,
  ),
  name: 'Core/Column totals — Search changes the total, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsOwnFooterStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsOwnFooter,
    1,
  ),
  name: 'Core/Column totals — Own footer, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsOwnFooterStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsOwnFooter,
    2,
  ),
  name: 'Core/Column totals — Own footer, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsTreeStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsTree,
    1,
  ),
  name: 'Core/Column totals — Tree, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsTreeStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsTree,
    2,
  ),
  name: 'Core/Column totals — Tree, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsEditingStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsEditing,
    1,
  ),
  name: 'Core/Column totals — Edit a value, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsEditingStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsEditing,
    2,
  ),
  name: 'Core/Column totals — Edit a value, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsDraftsStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsDrafts,
    1,
  ),
  name: 'Core/Column totals — Edit before applying, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsDraftsStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsDrafts,
    2,
  ),
  name: 'Core/Column totals — Edit before applying, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsDraftsStep3 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsDrafts,
    3,
  ),
  name: 'Core/Column totals — Edit before applying, step 3',
  tags: ['!test'],
}

export const HighContrastColumnTotalsAllNodesSearchStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsAllNodesSearch,
    1,
  ),
  name: 'Core/Column totals — All tree rows — search, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsAllNodesSearchStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsAllNodesSearch,
    2,
  ),
  name: 'Core/Column totals — All tree rows — search, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsAllNodesGroupsStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsAllNodesGroups,
    1,
  ),
  name: 'Core/Column totals — All tree rows — grouping, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsAllNodesGroupsStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsAllNodesGroups,
    2,
  ),
  name: 'Core/Column totals — All tree rows — grouping, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsLazyTreeStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsLazyTree,
    1,
  ),
  name: 'Core/Column totals — All tree rows — lazy children, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsLazyTreeStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsLazyTree,
    2,
  ),
  name: 'Core/Column totals — All tree rows — lazy children, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsLazyTreeStep3 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsLazyTree,
    3,
  ),
  name: 'Core/Column totals — All tree rows — lazy children, step 3',
  tags: ['!test'],
}

export const HighContrastColumnTotalsServerTreeStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsServerTree,
    1,
  ),
  name: 'Core/Column totals — All tree rows — server row model, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsServerTreeStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsServerTree,
    2,
  ),
  name: 'Core/Column totals — All tree rows — server row model, step 2',
  tags: ['!test'],
}

export const HighContrastColumnTotalsServerTreeStep3 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsServerTree,
    3,
  ),
  name: 'Core/Column totals — All tree rows — server row model, step 3',
  tags: ['!test'],
}

export const HighContrastColumnTotalsServerPageStep1 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsServerPage,
    1,
  ),
  name: 'Core/Column totals — Server page, step 1',
  tags: ['!test'],
}

export const HighContrastColumnTotalsServerPageStep2 = {
  ...twinStep(
    coreColumnTotalsStories,
    coreColumnTotalsStories.ColumnTotalsServerPage,
    2,
  ),
  name: 'Core/Column totals — Server page, step 2',
  tags: ['!test'],
}

export const HighContrastGroupRowCountFilteredStep1 = {
  ...twinStep(
    rowsGroupingStories,
    rowsGroupingStories.GroupRowCountFiltered,
    1,
  ),
  name: 'Rows/Grouping — Row count, search, step 1',
  tags: ['!test'],
}

export const HighContrastGroupRowCountFilteredStep2 = {
  ...twinStep(
    rowsGroupingStories,
    rowsGroupingStories.GroupRowCountFiltered,
    2,
  ),
  name: 'Rows/Grouping — Row count, search, step 2',
  tags: ['!test'],
}

export const HighContrastGroupRowCountOffStep1 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupRowCountOff, 1),
  name: 'Rows/Grouping — Row count, off, step 1',
  tags: ['!test'],
}

export const HighContrastGroupRowCountOffStep2 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupRowCountOff, 2),
  name: 'Rows/Grouping — Row count, off, step 2',
  tags: ['!test'],
}

export const HighContrastServerGroupRowCountStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerGroupRowCount,
    1,
  ),
  name: 'Server row model/Grouping — Row count, step 1',
  tags: ['!test'],
}

export const HighContrastServerGroupRowCountStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerGroupRowCount,
    2,
  ),
  name: 'Server row model/Grouping — Row count, step 2',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAll,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Select the page, step 1',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAll,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Select the page, step 2',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAll,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Select the page, step 3',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllStep4 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAll,
    4,
  ),
  name: 'Data loading/Server row model/Selection — Select the page, step 4',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllWaitsStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAllWaits,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Page still loading, step 1',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllWaitsStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAllWaits,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Page still loading, step 2',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllWaitsStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAllWaits,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Page still loading, step 3',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllRefusedStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAllRefused,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Page refused, step 1',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllRefusedStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAllRefused,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Page refused, step 2',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllRefusedStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAllRefused,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Page refused, step 3',
  tags: ['!test'],
}

export const HighContrastServerPageSelectAllRefusedStep4 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerPageSelectAllRefused,
    4,
  ),
  name: 'Data loading/Server row model/Selection — Page refused, step 4',
  tags: ['!test'],
}

export const HighContrastServerRowIndentStep1 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerRowIndent, 1),
  name: 'Data loading/Server row model/Dragging — Indent a row, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowIndentStep2 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerRowIndent, 2),
  name: 'Data loading/Server row model/Dragging — Indent a row, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowIndentStep3 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerRowIndent, 3),
  name: 'Data loading/Server row model/Dragging — Indent a row, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowIndentStep4 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerRowIndent, 4),
  name: 'Data loading/Server row model/Dragging — Indent a row, step 4',
  tags: ['!test'],
}

export const HighContrastServerRowOutdentStep1 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerRowOutdent, 1),
  name: 'Data loading/Server row model/Dragging — Outdent a row, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowOutdentStep2 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerRowOutdent, 2),
  name: 'Data loading/Server row model/Dragging — Outdent a row, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowOutdentStep3 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerRowOutdent, 3),
  name: 'Data loading/Server row model/Dragging — Outdent a row, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowOutdentStep4 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerRowOutdent, 4),
  name: 'Data loading/Server row model/Dragging — Outdent a row, step 4',
  tags: ['!test'],
}

export const HighContrastServerRowIndentRefusedStep1 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerRowIndentRefused,
    1,
  ),
  name: 'Data loading/Server row model/Dragging — Branch refused, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowIndentRefusedStep2 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerRowIndentRefused,
    2,
  ),
  name: 'Data loading/Server row model/Dragging — Branch refused, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowIndentRefusedStep3 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerRowIndentRefused,
    3,
  ),
  name: 'Data loading/Server row model/Dragging — Branch refused, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowNextGroupStep1 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerRowNextGroup,
    1,
  ),
  name: 'Data loading/Server row model/Dragging — Move to the next group, step 1',
  tags: ['!test'],
}

export const HighContrastServerRowNextGroupStep2 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerRowNextGroup,
    2,
  ),
  name: 'Data loading/Server row model/Dragging — Move to the next group, step 2',
  tags: ['!test'],
}

export const HighContrastServerRowNextGroupStep3 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerRowNextGroup,
    3,
  ),
  name: 'Data loading/Server row model/Dragging — Move to the next group, step 3',
  tags: ['!test'],
}

export const HighContrastServerRowNextGroupStep4 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerRowNextGroup,
    4,
  ),
  name: 'Data loading/Server row model/Dragging — Move to the next group, step 4',
  tags: ['!test'],
}

export const HighContrastExportServerRowsViewStep1 = {
  ...twinStep(serverExportStories, serverExportStories.ExportServerRowsView, 1),
  name: 'Data loading/Server row model/Export — Export the result, step 1',
  tags: ['!test'],
}

export const HighContrastExportServerRowsViewStep2 = {
  ...twinStep(serverExportStories, serverExportStories.ExportServerRowsView, 2),
  name: 'Data loading/Server row model/Export — Export the result, step 2',
  tags: ['!test'],
}

export const HighContrastExportServerRowsViewStep3 = {
  ...twinStep(serverExportStories, serverExportStories.ExportServerRowsView, 3),
  name: 'Data loading/Server row model/Export — Export the result, step 3',
  tags: ['!test'],
}

export const HighContrastExportServerRowsLimitStep1 = {
  ...twinStep(
    serverExportStories,
    serverExportStories.ExportServerRowsLimit,
    1,
  ),
  name: 'Data loading/Server row model/Export — Over the limit, step 1',
  tags: ['!test'],
}

export const HighContrastExportServerRowsLimitStep2 = {
  ...twinStep(
    serverExportStories,
    serverExportStories.ExportServerRowsLimit,
    2,
  ),
  name: 'Data loading/Server row model/Export — Over the limit, step 2',
  tags: ['!test'],
}

export const HighContrastExportServerRowsRefusedStep1 = {
  ...twinStep(
    serverExportStories,
    serverExportStories.ExportServerRowsRefused,
    1,
  ),
  name: 'Data loading/Server row model/Export — Refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastExportServerRowsRefusedStep2 = {
  ...twinStep(
    serverExportStories,
    serverExportStories.ExportServerRowsRefused,
    2,
  ),
  name: 'Data loading/Server row model/Export — Refused by the server, step 2',
  tags: ['!test'],
}

export const HighContrastExportServerRowsRefusedStep3 = {
  ...twinStep(
    serverExportStories,
    serverExportStories.ExportServerRowsRefused,
    3,
  ),
  name: 'Data loading/Server row model/Export — Refused by the server, step 3',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep1 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    1,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 1',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep2 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    2,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 2',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep3 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    3,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 3',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep4 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    4,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 4',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep5 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    5,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 5',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep6 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    6,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 6',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep7 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    7,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 7',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep8 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    8,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 8',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep9 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    9,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 9',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep10 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    10,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 10',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep11 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    11,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 11',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep12 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    12,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 12',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep13 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    13,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 13',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep14 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    14,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 14',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep15 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    15,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 15',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep16 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    16,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 16',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep17 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    17,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 17',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep18 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    18,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 18',
  tags: ['!test'],
}

export const HighContrastPopupAssembledStep19 = {
  ...twinStep(
    uiPopupAssembledStories,
    uiPopupAssembledStories.PopupAssembled,
    19,
  ),
  name: 'UI/Popup/Assembled — Popups assembled, step 19',
  tags: ['!test'],
}

export const HighContrastThemingDefaultPaletteStep1 = {
  ...twinStep(themingStories, themingStories.ThemingDefaultPalette, 1),
  name: 'Theming — Default palette, step 1',
  tags: ['!test'],
}

export const HighContrastThemingDefaultPaletteStep2 = {
  ...twinStep(themingStories, themingStories.ThemingDefaultPalette, 2),
  name: 'Theming — Default palette, step 2',
  tags: ['!test'],
}

export const HighContrastThemingShadcnPaletteStep1 = {
  ...twinStep(themingStories, themingStories.ThemingShadcnPalette, 1),
  name: 'Theming — App palette, step 1',
  tags: ['!test'],
}

export const HighContrastThemingShadcnPaletteStep2 = {
  ...twinStep(themingStories, themingStories.ThemingShadcnPalette, 2),
  name: 'Theming — App palette, step 2',
  tags: ['!test'],
}

export const HighContrastThemingShadcnPaletteStep3 = {
  ...twinStep(themingStories, themingStories.ThemingShadcnPalette, 3),
  name: 'Theming — App palette, step 3',
  tags: ['!test'],
}

export const HighContrastThemingUnsavedRoleStep1 = {
  ...twinStep(themingStories, themingStories.ThemingUnsavedRole, 1),
  name: 'Theming — Unsaved role, step 1',
  tags: ['!test'],
}

export const HighContrastThemingUnsavedRoleStep2 = {
  ...twinStep(themingStories, themingStories.ThemingUnsavedRole, 2),
  name: 'Theming — Unsaved role, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationPageNumbersStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationPageNumbers,
    1,
  ),
  name: 'Panels/Pagination — Page numbers, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationPageNumbersStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationPageNumbers,
    2,
  ),
  name: 'Panels/Pagination — Page numbers, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationPageNumbersStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationPageNumbers,
    3,
  ),
  name: 'Panels/Pagination — Page numbers, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationPageInputStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationPageInput,
    1,
  ),
  name: 'Panels/Pagination — Page input, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationPageInputStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationPageInput,
    2,
  ),
  name: 'Panels/Pagination — Page input, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationPageInputStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationPageInput,
    3,
  ),
  name: 'Panels/Pagination — Page input, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationNarrowPageNumbersStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationNarrowPageNumbers,
    1,
  ),
  name: 'Panels/Pagination — Narrow panel, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationNarrowPageNumbersStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationNarrowPageNumbers,
    2,
  ),
  name: 'Panels/Pagination — Narrow panel, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationNarrowPageNumbersStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationNarrowPageNumbers,
    3,
  ),
  name: 'Panels/Pagination — Narrow panel, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationServerPageRefusedStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerPageRefused,
    1,
  ),
  name: 'Panels/Pagination — Refused page, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationServerPageRefusedStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerPageRefused,
    2,
  ),
  name: 'Panels/Pagination — Refused page, step 2',
  tags: ['!test'],
}

export const HighContrastPaginationServerPageRefusedStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerPageRefused,
    3,
  ),
  name: 'Panels/Pagination — Refused page, step 3',
  tags: ['!test'],
}

export const HighContrastPaginationUnknownTotalStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.PaginationUnknownTotal,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Page numbers after the total, step 1',
  tags: ['!test'],
}

export const HighContrastPaginationUnknownTotalStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.PaginationUnknownTotal,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Page numbers after the total, step 2',
  tags: ['!test'],
}

export const HighContrastClientTransactionsEditLargeTableStep1 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsEditLargeTable,
    1,
  ),
  name: 'Data loading/Client transactions — Edit a large sorted table, step 1',
  tags: ['!test'],
}

export const HighContrastClientTransactionsEditLargeTableStep2 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsEditLargeTable,
    2,
  ),
  name: 'Data loading/Client transactions — Edit a large sorted table, step 2',
  tags: ['!test'],
}

export const HighContrastClientTransactionsEditLargeTableStep3 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsEditLargeTable,
    3,
  ),
  name: 'Data loading/Client transactions — Edit a large sorted table, step 3',
  tags: ['!test'],
}

export const HighContrastClientTransactionsAddRemoveStep1 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsAddRemove,
    1,
  ),
  name: 'Data loading/Client transactions — Add and remove rows, step 1',
  tags: ['!test'],
}

export const HighContrastClientTransactionsAddRemoveStep2 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsAddRemove,
    2,
  ),
  name: 'Data loading/Client transactions — Add and remove rows, step 2',
  tags: ['!test'],
}

export const HighContrastClientTransactionsAddRemoveStep3 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsAddRemove,
    3,
  ),
  name: 'Data loading/Client transactions — Add and remove rows, step 3',
  tags: ['!test'],
}

export const HighContrastClientTransactionsAddRemoveStep4 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsAddRemove,
    4,
  ),
  name: 'Data loading/Client transactions — Add and remove rows, step 4',
  tags: ['!test'],
}

export const HighContrastClientTransactionsShiftLargeTableStep1 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsShiftLargeTable,
    1,
  ),
  name: 'Data loading/Client transactions — Shift rows in a large table, step 1',
  tags: ['!test'],
}

export const HighContrastClientTransactionsShiftLargeTableStep2 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsShiftLargeTable,
    2,
  ),
  name: 'Data loading/Client transactions — Shift rows in a large table, step 2',
  tags: ['!test'],
}

export const HighContrastClientTransactionsShiftLargeTableStep3 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsShiftLargeTable,
    3,
  ),
  name: 'Data loading/Client transactions — Shift rows in a large table, step 3',
  tags: ['!test'],
}

export const HighContrastClientTransactionsShiftLargeTableStep4 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsShiftLargeTable,
    4,
  ),
  name: 'Data loading/Client transactions — Shift rows in a large table, step 4',
  tags: ['!test'],
}

export const HighContrastClientTransactionsWithoutHandlerStep1 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsWithoutHandler,
    1,
  ),
  name: 'Data loading/Client transactions — Without a data handler, step 1',
  tags: ['!test'],
}

export const HighContrastClientTransactionsWithoutHandlerStep2 = {
  ...twinStep(
    clientTransactionsStories,
    clientTransactionsStories.ClientTransactionsWithoutHandler,
    2,
  ),
  name: 'Data loading/Client transactions — Without a data handler, step 2',
  tags: ['!test'],
}

export const HighContrastClientRowModelLargeTableStep1 = {
  ...twinStep(
    clientRowModelStories,
    clientRowModelStories.ClientRowModelLargeTable,
    1,
  ),
  name: 'Data loading/Client row model — Sort, filter, group and edit a large table, step 1',
  tags: ['!test'],
}

export const HighContrastClientRowModelLargeTableStep2 = {
  ...twinStep(
    clientRowModelStories,
    clientRowModelStories.ClientRowModelLargeTable,
    2,
  ),
  name: 'Data loading/Client row model — Sort, filter, group and edit a large table, step 2',
  tags: ['!test'],
}

export const HighContrastClientRowModelLargeTableStep3 = {
  ...twinStep(
    clientRowModelStories,
    clientRowModelStories.ClientRowModelLargeTable,
    3,
  ),
  name: 'Data loading/Client row model — Sort, filter, group and edit a large table, step 3',
  tags: ['!test'],
}

export const HighContrastClientRowModelLargeTableStep4 = {
  ...twinStep(
    clientRowModelStories,
    clientRowModelStories.ClientRowModelLargeTable,
    4,
  ),
  name: 'Data loading/Client row model — Sort, filter, group and edit a large table, step 4',
  tags: ['!test'],
}

export const HighContrastClientRowModelLargeTableStep5 = {
  ...twinStep(
    clientRowModelStories,
    clientRowModelStories.ClientRowModelLargeTable,
    5,
  ),
  name: 'Data loading/Client row model — Sort, filter, group and edit a large table, step 5',
  tags: ['!test'],
}

export const HighContrastClientRowModelLargeTableStep6 = {
  ...twinStep(
    clientRowModelStories,
    clientRowModelStories.ClientRowModelLargeTable,
    6,
  ),
  name: 'Data loading/Client row model — Sort, filter, group and edit a large table, step 6',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyMissingSliceStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyMissingSlice, 1),
  name: 'Plugin API — Body slices, step 1',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyMissingSliceStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyMissingSlice, 2),
  name: 'Plugin API — Body slices, step 2',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyMissingSliceStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyMissingSlice, 3),
  name: 'Plugin API — Body slices, step 3',
  tags: ['!test'],
}

export const HighContrastVisibilityHideSortedColumnStep1 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.VisibilityHideSortedColumn,
    1,
  ),
  name: 'Columns/Visibility — Hide a sorted column, step 1',
  tags: ['!test'],
}

export const HighContrastVisibilityHideSortedColumnStep2 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.VisibilityHideSortedColumn,
    2,
  ),
  name: 'Columns/Visibility — Hide a sorted column, step 2',
  tags: ['!test'],
}

export const HighContrastVisibilityHideSortedColumnStep3 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.VisibilityHideSortedColumn,
    3,
  ),
  name: 'Columns/Visibility — Hide a sorted column, step 3',
  tags: ['!test'],
}

export const HighContrastVisibilityClearHiddenTransformsStep1 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.VisibilityClearHiddenTransforms,
    1,
  ),
  name: 'Columns/Visibility — Clear a hidden column sorting, step 1',
  tags: ['!test'],
}

export const HighContrastVisibilityClearHiddenTransformsStep2 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.VisibilityClearHiddenTransforms,
    2,
  ),
  name: 'Columns/Visibility — Clear a hidden column sorting, step 2',
  tags: ['!test'],
}

export const HighContrastVisibilityClearHiddenTransformsStep3 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.VisibilityClearHiddenTransforms,
    3,
  ),
  name: 'Columns/Visibility — Clear a hidden column sorting, step 3',
  tags: ['!test'],
}

export const HighContrastVisibilityClearHiddenTransformsStep4 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.VisibilityClearHiddenTransforms,
    4,
  ),
  name: 'Columns/Visibility — Clear a hidden column sorting, step 4',
  tags: ['!test'],
}

export const HighContrastHeaderGroupsWideGroupsStep1 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGroupsWideGroups,
    1,
  ),
  name: 'Columns/Header groups — Wide groups, step 1',
  tags: ['!test'],
}

export const HighContrastHeaderGroupsWideGroupsStep2 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGroupsWideGroups,
    2,
  ),
  name: 'Columns/Header groups — Wide groups, step 2',
  tags: ['!test'],
}

export const HighContrastHeaderGroupsWideGroupsStep3 = {
  ...twinStep(
    columnsHeaderGroupsStories,
    columnsHeaderGroupsStories.HeaderGroupsWideGroups,
    3,
  ),
  name: 'Columns/Header groups — Wide groups, step 3',
  tags: ['!test'],
}

export const HighContrastThemingColumnDividersStep1 = {
  ...twinStep(themingStories, themingStories.ThemingColumnDividers, 1),
  name: 'Theming — Column dividers, step 1',
  tags: ['!test'],
}

export const HighContrastThemingColumnDividersStep2 = {
  ...twinStep(themingStories, themingStories.ThemingColumnDividers, 2),
  name: 'Theming — Column dividers, step 2',
  tags: ['!test'],
}

export const HighContrastToolbarOwnOrderStep1 = {
  ...twinStep(panelsToolbarStories, panelsToolbarStories.ToolbarOwnOrder, 1),
  name: 'Panels/Toolbar — Own button order, step 1',
  tags: ['!test'],
}

export const HighContrastToolbarOwnOrderStep2 = {
  ...twinStep(panelsToolbarStories, panelsToolbarStories.ToolbarOwnOrder, 2),
  name: 'Panels/Toolbar — Own button order, step 2',
  tags: ['!test'],
}

export const HighContrastToolbarOwnOrderStep3 = {
  ...twinStep(panelsToolbarStories, panelsToolbarStories.ToolbarOwnOrder, 3),
  name: 'Panels/Toolbar — Own button order, step 3',
  tags: ['!test'],
}

export const HighContrastViewSummaryStep1 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsSummary,
    1,
  ),
  name: 'Panels/View settings — Hidden column settings, step 1',
  tags: ['!test'],
}

export const HighContrastViewSummaryStep2 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsSummary,
    2,
  ),
  name: 'Panels/View settings — Hidden column settings, step 2',
  tags: ['!test'],
}

export const HighContrastViewSummaryStep3 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsSummary,
    3,
  ),
  name: 'Panels/View settings — Hidden column settings, step 3',
  tags: ['!test'],
}

export const HighContrastViewSummaryStep4 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsSummary,
    4,
  ),
  name: 'Panels/View settings — Hidden column settings, step 4',
  tags: ['!test'],
}

export const HighContrastViewColumnsStep1 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsColumns,
    1,
  ),
  name: 'Panels/View settings — Columns section, step 1',
  tags: ['!test'],
}

export const HighContrastViewColumnsStep2 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsColumns,
    2,
  ),
  name: 'Panels/View settings — Columns section, step 2',
  tags: ['!test'],
}

export const HighContrastViewColumnsStep3 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsColumns,
    3,
  ),
  name: 'Panels/View settings — Columns section, step 3',
  tags: ['!test'],
}

export const HighContrastViewOwnSectionStep1 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsOwnSection,
    1,
  ),
  name: 'Panels/View settings — Own section, step 1',
  tags: ['!test'],
}

export const HighContrastViewOwnSectionStep2 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsOwnSection,
    2,
  ),
  name: 'Panels/View settings — Own section, step 2',
  tags: ['!test'],
}

export const HighContrastViewOwnSectionStep3 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsOwnSection,
    3,
  ),
  name: 'Panels/View settings — Own section, step 3',
  tags: ['!test'],
}

export const HighContrastViewServerRefusedStep1 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsServerRefused,
    1,
  ),
  name: 'Panels/View settings — Refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastViewServerRefusedStep2 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsServerRefused,
    2,
  ),
  name: 'Panels/View settings — Refused by the server, step 2',
  tags: ['!test'],
}

export const HighContrastViewServerRefusedStep3 = {
  ...twinStep(
    panelsViewSettingsStories,
    panelsViewSettingsStories.ViewSettingsServerRefused,
    3,
  ),
  name: 'Panels/View settings — Refused by the server, step 3',
  tags: ['!test'],
}

export const HighContrastFlexFillStep1 = {
  ...twinStep(
    columnsFlexWidthStories,
    columnsFlexWidthStories.FlexFillWidth,
    1,
  ),
  name: 'Columns/Flex width — Fill the width, step 1',
  tags: ['!test'],
}

export const HighContrastFlexFillStep2 = {
  ...twinStep(
    columnsFlexWidthStories,
    columnsFlexWidthStories.FlexFillWidth,
    2,
  ),
  name: 'Columns/Flex width — Fill the width, step 2',
  tags: ['!test'],
}

export const HighContrastFlexFillStep3 = {
  ...twinStep(
    columnsFlexWidthStories,
    columnsFlexWidthStories.FlexFillWidth,
    3,
  ),
  name: 'Columns/Flex width — Fill the width, step 3',
  tags: ['!test'],
}

export const HighContrastFlexResizeStep1 = {
  ...twinStep(columnsFlexWidthStories, columnsFlexWidthStories.FlexResize, 1),
  name: 'Columns/Flex width — Resize a flex column, step 1',
  tags: ['!test'],
}

export const HighContrastFlexResizeStep2 = {
  ...twinStep(columnsFlexWidthStories, columnsFlexWidthStories.FlexResize, 2),
  name: 'Columns/Flex width — Resize a flex column, step 2',
  tags: ['!test'],
}

export const HighContrastFlexResizeStep3 = {
  ...twinStep(columnsFlexWidthStories, columnsFlexWidthStories.FlexResize, 3),
  name: 'Columns/Flex width — Resize a flex column, step 3',
  tags: ['!test'],
}

export const HighContrastFlexOverflowStep1 = {
  ...twinStep(columnsFlexWidthStories, columnsFlexWidthStories.FlexOverflow, 1),
  name: 'Columns/Flex width — Columns do not fit, step 1',
  tags: ['!test'],
}

export const HighContrastFlexOverflowStep2 = {
  ...twinStep(columnsFlexWidthStories, columnsFlexWidthStories.FlexOverflow, 2),
  name: 'Columns/Flex width — Columns do not fit, step 2',
  tags: ['!test'],
}

export const HighContrastAutosizeColumnsStep1 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.AutosizeColumns,
    1,
  ),
  name: 'Columns/Resizing — Autosize columns, step 1',
  tags: ['!test'],
}

export const HighContrastAutosizeColumnsStep2 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.AutosizeColumns,
    2,
  ),
  name: 'Columns/Resizing — Autosize columns, step 2',
  tags: ['!test'],
}

export const HighContrastAutosizeColumnsStep3 = {
  ...twinStep(
    columnsResizingStories,
    columnsResizingStories.AutosizeColumns,
    3,
  ),
  name: 'Columns/Resizing — Autosize columns, step 3',
  tags: ['!test'],
}

export const HighContrastAutosizeOnDataStep1 = {
  ...twinStep(columnsResizingStories, columnsResizingStories.AutosizeOnData, 1),
  name: 'Columns/Resizing — Autosize on data, step 1',
  tags: ['!test'],
}

export const HighContrastAutosizeOnDataStep2 = {
  ...twinStep(columnsResizingStories, columnsResizingStories.AutosizeOnData, 2),
  name: 'Columns/Resizing — Autosize on data, step 2',
  tags: ['!test'],
}

export const HighContrastTextWrapClampedStep1 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapClamped,
    1,
  ),
  name: 'Columns/Text wrap — Wrap within the row, step 1',
  tags: ['!test'],
}

export const HighContrastTextWrapClampedStep2 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapClamped,
    2,
  ),
  name: 'Columns/Text wrap — Wrap within the row, step 2',
  tags: ['!test'],
}

export const HighContrastTextWrapClampedStep3 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapClamped,
    3,
  ),
  name: 'Columns/Text wrap — Wrap within the row, step 3',
  tags: ['!test'],
}

export const HighContrastTextWrapAutoHeightStep1 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapAutoHeight,
    1,
  ),
  name: 'Columns/Text wrap — Rows grow with content, step 1',
  tags: ['!test'],
}

export const HighContrastTextWrapAutoHeightStep2 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapAutoHeight,
    2,
  ),
  name: 'Columns/Text wrap — Rows grow with content, step 2',
  tags: ['!test'],
}

export const HighContrastTextWrapResizeColumnStep1 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapResizeColumn,
    1,
  ),
  name: 'Columns/Text wrap — Narrow a column, step 1',
  tags: ['!test'],
}

export const HighContrastTextWrapResizeColumnStep2 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapResizeColumn,
    2,
  ),
  name: 'Columns/Text wrap — Narrow a column, step 2',
  tags: ['!test'],
}

export const HighContrastTextWrapHeaderStep1 = {
  ...twinStep(columnsTextWrapStories, columnsTextWrapStories.TextWrapHeader, 1),
  name: 'Columns/Text wrap — Long headers, step 1',
  tags: ['!test'],
}

export const HighContrastTextWrapHeaderStep2 = {
  ...twinStep(columnsTextWrapStories, columnsTextWrapStories.TextWrapHeader, 2),
  name: 'Columns/Text wrap — Long headers, step 2',
  tags: ['!test'],
}

export const HighContrastTextWrapKeyboardStep1 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapKeyboard,
    1,
  ),
  name: 'Columns/Text wrap — Keyboard and scroll to a record, step 1',
  tags: ['!test'],
}

export const HighContrastTextWrapKeyboardStep2 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapKeyboard,
    2,
  ),
  name: 'Columns/Text wrap — Keyboard and scroll to a record, step 2',
  tags: ['!test'],
}

export const HighContrastTextWrapKeyboardStep3 = {
  ...twinStep(
    columnsTextWrapStories,
    columnsTextWrapStories.TextWrapKeyboard,
    3,
  ),
  name: 'Columns/Text wrap — Keyboard and scroll to a record, step 3',
  tags: ['!test'],
}

export const HighContrastTextWrapServerStep1 = {
  ...twinStep(columnsTextWrapStories, columnsTextWrapStories.TextWrapServer, 1),
  name: 'Columns/Text wrap — Server rows, step 1',
  tags: ['!test'],
}

export const HighContrastTextWrapServerStep2 = {
  ...twinStep(columnsTextWrapStories, columnsTextWrapStories.TextWrapServer, 2),
  name: 'Columns/Text wrap — Server rows, step 2',
  tags: ['!test'],
}

export const HighContrastTextWrapMotionStep1 = {
  ...twinStep(columnsTextWrapStories, columnsTextWrapStories.TextWrapMotion, 1),
  name: 'Columns/Text wrap — Sort rows of different heights, step 1',
  tags: ['!test'],
}

export const HighContrastTextWrapMotionStep2 = {
  ...twinStep(columnsTextWrapStories, columnsTextWrapStories.TextWrapMotion, 2),
  name: 'Columns/Text wrap — Sort rows of different heights, step 2',
  tags: ['!test'],
}

export const HighContrastPasteFromSpreadsheetStep1 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteFromSpreadsheet,
    1,
  ),
  name: 'Cells/Paste & fill — Paste from a spreadsheet, step 1',
  tags: ['!test'],
}

export const HighContrastPasteFromSpreadsheetStep2 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteFromSpreadsheet,
    2,
  ),
  name: 'Cells/Paste & fill — Paste from a spreadsheet, step 2',
  tags: ['!test'],
}

export const HighContrastPasteOneIntoRangeStep1 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteOneIntoRange,
    1,
  ),
  name: 'Cells/Paste & fill — One value into a range, step 1',
  tags: ['!test'],
}

export const HighContrastPasteOneIntoRangeStep2 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteOneIntoRange,
    2,
  ),
  name: 'Cells/Paste & fill — One value into a range, step 2',
  tags: ['!test'],
}

export const HighContrastPasteWithErrorsStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteWithErrors, 1),
  name: 'Cells/Paste & fill — Read-only and invalid cells, step 1',
  tags: ['!test'],
}

export const HighContrastPasteWithErrorsStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteWithErrors, 2),
  name: 'Cells/Paste & fill — Read-only and invalid cells, step 2',
  tags: ['!test'],
}

export const HighContrastPasteRefusedByServerStep1 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteRefusedByServer,
    1,
  ),
  name: 'Cells/Paste & fill — Refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastPasteRefusedByServerStep2 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteRefusedByServer,
    2,
  ),
  name: 'Cells/Paste & fill — Refused by the server, step 2',
  tags: ['!test'],
}

export const HighContrastPasteRefusedByServerStep3 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteRefusedByServer,
    3,
  ),
  name: 'Cells/Paste & fill — Refused by the server, step 3',
  tags: ['!test'],
}

export const HighContrastPasteRefusedByServerStep4 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteRefusedByServer,
    4,
  ),
  name: 'Cells/Paste & fill — Refused by the server, step 4',
  tags: ['!test'],
}

export const HighContrastPasteManualSaveStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteManualSave, 1),
  name: 'Cells/Paste & fill — Paste, then save by button, step 1',
  tags: ['!test'],
}

export const HighContrastPasteManualSaveStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteManualSave, 2),
  name: 'Cells/Paste & fill — Paste, then save by button, step 2',
  tags: ['!test'],
}

export const HighContrastClearAndCutStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.ClearAndCut, 1),
  name: 'Cells/Paste & fill — Clear and cut, step 1',
  tags: ['!test'],
}

export const HighContrastClearAndCutStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.ClearAndCut, 2),
  name: 'Cells/Paste & fill — Clear and cut, step 2',
  tags: ['!test'],
}

export const HighContrastClearAndCutStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.ClearAndCut, 3),
  name: 'Cells/Paste & fill — Clear and cut, step 3',
  tags: ['!test'],
}

export const HighContrastOwnBulkEditStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.OwnBulkEdit, 1),
  name: 'Cells/Paste & fill — Own action in the context menu, step 1',
  tags: ['!test'],
}

export const HighContrastOwnBulkEditStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.OwnBulkEdit, 2),
  name: 'Cells/Paste & fill — Own action in the context menu, step 2',
  tags: ['!test'],
}

export const HighContrastPasteConfirmStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteConfirm, 1),
  name: 'Cells/Paste & fill — Confirm before pasting, step 1',
  tags: ['!test'],
}

export const HighContrastPasteConfirmStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteConfirm, 2),
  name: 'Cells/Paste & fill — Confirm before pasting, step 2',
  tags: ['!test'],
}

export const HighContrastPasteConfirmStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteConfirm, 3),
  name: 'Cells/Paste & fill — Confirm before pasting, step 3',
  tags: ['!test'],
}

export const HighContrastPasteFromSpreadsheetStep3 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteFromSpreadsheet,
    3,
  ),
  name: 'Cells/Paste & fill — Paste from a spreadsheet, step 3',
  tags: ['!test'],
}

export const HighContrastPasteOneIntoRangeStep3 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteOneIntoRange,
    3,
  ),
  name: 'Cells/Paste & fill — One value into a range, step 3',
  tags: ['!test'],
}

export const HighContrastPasteWithErrorsStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteWithErrors, 3),
  name: 'Cells/Paste & fill — Read-only and invalid cells, step 3',
  tags: ['!test'],
}

export const HighContrastPasteRefusedByServerStep5 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.PasteRefusedByServer,
    5,
  ),
  name: 'Cells/Paste & fill — Refused by the server, step 5',
  tags: ['!test'],
}

export const HighContrastPasteManualSaveStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteManualSave, 3),
  name: 'Cells/Paste & fill — Paste, then save by button, step 3',
  tags: ['!test'],
}

export const HighContrastClearAndCutStep4 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.ClearAndCut, 4),
  name: 'Cells/Paste & fill — Clear and cut, step 4',
  tags: ['!test'],
}

export const HighContrastOwnBulkEditStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.OwnBulkEdit, 3),
  name: 'Cells/Paste & fill — Own action in the context menu, step 3',
  tags: ['!test'],
}

export const HighContrastPasteConfirmStep4 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteConfirm, 4),
  name: 'Cells/Paste & fill — Confirm before pasting, step 4',
  tags: ['!test'],
}

export const HighContrastOwnBulkEditStep4 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.OwnBulkEdit, 4),
  name: 'Cells/Paste & fill — Own action in the context menu, step 4',
  tags: ['!test'],
}

export const HighContrastFillCopyStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillCopy, 1),
  name: 'Cells/Paste & fill — Drag a value down, step 1',
  tags: ['!test'],
}

export const HighContrastFillCopyStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillCopy, 2),
  name: 'Cells/Paste & fill — Drag a value down, step 2',
  tags: ['!test'],
}

export const HighContrastFillCopyStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillCopy, 3),
  name: 'Cells/Paste & fill — Drag a value down, step 3',
  tags: ['!test'],
}

export const HighContrastFillCopyStep4 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillCopy, 4),
  name: 'Cells/Paste & fill — Drag a value down, step 4',
  tags: ['!test'],
}

export const HighContrastFillSeriesStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillSeries, 1),
  name: 'Cells/Paste & fill — Continue a series, step 1',
  tags: ['!test'],
}

export const HighContrastFillSeriesStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillSeries, 2),
  name: 'Cells/Paste & fill — Continue a series, step 2',
  tags: ['!test'],
}

export const HighContrastFillSeriesStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillSeries, 3),
  name: 'Cells/Paste & fill — Continue a series, step 3',
  tags: ['!test'],
}

export const HighContrastFillSeriesStep4 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillSeries, 4),
  name: 'Cells/Paste & fill — Continue a series, step 4',
  tags: ['!test'],
}

export const HighContrastFillSeriesStep5 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillSeries, 5),
  name: 'Cells/Paste & fill — Continue a series, step 5',
  tags: ['!test'],
}

export const HighContrastFillDownKeyboardStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillDownKeyboard, 1),
  name: 'Cells/Paste & fill — Fill down and right from the keyboard, step 1',
  tags: ['!test'],
}

export const HighContrastFillDownKeyboardStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillDownKeyboard, 2),
  name: 'Cells/Paste & fill — Fill down and right from the keyboard, step 2',
  tags: ['!test'],
}

export const HighContrastFillDownKeyboardStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillDownKeyboard, 3),
  name: 'Cells/Paste & fill — Fill down and right from the keyboard, step 3',
  tags: ['!test'],
}

export const HighContrastFillDownKeyboardStep4 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillDownKeyboard, 4),
  name: 'Cells/Paste & fill — Fill down and right from the keyboard, step 4',
  tags: ['!test'],
}

export const HighContrastFillDownKeyboardStep5 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.FillDownKeyboard, 5),
  name: 'Cells/Paste & fill — Fill down and right from the keyboard, step 5',
  tags: ['!test'],
}

export const HighContrastBulkEditCtrlEnterStep1 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.BulkEditCtrlEnter,
    1,
  ),
  name: 'Cells/Paste & fill — Edit the whole range, step 1',
  tags: ['!test'],
}

export const HighContrastBulkEditCtrlEnterStep2 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.BulkEditCtrlEnter,
    2,
  ),
  name: 'Cells/Paste & fill — Edit the whole range, step 2',
  tags: ['!test'],
}

export const HighContrastBulkEditCtrlEnterStep3 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.BulkEditCtrlEnter,
    3,
  ),
  name: 'Cells/Paste & fill — Edit the whole range, step 3',
  tags: ['!test'],
}

export const HighContrastBulkEditCtrlEnterStep4 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.BulkEditCtrlEnter,
    4,
  ),
  name: 'Cells/Paste & fill — Edit the whole range, step 4',
  tags: ['!test'],
}

export const HighContrastServerPasteLoadsRowsStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerPasteLoadsRows,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Paste loads the rows, step 1',
  tags: ['!test'],
}

export const HighContrastServerPasteLoadsRowsStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerPasteLoadsRows,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Paste loads the rows, step 2',
  tags: ['!test'],
}

export const HighContrastServerPasteLoadsRowsStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerPasteLoadsRows,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Paste loads the rows, step 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangesAnyModeStep4 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.CellSelectionRangesAnyMode,
    4,
  ),
  name: 'Data loading/Server row model/Cell selection — Read the selection, step 4',
  tags: ['!test'],
}

export const HighContrastServerPasteLoadsRowsStep4 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerPasteLoadsRows,
    4,
  ),
  name: 'Data loading/Server row model/Cell selection — Paste loads the rows, step 4',
  tags: ['!test'],
}

export const HighContrastServerPasteLoadsRowsStep5 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerPasteLoadsRows,
    5,
  ),
  name: 'Data loading/Server row model/Cell selection — Paste loads the rows, step 5',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashUpdateStep1 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashUpdate,
    1,
  ),
  name: 'Cells/Value change flash — Update from the server, step 1',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashUpdateStep2 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashUpdate,
    2,
  ),
  name: 'Cells/Value change flash — Update from the server, step 2',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashDirectionStep1 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashDirection,
    1,
  ),
  name: 'Cells/Value change flash — Rise and fall, step 1',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashDirectionStep2 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashDirection,
    2,
  ),
  name: 'Cells/Value change flash — Rise and fall, step 2',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashOwnEditStep1 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashOwnEdit,
    1,
  ),
  name: 'Cells/Value change flash — Own edit and a colleague, step 1',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashOwnEditStep2 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashOwnEdit,
    2,
  ),
  name: 'Cells/Value change flash — Own edit and a colleague, step 2',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashOwnEditStep3 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashOwnEdit,
    3,
  ),
  name: 'Cells/Value change flash — Own edit and a colleague, step 3',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashOverFillStep1 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashOverFill,
    1,
  ),
  name: 'Cells/Value change flash — Flash over a highlight, step 1',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashOverFillStep2 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashOverFill,
    2,
  ),
  name: 'Cells/Value change flash — Flash over a highlight, step 2',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashTotalsStep1 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashTotals,
    1,
  ),
  name: 'Cells/Value change flash — Totals in the footer, step 1',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashTotalsStep2 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashTotals,
    2,
  ),
  name: 'Cells/Value change flash — Totals in the footer, step 2',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashTotalsStep3 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashTotals,
    3,
  ),
  name: 'Cells/Value change flash — Totals in the footer, step 3',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashColorsStep1 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashColors,
    1,
  ),
  name: 'Cells/Value change flash — Flash colors, step 1',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashColorsStep2 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashColors,
    2,
  ),
  name: 'Cells/Value change flash — Flash colors, step 2',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashColorsStep3 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashColors,
    3,
  ),
  name: 'Cells/Value change flash — Flash colors, step 3',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashColorsStep4 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashColors,
    4,
  ),
  name: 'Cells/Value change flash — Flash colors, step 4',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashColorsStep5 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashColors,
    5,
  ),
  name: 'Cells/Value change flash — Flash colors, step 5',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashColorsStep6 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashColors,
    6,
  ),
  name: 'Cells/Value change flash — Flash colors, step 6',
  tags: ['!test'],
}

export const HighContrastValueChangeFlashColorsStep7 = {
  ...twinStep(
    cellsValueChangeFlashStories,
    cellsValueChangeFlashStories.ValueChangeFlashColors,
    7,
  ),
  name: 'Cells/Value change flash — Flash colors, step 7',
  tags: ['!test'],
}

export const HighContrastUndoPasteStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoPaste, 1),
  name: 'Cells/Undo & redo — Undo a paste, step 1',
  tags: ['!test'],
}

export const HighContrastUndoPasteStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoPaste, 2),
  name: 'Cells/Undo & redo — Undo a paste, step 2',
  tags: ['!test'],
}

export const HighContrastUndoPasteStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoPaste, 3),
  name: 'Cells/Undo & redo — Undo a paste, step 3',
  tags: ['!test'],
}

export const HighContrastUndoPasteStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoPaste, 4),
  name: 'Cells/Undo & redo — Undo a paste, step 4',
  tags: ['!test'],
}

export const HighContrastUndoOnServerStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoOnServer, 1),
  name: 'Cells/Undo & redo — Undo saved on the server, step 1',
  tags: ['!test'],
}

export const HighContrastUndoOnServerStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoOnServer, 2),
  name: 'Cells/Undo & redo — Undo saved on the server, step 2',
  tags: ['!test'],
}

export const HighContrastUndoOnServerStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoOnServer, 3),
  name: 'Cells/Undo & redo — Undo saved on the server, step 3',
  tags: ['!test'],
}

export const HighContrastUndoOnServerStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoOnServer, 4),
  name: 'Cells/Undo & redo — Undo saved on the server, step 4',
  tags: ['!test'],
}

export const HighContrastUndoOnServerStep5 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoOnServer, 5),
  name: 'Cells/Undo & redo — Undo saved on the server, step 5',
  tags: ['!test'],
}

export const HighContrastUndoWhilePendingStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoWhilePending, 1),
  name: 'Cells/Undo & redo — Undo while saving, step 1',
  tags: ['!test'],
}

export const HighContrastUndoWhilePendingStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoWhilePending, 2),
  name: 'Cells/Undo & redo — Undo while saving, step 2',
  tags: ['!test'],
}

export const HighContrastUndoWhilePendingStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoWhilePending, 3),
  name: 'Cells/Undo & redo — Undo while saving, step 3',
  tags: ['!test'],
}

export const HighContrastUndoWhilePendingStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoWhilePending, 4),
  name: 'Cells/Undo & redo — Undo while saving, step 4',
  tags: ['!test'],
}

export const HighContrastUndoConflictStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoConflict, 1),
  name: 'Cells/Undo & redo — Changed by someone else, step 1',
  tags: ['!test'],
}

export const HighContrastUndoConflictStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoConflict, 2),
  name: 'Cells/Undo & redo — Changed by someone else, step 2',
  tags: ['!test'],
}

export const HighContrastUndoConflictStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoConflict, 3),
  name: 'Cells/Undo & redo — Changed by someone else, step 3',
  tags: ['!test'],
}

export const HighContrastUndoConflictStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoConflict, 4),
  name: 'Cells/Undo & redo — Changed by someone else, step 4',
  tags: ['!test'],
}

export const HighContrastHistoryRewindStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryRewind, 1),
  name: 'Cells/Undo & redo — Rewind with the history, step 1',
  tags: ['!test'],
}

export const HighContrastHistoryRewindStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryRewind, 2),
  name: 'Cells/Undo & redo — Rewind with the history, step 2',
  tags: ['!test'],
}

export const HighContrastHistoryRewindStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryRewind, 3),
  name: 'Cells/Undo & redo — Rewind with the history, step 3',
  tags: ['!test'],
}

export const HighContrastHistoryRewindStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryRewind, 4),
  name: 'Cells/Undo & redo — Rewind with the history, step 4',
  tags: ['!test'],
}

export const HighContrastHistoryRewindStep5 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryRewind, 5),
  name: 'Cells/Undo & redo — Rewind with the history, step 5',
  tags: ['!test'],
}

export const HighContrastUndoDraftsStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoDrafts, 1),
  name: 'Cells/Undo & redo — Undo unsaved changes, step 1',
  tags: ['!test'],
}

export const HighContrastUndoDraftsStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoDrafts, 2),
  name: 'Cells/Undo & redo — Undo unsaved changes, step 2',
  tags: ['!test'],
}

export const HighContrastUndoDraftsStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoDrafts, 3),
  name: 'Cells/Undo & redo — Undo unsaved changes, step 3',
  tags: ['!test'],
}

export const HighContrastUndoDraftsStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoDrafts, 4),
  name: 'Cells/Undo & redo — Undo unsaved changes, step 4',
  tags: ['!test'],
}

export const HighContrastAppHistoryEntryStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.AppHistoryEntry, 1),
  name: 'Cells/Undo & redo — Own action in the history, step 1',
  tags: ['!test'],
}

export const HighContrastAppHistoryEntryStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.AppHistoryEntry, 2),
  name: 'Cells/Undo & redo — Own action in the history, step 2',
  tags: ['!test'],
}

export const HighContrastAppHistoryEntryStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.AppHistoryEntry, 3),
  name: 'Cells/Undo & redo — Own action in the history, step 3',
  tags: ['!test'],
}

export const HighContrastAppHistoryEntryStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.AppHistoryEntry, 4),
  name: 'Cells/Undo & redo — Own action in the history, step 4',
  tags: ['!test'],
}

export const HighContrastAppHistoryEntryStep5 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.AppHistoryEntry, 5),
  name: 'Cells/Undo & redo — Own action in the history, step 5',
  tags: ['!test'],
}

export const HighContrastUndoRowDeleteStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowDelete, 1),
  name: 'Cells/Undo & redo — Undo a row delete, step 1',
  tags: ['!test'],
}

export const HighContrastUndoRowDeleteStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowDelete, 2),
  name: 'Cells/Undo & redo — Undo a row delete, step 2',
  tags: ['!test'],
}

export const HighContrastUndoRowDeleteStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowDelete, 3),
  name: 'Cells/Undo & redo — Undo a row delete, step 3',
  tags: ['!test'],
}

export const HighContrastUndoRowDeleteStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowDelete, 4),
  name: 'Cells/Undo & redo — Undo a row delete, step 4',
  tags: ['!test'],
}

export const HighContrastUndoRowDeleteStep5 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowDelete, 5),
  name: 'Cells/Undo & redo — Undo a row delete, step 5',
  tags: ['!test'],
}

export const HighContrastUndoRowMoveStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowMove, 1),
  name: 'Cells/Undo & redo — Undo a row move, step 1',
  tags: ['!test'],
}

export const HighContrastUndoRowMoveStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowMove, 2),
  name: 'Cells/Undo & redo — Undo a row move, step 2',
  tags: ['!test'],
}

export const HighContrastUndoRowMoveStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowMove, 3),
  name: 'Cells/Undo & redo — Undo a row move, step 3',
  tags: ['!test'],
}

export const HighContrastUndoRowMoveStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowMove, 4),
  name: 'Cells/Undo & redo — Undo a row move, step 4',
  tags: ['!test'],
}

export const HighContrastUndoRowMoveStep5 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoRowMove, 5),
  name: 'Cells/Undo & redo — Undo a row move, step 5',
  tags: ['!test'],
}

export const HighContrastHistoryBackToOriginalStep1 = {
  ...twinStep(
    cellsUndoRedoStories,
    cellsUndoRedoStories.HistoryBackToOriginal,
    1,
  ),
  name: 'Cells/Undo & redo — Back to original, step 1',
  tags: ['!test'],
}

export const HighContrastHistoryBackToOriginalStep2 = {
  ...twinStep(
    cellsUndoRedoStories,
    cellsUndoRedoStories.HistoryBackToOriginal,
    2,
  ),
  name: 'Cells/Undo & redo — Back to original, step 2',
  tags: ['!test'],
}

export const HighContrastHistoryBackToOriginalStep3 = {
  ...twinStep(
    cellsUndoRedoStories,
    cellsUndoRedoStories.HistoryBackToOriginal,
    3,
  ),
  name: 'Cells/Undo & redo — Back to original, step 3',
  tags: ['!test'],
}

export const HighContrastHistoryBackToOriginalStep4 = {
  ...twinStep(
    cellsUndoRedoStories,
    cellsUndoRedoStories.HistoryBackToOriginal,
    4,
  ),
  name: 'Cells/Undo & redo — Back to original, step 4',
  tags: ['!test'],
}

export const HighContrastHistoryBackToOriginalStep5 = {
  ...twinStep(
    cellsUndoRedoStories,
    cellsUndoRedoStories.HistoryBackToOriginal,
    5,
  ),
  name: 'Cells/Undo & redo — Back to original, step 5',
  tags: ['!test'],
}

export const HighContrastLargePasteConfirmStep1 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.LargePasteConfirm,
    1,
  ),
  name: 'Cells/Paste & fill — Confirm a large paste, step 1',
  tags: ['!test'],
}

export const HighContrastLargePasteConfirmStep2 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.LargePasteConfirm,
    2,
  ),
  name: 'Cells/Paste & fill — Confirm a large paste, step 2',
  tags: ['!test'],
}

export const HighContrastLargePasteConfirmStep3 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.LargePasteConfirm,
    3,
  ),
  name: 'Cells/Paste & fill — Confirm a large paste, step 3',
  tags: ['!test'],
}

export const HighContrastLargePasteConfirmStep4 = {
  ...twinStep(
    cellsPasteFillStories,
    cellsPasteFillStories.LargePasteConfirm,
    4,
  ),
  name: 'Cells/Paste & fill — Confirm a large paste, step 4',
  tags: ['!test'],
}

export const HighContrastPasteOverLimitStep1 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteOverLimit, 1),
  name: 'Cells/Paste & fill — Paste over the limit, step 1',
  tags: ['!test'],
}

export const HighContrastPasteOverLimitStep2 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteOverLimit, 2),
  name: 'Cells/Paste & fill — Paste over the limit, step 2',
  tags: ['!test'],
}

export const HighContrastPasteOverLimitStep3 = {
  ...twinStep(cellsPasteFillStories, cellsPasteFillStories.PasteOverLimit, 3),
  name: 'Cells/Paste & fill — Paste over the limit, step 3',
  tags: ['!test'],
}

export const HighContrastUndoDiscardStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoDiscard, 1),
  name: 'Cells/Undo & redo — Undo a discard, step 1',
  tags: ['!test'],
}

export const HighContrastUndoDiscardStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoDiscard, 2),
  name: 'Cells/Undo & redo — Undo a discard, step 2',
  tags: ['!test'],
}

export const HighContrastUndoDiscardStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoDiscard, 3),
  name: 'Cells/Undo & redo — Undo a discard, step 3',
  tags: ['!test'],
}

export const HighContrastUndoDiscardStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.UndoDiscard, 4),
  name: 'Cells/Undo & redo — Undo a discard, step 4',
  tags: ['!test'],
}

export const HighContrastHistoryAppliedStep1 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryApplied, 1),
  name: 'Cells/Undo & redo — Unsaved and applied in the history, step 1',
  tags: ['!test'],
}

export const HighContrastHistoryAppliedStep2 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryApplied, 2),
  name: 'Cells/Undo & redo — Unsaved and applied in the history, step 2',
  tags: ['!test'],
}

export const HighContrastHistoryAppliedStep3 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryApplied, 3),
  name: 'Cells/Undo & redo — Unsaved and applied in the history, step 3',
  tags: ['!test'],
}

export const HighContrastHistoryAppliedStep4 = {
  ...twinStep(cellsUndoRedoStories, cellsUndoRedoStories.HistoryApplied, 4),
  name: 'Cells/Undo & redo — Unsaved and applied in the history, step 4',
  tags: ['!test'],
}

export const HighContrastServerUndoStep1 = {
  ...twinStep(serverEditingStories, serverEditingStories.ServerUndo, 1),
  name: 'Data loading/Server row model/Editing — Undo an edit off the window, step 1',
  tags: ['!test'],
}

export const HighContrastServerUndoStep2 = {
  ...twinStep(serverEditingStories, serverEditingStories.ServerUndo, 2),
  name: 'Data loading/Server row model/Editing — Undo an edit off the window, step 2',
  tags: ['!test'],
}

export const HighContrastServerUndoStep3 = {
  ...twinStep(serverEditingStories, serverEditingStories.ServerUndo, 3),
  name: 'Data loading/Server row model/Editing — Undo an edit off the window, step 3',
  tags: ['!test'],
}

export const HighContrastServerUndoStep4 = {
  ...twinStep(serverEditingStories, serverEditingStories.ServerUndo, 4),
  name: 'Data loading/Server row model/Editing — Undo an edit off the window, step 4',
  tags: ['!test'],
}

export const HighContrastSummaryPickStep1 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryPick, 1),
  name: 'Columns/Summary — Pick a function, step 1',
  tags: ['!test'],
}

export const HighContrastSummaryPickStep2 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryPick, 2),
  name: 'Columns/Summary — Pick a function, step 2',
  tags: ['!test'],
}

export const HighContrastSummaryPickStep3 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryPick, 3),
  name: 'Columns/Summary — Pick a function, step 3',
  tags: ['!test'],
}

export const HighContrastSummaryGroupsStep1 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryGroups, 1),
  name: 'Columns/Summary — Groups, step 1',
  tags: ['!test'],
}

export const HighContrastSummaryGroupsStep2 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryGroups, 2),
  name: 'Columns/Summary — Groups, step 2',
  tags: ['!test'],
}

export const HighContrastSummaryNoneStep1 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryNone, 1),
  name: 'Columns/Summary — No summary, step 1',
  tags: ['!test'],
}

export const HighContrastSummaryNoneStep2 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryNone, 2),
  name: 'Columns/Summary — No summary, step 2',
  tags: ['!test'],
}

export const HighContrastSummaryAllowedStep1 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryAllowed, 1),
  name: 'Columns/Summary — Allowed functions, step 1',
  tags: ['!test'],
}

export const HighContrastSummaryAllowedStep2 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryAllowed, 2),
  name: 'Columns/Summary — Allowed functions, step 2',
  tags: ['!test'],
}

export const HighContrastSummaryViewSettingsStep1 = {
  ...twinStep(
    columnsSummaryStories,
    columnsSummaryStories.SummaryViewSettings,
    1,
  ),
  name: 'Columns/Summary — View settings, step 1',
  tags: ['!test'],
}

export const HighContrastSummaryViewSettingsStep2 = {
  ...twinStep(
    columnsSummaryStories,
    columnsSummaryStories.SummaryViewSettings,
    2,
  ),
  name: 'Columns/Summary — View settings, step 2',
  tags: ['!test'],
}

export const HighContrastSummaryViewSettingsStep3 = {
  ...twinStep(
    columnsSummaryStories,
    columnsSummaryStories.SummaryViewSettings,
    3,
  ),
  name: 'Columns/Summary — View settings, step 3',
  tags: ['!test'],
}

export const HighContrastSummaryRestoreStep1 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryRestore, 1),
  name: 'Columns/Summary — Restore a saved choice, step 1',
  tags: ['!test'],
}

export const HighContrastSummaryRestoreStep2 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryRestore, 2),
  name: 'Columns/Summary — Restore a saved choice, step 2',
  tags: ['!test'],
}

export const HighContrastSummaryServerStep1 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryServer, 1),
  name: 'Columns/Summary — Server row model, step 1',
  tags: ['!test'],
}

export const HighContrastSummaryServerStep2 = {
  ...twinStep(columnsSummaryStories, columnsSummaryStories.SummaryServer, 2),
  name: 'Columns/Summary — Server row model, step 2',
  tags: ['!test'],
}

export const HighContrastSummaryServerRefusedStep1 = {
  ...twinStep(
    columnsSummaryStories,
    columnsSummaryStories.SummaryServerRefused,
    1,
  ),
  name: 'Columns/Summary — Refused by the server, step 1',
  tags: ['!test'],
}

export const HighContrastSummaryServerRefusedStep2 = {
  ...twinStep(
    columnsSummaryStories,
    columnsSummaryStories.SummaryServerRefused,
    2,
  ),
  name: 'Columns/Summary — Refused by the server, step 2',
  tags: ['!test'],
}

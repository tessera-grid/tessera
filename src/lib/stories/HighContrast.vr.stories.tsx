import { Meta } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { type TwinSource, forced } from './__mocks__/catalog'
import { forcedStep } from './__mocks__/catalogPlay'
import * as cellsActionStatusStories from './DataGrid.Cells.ActionStatus.stories'
import * as cellsSelectionStories from './DataGrid.Cells.Selection.stories'
import * as columnsSortingStories from './DataGrid.Columns.Sorting.stories'
import * as coreFooterStories from './DataGrid.Core.Footer.stories'
import * as customizationLocalizationStories from './Customization.Localization.stories'
import * as coreIncreasedContrastStories from './Customization.IncreasedContrast.stories'
import * as themingStories from './Theming.stories'
import * as coreSizingStories from './DataGrid.Core.Sizing.stories'
import * as coreSkeletonStories from './DataGrid.DataLoading.Skeleton.stories'
import * as coreStubsStories from './DataGrid.Core.Stubs.stories'
import * as exportStories from './DataGrid.Export.stories'
import * as filteringStories from './DataGrid.Filtering.stories'
import * as panelsPaginationStories from './DataGrid.Panels.Pagination.stories'
import * as panelsToolbarStories from './DataGrid.Panels.Toolbar.stories'
import panelsFailureLogMeta, * as panelsFailureLogStories from './DataGrid.Panels.FailureLog.stories'
import panelsUnsavedChangesMeta, * as panelsUnsavedChangesStories from './DataGrid.Panels.UnsavedChanges.stories'
import rowsEditingMeta, * as rowsEditingStories from './DataGrid.Rows.Editing.stories'
import * as pluginApiStories from './DataGrid.PluginApi.stories'
import * as infiniteScrollStories from './DataGrid.DataLoading.InfiniteScroll.stories'
import * as serverRowModelStories from './DataGrid.DataLoading.ServerRowModel.stories'
import * as serverGroupingStories from './DataGrid.DataLoading.ServerRowModel.Grouping.stories'
import * as serverSelectionStories from './DataGrid.DataLoading.ServerRowModel.Selection.stories'
import * as serverCellSelectionStories from './DataGrid.DataLoading.ServerRowModel.CellSelection.stories'
import * as serverEditingStories from './DataGrid.DataLoading.ServerRowModel.Editing.stories'
import * as serverTransactionsStories from './DataGrid.DataLoading.ServerRowModel.Transactions.stories'
import * as serverPaginationStories from './DataGrid.DataLoading.ServerRowModel.Pagination.stories'
import * as serverDraggingStories from './DataGrid.DataLoading.ServerRowModel.Dragging.stories'
import * as serverLazyChildrenStories from './DataGrid.DataLoading.ServerRowModel.LazyChildren.stories'
import * as columnsDraggingStories from './DataGrid.Columns.Dragging.stories'
import * as columnsResizingStories from './DataGrid.Columns.Resizing.stories'
import * as rowsDraggingStories from './DataGrid.Rows.Dragging.stories'
import * as rowsGroupingStories from './DataGrid.Rows.Grouping.stories'
import * as rowsSelectionStories from './DataGrid.Rows.Selection.stories'
import * as rowsTreeDataStories from './DataGrid.Rows.TreeData.stories'
import * as cellsContextMenuStories from './DataGrid.Cells.ContextMenu.stories'
import * as cellsEditingStories from './DataGrid.Cells.Editing.stories'
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
  name: 'Cells/Keyboard — Move around, шаг 1',
  tags: ['!test'],
}

export const HighContrastKeyboardMovingStep2 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardMoving, 2),
  name: 'Cells/Keyboard — Move around, шаг 2',
  tags: ['!test'],
}

export const HighContrastKeyboardMovingStep3 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardMoving, 3),
  name: 'Cells/Keyboard — Move around, шаг 3',
  tags: ['!test'],
}

export const HighContrastKeyboardActionsStep1 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardActions, 1),
  name: 'Cells/Keyboard — Actions without a mouse, шаг 1',
  tags: ['!test'],
}

export const HighContrastKeyboardActionsStep2 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardActions, 2),
  name: 'Cells/Keyboard — Actions without a mouse, шаг 2',
  tags: ['!test'],
}

export const HighContrastKeyboardActionsStep3 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardActions, 3),
  name: 'Cells/Keyboard — Actions without a mouse, шаг 3',
  tags: ['!test'],
}

export const HighContrastKeyboardActionsStep4 = {
  ...twinStep(cellsKeyboardStories, cellsKeyboardStories.KeyboardActions, 4),
  name: 'Cells/Keyboard — Actions without a mouse, шаг 4',
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
  name: 'Columns/Sorting — Multi-sort, шаг 1',
  tags: ['!test'],
}

export const HighContrastColumnMultiSortingStep2 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnMultiSorting,
    2,
  ),
  name: 'Columns/Sorting — Multi-sort, шаг 2',
  tags: ['!test'],
}

export const HighContrastColumnMultiSortingStep3 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnMultiSorting,
    3,
  ),
  name: 'Columns/Sorting — Multi-sort, шаг 3',
  tags: ['!test'],
}

export const HighContrastColumnMultiSortingStep4 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnMultiSorting,
    4,
  ),
  name: 'Columns/Sorting — Multi-sort, шаг 4',
  tags: ['!test'],
}

export const HighContrastColumnSortingOptionLabelsStep1 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnSortingOptionLabels,
    1,
  ),
  name: 'Columns/Sorting — Option labels, шаг 1',
  tags: ['!test'],
}

export const HighContrastColumnSortingOptionLabelsStep2 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnSortingOptionLabels,
    2,
  ),
  name: 'Columns/Sorting — Option labels, шаг 2',
  tags: ['!test'],
}

export const HighContrastColumnSortingOptionLabelsStep3 = {
  ...twinStep(
    columnsSortingStories,
    columnsSortingStories.ColumnSortingOptionLabels,
    3,
  ),
  name: 'Columns/Sorting — Option labels, шаг 3',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityWithHeaderMenuStep1 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityWithHeaderMenu,
    1,
  ),
  name: 'Columns/Visibility — With header menu, шаг 1',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityWithHeaderMenuStep2 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityWithHeaderMenu,
    2,
  ),
  name: 'Columns/Visibility — With header menu, шаг 2',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityWithHeaderMenuStep3 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityWithHeaderMenu,
    3,
  ),
  name: 'Columns/Visibility — With header menu, шаг 3',
  tags: ['!test'],
}

export const HighContrastColumnVisibilityWithHeaderMenuStep4 = {
  ...twinStep(
    columnsVisibilityStories,
    columnsVisibilityStories.ColumnVisibilityWithHeaderMenu,
    4,
  ),
  name: 'Columns/Visibility — With header menu, шаг 4',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollUnknownTotalStep1 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollUnknownTotal,
    1,
  ),
  name: 'Data loading/Infinite scroll — Unknown total, шаг 1',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollUnknownTotalStep2 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollUnknownTotal,
    2,
  ),
  name: 'Data loading/Infinite scroll — Unknown total, шаг 2',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollUnknownTotalStep3 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollUnknownTotal,
    3,
  ),
  name: 'Data loading/Infinite scroll — Unknown total, шаг 3',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollErrorsStep1 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollErrors,
    1,
  ),
  name: 'Data loading/Infinite scroll — Errors, шаг 1',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollErrorsStep2 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollErrors,
    2,
  ),
  name: 'Data loading/Infinite scroll — Errors, шаг 2',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollErrorsStep3 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollErrors,
    3,
  ),
  name: 'Data loading/Infinite scroll — Errors, шаг 3',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollServerQueryStep1 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollServerQuery,
    1,
  ),
  name: 'Data loading/Infinite scroll — Server sort & filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollServerQueryStep2 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollServerQuery,
    2,
  ),
  name: 'Data loading/Infinite scroll — Server sort & filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelJumpStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelJump,
    1,
  ),
  name: 'Data loading/Server row model — Jump to the middle, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelJumpStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelJump,
    2,
  ),
  name: 'Data loading/Server row model — Jump to the middle, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelJumpStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelJump,
    3,
  ),
  name: 'Data loading/Server row model — Jump to the middle, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelBlockErrorStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelBlockError,
    1,
  ),
  name: 'Data loading/Server row model — Block error, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelBlockErrorStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelBlockError,
    2,
  ),
  name: 'Data loading/Server row model — Block error, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelBlockErrorStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelBlockError,
    3,
  ),
  name: 'Data loading/Server row model — Block error, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelUnknownTotalStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelUnknownTotal,
    1,
  ),
  name: 'Data loading/Server row model — Unknown total, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelUnknownTotalStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelUnknownTotal,
    2,
  ),
  name: 'Data loading/Server row model — Unknown total, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelUnknownTotalStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelUnknownTotal,
    3,
  ),
  name: 'Data loading/Server row model — Unknown total, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelUnknownTotalStep4 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelUnknownTotal,
    4,
  ),
  name: 'Data loading/Server row model — Unknown total, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    1,
  ),
  name: 'Data loading/Server row model — Sorting, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    2,
  ),
  name: 'Data loading/Server row model — Sorting, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    3,
  ),
  name: 'Data loading/Server row model — Sorting, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelSortingStep4 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelSorting,
    4,
  ),
  name: 'Data loading/Server row model — Sorting, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelOpenAtRecordStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelOpenAtRecord,
    1,
  ),
  name: 'Data loading/Server row model — Open at record, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelOpenAtRecordStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelOpenAtRecord,
    2,
  ),
  name: 'Data loading/Server row model — Open at record, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelOpenAtRecordStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelOpenAtRecord,
    3,
  ),
  name: 'Data loading/Server row model — Open at record, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelSelectAllExceptStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerRowModelSelectAllExcept,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Select all except, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelSelectAllExceptStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerRowModelSelectAllExcept,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Select all except, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelSelectAllExceptStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerRowModelSelectAllExcept,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Select all except, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelSelectAllExceptStep4 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerRowModelSelectAllExcept,
    4,
  ),
  name: 'Data loading/Server row model/Selection — Select all except, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelLazyChildrenStep1 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerRowModelLazyChildren,
    1,
  ),
  name: 'Data loading/Server row model/Lazy children — Lazy children, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelLazyChildrenStep2 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerRowModelLazyChildren,
    2,
  ),
  name: 'Data loading/Server row model/Lazy children — Lazy children, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelLazyChildrenStep3 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerRowModelLazyChildren,
    3,
  ),
  name: 'Data loading/Server row model/Lazy children — Lazy children, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelEditCellStep1 = {
  ...twinStep(
    serverEditingStories,
    serverEditingStories.ServerRowModelEditCell,
    1,
  ),
  name: 'Data loading/Server row model/Editing — Edit a cell, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelEditCellStep2 = {
  ...twinStep(
    serverEditingStories,
    serverEditingStories.ServerRowModelEditCell,
    2,
  ),
  name: 'Data loading/Server row model/Editing — Edit a cell, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelEditCellStep3 = {
  ...twinStep(
    serverEditingStories,
    serverEditingStories.ServerRowModelEditCell,
    3,
  ),
  name: 'Data loading/Server row model/Editing — Edit a cell, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerTransactionAddStep1 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionAdd,
    1,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerTransactionAddStep2 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionAdd,
    2,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerTransactionAddStep3 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionAdd,
    3,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerTransactionAddStep4 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionAdd,
    4,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerTransactionRemoveStep1 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRemove,
    1,
  ),
  name: 'Data loading/Server row model/Transactions — Remove selected rows, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerTransactionRemoveStep2 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRemove,
    2,
  ),
  name: 'Data loading/Server row model/Transactions — Remove selected rows, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerTransactionRemoveStep3 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRemove,
    3,
  ),
  name: 'Data loading/Server row model/Transactions — Remove selected rows, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerTransactionLiveStep1 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionLive,
    1,
  ),
  name: 'Data loading/Server row model/Transactions — Live updates, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerTransactionLiveStep2 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionLive,
    2,
  ),
  name: 'Data loading/Server row model/Transactions — Live updates, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerTransactionRefetchStep1 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRefetch,
    1,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row without a place, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerTransactionRefetchStep2 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRefetch,
    2,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row without a place, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerTransactionRefetchStep3 = {
  ...twinStep(
    serverTransactionsStories,
    serverTransactionsStories.ServerTransactionRefetch,
    3,
  ),
  name: 'Data loading/Server row model/Transactions — Add a row without a place, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerPaginationPagesStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationPages,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Load pages, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerPaginationPagesStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationPages,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Load pages, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerPaginationPagesStep3 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationPages,
    3,
  ),
  name: 'Data loading/Server row model/Pagination — Load pages, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerPaginationPagesStep4 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationPages,
    4,
  ),
  name: 'Data loading/Server row model/Pagination — Load pages, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerPaginationUnknownTotalStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationUnknownTotal,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Unknown total, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerPaginationUnknownTotalStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationUnknownTotal,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Unknown total, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerPaginationGroupsStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationGroups,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Groups on pages, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerPaginationGroupsStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationGroups,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Groups on pages, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerPaginationGroupsStep3 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationGroups,
    3,
  ),
  name: 'Data loading/Server row model/Pagination — Groups on pages, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerPaginationEditingStep1 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationEditing,
    1,
  ),
  name: 'Data loading/Server row model/Pagination — Draft across pages, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerPaginationEditingStep2 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationEditing,
    2,
  ),
  name: 'Data loading/Server row model/Pagination — Draft across pages, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerPaginationEditingStep3 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationEditing,
    3,
  ),
  name: 'Data loading/Server row model/Pagination — Draft across pages, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerPaginationEditingStep4 = {
  ...twinStep(
    serverPaginationStories,
    serverPaginationStories.ServerPaginationEditing,
    4,
  ),
  name: 'Data loading/Server row model/Pagination — Draft across pages, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerDragMoveStep1 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragMove, 1),
  name: 'Data loading/Server row model/Dragging — Move a row, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerDragMoveStep2 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragMove, 2),
  name: 'Data loading/Server row model/Dragging — Move a row, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerDragMoveStep3 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragMove, 3),
  name: 'Data loading/Server row model/Dragging — Move a row, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerDragRefusedStep1 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerDragRefused,
    1,
  ),
  name: 'Data loading/Server row model/Dragging — Move refused, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerDragRefusedStep2 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerDragRefused,
    2,
  ),
  name: 'Data loading/Server row model/Dragging — Move refused, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerDragRefusedStep3 = {
  ...twinStep(
    serverDraggingStories,
    serverDraggingStories.ServerDragRefused,
    3,
  ),
  name: 'Data loading/Server row model/Dragging — Move refused, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep1 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 1),
  name: 'Data loading/Server row model/Dragging — Move into a branch, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep2 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 2),
  name: 'Data loading/Server row model/Dragging — Move into a branch, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep3 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 3),
  name: 'Data loading/Server row model/Dragging — Move into a branch, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep4 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 4),
  name: 'Data loading/Server row model/Dragging — Move into a branch, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerDragTreeStep5 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragTree, 5),
  name: 'Data loading/Server row model/Dragging — Move into a branch, шаг 5',
  tags: ['!test'],
}

export const HighContrastServerDragGroupsStep1 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragGroups, 1),
  name: 'Data loading/Server row model/Dragging — Move to another group, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerDragGroupsStep2 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragGroups, 2),
  name: 'Data loading/Server row model/Dragging — Move to another group, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerDragGroupsStep3 = {
  ...twinStep(serverDraggingStories, serverDraggingStories.ServerDragGroups, 3),
  name: 'Data loading/Server row model/Dragging — Move to another group, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerGroupingExpandAllStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerGroupingExpandAll,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Expand all, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerGroupingExpandAllStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerGroupingExpandAll,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Expand all, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerGroupingExpandAllStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerGroupingExpandAll,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Expand all, шаг 3',
  tags: ['!test'],
}

export const HighContrastExpandingExpandAllStep1 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingExpandAll, 1),
  name: 'Rows/Expanding — Expand all, шаг 1',
  tags: ['!test'],
}

export const HighContrastExpandingExpandAllStep2 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingExpandAll, 2),
  name: 'Rows/Expanding — Expand all, шаг 2',
  tags: ['!test'],
}

export const HighContrastExpandingExpandAllStep3 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingExpandAll, 3),
  name: 'Rows/Expanding — Expand all, шаг 3',
  tags: ['!test'],
}

export const HighContrastGroupingStickyRowsStep1 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupingStickyRows, 1),
  name: 'Rows/Grouping — Sticky group rows, шаг 1',
  tags: ['!test'],
}

export const HighContrastGroupingStickyRowsStep2 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupingStickyRows, 2),
  name: 'Rows/Grouping — Sticky group rows, шаг 2',
  tags: ['!test'],
}

export const HighContrastGroupingStickyRowsStep3 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupingStickyRows, 3),
  name: 'Rows/Grouping — Sticky group rows, шаг 3',
  tags: ['!test'],
}

export const HighContrastGroupingStickyRowsStep4 = {
  ...twinStep(rowsGroupingStories, rowsGroupingStories.GroupingStickyRows, 4),
  name: 'Rows/Grouping — Sticky group rows, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerStickyBranchesStep1 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerStickyBranches,
    1,
  ),
  name: 'Data loading/Server row model/Lazy children — Sticky branches, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerStickyBranchesStep2 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerStickyBranches,
    2,
  ),
  name: 'Data loading/Server row model/Lazy children — Sticky branches, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerTreeLinesStep1 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerTreeLines,
    1,
  ),
  name: 'Data loading/Server row model/Lazy children — Tree lines, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerTreeLinesStep2 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerTreeLines,
    2,
  ),
  name: 'Data loading/Server row model/Lazy children — Tree lines, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerTreeLinesStep3 = {
  ...twinStep(
    serverLazyChildrenStories,
    serverLazyChildrenStories.ServerTreeLines,
    3,
  ),
  name: 'Data loading/Server row model/Lazy children — Tree lines, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelMillionRowsStep1 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelMillionRows,
    1,
  ),
  name: 'Data loading/Server row model — Million rows, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelMillionRowsStep2 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelMillionRows,
    2,
  ),
  name: 'Data loading/Server row model — Million rows, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelMillionRowsStep3 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelMillionRows,
    3,
  ),
  name: 'Data loading/Server row model — Million rows, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelMillionRowsStep4 = {
  ...twinStep(
    serverRowModelStories,
    serverRowModelStories.ServerRowModelMillionRows,
    4,
  ),
  name: 'Data loading/Server row model — Million rows, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupByStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupBy,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Group by a column, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupByStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupBy,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Group by a column, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupByStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupBy,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Group by a column, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelExpandGroupStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelExpandGroup,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Expand a group, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelExpandGroupStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelExpandGroup,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Expand a group, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelExpandGroupStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelExpandGroup,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Expand a group, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelTotalsStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelTotals,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Totals in the footer, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelTotalsStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelTotals,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Totals in the footer, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelTotalsStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelTotals,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Totals in the footer, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupingRefusedStep1 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupingRefused,
    1,
  ),
  name: 'Data loading/Server row model/Grouping — Grouping refused, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupingRefusedStep2 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupingRefused,
    2,
  ),
  name: 'Data loading/Server row model/Grouping — Grouping refused, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRowModelGroupingRefusedStep3 = {
  ...twinStep(
    serverGroupingStories,
    serverGroupingStories.ServerRowModelGroupingRefused,
    3,
  ),
  name: 'Data loading/Server row model/Grouping — Grouping refused, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerRangeSelectionStep4 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerRangeSelection,
    4,
  ),
  name: 'Data loading/Server row model/Cell selection — Select a range, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerCopyLoadsRowsStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyLoadsRows,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy loads the rows, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerCopyLoadsRowsStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyLoadsRows,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy loads the rows, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerCopyLoadsRowsStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyLoadsRows,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy loads the rows, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerCopyOverLimitStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyOverLimit,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy over the limit, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerCopyOverLimitStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyOverLimit,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy over the limit, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerCopyRefusedStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyRefused,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy refused by the server, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerCopyRefusedStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyRefused,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy refused by the server, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerCopyRefusedStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyRefused,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Copy refused by the server, шаг 3',
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
  name: 'Filtering — Text filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringTextStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringText, 2),
  name: 'Filtering — Text filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringTextStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringText, 3),
  name: 'Filtering — Text filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringEmptyStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringEmpty, 1),
  name: 'Filtering — Empty result, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringEmptyStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringEmpty, 2),
  name: 'Filtering — Empty result, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringServer, 1),
  name: 'Filtering — Server, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringServer, 2),
  name: 'Filtering — Server, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringServer, 3),
  name: 'Filtering — Server, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringServer, 4),
  name: 'Filtering — Server, шаг 4',
  tags: ['!test'],
}

export const HighContrastFilteringServerFiltersClientSearchStep1 = {
  ...twinStep(
    filteringStories,
    filteringStories.FilteringServerFiltersClientSearch,
    1,
  ),
  name: 'Filtering — Server filters, client search, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerFiltersClientSearchStep2 = {
  ...twinStep(
    filteringStories,
    filteringStories.FilteringServerFiltersClientSearch,
    2,
  ),
  name: 'Filtering — Server filters, client search, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerFiltersClientSearchStep3 = {
  ...twinStep(
    filteringStories,
    filteringStories.FilteringServerFiltersClientSearch,
    3,
  ),
  name: 'Filtering — Server filters, client search, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringTreeStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringTree, 1),
  name: 'Filtering — Tree, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringTreeStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringTree, 2),
  name: 'Filtering — Tree, шаг 2',
  tags: ['!test'],
}

export const HighContrastQuickSearchNoColumnsStep1 = {
  ...twinStep(filteringStories, filteringStories.QuickSearchNoColumns, 1),
  name: 'Filtering — Quick search, no searchable columns, шаг 1',
  tags: ['!test'],
}

export const HighContrastQuickSearchNoColumnsStep2 = {
  ...twinStep(filteringStories, filteringStories.QuickSearchNoColumns, 2),
  name: 'Filtering — Quick search, no searchable columns, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 1),
  name: 'Filtering — Dates, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 2),
  name: 'Filtering — Dates, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 3),
  name: 'Filtering — Dates, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 4),
  name: 'Filtering — Dates, шаг 4',
  tags: ['!test'],
}

export const HighContrastFilteringDatesStep5 = {
  ...twinStep(filteringStories, filteringStories.FilteringDates, 5),
  name: 'Filtering — Dates, шаг 5',
  tags: ['!test'],
}

export const HighContrastFilteringOptionsStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringOptions, 1),
  name: 'Filtering — Select & multiselect, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringOptionsStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringOptions, 2),
  name: 'Filtering — Select & multiselect, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringOptionsStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringOptions, 3),
  name: 'Filtering — Select & multiselect, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringOptionsStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringOptions, 4),
  name: 'Filtering — Select & multiselect, шаг 4',
  tags: ['!test'],
}

export const HighContrastFilteringLookupServerStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringLookupServer, 1),
  name: 'Filtering — Lookup (server), шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringLookupServerStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringLookupServer, 2),
  name: 'Filtering — Lookup (server), шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringLookupServerStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringLookupServer, 3),
  name: 'Filtering — Lookup (server), шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringLookupServerStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringLookupServer, 4),
  name: 'Filtering — Lookup (server), шаг 4',
  tags: ['!test'],
}

export const HighContrastExportDirectStep1 = {
  ...twinStep(exportStories, exportStories.ExportDirect, 1),
  name: 'Export — Direct click, шаг 1',
  tags: ['!test'],
}

export const HighContrastExportDirectStep2 = {
  ...twinStep(exportStories, exportStories.ExportDirect, 2),
  name: 'Export — Direct click, шаг 2',
  tags: ['!test'],
}

export const HighContrastExportPresetsStep1 = {
  ...twinStep(exportStories, exportStories.ExportPresets, 1),
  name: 'Export — Settings and quick sets, шаг 1',
  tags: ['!test'],
}

export const HighContrastExportPresetsStep2 = {
  ...twinStep(exportStories, exportStories.ExportPresets, 2),
  name: 'Export — Settings and quick sets, шаг 2',
  tags: ['!test'],
}

export const HighContrastExportPresetsStep3 = {
  ...twinStep(exportStories, exportStories.ExportPresets, 3),
  name: 'Export — Settings and quick sets, шаг 3',
  tags: ['!test'],
}

export const HighContrastExportPresetsStep4 = {
  ...twinStep(exportStories, exportStories.ExportPresets, 4),
  name: 'Export — Settings and quick sets, шаг 4',
  tags: ['!test'],
}

export const HighContrastExportServerStep1 = {
  ...twinStep(exportStories, exportStories.ExportServer, 1),
  name: 'Export — Server, шаг 1',
  tags: ['!test'],
}

export const HighContrastExportServerStep2 = {
  ...twinStep(exportStories, exportStories.ExportServer, 2),
  name: 'Export — Server, шаг 2',
  tags: ['!test'],
}

export const HighContrastExportServerStep3 = {
  ...twinStep(exportStories, exportStories.ExportServer, 3),
  name: 'Export — Server, шаг 3',
  tags: ['!test'],
}

export const HighContrastExportServerStep4 = {
  ...twinStep(exportStories, exportStories.ExportServer, 4),
  name: 'Export — Server, шаг 4',
  tags: ['!test'],
}

export const HighContrastExportServerStep5 = {
  ...twinStep(exportStories, exportStories.ExportServer, 5),
  name: 'Export — Server, шаг 5',
  tags: ['!test'],
}

export const HighContrastExportExcelStep1 = {
  ...twinStep(exportStories, exportStories.ExportExcel, 1),
  name: 'Export — Excel, шаг 1',
  tags: ['!test'],
}

export const HighContrastExportExcelStep2 = {
  ...twinStep(exportStories, exportStories.ExportExcel, 2),
  name: 'Export — Excel, шаг 2',
  tags: ['!test'],
}

export const HighContrastExportExcelStep3 = {
  ...twinStep(exportStories, exportStories.ExportExcel, 3),
  name: 'Export — Excel, шаг 3',
  tags: ['!test'],
}

export const HighContrastExportExcelStep4 = {
  ...twinStep(exportStories, exportStories.ExportExcel, 4),
  name: 'Export — Excel, шаг 4',
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
  name: 'Rows/Actions — Action menu, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowActionMenuStep2 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionMenu, 2),
  name: 'Rows/Actions — Action menu, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowActionMenuStep3 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionMenu, 3),
  name: 'Rows/Actions — Action menu, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep1 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 1),
  name: 'Rows/Actions — Nested sections, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep2 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 2),
  name: 'Rows/Actions — Nested sections, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep3 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 3),
  name: 'Rows/Actions — Nested sections, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep4 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 4),
  name: 'Rows/Actions — Nested sections, шаг 4',
  tags: ['!test'],
}

export const HighContrastRowActionsNestedStep5 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsNested, 5),
  name: 'Rows/Actions — Nested sections, шаг 5',
  tags: ['!test'],
}

export const HighContrastRowActionsAsyncStep1 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsAsync, 1),
  name: 'Rows/Actions — Async action, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowActionsAsyncStep2 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsAsync, 2),
  name: 'Rows/Actions — Async action, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowActionsAsyncStep3 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsAsync, 3),
  name: 'Rows/Actions — Async action, шаг 3',
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
  name: 'Rows/Back to top — Return to top, шаг 1',
  tags: ['!test'],
}

export const HighContrastBackToTopReturnStep2 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopReturn, 2),
  name: 'Rows/Back to top — Return to top, шаг 2',
  tags: ['!test'],
}

export const HighContrastBackToTopReturnStep3 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopReturn, 3),
  name: 'Rows/Back to top — Return to top, шаг 3',
  tags: ['!test'],
}

export const HighContrastBackToTopWideStep1 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopWide, 1),
  name: 'Rows/Back to top — Wide table, шаг 1',
  tags: ['!test'],
}

export const HighContrastBackToTopWideStep2 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopWide, 2),
  name: 'Rows/Back to top — Wide table, шаг 2',
  tags: ['!test'],
}

export const HighContrastBackToTopWideStep3 = {
  ...twinStep(rowsBackToTopStories, rowsBackToTopStories.BackToTopWide, 3),
  name: 'Rows/Back to top — Wide table, шаг 3',
  tags: ['!test'],
}

export const HighContrastExpandingConfirmedStep1 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingConfirmed, 1),
  name: 'Rows/Expanding — Expand confirmed by the server, шаг 1',
  tags: ['!test'],
}

export const HighContrastExpandingConfirmedStep2 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingConfirmed, 2),
  name: 'Rows/Expanding — Expand confirmed by the server, шаг 2',
  tags: ['!test'],
}

export const HighContrastExpandingConfirmedStep3 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingConfirmed, 3),
  name: 'Rows/Expanding — Expand confirmed by the server, шаг 3',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep1 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    1,
  ),
  name: 'Rows/Expanding — Lazy children (server), шаг 1',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep2 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    2,
  ),
  name: 'Rows/Expanding — Lazy children (server), шаг 2',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep3 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    3,
  ),
  name: 'Rows/Expanding — Lazy children (server), шаг 3',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep4 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    4,
  ),
  name: 'Rows/Expanding — Lazy children (server), шаг 4',
  tags: ['!test'],
}

export const HighContrastExpandingLazyChildrenStep5 = {
  ...twinStep(
    rowsExpandingStories,
    rowsExpandingStories.ExpandingLazyChildren,
    5,
  ),
  name: 'Rows/Expanding — Lazy children (server), шаг 5',
  tags: ['!test'],
}

export const HighContrastHighlightDeleteConfirmationStep1 = {
  ...twinStep(
    rowsHighlightStories,
    rowsHighlightStories.HighlightDeleteConfirmation,
    1,
  ),
  name: 'Rows/Highlight — Delete confirmation, шаг 1',
  tags: ['!test'],
}

export const HighContrastHighlightDeleteConfirmationStep2 = {
  ...twinStep(
    rowsHighlightStories,
    rowsHighlightStories.HighlightDeleteConfirmation,
    2,
  ),
  name: 'Rows/Highlight — Delete confirmation, шаг 2',
  tags: ['!test'],
}

export const HighContrastHighlightDeleteConfirmationStep3 = {
  ...twinStep(
    rowsHighlightStories,
    rowsHighlightStories.HighlightDeleteConfirmation,
    3,
  ),
  name: 'Rows/Highlight — Delete confirmation, шаг 3',
  tags: ['!test'],
}

export const HighContrastHighlightDeleteConfirmationStep4 = {
  ...twinStep(
    rowsHighlightStories,
    rowsHighlightStories.HighlightDeleteConfirmation,
    4,
  ),
  name: 'Rows/Highlight — Delete confirmation, шаг 4',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep1 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 1),
  name: 'Rows/Highlight — Search, cell and column, шаг 1',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep2 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 2),
  name: 'Rows/Highlight — Search, cell and column, шаг 2',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep3 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 3),
  name: 'Rows/Highlight — Search, cell and column, шаг 3',
  tags: ['!test'],
}

export const HighContrastHighlightMarksStep4 = {
  ...twinStep(rowsHighlightStories, rowsHighlightStories.HighlightMarks, 4),
  name: 'Rows/Highlight — Search, cell and column, шаг 4',
  tags: ['!test'],
}

export const HighContrastRowMotionTreeStep1 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionTree, 1),
  name: 'Rows/Motion — Tree, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowMotionTreeStep2 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionTree, 2),
  name: 'Rows/Motion — Tree, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowMotionTreeStep3 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionTree, 3),
  name: 'Rows/Motion — Tree, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowMotionSearchStep1 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionSearch, 1),
  name: 'Rows/Motion — Sort and search, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowMotionSearchStep2 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionSearch, 2),
  name: 'Rows/Motion — Sort and search, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowMotionSearchStep3 = {
  ...twinStep(rowsMotionStories, rowsMotionStories.RowMotionSearch, 3),
  name: 'Rows/Motion — Sort and search, шаг 3',
  tags: ['!test'],
}

export const HighContrastScrollToRowShowStep1 = {
  ...twinStep(
    rowsScrollToRowStories,
    rowsScrollToRowStories.ScrollToRowShow,
    1,
  ),
  name: 'Rows/Scroll to row — Show a row, шаг 1',
  tags: ['!test'],
}

export const HighContrastScrollToRowShowStep2 = {
  ...twinStep(
    rowsScrollToRowStories,
    rowsScrollToRowStories.ScrollToRowShow,
    2,
  ),
  name: 'Rows/Scroll to row — Show a row, шаг 2',
  tags: ['!test'],
}

export const HighContrastScrollToRowShowStep3 = {
  ...twinStep(
    rowsScrollToRowStories,
    rowsScrollToRowStories.ScrollToRowShow,
    3,
  ),
  name: 'Rows/Scroll to row — Show a row, шаг 3',
  tags: ['!test'],
}

export const HighContrastBatchRowSelectionStep1 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.BatchRowSelection, 1),
  name: 'Rows/Selection — Select all rows, шаг 1',
  tags: ['!test'],
}

export const HighContrastBatchRowSelectionStep2 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.BatchRowSelection, 2),
  name: 'Rows/Selection — Select all rows, шаг 2',
  tags: ['!test'],
}

export const HighContrastBatchRowSelectionStep3 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.BatchRowSelection, 3),
  name: 'Rows/Selection — Select all rows, шаг 3',
  tags: ['!test'],
}

export const HighContrastSubRowSelectionStep1 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.SubRowSelection, 1),
  name: 'Rows/Selection — Parent with children, шаг 1',
  tags: ['!test'],
}

export const HighContrastSubRowSelectionStep2 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.SubRowSelection, 2),
  name: 'Rows/Selection — Parent with children, шаг 2',
  tags: ['!test'],
}

export const HighContrastSubRowSelectionStep3 = {
  ...twinStep(rowsSelectionStories, rowsSelectionStories.SubRowSelection, 3),
  name: 'Rows/Selection — Parent with children, шаг 3',
  tags: ['!test'],
}

export const HighContrastSelectionSubRowsSelfStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionSubRowsSelf,
    1,
  ),
  name: 'Rows/Selection — Each row on its own, шаг 1',
  tags: ['!test'],
}

export const HighContrastSelectionSubRowsSelfStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionSubRowsSelf,
    2,
  ),
  name: 'Rows/Selection — Each row on its own, шаг 2',
  tags: ['!test'],
}

export const HighContrastSelectionSubRowsSelfStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.SelectionSubRowsSelf,
    3,
  ),
  name: 'Rows/Selection — Each row on its own, шаг 3',
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

export const HighContrastThemingGridButtonSizeStep1 = {
  ...twinStep(themingStories, themingStories.ThemingGridButtonSize, 1),
  name: 'Theming — Grid button size, шаг 1',
  tags: ['!test'],
}

export const HighContrastThemingGridButtonSizeStep2 = {
  ...twinStep(themingStories, themingStories.ThemingGridButtonSize, 2),
  name: 'Theming — Grid button size, шаг 2',
  tags: ['!test'],
}

export const HighContrastThemeSourcesStep1 = {
  ...twinStep(themingStories, themingStories.ThemeSources, 1),
  name: 'Theming — Theme sources, шаг 1',
  tags: ['!test'],
}

export const HighContrastThemeSourcesStep2 = {
  ...twinStep(themingStories, themingStories.ThemeSources, 2),
  name: 'Theming — Theme sources, шаг 2',
  tags: ['!test'],
}

export const HighContrastThemeSourcesStep3 = {
  ...twinStep(themingStories, themingStories.ThemeSources, 3),
  name: 'Theming — Theme sources, шаг 3',
  tags: ['!test'],
}

export const HighContrastThemeSourcesStep4 = {
  ...twinStep(themingStories, themingStories.ThemeSources, 4),
  name: 'Theming — Theme sources, шаг 4',
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

export const HighContrastStubsCustomStep1 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsCustom, 1),
  name: 'Core/Stubs — Custom stubs, шаг 1',
  tags: ['!test'],
}

export const HighContrastStubsCustomStep2 = {
  ...twinStep(coreStubsStories, coreStubsStories.StubsCustom, 2),
  name: 'Core/Stubs — Custom stubs, шаг 2',
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

export const HighContrastPaginationServerStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServer,
    1,
  ),
  name: 'Panels/Pagination — Server, шаг 1',
  tags: ['!test'],
}

export const HighContrastPaginationServerStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServer,
    2,
  ),
  name: 'Panels/Pagination — Server, шаг 2',
  tags: ['!test'],
}

export const HighContrastPaginationServerStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServer,
    3,
  ),
  name: 'Panels/Pagination — Server, шаг 3',
  tags: ['!test'],
}

export const HighContrastSelectedCountStep1 = {
  ...twinStep(panelsStatusBarStories, panelsStatusBarStories.SelectedCount, 1),
  name: 'Panels/Status bar — Selected count, шаг 1',
  tags: ['!test'],
}

export const HighContrastSelectedCountStep2 = {
  ...twinStep(panelsStatusBarStories, panelsStatusBarStories.SelectedCount, 2),
  name: 'Panels/Status bar — Selected count, шаг 2',
  tags: ['!test'],
}

export const HighContrastSelectedCountStep3 = {
  ...twinStep(panelsStatusBarStories, panelsStatusBarStories.SelectedCount, 3),
  name: 'Panels/Status bar — Selected count, шаг 3',
  tags: ['!test'],
}

export const HighContrastPanelsNarrowStatusBarStep1 = {
  ...twinStep(
    panelsStatusBarStories,
    panelsStatusBarStories.PanelsNarrowStatusBar,
    1,
  ),
  name: 'Panels/Status bar — Narrow, шаг 1',
  tags: ['!test'],
}

export const HighContrastPanelsNarrowStatusBarStep2 = {
  ...twinStep(
    panelsStatusBarStories,
    panelsStatusBarStories.PanelsNarrowStatusBar,
    2,
  ),
  name: 'Panels/Status bar — Narrow, шаг 2',
  tags: ['!test'],
}

export const HighContrastPanelsNarrowStatusBarStep3 = {
  ...twinStep(
    panelsStatusBarStories,
    panelsStatusBarStories.PanelsNarrowStatusBar,
    3,
  ),
  name: 'Panels/Status bar — Narrow, шаг 3',
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

export const HighContrastPluginApiReactiveArgsStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReactiveArgs, 1),
  name: 'Plugin API — Reactive arguments, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiReactiveArgsStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReactiveArgs, 2),
  name: 'Plugin API — Reactive arguments, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiReactiveArgsStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReactiveArgs, 3),
  name: 'Plugin API — Reactive arguments, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiReactiveArgsStep4 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiReactiveArgs, 4),
  name: 'Plugin API — Reactive arguments, шаг 4',
  tags: ['!test'],
}

export const HighContrastSessionCallbacksStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.SessionCallbacks, 1),
  name: 'Plugin API — Drag callbacks, шаг 1',
  tags: ['!test'],
}

export const HighContrastSessionCallbacksStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.SessionCallbacks, 2),
  name: 'Plugin API — Drag callbacks, шаг 2',
  tags: ['!test'],
}

export const HighContrastSessionCallbacksStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.SessionCallbacks, 3),
  name: 'Plugin API — Drag callbacks, шаг 3',
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

export const HighContrastOutcomeFlashFromAppStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.OutcomeFlashFromApp, 1),
  name: 'Plugin API — Outcome flash, шаг 1',
  tags: ['!test'],
}

export const HighContrastOutcomeFlashFromAppStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.OutcomeFlashFromApp, 2),
  name: 'Plugin API — Outcome flash, шаг 2',
  tags: ['!test'],
}

export const HighContrastOutcomeFlashFromAppStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.OutcomeFlashFromApp, 3),
  name: 'Plugin API — Outcome flash, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiRevokeEditingStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiRevokeEditing, 1),
  name: 'Plugin API — Revoke editing, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiRevokeEditingStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiRevokeEditing, 2),
  name: 'Plugin API — Revoke editing, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiRevokeEditingStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiRevokeEditing, 3),
  name: 'Plugin API — Revoke editing, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiResizeCallbacksStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiResizeCallbacks, 1),
  name: 'Plugin API — Resize callbacks, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiResizeCallbacksStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiResizeCallbacks, 2),
  name: 'Plugin API — Resize callbacks, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiResizeCallbacksStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiResizeCallbacks, 3),
  name: 'Plugin API — Resize callbacks, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiCellButtonStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCellButton, 1),
  name: 'Plugin API — Cell button, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiCellButtonStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCellButton, 2),
  name: 'Plugin API — Cell button, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiCellButtonStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCellButton, 3),
  name: 'Plugin API — Cell button, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiControlledStateStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiControlledState, 1),
  name: 'Plugin API — Controlled state, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiControlledStateStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiControlledState, 2),
  name: 'Plugin API — Controlled state, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiControlledStateStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiControlledState, 3),
  name: 'Plugin API — Controlled state, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiServiceColumnStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiServiceColumn, 1),
  name: 'Plugin API — Service column, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiServiceColumnStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiServiceColumn, 2),
  name: 'Plugin API — Service column, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiPluginCrashStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiPluginCrash, 1),
  name: 'Plugin API — Plugin crash, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiPluginCrashStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiPluginCrash, 2),
  name: 'Plugin API — Plugin crash, шаг 2',
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

export const HighContrastRowsSelectionSelectAllFilteredStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    1,
  ),
  name: 'Rows/Selection — Select all found rows, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    2,
  ),
  name: 'Rows/Selection — Select all found rows, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    3,
  ),
  name: 'Rows/Selection — Select all found rows, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep4 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    4,
  ),
  name: 'Rows/Selection — Select all found rows, шаг 4',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllFilteredStep5 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllFiltered,
    5,
  ),
  name: 'Rows/Selection — Select all found rows, шаг 5',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllCurrentPageStep1 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllCurrentPage,
    1,
  ),
  name: 'Rows/Selection — Select all on the page, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllCurrentPageStep2 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllCurrentPage,
    2,
  ),
  name: 'Rows/Selection — Select all on the page, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowsSelectionSelectAllCurrentPageStep3 = {
  ...twinStep(
    rowsSelectionStories,
    rowsSelectionStories.RowsSelectionSelectAllCurrentPage,
    3,
  ),
  name: 'Rows/Selection — Select all on the page, шаг 3',
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

export const HighContrastRowDraggingMoveStep5 = {
  ...twinStep(rowsDraggingStories, rowsDraggingStories.RowDraggingMove, 5),
  name: 'Rows/Dragging — Move, шаг 5',
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

export const HighContrastServerActionsRefusedStep1 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    1,
  ),
  name: 'Data loading/Server actions — Refused by the server, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep2 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    2,
  ),
  name: 'Data loading/Server actions — Refused by the server, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep3 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    3,
  ),
  name: 'Data loading/Server actions — Refused by the server, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep4 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    4,
  ),
  name: 'Data loading/Server actions — Refused by the server, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep5 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    5,
  ),
  name: 'Data loading/Server actions — Refused by the server, шаг 5',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep6 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    6,
  ),
  name: 'Data loading/Server actions — Refused by the server, шаг 6',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep7 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    7,
  ),
  name: 'Data loading/Server actions — Refused by the server, шаг 7',
  tags: ['!test'],
}

export const HighContrastServerActionsRefusedStep8 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsRefused,
    8,
  ),
  name: 'Data loading/Server actions — Refused by the server, шаг 8',
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

export const HighContrastHeaderMenuNarrowActiveStep1 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    1,
  ),
  name: 'Columns/Header menu — Narrow column, шаг 1',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep2 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    2,
  ),
  name: 'Columns/Header menu — Narrow column, шаг 2',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep3 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    3,
  ),
  name: 'Columns/Header menu — Narrow column, шаг 3',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep4 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    4,
  ),
  name: 'Columns/Header menu — Narrow column, шаг 4',
  tags: ['!test'],
}

export const HighContrastHeaderMenuNarrowActiveStep5 = {
  ...twinStep(
    columnsHeaderMenuStories,
    columnsHeaderMenuStories.HeaderMenuNarrowActive,
    5,
  ),
  name: 'Columns/Header menu — Narrow column, шаг 5',
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

export const HighContrastEditingValueStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingValue, 1),
  name: 'Cells/Editing — Edit a value, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingValueStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingValue, 2),
  name: 'Cells/Editing — Edit a value, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingValueStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingValue, 3),
  name: 'Cells/Editing — Edit a value, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingServerStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 1),
  name: 'Cells/Editing — Server save, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingServerStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 2),
  name: 'Cells/Editing — Server save, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingServerStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 3),
  name: 'Cells/Editing — Server save, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingServerStep4 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingServer, 4),
  name: 'Cells/Editing — Server save, шаг 4',
  tags: ['!test'],
}

export const HighContrastEditingRevertedWhileAwayStep1 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.EditingRevertedWhileAway,
    1,
  ),
  name: 'Cells/Editing — Refused while editing another cell, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingRevertedWhileAwayStep2 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.EditingRevertedWhileAway,
    2,
  ),
  name: 'Cells/Editing — Refused while editing another cell, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingRevertedWhileAwayStep3 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.EditingRevertedWhileAway,
    3,
  ),
  name: 'Cells/Editing — Refused while editing another cell, шаг 3',
  tags: ['!test'],
}

export const HighContrastExpandingRejectedStep1 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingRejected, 1),
  name: 'Rows/Expanding — Expand refused by the server, шаг 1',
  tags: ['!test'],
}

export const HighContrastExpandingRejectedStep2 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingRejected, 2),
  name: 'Rows/Expanding — Expand refused by the server, шаг 2',
  tags: ['!test'],
}

export const HighContrastExpandingRejectedStep3 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingRejected, 3),
  name: 'Rows/Expanding — Expand refused by the server, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 1),
  name: 'Cells/Editing — Draft survives, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 2),
  name: 'Cells/Editing — Draft survives, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 3),
  name: 'Cells/Editing — Draft survives, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingSessionStep4 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingSession, 4),
  name: 'Cells/Editing — Draft survives, шаг 4',
  tags: ['!test'],
}

export const HighContrastEditingConflictStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingConflict, 1),
  name: 'Cells/Editing — Conflict blocks save, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingConflictStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.EditingConflict, 2),
  name: 'Cells/Editing — Conflict blocks save, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    1,
  ),
  name: 'Cells/Selection — Select and copy, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    2,
  ),
  name: 'Cells/Selection — Select and copy, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep3 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    3,
  ),
  name: 'Cells/Selection — Select and copy, шаг 3',
  tags: ['!test'],
}

export const HighContrastCellSelectionRangeStep4 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionRange,
    4,
  ),
  name: 'Cells/Selection — Select and copy, шаг 4',
  tags: ['!test'],
}

export const HighContrastCellSelectionPredicateStep1 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionPredicate,
    1,
  ),
  name: 'Cells/Selection — Forbidden column, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellSelectionPredicateStep2 = {
  ...twinStep(
    cellsSelectionStories,
    cellsSelectionStories.CellSelectionPredicate,
    2,
  ),
  name: 'Cells/Selection — Forbidden column, шаг 2',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    1,
  ),
  name: 'Cells/Context menu — Menu on a cell, шаг 1',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    2,
  ),
  name: 'Cells/Context menu — Menu on a cell, шаг 2',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    3,
  ),
  name: 'Cells/Context menu — Menu on a cell, шаг 3',
  tags: ['!test'],
}

export const HighContrastContextMenuCellStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCell,
    4,
  ),
  name: 'Cells/Context menu — Menu on a cell, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectionStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelection,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Select a group, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectionStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelection,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Select a group, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectionStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelection,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Select a group, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectionStep4 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelection,
    4,
  ),
  name: 'Data loading/Server row model/Selection — Select a group, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectResetStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectReset,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Regrouping clears the selection, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectResetStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectReset,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Regrouping clears the selection, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectResetStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectReset,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Regrouping clears the selection, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectCountStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectCount,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Count without group sizes, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectCountStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectCount,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Count without group sizes, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerGroupSelectCountStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerGroupSelectCount,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Count without group sizes, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep1 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    1,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep2 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    2,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep3 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    3,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep4 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    4,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerTreeSelectBranchStep5 = {
  ...twinStep(
    serverSelectionStories,
    serverSelectionStories.ServerTreeSelectBranch,
    5,
  ),
  name: 'Data loading/Server row model/Selection — Select a tree branch, шаг 5',
  tags: ['!test'],
}

export const HighContrastCellErrorsFixValuesStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsFixValues, 1),
  name: 'Cells/Errors — Fix invalid values, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellErrorsFixValuesStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsFixValues, 2),
  name: 'Cells/Errors — Fix invalid values, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellErrorsReadOnlyStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsReadOnly, 1),
  name: 'Cells/Errors — Read-only table, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellErrorsReadOnlyStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsReadOnly, 2),
  name: 'Cells/Errors — Read-only table, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellErrorsRefusalStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsRefusal, 1),
  name: 'Cells/Errors — Refusal and data error, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellErrorsRefusalStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsRefusal, 2),
  name: 'Cells/Errors — Refusal and data error, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellErrorsRefusalStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellErrorsRefusal, 3),
  name: 'Cells/Errors — Refusal and data error, шаг 3',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 1),
  name: 'Cells/Errors — Refused edit and retry, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 2),
  name: 'Cells/Errors — Refused edit and retry, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 3),
  name: 'Cells/Errors — Refused edit and retry, шаг 3',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep4 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 4),
  name: 'Cells/Errors — Refused edit and retry, шаг 4',
  tags: ['!test'],
}

export const HighContrastCellFailureRetryStep5 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureRetry, 5),
  name: 'Cells/Errors — Refused edit and retry, шаг 5',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscard, 1),
  name: 'Cells/Errors — Refused checkbox, discard, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscard, 2),
  name: 'Cells/Errors — Refused checkbox, discard, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscard, 3),
  name: 'Cells/Errors — Refused checkbox, discard, шаг 3',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardStep4 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscard, 4),
  name: 'Cells/Errors — Refused checkbox, discard, шаг 4',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardMenuStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscardMenu, 1),
  name: 'Cells/Errors — Discard from the menu, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardMenuStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscardMenu, 2),
  name: 'Cells/Errors — Discard from the menu, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardMenuStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscardMenu, 3),
  name: 'Cells/Errors — Discard from the menu, шаг 3',
  tags: ['!test'],
}

export const HighContrastCellFailureDiscardMenuStep4 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureDiscardMenu, 4),
  name: 'Cells/Errors — Discard from the menu, шаг 4',
  tags: ['!test'],
}

export const HighContrastCellFailureExternalChangeStep1 = {
  ...twinStep(
    cellsErrorsStories,
    cellsErrorsStories.CellFailureExternalChange,
    1,
  ),
  name: 'Cells/Errors — Value changed elsewhere, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellFailureExternalChangeStep2 = {
  ...twinStep(
    cellsErrorsStories,
    cellsErrorsStories.CellFailureExternalChange,
    2,
  ),
  name: 'Cells/Errors — Value changed elsewhere, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellFailureExternalChangeStep3 = {
  ...twinStep(
    cellsErrorsStories,
    cellsErrorsStories.CellFailureExternalChange,
    3,
  ),
  name: 'Cells/Errors — Value changed elsewhere, шаг 3',
  tags: ['!test'],
}

export const HighContrastCellFailureExternalChangeStep4 = {
  ...twinStep(
    cellsErrorsStories,
    cellsErrorsStories.CellFailureExternalChange,
    4,
  ),
  name: 'Cells/Errors — Value changed elsewhere, шаг 4',
  tags: ['!test'],
}

export const HighContrastCellFailureAppResetStep1 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureAppReset, 1),
  name: 'Cells/Errors — Reset by the application, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellFailureAppResetStep2 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureAppReset, 2),
  name: 'Cells/Errors — Reset by the application, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellFailureAppResetStep3 = {
  ...twinStep(cellsErrorsStories, cellsErrorsStories.CellFailureAppReset, 3),
  name: 'Cells/Errors — Reset by the application, шаг 3',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    1,
  ),
  name: 'Cells/Context menu — Async items, шаг 1',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    2,
  ),
  name: 'Cells/Context menu — Async items, шаг 2',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    3,
  ),
  name: 'Cells/Context menu — Async items, шаг 3',
  tags: ['!test'],
}

export const HighContrastContextMenuAsyncItemsStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuAsyncItems,
    4,
  ),
  name: 'Cells/Context menu — Async items, шаг 4',
  tags: ['!test'],
}

export const HighContrastContextMenuRefusedOnSelectionStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuRefusedOnSelection,
    1,
  ),
  name: 'Cells/Context menu — Refused on a selection, шаг 1',
  tags: ['!test'],
}

export const HighContrastContextMenuRefusedOnSelectionStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuRefusedOnSelection,
    2,
  ),
  name: 'Cells/Context menu — Refused on a selection, шаг 2',
  tags: ['!test'],
}

export const HighContrastContextMenuRefusedOnSelectionStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuRefusedOnSelection,
    3,
  ),
  name: 'Cells/Context menu — Refused on a selection, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowActionsCancelStep1 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsCancel, 1),
  name: 'Rows/Actions — Cancel an action, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowActionsCancelStep2 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsCancel, 2),
  name: 'Rows/Actions — Cancel an action, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowActionsCancelStep3 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsCancel, 3),
  name: 'Rows/Actions — Cancel an action, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowActionsCancelStep4 = {
  ...twinStep(rowsActionsStories, rowsActionsStories.RowActionsCancel, 4),
  name: 'Rows/Actions — Cancel an action, шаг 4',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    1,
  ),
  name: 'Cells/Context menu — Cancel from the menu, шаг 1',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    2,
  ),
  name: 'Cells/Context menu — Cancel from the menu, шаг 2',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    3,
  ),
  name: 'Cells/Context menu — Cancel from the menu, шаг 3',
  tags: ['!test'],
}

export const HighContrastContextMenuCancelFromMenuStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuCancelFromMenu,
    4,
  ),
  name: 'Cells/Context menu — Cancel from the menu, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSearchStep1 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSearch,
    1,
  ),
  name: 'Data loading/Server actions — Cancel a search, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSearchStep2 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSearch,
    2,
  ),
  name: 'Data loading/Server actions — Cancel a search, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSearchStep3 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSearch,
    3,
  ),
  name: 'Data loading/Server actions — Cancel a search, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSearchStep4 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSearch,
    4,
  ),
  name: 'Data loading/Server actions — Cancel a search, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSortStep1 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSort,
    1,
  ),
  name: 'Data loading/Server actions — Cancel sorting, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSortStep2 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSort,
    2,
  ),
  name: 'Data loading/Server actions — Cancel sorting, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSortStep3 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSort,
    3,
  ),
  name: 'Data loading/Server actions — Cancel sorting, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerActionsCancelSortStep4 = {
  ...twinStep(
    dataLoadingServerActionsStories,
    dataLoadingServerActionsStories.ServerActionsCancelSort,
    4,
  ),
  name: 'Data loading/Server actions — Cancel sorting, шаг 4',
  tags: ['!test'],
}

export const HighContrastExportCancelStep1 = {
  ...twinStep(exportStories, exportStories.ExportCancel, 1),
  name: 'Export — Cancel an export, шаг 1',
  tags: ['!test'],
}

export const HighContrastExportCancelStep2 = {
  ...twinStep(exportStories, exportStories.ExportCancel, 2),
  name: 'Export — Cancel an export, шаг 2',
  tags: ['!test'],
}

export const HighContrastExportCancelStep3 = {
  ...twinStep(exportStories, exportStories.ExportCancel, 3),
  name: 'Export — Cancel an export, шаг 3',
  tags: ['!test'],
}

export const HighContrastExportCancelStep4 = {
  ...twinStep(exportStories, exportStories.ExportCancel, 4),
  name: 'Export — Cancel an export, шаг 4',
  tags: ['!test'],
}

export const HighContrastPluginApiCancelPendingStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCancelPending, 1),
  name: 'Plugin API — Cancel everything pending, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiCancelPendingStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCancelPending, 2),
  name: 'Plugin API — Cancel everything pending, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiCancelPendingStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiCancelPending, 3),
  name: 'Plugin API — Cancel everything pending, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyAttributesStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyAttributes, 1),
  name: 'Plugin API — Body attributes, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyAttributesStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyAttributes, 2),
  name: 'Plugin API — Body attributes, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyAttributesStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyAttributes, 3),
  name: 'Plugin API — Body attributes, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyEventsStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyEvents, 1),
  name: 'Plugin API — Body events, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyEventsStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyEvents, 2),
  name: 'Plugin API — Body events, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyEventsStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyEvents, 3),
  name: 'Plugin API — Body events, шаг 3',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyKeysStep1 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyKeys, 1),
  name: 'Plugin API — Body keys, шаг 1',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyKeysStep2 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyKeys, 2),
  name: 'Plugin API — Body keys, шаг 2',
  tags: ['!test'],
}

export const HighContrastPluginApiBodyKeysStep3 = {
  ...twinStep(pluginApiStories, pluginApiStories.PluginApiBodyKeys, 3),
  name: 'Plugin API — Body keys, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerCancelStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerCancel, 1),
  name: 'Filtering — Cancel a server filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerCancelStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerCancel, 2),
  name: 'Filtering — Cancel a server filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerCancelStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerCancel, 3),
  name: 'Filtering — Cancel a server filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerCancelStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerCancel, 4),
  name: 'Filtering — Cancel a server filter, шаг 4',
  tags: ['!test'],
}

export const HighContrastPaginationServerCancelStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerCancel,
    1,
  ),
  name: 'Panels/Pagination — Cancel a page change, шаг 1',
  tags: ['!test'],
}

export const HighContrastPaginationServerCancelStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerCancel,
    2,
  ),
  name: 'Panels/Pagination — Cancel a page change, шаг 2',
  tags: ['!test'],
}

export const HighContrastPaginationServerCancelStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerCancel,
    3,
  ),
  name: 'Panels/Pagination — Cancel a page change, шаг 3',
  tags: ['!test'],
}

export const HighContrastPaginationServerCancelStep4 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerCancel,
    4,
  ),
  name: 'Panels/Pagination — Cancel a page change, шаг 4',
  tags: ['!test'],
}

export const HighContrastExpandingCancelStep1 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingCancel, 1),
  name: 'Rows/Expanding — Cancel loading children, шаг 1',
  tags: ['!test'],
}

export const HighContrastExpandingCancelStep2 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingCancel, 2),
  name: 'Rows/Expanding — Cancel loading children, шаг 2',
  tags: ['!test'],
}

export const HighContrastExpandingCancelStep3 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingCancel, 3),
  name: 'Rows/Expanding — Cancel loading children, шаг 3',
  tags: ['!test'],
}

export const HighContrastExpandingCancelStep4 = {
  ...twinStep(rowsExpandingStories, rowsExpandingStories.ExpandingCancel, 4),
  name: 'Rows/Expanding — Cancel loading children, шаг 4',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep1 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    1,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, шаг 1',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep2 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    2,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, шаг 2',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep3 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    3,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, шаг 3',
  tags: ['!test'],
}

export const HighContrastServerCopyCancelStep4 = {
  ...twinStep(
    serverCellSelectionStories,
    serverCellSelectionStories.ServerCopyCancel,
    4,
  ),
  name: 'Data loading/Server row model/Cell selection — Cancel copying, шаг 4',
  tags: ['!test'],
}

export const HighContrastFilteringServerApplyStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerApply, 1),
  name: 'Filtering — Apply a server filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerApplyStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerApply, 2),
  name: 'Filtering — Apply a server filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerApplyStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerApply, 3),
  name: 'Filtering — Apply a server filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerApplyStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerApply, 4),
  name: 'Filtering — Apply a server filter, шаг 4',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep1 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 1),
  name: 'Filtering — Reapply after cancel, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep2 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 2),
  name: 'Filtering — Reapply after cancel, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep3 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 3),
  name: 'Filtering — Reapply after cancel, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep4 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 4),
  name: 'Filtering — Reapply after cancel, шаг 4',
  tags: ['!test'],
}

export const HighContrastFilteringServerReapplyStep5 = {
  ...twinStep(filteringStories, filteringStories.FilteringServerReapply, 5),
  name: 'Filtering — Reapply after cancel, шаг 5',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep1 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    1,
  ),
  name: 'Cells/Context menu — Whole table, шаг 1',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep2 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    2,
  ),
  name: 'Cells/Context menu — Whole table, шаг 2',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep3 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    3,
  ),
  name: 'Cells/Context menu — Whole table, шаг 3',
  tags: ['!test'],
}

export const HighContrastContextMenuWholeTableStep4 = {
  ...twinStep(
    cellsContextMenuStories,
    cellsContextMenuStories.ContextMenuWholeTable,
    4,
  ),
  name: 'Cells/Context menu — Whole table, шаг 4',
  tags: ['!test'],
}

export const HighContrastActionStatusCheckboxStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusCheckbox,
    1,
  ),
  name: 'Cells/Action status — Checkbox in a cell, шаг 1',
  tags: ['!test'],
}

export const HighContrastActionStatusCheckboxStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusCheckbox,
    2,
  ),
  name: 'Cells/Action status — Checkbox in a cell, шаг 2',
  tags: ['!test'],
}

export const HighContrastActionStatusCheckboxStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusCheckbox,
    3,
  ),
  name: 'Cells/Action status — Checkbox in a cell, шаг 3',
  tags: ['!test'],
}

export const HighContrastActionStatusSwitchStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusSwitch,
    1,
  ),
  name: 'Cells/Action status — Switch refused by the server, шаг 1',
  tags: ['!test'],
}

export const HighContrastActionStatusSwitchStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusSwitch,
    2,
  ),
  name: 'Cells/Action status — Switch refused by the server, шаг 2',
  tags: ['!test'],
}

export const HighContrastActionStatusSwitchStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusSwitch,
    3,
  ),
  name: 'Cells/Action status — Switch refused by the server, шаг 3',
  tags: ['!test'],
}

export const HighContrastActionStatusSwitchStep4 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusSwitch,
    4,
  ),
  name: 'Cells/Action status — Switch refused by the server, шаг 4',
  tags: ['!test'],
}

export const HighContrastActionStatusDoubleClickStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusDoubleClick,
    1,
  ),
  name: 'Cells/Action status — Double-click without a control, шаг 1',
  tags: ['!test'],
}

export const HighContrastActionStatusDoubleClickStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusDoubleClick,
    2,
  ),
  name: 'Cells/Action status — Double-click without a control, шаг 2',
  tags: ['!test'],
}

export const HighContrastActionStatusDoubleClickStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusDoubleClick,
    3,
  ),
  name: 'Cells/Action status — Double-click without a control, шаг 3',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    1,
  ),
  name: 'Cells/Action status — Change while saving, шаг 1',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    2,
  ),
  name: 'Cells/Action status — Change while saving, шаг 2',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    3,
  ),
  name: 'Cells/Action status — Change while saving, шаг 3',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep4 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    4,
  ),
  name: 'Cells/Action status — Change while saving, шаг 4',
  tags: ['!test'],
}

export const HighContrastBusyObjectIgnoredStep5 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.BusyObjectIgnored,
    5,
  ),
  name: 'Cells/Action status — Change while saving, шаг 5',
  tags: ['!test'],
}

export const HighContrastActionStatusRetryStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusRetry,
    1,
  ),
  name: 'Cells/Action status — Retry from the mark, шаг 1',
  tags: ['!test'],
}

export const HighContrastActionStatusRetryStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusRetry,
    2,
  ),
  name: 'Cells/Action status — Retry from the mark, шаг 2',
  tags: ['!test'],
}

export const HighContrastActionStatusRetryStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusRetry,
    3,
  ),
  name: 'Cells/Action status — Retry from the mark, шаг 3',
  tags: ['!test'],
}

export const HighContrastActionStatusRetryStep4 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.ActionStatusRetry,
    4,
  ),
  name: 'Cells/Action status — Retry from the mark, шаг 4',
  tags: ['!test'],
}

export const HighContrastCellSaveCancelMenuStep1 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.CellSaveCancelMenu,
    1,
  ),
  name: 'Cells/Action status — Cancel saving from the menu, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellSaveCancelMenuStep2 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.CellSaveCancelMenu,
    2,
  ),
  name: 'Cells/Action status — Cancel saving from the menu, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellSaveCancelMenuStep3 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.CellSaveCancelMenu,
    3,
  ),
  name: 'Cells/Action status — Cancel saving from the menu, шаг 3',
  tags: ['!test'],
}

export const HighContrastCellSaveCancelMenuStep4 = {
  ...twinStep(
    cellsActionStatusStories,
    cellsActionStatusStories.CellSaveCancelMenu,
    4,
  ),
  name: 'Cells/Action status — Cancel saving from the menu, шаг 4',
  tags: ['!test'],
}

export const HighContrastDataTypesCustomTypeStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesCustomType,
    1,
  ),
  name: 'Columns/Data types/Overview — Custom type, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesCustomTypeStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesCustomType,
    2,
  ),
  name: 'Columns/Data types/Overview — Custom type, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesOverrideBuiltInStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesOverrideBuiltIn,
    1,
  ),
  name: 'Columns/Data types/Overview — Override built-in type, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesOverrideBuiltInStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesOverrideBuiltIn,
    2,
  ),
  name: 'Columns/Data types/Overview — Override built-in type, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesLocaleStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesLocale,
    1,
  ),
  name: 'Columns/Data types/Overview — Switch language, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesLocaleStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesLocale,
    2,
  ),
  name: 'Columns/Data types/Overview — Switch language, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesLocaleStep3 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesLocale,
    3,
  ),
  name: 'Columns/Data types/Overview — Switch language, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesSearchStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesSearch,
    1,
  ),
  name: 'Columns/Data types/Overview — Search shown text, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesSearchStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesSearch,
    2,
  ),
  name: 'Columns/Data types/Overview — Search shown text, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesSearchStep3 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.DataTypesSearch,
    3,
  ),
  name: 'Columns/Data types/Overview — Search shown text, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingTypeEditorStep1 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.EditingTypeEditor,
    1,
  ),
  name: 'Columns/Data types/Overview — Editor of a data type, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingTypeEditorStep2 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.EditingTypeEditor,
    2,
  ),
  name: 'Columns/Data types/Overview — Editor of a data type, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingTypeEditorStep3 = {
  ...twinStep(
    columnsDataTypesStories,
    columnsDataTypesStories.EditingTypeEditor,
    3,
  ),
  name: 'Columns/Data types/Overview — Editor of a data type, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingBooleanStep1 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBoolean,
    1,
  ),
  name: 'Columns/Data types/Boolean — Toggle, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingBooleanStep2 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBoolean,
    2,
  ),
  name: 'Columns/Data types/Boolean — Toggle, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingBooleanStep3 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBoolean,
    3,
  ),
  name: 'Columns/Data types/Boolean — Toggle, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingBooleanKeyboardStep1 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBooleanKeyboard,
    1,
  ),
  name: 'Columns/Data types/Boolean — Toggle and select with the keyboard, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingBooleanKeyboardStep2 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBooleanKeyboard,
    2,
  ),
  name: 'Columns/Data types/Boolean — Toggle and select with the keyboard, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingBooleanKeyboardStep3 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.EditingBooleanKeyboard,
    3,
  ),
  name: 'Columns/Data types/Boolean — Toggle and select with the keyboard, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesBooleanFilterStep1 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.DataTypesBooleanFilter,
    1,
  ),
  name: 'Columns/Data types/Boolean — Filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesBooleanFilterStep2 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.DataTypesBooleanFilter,
    2,
  ),
  name: 'Columns/Data types/Boolean — Filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesBooleanFilterStep3 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.DataTypesBooleanFilter,
    3,
  ),
  name: 'Columns/Data types/Boolean — Filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesBooleanFilterStep4 = {
  ...twinStep(
    columnsDataTypesBooleanStories,
    columnsDataTypesBooleanStories.DataTypesBooleanFilter,
    4,
  ),
  name: 'Columns/Data types/Boolean — Filter, шаг 4',
  tags: ['!test'],
}

export const HighContrastDataTypesFilterStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesFilter,
    1,
  ),
  name: 'Columns/Data types/Date — Filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesFilterStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesFilter,
    2,
  ),
  name: 'Columns/Data types/Date — Filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesFilterStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesFilter,
    3,
  ),
  name: 'Columns/Data types/Date — Filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesFilterStep4 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesFilter,
    4,
  ),
  name: 'Columns/Data types/Date — Filter, шаг 4',
  tags: ['!test'],
}

export const HighContrastEditingDateStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDate,
    1,
  ),
  name: 'Columns/Data types/Date — Edit, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingDateStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDate,
    2,
  ),
  name: 'Columns/Data types/Date — Edit, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingDateStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDate,
    3,
  ),
  name: 'Columns/Data types/Date — Edit, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingDateClearStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDateClear,
    1,
  ),
  name: 'Columns/Data types/Date — Clear, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingDateClearStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDateClear,
    2,
  ),
  name: 'Columns/Data types/Date — Clear, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingDateClearStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.EditingDateClear,
    3,
  ),
  name: 'Columns/Data types/Date — Clear, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesDateSortStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateSort,
    1,
  ),
  name: 'Columns/Data types/Date — Sort, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesDateSortStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateSort,
    2,
  ),
  name: 'Columns/Data types/Date — Sort, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesDateSortStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateSort,
    3,
  ),
  name: 'Columns/Data types/Date — Sort, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesDateExcelStep1 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateExcel,
    1,
  ),
  name: 'Columns/Data types/Date — Export to Excel, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesDateExcelStep2 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateExcel,
    2,
  ),
  name: 'Columns/Data types/Date — Export to Excel, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesDateExcelStep3 = {
  ...twinStep(
    columnsDataTypesDateStories,
    columnsDataTypesDateStories.DataTypesDateExcel,
    3,
  ),
  name: 'Columns/Data types/Date — Export to Excel, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingDateTimeStep1 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.EditingDateTime,
    1,
  ),
  name: 'Columns/Data types/Date & time — Edit, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingDateTimeStep2 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.EditingDateTime,
    2,
  ),
  name: 'Columns/Data types/Date & time — Edit, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingDateTimeStep3 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.EditingDateTime,
    3,
  ),
  name: 'Columns/Data types/Date & time — Edit, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesDateTimeFilterStep1 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.DataTypesDateTimeFilter,
    1,
  ),
  name: 'Columns/Data types/Date & time — Filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesDateTimeFilterStep2 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.DataTypesDateTimeFilter,
    2,
  ),
  name: 'Columns/Data types/Date & time — Filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesDateTimeFilterStep3 = {
  ...twinStep(
    columnsDataTypesDateTimeStories,
    columnsDataTypesDateTimeStories.DataTypesDateTimeFilter,
    3,
  ),
  name: 'Columns/Data types/Date & time — Filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringStep1 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberString,
    1,
  ),
  name: 'Columns/Data types/Decimal string — Exact order, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringStep2 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberString,
    2,
  ),
  name: 'Columns/Data types/Decimal string — Exact order, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringExportStep1 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberStringExport,
    1,
  ),
  name: 'Columns/Data types/Decimal string — Export to Excel, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringExportStep2 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberStringExport,
    2,
  ),
  name: 'Columns/Data types/Decimal string — Export to Excel, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberStringExportStep3 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.DataTypesNumberStringExport,
    3,
  ),
  name: 'Columns/Data types/Decimal string — Export to Excel, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingDecimalStringStep1 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.EditingDecimalString,
    1,
  ),
  name: 'Columns/Data types/Decimal string — Edit, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingDecimalStringStep2 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.EditingDecimalString,
    2,
  ),
  name: 'Columns/Data types/Decimal string — Edit, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingDecimalStringStep3 = {
  ...twinStep(
    columnsDataTypesDecimalStringStories,
    columnsDataTypesDecimalStringStories.EditingDecimalString,
    3,
  ),
  name: 'Columns/Data types/Decimal string — Edit, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingMultiSelectStep1 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.EditingMultiSelect,
    1,
  ),
  name: 'Columns/Data types/Multi select — Choose several, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingMultiSelectStep2 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.EditingMultiSelect,
    2,
  ),
  name: 'Columns/Data types/Multi select — Choose several, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingMultiSelectStep3 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.EditingMultiSelect,
    3,
  ),
  name: 'Columns/Data types/Multi select — Choose several, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingMultiSelectStep4 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.EditingMultiSelect,
    4,
  ),
  name: 'Columns/Data types/Multi select — Choose several, шаг 4',
  tags: ['!test'],
}

export const HighContrastDataTypesMultiSelectFilterStep1 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.DataTypesMultiSelectFilter,
    1,
  ),
  name: 'Columns/Data types/Multi select — Filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesMultiSelectFilterStep2 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.DataTypesMultiSelectFilter,
    2,
  ),
  name: 'Columns/Data types/Multi select — Filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesMultiSelectFilterStep3 = {
  ...twinStep(
    columnsDataTypesMultiSelectStories,
    columnsDataTypesMultiSelectStories.DataTypesMultiSelectFilter,
    3,
  ),
  name: 'Columns/Data types/Multi select — Filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesEditNumberStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesEditNumber,
    1,
  ),
  name: 'Columns/Data types/Number — Edit with a decimal comma, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesEditNumberStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesEditNumber,
    2,
  ),
  name: 'Columns/Data types/Number — Edit with a decimal comma, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesEditNumberStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesEditNumber,
    3,
  ),
  name: 'Columns/Data types/Number — Edit with a decimal comma, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingNumberStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.EditingNumber,
    1,
  ),
  name: 'Columns/Data types/Number — Edit, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingNumberStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.EditingNumber,
    2,
  ),
  name: 'Columns/Data types/Number — Edit, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingNumberStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.EditingNumber,
    3,
  ),
  name: 'Columns/Data types/Number — Edit, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingNumberStep4 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.EditingNumber,
    4,
  ),
  name: 'Columns/Data types/Number — Edit, шаг 4',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberSortStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberSort,
    1,
  ),
  name: 'Columns/Data types/Number — Sort, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberSortStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberSort,
    2,
  ),
  name: 'Columns/Data types/Number — Sort, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberSortStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberSort,
    3,
  ),
  name: 'Columns/Data types/Number — Sort, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberFilterStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberFilter,
    1,
  ),
  name: 'Columns/Data types/Number — Filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberFilterStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberFilter,
    2,
  ),
  name: 'Columns/Data types/Number — Filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberFilterStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberFilter,
    3,
  ),
  name: 'Columns/Data types/Number — Filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberExcelStep1 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberExcel,
    1,
  ),
  name: 'Columns/Data types/Number — Export to Excel, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberExcelStep2 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberExcel,
    2,
  ),
  name: 'Columns/Data types/Number — Export to Excel, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesNumberExcelStep3 = {
  ...twinStep(
    columnsDataTypesNumberStories,
    columnsDataTypesNumberStories.DataTypesNumberExcel,
    3,
  ),
  name: 'Columns/Data types/Number — Export to Excel, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectStep1 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObject,
    1,
  ),
  name: 'Columns/Data types/Object — Sort and filter records, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectStep2 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObject,
    2,
  ),
  name: 'Columns/Data types/Object — Sort and filter records, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectStep3 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObject,
    3,
  ),
  name: 'Columns/Data types/Object — Sort and filter records, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectStep4 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObject,
    4,
  ),
  name: 'Columns/Data types/Object — Sort and filter records, шаг 4',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectLabelStep1 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObjectLabel,
    1,
  ),
  name: 'Columns/Data types/Object — Key and label, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesObjectLabelStep2 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.DataTypesObjectLabel,
    2,
  ),
  name: 'Columns/Data types/Object — Key and label, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep1 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    1,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep2 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    2,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep3 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    3,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep4 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    4,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, шаг 4',
  tags: ['!test'],
}

export const HighContrastEditingLookupStep5 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingLookup,
    5,
  ),
  name: 'Columns/Data types/Object — Choose from a directory, шаг 5',
  tags: ['!test'],
}

export const HighContrastEditingRecordFromDataStep1 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingRecordFromData,
    1,
  ),
  name: 'Columns/Data types/Object — Choose a record from the table, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingRecordFromDataStep2 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingRecordFromData,
    2,
  ),
  name: 'Columns/Data types/Object — Choose a record from the table, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingRecordFromDataStep3 = {
  ...twinStep(
    columnsDataTypesObjectStories,
    columnsDataTypesObjectStories.EditingRecordFromData,
    3,
  ),
  name: 'Columns/Data types/Object — Choose a record from the table, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingSelectStep1 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.EditingSelect,
    1,
  ),
  name: 'Columns/Data types/Select — Choose, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingSelectStep2 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.EditingSelect,
    2,
  ),
  name: 'Columns/Data types/Select — Choose, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingSelectStep3 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.EditingSelect,
    3,
  ),
  name: 'Columns/Data types/Select — Choose, шаг 3',
  tags: ['!test'],
}

export const HighContrastEditingSelectStep4 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.EditingSelect,
    4,
  ),
  name: 'Columns/Data types/Select — Choose, шаг 4',
  tags: ['!test'],
}

export const HighContrastDataTypesSelectFilterStep1 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.DataTypesSelectFilter,
    1,
  ),
  name: 'Columns/Data types/Select — Filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesSelectFilterStep2 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.DataTypesSelectFilter,
    2,
  ),
  name: 'Columns/Data types/Select — Filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesSelectFilterStep3 = {
  ...twinStep(
    columnsDataTypesSelectStories,
    columnsDataTypesSelectStories.DataTypesSelectFilter,
    3,
  ),
  name: 'Columns/Data types/Select — Filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesTextSortStep1 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextSort,
    1,
  ),
  name: 'Columns/Data types/Text — Sort, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesTextSortStep2 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextSort,
    2,
  ),
  name: 'Columns/Data types/Text — Sort, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesTextSortStep3 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextSort,
    3,
  ),
  name: 'Columns/Data types/Text — Sort, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesTextFilterStep1 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextFilter,
    1,
  ),
  name: 'Columns/Data types/Text — Filter, шаг 1',
  tags: ['!test'],
}

export const HighContrastDataTypesTextFilterStep2 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextFilter,
    2,
  ),
  name: 'Columns/Data types/Text — Filter, шаг 2',
  tags: ['!test'],
}

export const HighContrastDataTypesTextFilterStep3 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextFilter,
    3,
  ),
  name: 'Columns/Data types/Text — Filter, шаг 3',
  tags: ['!test'],
}

export const HighContrastDataTypesTextFilterStep4 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.DataTypesTextFilter,
    4,
  ),
  name: 'Columns/Data types/Text — Filter, шаг 4',
  tags: ['!test'],
}

export const HighContrastEditingTextStep1 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.EditingText,
    1,
  ),
  name: 'Columns/Data types/Text — Edit, шаг 1',
  tags: ['!test'],
}

export const HighContrastEditingTextStep2 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.EditingText,
    2,
  ),
  name: 'Columns/Data types/Text — Edit, шаг 2',
  tags: ['!test'],
}

export const HighContrastEditingTextStep3 = {
  ...twinStep(
    columnsDataTypesTextStories,
    columnsDataTypesTextStories.EditingText,
    3,
  ),
  name: 'Columns/Data types/Text — Edit, шаг 3',
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
  name: 'Panels/Failure log — Refused row action, шаг 1',
  tags: ['!test'],
}

export const HighContrastFailureLogRowStep2 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogRow,
    2,
  ),
  name: 'Panels/Failure log — Refused row action, шаг 2',
  tags: ['!test'],
}

export const HighContrastFailureLogRowStep3 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogRow,
    3,
  ),
  name: 'Panels/Failure log — Refused row action, шаг 3',
  tags: ['!test'],
}

export const HighContrastFailureLogRowStep4 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogRow,
    4,
  ),
  name: 'Panels/Failure log — Refused row action, шаг 4',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep1 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    1,
  ),
  name: 'Panels/Failure log — Failures off screen, шаг 1',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep2 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    2,
  ),
  name: 'Panels/Failure log — Failures off screen, шаг 2',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep3 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    3,
  ),
  name: 'Panels/Failure log — Failures off screen, шаг 3',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep4 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    4,
  ),
  name: 'Panels/Failure log — Failures off screen, шаг 4',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep5 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    5,
  ),
  name: 'Panels/Failure log — Failures off screen, шаг 5',
  tags: ['!test'],
}

export const HighContrastFailureLogOffscreenStep6 = {
  ...twinStep(
    panelsFailureLogStories,
    panelsFailureLogStories.FailureLogOffscreen,
    6,
  ),
  name: 'Panels/Failure log — Failures off screen, шаг 6',
  tags: ['!test'],
}

export const HighContrastFilterDraftClosedPanelStep1 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftClosedPanel, 1),
  name: 'Filtering — Unapplied condition, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilterDraftClosedPanelStep2 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftClosedPanel, 2),
  name: 'Filtering — Unapplied condition, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilterDraftClosedPanelStep3 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftClosedPanel, 3),
  name: 'Filtering — Unapplied condition, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilterDraftClosedPanelStep4 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftClosedPanel, 4),
  name: 'Filtering — Unapplied condition, шаг 4',
  tags: ['!test'],
}

export const HighContrastFilterDraftAfterRefusalStep1 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftAfterRefusal, 1),
  name: 'Filtering — Refused condition, шаг 1',
  tags: ['!test'],
}

export const HighContrastFilterDraftAfterRefusalStep2 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftAfterRefusal, 2),
  name: 'Filtering — Refused condition, шаг 2',
  tags: ['!test'],
}

export const HighContrastFilterDraftAfterRefusalStep3 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftAfterRefusal, 3),
  name: 'Filtering — Refused condition, шаг 3',
  tags: ['!test'],
}

export const HighContrastFilterDraftAfterRefusalStep4 = {
  ...twinStep(filteringStories, filteringStories.FilterDraftAfterRefusal, 4),
  name: 'Filtering — Refused condition, шаг 4',
  tags: ['!test'],
}

export const HighContrastDraftsFromUrlStep1 = {
  ...twinStep(filteringStories, filteringStories.DraftsFromUrl, 1),
  name: 'Filtering — Restore unapplied conditions, шаг 1',
  tags: ['!test'],
}

export const HighContrastDraftsFromUrlStep2 = {
  ...twinStep(filteringStories, filteringStories.DraftsFromUrl, 2),
  name: 'Filtering — Restore unapplied conditions, шаг 2',
  tags: ['!test'],
}

export const HighContrastDraftsFromUrlStep3 = {
  ...twinStep(filteringStories, filteringStories.DraftsFromUrl, 3),
  name: 'Filtering — Restore unapplied conditions, шаг 3',
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
  name: 'Panels/Unsaved changes — Apply from the panel, шаг 1',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesApplyStep2 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesApply,
    2,
  ),
  name: 'Panels/Unsaved changes — Apply from the panel, шаг 2',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesApplyStep3 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesApply,
    3,
  ),
  name: 'Panels/Unsaved changes — Apply from the panel, шаг 3',
  tags: ['!test'],
}

export const HighContrastUnsavedChangesApplyStep4 = {
  ...twinStep(
    panelsUnsavedChangesStories,
    panelsUnsavedChangesStories.UnsavedChangesApply,
    4,
  ),
  name: 'Panels/Unsaved changes — Apply from the panel, шаг 4',
  tags: ['!test'],
}

export const HighContrastManualSaveCellsStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.ManualSaveCells, 1),
  name: 'Cells/Editing — Save by button, шаг 1',
  tags: ['!test'],
}

export const HighContrastManualSaveCellsStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.ManualSaveCells, 2),
  name: 'Cells/Editing — Save by button, шаг 2',
  tags: ['!test'],
}

export const HighContrastManualSaveCellsStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.ManualSaveCells, 3),
  name: 'Cells/Editing — Save by button, шаг 3',
  tags: ['!test'],
}

export const HighContrastManualSaveCellsStep4 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.ManualSaveCells, 4),
  name: 'Cells/Editing — Save by button, шаг 4',
  tags: ['!test'],
}

export const HighContrastManualSavePartialRefusalStep1 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.ManualSavePartialRefusal,
    1,
  ),
  name: 'Cells/Editing — Refused part of the batch, шаг 1',
  tags: ['!test'],
}

export const HighContrastManualSavePartialRefusalStep2 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.ManualSavePartialRefusal,
    2,
  ),
  name: 'Cells/Editing — Refused part of the batch, шаг 2',
  tags: ['!test'],
}

export const HighContrastManualSavePartialRefusalStep3 = {
  ...twinStep(
    cellsEditingStories,
    cellsEditingStories.ManualSavePartialRefusal,
    3,
  ),
  name: 'Cells/Editing — Refused part of the batch, шаг 3',
  tags: ['!test'],
}

export const HighContrastCellDraftRollbackStep1 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.CellDraftRollback, 1),
  name: 'Cells/Editing — Roll back an edit, шаг 1',
  tags: ['!test'],
}

export const HighContrastCellDraftRollbackStep2 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.CellDraftRollback, 2),
  name: 'Cells/Editing — Roll back an edit, шаг 2',
  tags: ['!test'],
}

export const HighContrastCellDraftRollbackStep3 = {
  ...twinStep(cellsEditingStories, cellsEditingStories.CellDraftRollback, 3),
  name: 'Cells/Editing — Roll back an edit, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowEditingPlayground = {
  ...twin(rowsEditingMeta, rowsEditingStories.RowEditingPlayground),
  name: 'Rows/Editing — Playground',
  tags: ['!test'],
}

export const HighContrastRowDraftInsertStep1 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftInsert, 1),
  name: 'Rows/Editing — Add a row, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowDraftInsertStep2 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftInsert, 2),
  name: 'Rows/Editing — Add a row, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowDraftInsertStep3 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftInsert, 3),
  name: 'Rows/Editing — Add a row, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowDraftInsertStep4 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftInsert, 4),
  name: 'Rows/Editing — Add a row, шаг 4',
  tags: ['!test'],
}

export const HighContrastRowDraftDeleteStep1 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftDelete, 1),
  name: 'Rows/Editing — Delete and restore a row, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowDraftDeleteStep2 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftDelete, 2),
  name: 'Rows/Editing — Delete and restore a row, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowDraftDeleteStep3 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftDelete, 3),
  name: 'Rows/Editing — Delete and restore a row, шаг 3',
  tags: ['!test'],
}

export const HighContrastRowDraftsCommitRefusedStep1 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftsCommitRefused, 1),
  name: 'Rows/Editing — Refused new row, шаг 1',
  tags: ['!test'],
}

export const HighContrastRowDraftsCommitRefusedStep2 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftsCommitRefused, 2),
  name: 'Rows/Editing — Refused new row, шаг 2',
  tags: ['!test'],
}

export const HighContrastRowDraftsCommitRefusedStep3 = {
  ...twinStep(rowsEditingStories, rowsEditingStories.RowDraftsCommitRefused, 3),
  name: 'Rows/Editing — Refused new row, шаг 3',
  tags: ['!test'],
}

export const HighContrastPaginationServerSelectAllExceptStep1 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerSelectAllExcept,
    1,
  ),
  name: 'Panels/Pagination — Server, select all except, шаг 1',
  tags: ['!test'],
}

export const HighContrastPaginationServerSelectAllExceptStep2 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerSelectAllExcept,
    2,
  ),
  name: 'Panels/Pagination — Server, select all except, шаг 2',
  tags: ['!test'],
}

export const HighContrastPaginationServerSelectAllExceptStep3 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerSelectAllExcept,
    3,
  ),
  name: 'Panels/Pagination — Server, select all except, шаг 3',
  tags: ['!test'],
}

export const HighContrastPaginationServerSelectAllExceptStep4 = {
  ...twinStep(
    panelsPaginationStories,
    panelsPaginationStories.PaginationServerSelectAllExcept,
    4,
  ),
  name: 'Panels/Pagination — Server, select all except, шаг 4',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollSelectAllStep1 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollSelectAll,
    1,
  ),
  name: 'Data loading/Infinite scroll — Select all, шаг 1',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollSelectAllStep2 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollSelectAll,
    2,
  ),
  name: 'Data loading/Infinite scroll — Select all, шаг 2',
  tags: ['!test'],
}

export const HighContrastInfiniteScrollSelectAllStep3 = {
  ...twinStep(
    infiniteScrollStories,
    infiniteScrollStories.InfiniteScrollSelectAll,
    3,
  ),
  name: 'Data loading/Infinite scroll — Select all, шаг 3',
  tags: ['!test'],
}

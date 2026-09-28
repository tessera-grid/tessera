import { Meta, StoryObj } from '@storybook/react'
import { Grid } from './_shims'
import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../lib/plugins/rowActions'
import { DEFAULT_SKELETON_OPTIONS } from '../../lib/core/skeletonOptions'
import {
  columnCountType,
  containerHeightType,
  dataCountType,
  enableCellEditingType,
  enableColumnDraggingType,
  enableColumnPinningType,
  enableColumnResizingType,
  enableColumnSortingType,
  enableFooterType,
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
  showStubType,
  skeletonOptionsType,
} from './__mocks__/utils/argTypes'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { RowGrouping } from './DataGrid.Rows.stories'

/** Общие истории: все фичи, загрузка, заглушка, футер, ручная проверка доступности. */
const meta = {
  ...dataGridMeta,
  title: 'Tessera/DataGrid',
} satisfies Meta<StoryProps>

export default meta

export const AllFeatures: StoryObj<StoryProps> = {
  name: 'All Features',
  args: {
    containerHeight: 600,
    height: 500,
    maxHeight: 500,

    enableSkeleton: false,
    skeletonOptions: DEFAULT_SKELETON_OPTIONS,

    enableLoading: false,

    showStub: false,
    showHeaderGroups: false,

    enableColumnSorting: false,
    enableSortingRemoval: true,
    serverColumnSorting: false,
    enableMultiSort: true,

    enableColumnResizing: false,
    enableColumnDragging: false,
    enableColumnPinning: false,

    enableGrouping: false,

    enableRowSelection: false,
    enableSubRowSelection: false,
    enableRowExpanding: false,
    enableRowDragging: false,

    enableRowActions: false,
    rowActionsOptions: DEFAULT_ROW_ACTIONS_OPTIONS,

    enableHeaderActionMenu: false,
    enableRowActionMenu: false,

    enableCellEditing: false,

    enableFooter: false,
  },
  argTypes: {
    columnCount: columnCountType,
    dataCount: dataCountType,

    containerHeight: containerHeightType,
    height: numberHeightType,
    maxHeight: numberMaxHeightType,

    enableSkeleton: enableSkeletonType,
    skeletonOptions: skeletonOptionsType,

    enableLoading: enableLoadingType,

    showStub: showStubType,
    showHeaderGroups: showHeaderGroupsType,

    enableColumnSorting: enableColumnSortingType,
    enableSortingRemoval: enableSortingRemovalType,
    serverColumnSorting: serverColumnSortingType,
    enableMultiSort: enableMultiSortType,

    enableColumnResizing: enableColumnResizingType,
    enableColumnDragging: enableColumnDraggingType,
    enableColumnPinning: enableColumnPinningType,

    enableGrouping: enableGroupingType,

    enableRowSelection: enableRowSelectionType,
    enableSubRowSelection: enableSubRowSelectionType,
    enableRowExpanding: enableRowExpandingType,
    enableRowDragging: enableRowDraggingType,

    enableRowActions: enableRowActionsType,
    rowActionsOptions: rowActionsOptionsType,

    enableCellEditing: enableCellEditingType,

    enableFooter: enableFooterType,
  },
}

export const Skeletons: StoryObj<StoryProps> = {
  name: 'Skeletons',
  args: {
    enableSkeleton: true,
    skeletonOptions: DEFAULT_SKELETON_OPTIONS,
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
    enableKeyboardNavigation: true,
    enableRowDragging: true,
    enableRowExpanding: true,
    enableColumnDragging: true,
    dataMode: 'hierarchy',
    dataCount: 20,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

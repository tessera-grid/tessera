import React, { memo, useMemo, useState } from 'react'

import { ExpandedState } from '@tanstack/react-table'
import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { expect, waitFor } from 'storybook/test'

import { Card, CardContent, Grid, NoDataStub } from './_shims'
import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../core/createColumns/createRowActionsColumn'
import { useCreateHooks } from '../core/createHooks/useCreateHooks'
import { useRowExpandingState } from '../core/createState/rowExpandingState'
import { useRowSelectionState } from '../core/createState/rowSelectionState'
import { useCreateTable } from '../core/createTable'
import { CreateDataGridOptions } from '../core/createTable/types'
import { DEFAULT_SKELETON_OPTIONS } from '../core/skeletonOverlay/options'
import { DataGrid } from '../grid/DataGrid/DataGrid'
import { DataGridProps } from '../grid/DataGrid/types'
import { BatchToolbar } from './BatchToolbar'
import { Pagination } from './Pagination'
import { groupedColumns, useColumns } from './__mocks__/columns'
import { makeData, useData } from './__mocks__/data'
import { rowDeleteActionPlugin } from './__mocks__/plugins/rowDeleteAction/rowDeleteActionPlugin'
import { useAllRowsSelect } from './__mocks__/useAllRowsSelect'
import { usePagination } from './__mocks__/usePagination'
import {
  HANDLE,
  ROW,
  beginDrag,
  firePointer,
  nextFrame,
  rowSignatures,
  sortedRows,
} from './rowDragging.dnd'
import {
  columnCountType,
  containerHeightType,
  dataCountType,
  enableColumnDraggingType,
  enableColumnPinningType,
  enableColumnResizingType,
  enableColumnSortingType,
  enableFooterType,
  enableGroupingType,
  enableLoadingType,
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
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'

const COLUMN_COUNT = 20
const DATA_COUNT = 10
const PAGE_OFFSET = 5

export interface StoryProps extends CreateDataGridOptions {
  columnCount: number
  dataCount: number
  dataMode?: 'flat' | 'hierarchy' | 'groups'

  /**
   * Явный набор данных вместо генерируемого по dataMode/dataCount.
   * Используется группой Sizing/Data для параметризованных данных.
   */
  dataOverride?: any[]
  /**
   * Начальный grouping-state (список колонок). Если задан — StoryComponent
   * контролирует grouping и прокидывает onGroupingChange (интерактивно).
   */
  initialGrouping?: string[]
  /**
   * Начальное раскрытие строк (дерево/группы). `true` — раскрыть всё, чтобы
   * фича была видна сразу. По умолчанию наследует поведение dataMode.
   */
  initialExpanded?: ExpandedState

  containerHeight: number
  height: DataGridProps['height']
  maxHeight: DataGridProps['maxHeight']
  colorMode: DataGridProps['colorMode']

  showStub: boolean
  showHeaderGroups: boolean

  showBatchToolbar: boolean
  isAllRowsSelected: boolean

  page: number
  recordsOnPage: number

  updateArgs: (
    args: Partial<
      Pick<StoryProps, 'isAllRowsSelected' | 'page' | 'recordsOnPage'>
    >,
  ) => void
}

const expandingInitialState = {}

// Детерминированное дерево для истории SubRow Selection (генератор, а не
// захардкоженные данные) — 4 родителя × 3 ребёнка, наглядный каскад выбора.
const subRowSelectionTree = makeData({
  shape: 'tree',
  count: 4,
  depth: 2,
  breadth: 3,
})

export const StoryComponent = memo(
  ({
    columnCount,
    dataCount,
    dataMode = 'flat',

    containerHeight,
    height,
    maxHeight,
    colorMode,

    showStub,
    showHeaderGroups,

    showBatchToolbar,
    isAllRowsSelected,

    page,
    recordsOnPage,

    dataOverride,
    initialGrouping,
    initialExpanded,

    updateArgs,

    ...options
  }: StoryProps) => {
    const columnsWithCount = useColumns(columnCount)

    const columnsGetter = useMemo(() => {
      if (showHeaderGroups) {
        return groupedColumns
      }

      return columnsWithCount
    }, [showHeaderGroups, columnsWithCount])

    const { data: mockData, setData } = useData({
      count: dataCount,
      mode: dataMode,
      showStub,
    })

    // Явно переданный набор (группа Data) имеет приоритет над генерируемым.
    const data = dataOverride ?? mockData

    // Grouping контролируется только когда задан initialGrouping — иначе
    // поведение остальных историй не меняется (uncontrolled).
    const [grouping, setGrouping] = useState<string[] | undefined>(
      initialGrouping,
    )

    const { dataOnPage } = usePagination({
      data,
      page,
      recordsOnPage,
      updateArgs,
    })

    const { rowExpanded, onRowExpandedChange } = useRowExpandingState(
      initialExpanded ??
        (dataMode === 'hierarchy' ? true : expandingInitialState),
    )

    const { rowSelection, onRowSelectionChange } = useRowSelectionState()
    const { getSelectedData, selectedDataCount } = useAllRowsSelect({
      data,
      rowSelection,
    })

    const table = useCreateTable({
      columns: columnsGetter,
      data: showBatchToolbar ? dataOnPage : data,
      state: {
        expanded: rowExpanded,
        rowSelection,
        ...(grouping !== undefined ? { grouping } : {}),
      },
      handlers: {
        onExpandedChange: onRowExpandedChange,
        onRowSelectionChange,
        onRowOrderChange: setData,
        ...(initialGrouping !== undefined
          ? { onGroupingChange: setGrouping }
          : {}),
      },
      hooks: useCreateHooks({
        rowSelection: {
          onSelectRow: (): null => null,
          onSelectAllRowsOnPage: (): null => null,
          isAllRowsSelected,
        },
      }),
      ...options,
      // Раскрываемы: узлы дерева (isGroup) и сгруппированные строки TanStack.
      enableRowExpanding: options.enableRowExpanding
        ? row => row.getIsGrouped() || !!row.original?.isGroup
        : false,
      plugins: [rowDeleteActionPlugin],
    })

    return (
      <Grid
        style={{
          padding: 16,
          height: containerHeight,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Card style={{ height: '100%' }}>
          <CardContent
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {showBatchToolbar && (
              <BatchToolbar
                disabled={
                  !options.enableRowSelection || !!options.enableRowExpanding
                }
                onSelect={() => {
                  onRowSelectionChange(getSelectedData(!isAllRowsSelected))

                  updateArgs({
                    isAllRowsSelected: !isAllRowsSelected,
                  })
                }}
                isAllRowsSelected={isAllRowsSelected}
                selectedDataCount={selectedDataCount}
              />
            )}
            <DataGrid
              table={table}
              height={height}
              maxHeight={maxHeight}
              colorMode={colorMode}
              stub={<NoDataStub label="No Data!" />}
            />
            {showBatchToolbar && (
              <Pagination
                currentPage={page}
                recordsOnPage={recordsOnPage}
                totalPageAmount={Math.ceil(data.length / recordsOnPage)}
                totalRecordsAmount={data.length}
                updateArgs={updateArgs}
              />
            )}
          </CardContent>
        </Card>
      </Grid>
    )
  },
)

// --- Row Dragging demo scenario -----------------------------------------------
// Meta-level play: runs for EVERY story, but only does anything when the story
// actually enables row dragging (`args.enableRowDragging`). It is intentionally
// THIN — a single representative drag-and-drop so the Storybook Interactions
// panel demonstrates the feature. The per-requirement assertions (handle, hover
// reveal, cloud + fill, column width, auto-scroll R12–R14) each live as their
// own named test in `__tests__/row-dragging.test.tsx`, so `npm test` reports and
// fails them individually. Both share the pointer choreography in
// `rowDragging.dnd.ts` so the demo and the tests can't drift apart.

const rowDraggingPlay: NonNullable<Meta<StoryProps>['play']> = async ({
  args,
  canvasElement,
  step,
}) => {
  if (!args.enableRowDragging) return

  const canvas = canvasElement

  await waitFor(() =>
    expect(canvas.querySelectorAll(ROW).length).toBeGreaterThan(3),
  )

  await step('drag the first row onto a lower row and drop', async () => {
    const before = rowSignatures(canvas)
    const rows = sortedRows(canvas)
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    // Keep x fixed (no horizontal drift) so nesting depth stays 0 on flat data.
    const { hx } = await beginDrag(handle)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty) // over the target row
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, hx, ty + 1) // settle collision/over
    await nextFrame()
    await nextFrame()
    firePointer('pointerup', document, hx, ty + 1)

    // Sanity for the demo: the drop reordered the rows.
    await waitFor(() =>
      expect(rowSignatures(canvas).join('¦')).not.toBe(before.join('¦')),
    )
  })
}

const meta = {
  title: 'Tessera/DataGrid',
  args: {
    columnCount: COLUMN_COUNT,
    dataCount: DATA_COUNT,

    page: 0,
    recordsOnPage: PAGE_OFFSET,
  },
  play: rowDraggingPlay,
  parameters: {
    backgrounds: { disable: true },
    layout: 'fullscreen',
    controls: {
      expanded: true,
      exclude: ['page', 'recordsOnPage', 'dataMode', 'colorMode'],
    },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return <StoryComponent {...normalizeArgs(args)} updateArgs={updateArgs} />
  },
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

export const ColumnResizing: StoryObj<StoryProps> = {
  name: 'Column Resizing',
  args: {
    enableColumnResizing: true,
  },
}

export const ColumnSorting: StoryObj<StoryProps> = {
  name: 'Column Sorting',
  args: {
    enableColumnSorting: true,
  },
}

export const ColumnSortingNotRemovable: StoryObj<StoryProps> = {
  name: 'Column Sorting (not removable)',
  args: {
    enableColumnSorting: true,
    enableSortingRemoval: false,
  },
}

export const ColumnDragging: StoryObj<StoryProps> = {
  name: 'Column Dragging',
  args: {
    enableColumnDragging: true,
  },
}

export const ColumnPinning: StoryObj<StoryProps> = {
  name: 'Column Pinning',
  args: {
    enableColumnPinning: true,
  },
}

export const HeaderGroups: StoryObj<StoryProps> = {
  name: 'Header Groups',
  args: {
    showHeaderGroups: true,
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'page', 'recordsOnPage'],
    },
  },
}

export const WithFooter: StoryObj<StoryProps> = {
  name: 'With Footer',
  args: {
    enableFooter: true,
  },
}

export const RowSelection: StoryObj<StoryProps> = {
  name: 'Row Selection',
  args: {
    enableRowSelection: true,
  },
}

export const BatchRowSelection: StoryObj<StoryProps> = {
  name: 'Batch Row Selection',
  args: {
    enableRowSelection: true,
    showBatchToolbar: true,
    isAllRowsSelected: false,
  },
}

export const SubRowSelection: StoryObj<StoryProps> = {
  name: 'SubRow Selection',
  args: {
    // Реальное дерево из генератора (раскрыто), чтобы каскад выбора
    // родитель↔дети был нагляден — не на захардкоженных 5 строках.
    dataOverride: subRowSelectionTree,
    initialExpanded: true,

    enableRowSelection: true,
    enableSubRowSelection: true,
    enableRowExpanding: true,
  },
  parameters: {
    controls: {
      exclude: [
        'columnCount',
        'dataCount',
        'page',
        'recordsOnPage',
        'dataMode',
        'dataOverride',
        'initialExpanded',
      ],
    },
  },
}

export const RowDragging: StoryObj<StoryProps> = {
  name: 'Row Dragging',
  args: {
    enableRowDragging: true,
    // Sized to overflow on both axes so the play's auto-scroll steps (R12–R14)
    // have real vertical + horizontal scroll to exercise.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const RowActions: StoryObj<StoryProps> = {
  name: 'Row Actions',
  args: {
    enableRowActions: true,
  },
}

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
import { DataGrid } from '../ui/DataGrid/DataGrid'
import { DataGridProps } from '../ui/DataGrid/types'
import { BatchToolbar } from './BatchToolbar'
import { Pagination } from './Pagination'
import { groupedColumns, useColumns } from './__mocks__/columns'
import { makeData, useData } from './__mocks__/data'
import { rowDeleteActionPlugin } from './__mocks__/plugins/rowDeleteAction/rowDeleteActionPlugin'
import { useAllRowsSelect } from './__mocks__/useAllRowsSelect'
import { usePagination } from './__mocks__/usePagination'
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

// --- Row Dragging visual test -------------------------------------------------
// Meta-level play: runs for EVERY story, but only does anything when the story
// actually enables row dragging (`args.enableRowDragging`). So the same check
// covers any current/future story that flips the flag on. Uses synthetic pointer
// events (works in the Storybook UI and under vitest-browser); the CSS-`:hover`
// reveal, which synthetic events can't drive, is verified with trusted input in
// the vitest runner (`__tests__/row-dragging.test.tsx`).

/** Icon side per spec (`DragHandler.module.css`: `.button svg { 16px }`). */
const DRAG_ICON_SIZE = 16
/** Column width per spec: icon (16) + left padding (4) + right padding (4). */
const DRAG_COLUMN_WIDTH = DRAG_ICON_SIZE + 4 + 4 // = 24

const ROW = '.data-grid__body-row'
const USER_CELL = '.data-grid__body-cell:not([data-actions-column-cell="true"])'
const HANDLE = '.drag__handler--column'
/** OverlayBodyRow container (the drag "cloud") — distinct class from body rows. */
const OVERLAY = '.data-grid-body__row'
/** The row whose slot shows the colour drop-indicator while dragging. */
const DRAG_FILL = '.data-grid__body-row[data-row-draggable="true"]'
/** The element that actually overflows and scrolls. */
const SCROLLER = '.MuiTableContainer-root'

const sortByIndex = (a: HTMLElement, b: HTMLElement) =>
  Number(a.getAttribute('data-index')) - Number(b.getAttribute('data-index'))

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

const firePointer = (
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  target: Element | Document,
  x: number,
  y: number,
) => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  )
}

/** Visible order of rows keyed by a per-row signature (all user-cell text). */
const rowSignatures = (canvas: HTMLElement) =>
  Array.from(canvas.querySelectorAll<HTMLElement>(ROW))
    .sort(
      (a, b) =>
        Number(a.getAttribute('data-index')) -
        Number(b.getAttribute('data-index')),
    )
    .map(row =>
      Array.from(row.querySelectorAll<HTMLElement>(USER_CELL))
        .map(cell => cell.textContent?.trim() ?? '')
        .join('|'),
    )

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

  await step('drag column: dedicated first column with a 16px handle', async () => {
    const rows = Array.from(canvas.querySelectorAll<HTMLElement>(ROW))
    const handles = canvas.querySelectorAll<HTMLElement>(HANDLE)

    // Every row is draggable here (enableRowDragging: true), so `getCanDrag()`
    // renders a handle in each rendered row.
    expect(handles.length).toBe(rows.length)

    const firstHandle = handles[0]
    const dragCell = firstHandle.closest<HTMLElement>(
      '.data-grid__body-cell[data-actions-column-cell="true"]',
    )
    // The handle lives in the left-most (action) column.
    expect(dragCell).toBeTruthy()
    expect(dragCell).toBe(
      rows[0].querySelector('.data-grid__body-cell[data-actions-column-cell="true"]'),
    )

    const svg = firstHandle.querySelector('svg')!
    const iconStyle = getComputedStyle(svg)
    expect(iconStyle.width).toBe(`${DRAG_ICON_SIZE}px`)
    expect(iconStyle.height).toBe(`${DRAG_ICON_SIZE}px`)
  })

  await step('handle is hidden (opacity 0) until the row is hovered', async () => {
    // The reveal-on-hover half is CSS-`:hover`-driven and needs trusted input;
    // it is asserted in the vitest runner. Here we lock in the hidden default.
    const svg = canvas.querySelector<HTMLElement>(`${HANDLE} svg`)!
    expect(getComputedStyle(svg).opacity).toBe('0')
  })

  const before = rowSignatures(canvas)

  await step('drag shows the "cloud" overlay and the drop-indicator fill', async () => {
    const rows = Array.from(canvas.querySelectorAll<HTMLElement>(ROW)).sort(
      (a, b) =>
        Number(a.getAttribute('data-index')) -
        Number(b.getAttribute('data-index')),
    )
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    const hr = handle.getBoundingClientRect()
    const hx = hr.left + hr.width / 2
    const hy = hr.top + hr.height / 2
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2

    // Keep x fixed (no horizontal drift) so nesting depth stays 0 on flat data.
    firePointer('pointerdown', handle, hx, hy)
    await nextFrame()
    firePointer('pointermove', document, hx, hy + 6) // pass the activation move
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, hx, ty) // over the target row
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, hx, ty + 1) // settle collision/over
    await nextFrame()
    await nextFrame()

    // Mid-drag: the cloud follows the cursor and the source row shows the fill.
    await waitFor(() => {
      expect(canvas.querySelector(OVERLAY)).toBeTruthy()
      expect(canvas.querySelector(DRAG_FILL)).toBeTruthy()
    })

    firePointer('pointerup', document, hx, ty + 1)
  })

  await step('after drop: order changed, cloud + fill are gone', async () => {
    // Cleanup: overlay unmounts and the fill attribute clears.
    await waitFor(() => {
      expect(canvas.querySelector(OVERLAY)).toBeNull()
      expect(canvas.querySelector(DRAG_FILL)).toBeNull()
    })

    // The dragged row got a new index → the visible order is different, but no
    // row was lost (the dragged signature still present, just lower down).
    await waitFor(() => {
      const after = rowSignatures(canvas)
      expect(after.join('¦')).not.toBe(before.join('¦'))
      expect(after[0]).not.toBe(before[0])
      expect(after).toContain(before[0])
    })
  })

  await step('drag column width = 16 + 4 + 4 (spec)', async () => {
    const dragCell = canvas
      .querySelector<HTMLElement>(HANDLE)!
      .closest<HTMLElement>('.data-grid__body-cell')!
    // Spec width: 16 + 4 + 4 = 24 (`COLUMN_DRAGGING_SIZE`, border-box cell).
    expect(Math.round(dragCell.getBoundingClientRect().width)).toBe(
      DRAG_COLUMN_WIDTH,
    )
  })

  // --- Auto-scroll (R12–R14) ---------------------------------------------------
  // Only meaningful when the grid overflows; each step self-skips otherwise, so
  // the play stays correct on small stories that flip the flag on.
  const scroller = canvas.querySelector<HTMLElement>(SCROLLER)

  const sortedRows = () =>
    Array.from(canvas.querySelectorAll<HTMLElement>(ROW)).sort(sortByIndex)

  /** Press on a row handle and pass the activation move; pointer stays down. */
  const beginDrag = async (handle: HTMLElement) => {
    const hr = handle.getBoundingClientRect()
    const hx = hr.left + hr.width / 2
    const hy = hr.top + hr.height / 2
    firePointer('pointerdown', handle, hx, hy)
    await nextFrame()
    firePointer('pointermove', document, hx, hy + 6)
    await nextFrame()
    await nextFrame()
    await nextFrame()
    return { hx, hy }
  }

  await step('R12: dragging near the bottom edge auto-scrolls down', async () => {
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return

    scroller.scrollTop = 0
    await nextFrame()
    const { hx, hy } = await beginDrag(sortedRows()[0].querySelector(HANDLE)!)
    const cr = scroller.getBoundingClientRect()
    // Hold inside the bottom 20% threshold; dnd-kit keeps scrolling per frame.
    firePointer('pointermove', document, cr.left + cr.width / 2, cr.bottom - cr.height * 0.05)
    try {
      await waitFor(
        () => expect(scroller.scrollTop).toBeGreaterThan(0),
        { timeout: 2000 },
      )
    } finally {
      firePointer('pointerup', document, hx, hy)
    }
    await nextFrame()
  })

  await step('R14: dragging near the right edge does NOT scroll horizontally', async () => {
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return

    scroller.scrollLeft = 0
    scroller.scrollTop = 0
    await nextFrame()
    const { hx, hy } = await beginDrag(sortedRows()[0].querySelector(HANDLE)!)
    const cr = scroller.getBoundingClientRect()
    // Near the right edge but vertically centred (outside the vertical threshold).
    firePointer('pointermove', document, cr.right - cr.width * 0.03, cr.top + cr.height / 2)
    for (let i = 0; i < 40; i++) {
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
    }
    try {
      expect(scroller.scrollLeft).toBe(0)
    } finally {
      firePointer('pointerup', document, hx, hy)
    }
    await nextFrame()
  })

  await step('R13: a row reorders correctly after a vertical scroll', async () => {
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return

    scroller.scrollTop = Math.min(1500, scroller.scrollHeight - scroller.clientHeight)
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
    }

    const rows = sortedRows()
    const source = rows[1]
    const target = rows[4]
    const beforeScroll = rowSignatures(canvas)

    const { hx } = await beginDrag(source.querySelector(HANDLE)!)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    // Mid-container target (no edge → no auto-scroll): the reorder is what moves.
    firePointer('pointermove', document, hx, ty)
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, hx, ty + 1)
    await nextFrame()
    await nextFrame()
    firePointer('pointerup', document, hx, ty + 1)

    await waitFor(() =>
      expect(rowSignatures(canvas).join('¦')).not.toBe(beforeScroll.join('¦')),
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

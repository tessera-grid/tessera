import React, { memo, useMemo, useState } from 'react'

import {
  ColumnDef,
  ExpandedState,
  GroupingState,
  Updater,
  functionalUpdate,
} from '@tanstack/react-table'
import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { expect, waitFor } from 'storybook/test'

import { Card, CardContent, Grid, NoDataStub } from './_shims'
import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../lib/plugins/rowActions'
import { useRowExpandingState } from '../../lib/core/createState'
import { useRowSelectionState } from '../../lib/core/createState'
import { useCreateTable } from '../../lib/core/useCreateTable'
import { CreateDataGridOptions } from '../../lib/core/useCreateTable'
import { DEFAULT_SKELETON_OPTIONS } from '../../lib/core/skeletonOptions'
import { DataGrid } from '../../lib/grid/DataGrid'
import { DataGridProps } from '../../lib/grid/dataGridTypes'
import { BatchToolbar } from './BatchToolbar'
import { Pagination } from './Pagination'
import { groupedColumns, useColumns } from './__mocks__/columns'
import { makeData, useData } from './__mocks__/data'
import { RowExpandingHooks } from '../../lib/plugins/rowExpanding'
import { RowSelectionHooks } from '../../lib/plugins/rowSelection'
import type { CellEditCommit } from '../../lib/plugins/cellEditing/types'
import type { CellComponentProps } from '../../lib/core/createSlots'
import { useAllRowsSelect } from './__mocks__/useAllRowsSelect'
import { FeatureToggles, argsToPlugins } from './__mocks__/utils/argsToPlugins'
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
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'

const COLUMN_COUNT = 20
const DATA_COUNT = 10
const PAGE_OFFSET = 5

export interface StoryProps extends CreateDataGridOptions, FeatureToggles {
  columnCount: number
  dataCount: number
  dataMode?: 'flat' | 'hierarchy' | 'groups'

  /**
   * Явный набор данных вместо генерируемого по dataMode/dataCount.
   * Используется группой Sizing/Data для параметризованных данных.
   */
  dataOverride?: any[]
  /**
   * Явный набор колонок вместо генерируемого `useColumns(columnCount)`. Даёт
   * тестам seam, чтобы подать колонки с известными `header`/`size` и сверяться с
   * ними, а не с литералами дефолтного мока.
   */
  columnsOverride?: ColumnDef<any, any>[]
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

  /**
   * Проброс hook закрепления столбца (`columnPinning.onTogglePin`) наружу.
   * Нужен визуальным тестам, чтобы наблюдать вызов hook при переключении пина.
   * В обычных историях не задаётся.
   */
  onTogglePin?: (pinned: boolean) => void

  /**
   * Проброс hook сортировки столбца (`columnSorting.onToggleColumnSort`) наружу.
   * Нужен визуальным тестам, чтобы наблюдать вызов hook при переключении сортировки.
   * В обычных историях не задаётся.
   */
  onToggleColumnSort?: (
    id: string,
    sortDirection: 'asc' | 'desc' | false,
  ) => void

  /**
   * Проброс hook изменения ширины столбца (`columnSizing.onColumnResizeEnd`)
   * наружу. Нужен визуальным тестам, чтобы наблюдать вызов hook по завершении
   * ресайза и сброса. В обычных историях не задаётся.
   */
  onColumnResizeEnd?: (props: { id: string; width: number }) => void

  /**
   * Проброс hooks выбора строк (`rowSelection.onSelectRow` /
   * `onSelectAllRowsOnPage`) наружу. Нужны визуальным тестам, чтобы наблюдать
   * вызов hook при переключении строки и «выбрать все на странице».
   * В обычных историях не задаются (дефолт — no-op).
   */
  onSelectRow?: RowSelectionHooks['onSelectRow']
  onSelectAllRowsOnPage?: RowSelectionHooks['onSelectAllRowsOnPage']

  /**
   * Проброс hook раскрытия строки (`rowExpanding.onExpandRow`) наружу. Нужен
   * визуальным тестам, чтобы наблюдать вызов hook при тоггле раскрытия.
   * В обычных историях не задаётся (дефолт — no-op).
   */
  onExpandRow?: RowExpandingHooks['onExpandRow']

  updateArgs: (
    args: Partial<
      Pick<StoryProps, 'isAllRowsSelected' | 'page' | 'recordsOnPage'>
    >,
  ) => void
}

const expandingInitialState = {}

// Демо cellEditing: показ кнопки разрешён только на этих колонках (требование
// «условие показа по контексту ячейки»). Коммит пишет значение в мок-данные —
// изменение видно сразу в ячейке.
const CELL_EDITABLE_COLUMNS = ['age', 'visits', 'gender']

// Детерминированное дерево для истории SubRow Selection (генератор, а не
// захардкоженные данные) — 4 родителя × 3 ребёнка, наглядный каскад выбора.
const subRowSelectionTree = makeData({
  shape: 'tree',
  count: 4,
  depth: 2,
  breadth: 3,
})

// Данные для истории Row Expanding (генератор, а не захардкоженные строки).
// Дерево из 3 уровней: корни (depth 0) и их дети (depth 1) — узлы `isGroup`, у
// внуков (depth 2) детей нет. Три уровня специально: при `maxExpandingDepth = 1`
// раскрывать можно только корни, а группы глубже (depth 1) тоггла не получают
// (RE8). Плюс несколько плоских листовых корней (без subRows) — раскрываемости у
// них нет, тоггла нет (RE7).
const rowExpandingData = [
  ...makeData({ shape: 'tree', count: 3, depth: 3, breadth: 2 }),
  ...makeData({ shape: 'flat', count: 2 }),
]

// Плоский детерминированный набор для истории Row Grouping — генератор
// (faker.seed), а не захардкоженные строки. Группировка по колонке с малым
// числом различных значений (gender) агрегирует их в несколько групп-строк.
const rowGroupingData = makeData({ shape: 'flat', count: 12 })

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
    columnsOverride,
    initialGrouping,
    initialExpanded,

    onTogglePin,
    onToggleColumnSort,
    onColumnResizeEnd,
    onSelectRow,
    onSelectAllRowsOnPage,
    onExpandRow,

    updateArgs,

    ...options
  }: StoryProps) => {
    const columnsWithCount = useColumns(columnCount)

    const columnsGetter = useMemo(() => {
      if (columnsOverride) {
        return columnsOverride
      }

      if (showHeaderGroups) {
        return groupedColumns
      }

      return columnsWithCount
    }, [columnsOverride, showHeaderGroups, columnsWithCount])

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
          ? {
              onGroupingChange: (updater: Updater<GroupingState>) =>
                setGrouping(prev => functionalUpdate(updater, prev ?? [])),
            }
          : {}),
      },
      // Ядровые (не плагинные) опции остаются флагами.
      enableSkeleton: options.enableSkeleton,
      skeletonOptions: options.skeletonOptions,
      enableLoading: options.enableLoading,
      enableFooter: options.enableFooter,
      // Фичи-плагины (включая rowActions) композируются из тумблеров через
      // настоящие фабрики. Бизнес-хуки демо — через hook-слайс пользовательской
      // записи, без верхнего параметра hooks.
      plugins: [
        ...argsToPlugins(options),
        {
          id: 'demoHooks',
          // Пустой slot — запись не несёт фич, только hook-слайс (сохраняет вывод
          // типа набора фич при слиянии слотов).
          features: {},
          hooks: {
            rowSelection: {
              onSelectRow: onSelectRow ?? ((): null => null),
              onSelectAllRowsOnPage:
                onSelectAllRowsOnPage ?? ((): null => null),
              isAllRowsSelected,
            },
            ...(onTogglePin ? { columnPinning: { onTogglePin } } : {}),
            ...(onToggleColumnSort
              ? { columnSorting: { onToggleColumnSort } }
              : {}),
            ...(onColumnResizeEnd
              ? { columnSizing: { onColumnResizeEnd } }
              : {}),
            ...(onExpandRow ? { rowExpanding: { onExpandRow } } : {}),
            ...(options.enableCellEditing
              ? {
                  cellEditing: {
                    canEdit: (ctx: CellComponentProps) =>
                      CELL_EDITABLE_COLUMNS.includes(ctx.column.id),
                    onCellEdit: ({ rowId, columnId, value }: CellEditCommit) =>
                      setData(prev =>
                        prev.map(row =>
                          row.id === rowId
                            ? { ...row, [columnId]: value }
                            : row,
                        ),
                      ),
                  },
                }
              : {}),
          },
        },
      ],
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
              table={table as never}
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
// reveal, cloud + fill, column width, auto-scroll D12–D14) each live as their
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

export const ColumnResizing: StoryObj<StoryProps> = {
  name: 'Column Resizing',
  args: {
    enableColumnResizing: true,
    // Несколько строк, чтобы требование синхронизации ширины шапки и тела
    // (CR8) имело отрисованные body-ячейки для сверки.
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnSorting: StoryObj<StoryProps> = {
  name: 'Column Sorting',
  args: {
    enableColumnSorting: true,
    // Sized to overflow vertically so the row-ordering requirements (CS12–CS13)
    // have enough rendered rows to prove the sort order against.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnSortingNotRemovable: StoryObj<StoryProps> = {
  name: 'Column Sorting (not removable)',
  args: {
    enableColumnSorting: true,
    enableSortingRemoval: false,
  },
}

export const ColumnMultiSorting: StoryObj<StoryProps> = {
  name: 'Column Multi Sorting',
  args: {
    enableColumnSorting: true,
    enableMultiSort: true,
    // Shift+клик по нескольким заголовкам добавляет столбцы к сортировке; у
    // каждого отсортированного столбца в шапке виден порядковый бейдж приоритета.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnDragging: StoryObj<StoryProps> = {
  name: 'Column Dragging',
  args: {
    enableColumnDragging: true,
    // Sized to overflow on both axes so the auto-scroll requirements (D26–D28)
    // have real horizontal scroll distance and a vertical axis to stay off.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnPinning: StoryObj<StoryProps> = {
  name: 'Column Pinning',
  args: {
    enableColumnPinning: true,
    // Sized to overflow on both axes so the sticky requirements (CP10–CP12)
    // have real horizontal scroll distance to prove the pinned offset against.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnPinningTwoSides: StoryObj<StoryProps> = {
  name: 'Column Pinning (two-sided)',
  args: {
    // Двустороннее закрепление в UI. Стороны задаёт
    // `columnDef.meta.pinSides` (см. mock `columns.tsx`): `country` — только
    // влево, `total` — только вправо (инлайн-тумблер без поповера), остальные —
    // обе стороны (инлайн даёт поповер «Закрепить слева / справа»). Колонка
    // действий (`enableRowActions`) авто-закреплена справа: пользовательский
    // right-pin встаёт левее неё (с подложкой и разделителем). По умолчанию у
    // колонки действий подложки нет; как только есть хотя бы один пользовательский
    // правый пин — она входит в правозакреплённый блок и получает ту же подложку.
    enableColumnPinning: true,
    enableRowActions: true,
    enableRowSelection: true,
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const HeaderActionMenu: StoryObj<StoryProps> = {
  name: 'Header Action Menu',
  args: {
    // Три действия в правом слоте (пин + сортировка + группировка) — дескрипторы;
    // достигают порога 3 → весь набор схлопывается в один кебаб (⋮), меню делится
    // на подгруппы. Свич `enableColumnResizing` включает управление шириной: его
    // resize-грип рисуется на кромке, но в порог схлопывания не входит
    // (`countsAsHeaderAction: false`), поэтому кебаб от него не «толстеет».
    enableHeaderActionMenu: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enableGrouping: true,
    enableColumnResizing: true,
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const RowActionMenu: StoryObj<StoryProps> = {
  name: 'Row Action Menu',
  args: {
    // Демо-производитель даёт три действия строки (Edit / Duplicate / Delete) как
    // дескрипторы. Свич `enableRowActionMenu` (порог 2) схлопывает их в overflow-
    // кебаб (⋮) в колонке действий; выключенным — три row-кнопки инлайн (ревил по
    // hover строки). Колонка действий появляется по `enableRowActions`.
    enableRowActions: true,
    enableRowActionMenu: true,
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
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

export const HeaderGroupsPinning: StoryObj<StoryProps> = {
  name: 'Header Groups Pinning',
  args: {
    // Вложенная шапка + пиннинг: закрепляется только группа верхнего уровня
    // целиком. Узкий вьюпорт по горизонтали, чтобы sticky-закрепление
    // было видно при прокрутке.
    showHeaderGroups: true,
    enableColumnPinning: true,
    dataCount: 40,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'page', 'recordsOnPage'],
    },
  },
}

export const HeaderGroupsLeafPinning: StoryObj<StoryProps> = {
  name: 'Header Groups Leaf Pinning',
  args: {
    // Reorder-out: под вложенной шапкой можно пиннить любую единицу —
    // лист или группу любого уровня; при закреплении листья цели вырываются к
    // левому краю, а спанящие шапки родителей режутся на сегменты.
    showHeaderGroups: true,
    enableColumnPinning: true,
    enableLeafPinning: true,
    dataCount: 40,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
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
    // Небольшой набор, целиком помещающийся в вьюпорт: требования «выбрать все
    // на странице» (RS8–RS10, RS12) сверяются со всеми отрисованными строками,
    // поэтому вертикальная виртуализация не должна прятать часть строк.
    dataCount: 10,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
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

export const RowExpanding: StoryObj<StoryProps> = {
  name: 'Row Expanding',
  args: {
    // Реальные данные из генератора (см. rowExpandingData) — раскрытие видно на
    // настоящих subRows, а не на захардкоженных строках.
    dataOverride: rowExpandingData,
    enableRowExpanding: true,
    // Стартуем свёрнутыми: тесты сами раскрывают строки и сверяют появление
    // детей и контракт data-expanded / aria-expanded.
    initialExpanded: {},

    containerHeight: 640,
    height: 540,
    maxHeight: 540,
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

export const RowGrouping: StoryObj<StoryProps> = {
  name: 'Row Grouping',
  args: {
    // Реальные данные из генератора (см. rowGroupingData) — группировка видна на
    // настоящих строках, а не на захардкоженных.
    dataOverride: rowGroupingData,
    enableGrouping: true,
    // Немного колонок, целиком в горизонтальном вьюпорте: тесты адресуют шапку
    // groupable-колонки (gender) — она не должна прятаться за виртуализацией.
    columnCount: 6,

    containerHeight: 560,
    height: 460,
    maxHeight: 460,
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
      ],
    },
  },
}

export const RowDragging: StoryObj<StoryProps> = {
  name: 'Row Dragging',
  args: {
    enableRowDragging: true,
    // Sized to overflow on both axes so the play's auto-scroll steps (D12–D14)
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

export const CellEditing: StoryObj<StoryProps> = {
  name: 'Cell Editing',
  args: {
    enableCellEditing: true,
    // Немного колонок/строк без виртуализации: кнопка редактирования появляется в
    // правом слоте по hover, а редактируемость гейтит канредактируемые колонки
    // (age/visits/gender — CELL_EDITABLE_COLUMNS). Коммит по Enter пишет значение
    // в мок-данные и сразу виден в ячейке.
    columnCount: 6,
    dataCount: 10,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
  parameters: {
    controls: {
      exclude: [
        'columnCount',
        'dataCount',
        'page',
        'recordsOnPage',
        'dataMode',
      ],
    },
  },
}

export const CellSelection: StoryObj<StoryProps> = {
  name: 'Cell Selection',
  args: {
    enableCellSelection: true,
    // Умеренный грид (обе оси в окне): клик выделяет ячейку, shift-клик/drag —
    // прямоугольный диапазон, ctrl/cmd-клик — мульти-диапазон, Ctrl/Cmd+C копирует
    // выделение в буфер (TSV + HTML). См. ADR 0029.
    columnCount: 8,
    dataCount: 40,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
  parameters: {
    controls: {
      exclude: ['page', 'recordsOnPage', 'dataMode'],
    },
  },
}

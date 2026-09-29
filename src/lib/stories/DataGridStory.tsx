// Демо-компонент историй DataGrid: собирает таблицу из аргументов Storybook.
import { memo, useMemo, useState } from 'react'
import { GroupingState, Updater, functionalUpdate } from '@tanstack/react-table'
import { Card, CardContent, Grid, NoDataStub } from './_shims'
import { useExpandedState } from '../../lib/core/createState'
import { useRowSelectionState } from '../../lib/core/createState'
import { useCreateTable } from '../../lib/core/useCreateTable'
import { DataGrid } from '../../lib/grid/DataGrid'
import { BatchToolbar } from './BatchToolbar'
import { Pagination } from './Pagination'
import { groupedColumns, useColumns } from './__mocks__/columns'
import { useData } from './__mocks__/data'
import type { CellEditCommit } from '../../lib/plugins/cellEditing/types'
import type { CellComponentProps } from '../../lib/core/createSlots'
import { useAllRowsSelect } from './__mocks__/useAllRowsSelect'
import { argsToPlugins } from './__mocks__/utils/argsToPlugins'
import { usePagination } from './__mocks__/usePagination'
import type { StoryProps } from './DataGridStory.types'

const expandingInitialState = {}

// Демо cellEditing: показ кнопки разрешён только на этих колонках (требование
// «условие показа по контексту ячейки»). Коммит пишет значение в мок-данные —
// изменение видно сразу в ячейке.
const CELL_EDITABLE_COLUMNS = ['age', 'visits', 'gender']

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
    validateCellEdit,

    showBatchToolbar,
    isAllRowsSelected,

    page,
    recordsOnPage,

    dataOverride,
    columnsOverride,
    initialGrouping,
    initialExpanded,
    extraPlugins,

    onTogglePin,
    onToggleColumnSort,
    onColumnResizeEnd,
    onColumnDragEnd,
    onSelectRow,
    onSelectAllRowsOnPage,
    onExpandRow,
    onToggleColumnVisibility,
    onPageChange,

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

    const { expanded, onExpandedChange } = useExpandedState(
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
        expanded,
        rowSelection,
        ...(grouping !== undefined ? { grouping } : {}),
      },
      handlers: {
        onExpandedChange,
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
      enableToolbar: options.enableToolbar,
      enableAnnouncements: options.enableAnnouncements,
      // Фичи-плагины (включая rowActions) композируются из тумблеров через
      // настоящие фабрики. Бизнес-хуки демо — через hook-слайс пользовательской
      // записи, без верхнего параметра hooks.
      plugins: [
        ...argsToPlugins(options),
        ...(extraPlugins ?? []),
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
            ...(onColumnDragEnd ? { columnDragging: { onColumnDragEnd } } : {}),
            ...(onExpandRow ? { rowExpanding: { onExpandRow } } : {}),
            ...(onToggleColumnVisibility
              ? { columnVisibility: { onToggleColumnVisibility } }
              : {}),
            ...(onPageChange ? { pagination: { onPageChange } } : {}),
            ...(options.enableCellEditing
              ? {
                  cellEditing: {
                    canEdit: (ctx: CellComponentProps) =>
                      CELL_EDITABLE_COLUMNS.includes(ctx.column.id),
                    validate: validateCellEdit,
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

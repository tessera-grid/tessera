// Демо-компонент историй DataGrid: собирает таблицу из аргументов Storybook.
import { memo, useCallback, useMemo, useState } from 'react'
import { GroupingState, Updater, functionalUpdate } from '@tanstack/react-table'
import { Grid, NoDataStub } from './_shims'
import { loadingArg, panelFlag } from './__mocks__/utils/dataGridControls'
import { useExpandedState } from '../../lib/core/createState'
import { useRowSelectionState } from '../../lib/core/createState'
import type { TesseraFeatureEntry } from '../../lib/core/features'
import { argsKeyOf } from '../../lib/core/pluginArgs'
import { useCreateTable } from '../../lib/core/useCreateTable'
import { DataGrid } from '../../lib/grid/DataGrid'
import { BatchToolbar } from './BatchToolbar'
import { groupedColumns, useColumns } from './__mocks__/columns'
import { useData } from './__mocks__/data'
import type { CellEditCommit } from '../../lib/plugins/cellEditing/types'
import type { CellComponentProps } from '../../lib/core/createSlots'
import { useAllRowsSelect } from './__mocks__/useAllRowsSelect'
import { RU_LABELS } from './__mocks__/localization.ru'
import { argsToPlugins } from './__mocks__/utils/argsToPlugins'
import type { StoryProps } from './DataGridStory.types'

const expandingInitialState = {}

// Демо cellEditing: показ кнопки разрешён только на этих колонках (требование
// «условие показа по контексту ячейки»). Коммит пишет значение в мок-данные —
// изменение видно сразу в ячейке.
const CELL_EDITABLE_COLUMNS = ['age', 'visits', 'gender']

/**
 * Аргументы-договоры на время жизни (`server`, ADR 0039) таблица берёт при монтировании:
 * смена такого аргумента из Controls пересоздаёт грид, как велит договор.
 */
const lifetimeKeyOf = (entries: readonly TesseraFeatureEntry[]) =>
  entries
    .flatMap(entry =>
      (entry.lifetimeArgs ?? []).map(
        key =>
          `${entry.id}.${key}=${argsKeyOf((entry.args as Record<string, unknown> | undefined)?.[key])}`,
      ),
    )
    .join('|')

const StoryGrid = memo(
  ({
    columnCount,
    dataCount,
    dataNesting,

    containerHeight,
    containerWidth,
    height,
    maxHeight,
    colorMode,
    contrast,
    localization,
    locale,
    icons,
    errorStub,

    showStub,
    headerNesting,
    validateCellEdit,

    showBatchToolbar,
    isAllRowsSelected,

    dataOverride,
    columnsOverride,
    initialGrouping,
    initialExpanded,
    extraPlugins,

    onTogglePin,
    onToggleColumnSort,
    onSelectRow,
    onSelectAllRowsOnPage,
    onExpandRow,
    onToggleColumnVisibility,
    onPageChange,

    updateArgs,

    ...options
  }: StoryProps) => {
    const columnsWithCount = useColumns(columnCount)
    const labels = useMemo(
      () =>
        locale === 'ru' ? { ...RU_LABELS, ...localization } : localization,
      [locale, localization],
    )

    const columnsGetter = useMemo(() => {
      if (columnsOverride) {
        return columnsOverride
      }

      if (headerNesting === 'nested') {
        return groupedColumns
      }

      return columnsWithCount
    }, [columnsOverride, headerNesting, columnsWithCount])

    const { data: mockData, setData: setMockData } = useData({
      count: dataCount,
      nesting: dataNesting,
      showStub,
      skip: dataOverride !== undefined,
    })

    // Явно переданный набор имеет приоритет над генерируемым. Перестановки и правки
    // пишутся в его локальную копию; новый `dataOverride` (ответ «сервера») её сбрасывает.
    const [edited, setEdited] = useState<{ source: any[]; data: any[] }>()
    const data = dataOverride
      ? edited?.source === dataOverride
        ? edited.data
        : dataOverride
      : mockData
    const setData = useCallback(
      (updater: Updater<any[]>) => {
        if (!dataOverride) {
          setMockData(updater)
          return
        }
        setEdited(prev => ({
          source: dataOverride,
          data: functionalUpdate(
            updater,
            prev?.source === dataOverride ? prev.data : dataOverride,
          ),
        }))
      },
      [dataOverride, setMockData],
    )

    // Grouping контролируется только когда задан initialGrouping — иначе
    // поведение остальных историй не меняется (uncontrolled).
    const [grouping, setGrouping] = useState<string[] | undefined>(
      initialGrouping,
    )

    const { expanded, onExpandedChange } = useExpandedState(
      initialExpanded ?? expandingInitialState,
    )

    const { rowSelection, onRowSelectionChange } = useRowSelectionState()
    const { getSelectedData, selectedDataCount } = useAllRowsSelect({
      data,
      rowSelection,
    })

    const table = useCreateTable({
      columns: columnsGetter,
      data,
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
      loading: loadingArg(options.loading),
      skeletonOptions: options.skeletonOptions,
      refreshOptions: options.refreshOptions,
      loadError: options.loadError,
      onRetry: options.onRetry,
      enableFooter: options.enableFooter,
      enableToolbar: panelFlag(options.enableToolbar),
      enableStatusBar: panelFlag(options.enableStatusBar),
      enableAnnouncements: options.enableAnnouncements,
      enableOverflowTooltip: options.enableOverflowTooltip,
      enableRowAnimation: options.enableRowAnimation,
      rowHeight: options.rowHeight,
      headerHeight: options.headerHeight,
      defaultColumn: options.defaultColumn,
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
            ...(onExpandRow ? { rowExpanding: { onExpandRow } } : {}),
            ...(onToggleColumnVisibility
              ? { columnVisibility: { onToggleColumnVisibility } }
              : {}),
            ...(onPageChange ? { pagination: { onPageChange } } : {}),
            // Предикат аргументом плагина (тесты) — без демо-хуков: слайс хуков
            // записи заменил бы слайс плагина целиком.
            ...(options.enableCellEditing && !options.cellEditingCanEditCell
              ? {
                  cellEditing: {
                    canEditCell: (ctx: CellComponentProps) =>
                      CELL_EDITABLE_COLUMNS.includes(ctx.column.id),
                    validate: validateCellEdit,
                    onEditCancel: options.onEditCancel,
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

    const column = {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    } as const
    const body = (
      <>
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
          contrast={contrast}
          localization={labels}
          icons={icons}
          stub={<NoDataStub label="No Data!" />}
          errorStub={errorStub}
        />
      </>
    )

    return (
      <Grid
        style={{
          padding: 16,
          height: containerHeight,
          ...(containerWidth !== undefined && {
            width: containerWidth,
            boxSizing: 'border-box',
          }),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={column}>{body}</div>
      </Grid>
    )
  },
)

export const StoryComponent = memo((props: StoryProps) => (
  <StoryGrid
    key={lifetimeKeyOf([
      ...argsToPlugins(props),
      ...(props.extraPlugins ?? []),
    ])}
    {...props}
  />
))

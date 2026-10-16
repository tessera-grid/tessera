// Демо-компонент историй DataGrid: собирает таблицу из аргументов Storybook.
import { memo, useCallback, useMemo, useState } from 'react'
import {
  type ColumnPinningState,
  GroupingState,
  Updater,
  functionalUpdate,
} from '@tanstack/react-table'
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
import {
  argsToPlugins,
  type FeatureToggles,
} from './__mocks__/utils/argsToPlugins'
import type { StoryProps } from './DataGridStory.types'
import { sizeArg } from './__mocks__/utils/normalizeArgs'

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
    initialColumnPinning,
    pinFirstColumn,
    initialExpanded,
    expandAll,
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

    // Первая колонка данных; под вложенной шапкой — её первый лист.
    const firstColumnId = useMemo(() => {
      let column = columnsGetter[0] as
        { id?: string; accessorKey?: string; columns?: unknown[] } | undefined
      while (column?.columns?.length) {
        column = column.columns[0] as typeof column
      }
      return column?.id ?? column?.accessorKey
    }, [columnsGetter])
    const pinnedFirst = (
      prev: ColumnPinningState | undefined,
      pin: boolean,
    ): ColumnPinningState => {
      const start = (prev?.start ?? []).filter(id => id !== firstColumnId)
      return {
        start: pin && firstColumnId ? [firstColumnId, ...start] : start,
        end: prev?.end ?? [],
      }
    }
    const controlsPinning =
      initialColumnPinning !== undefined || pinFirstColumn !== undefined
    const [columnPinning, setColumnPinning] = useState<
      ColumnPinningState | undefined
    >(() =>
      pinFirstColumn
        ? pinnedFirst(initialColumnPinning, true)
        : initialColumnPinning,
    )
    // `pinFirstColumn` из панели закрепляет и открепляет колонку на лету.
    const [appliedPinFirst, setAppliedPinFirst] = useState(pinFirstColumn)
    if (appliedPinFirst !== pinFirstColumn) {
      setAppliedPinFirst(pinFirstColumn)
      setColumnPinning(prev => pinnedFirst(prev, !!pinFirstColumn))
    }

    const { expanded, onExpandedChange } = useExpandedState(
      expandAll ? true : (initialExpanded ?? expandingInitialState),
    )
    // `expandAll` из панели раскрывает или сворачивает всё на лету (SN10).
    const [appliedExpandAll, setAppliedExpandAll] = useState(expandAll)
    if (appliedExpandAll !== expandAll) {
      setAppliedExpandAll(expandAll)
      if (expandAll !== undefined) onExpandedChange(expandAll ? true : {})
    }

    const { rowSelection, onRowSelectionChange } = useRowSelectionState()
    const { getSelectedData, selectedDataCount } = useAllRowsSelect({
      data,
      rowSelection,
    })

    // Срезы плагинов — аргументами их фабрик (ADR 0120, §4): по умолчанию — состояние
    // истории, заданные историей аргументы главнее.
    const sliceArgs: FeatureToggles = {
      rowExpandingExpanded: expanded,
      rowExpandingModelExpanded: expanded,
      onExpandedChange,
      rowSelectionRowSelection: rowSelection,
      rowSelectionModelRowSelection: rowSelection,
      onRowSelectionChange,
      onRowOrderChange: setData,
      ...(grouping !== undefined
        ? { rowGroupingGrouping: grouping, rowGroupingModelGrouping: grouping }
        : {}),
      ...(initialGrouping !== undefined
        ? {
            onGroupingChange: (next: Updater<GroupingState>) =>
              setGrouping(prev => functionalUpdate(next, prev ?? [])),
          }
        : {}),
    }
    const pluginArgs = {
      ...sliceArgs,
      ...Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined),
      ),
    } as FeatureToggles

    const table = useCreateTable({
      columns: columnsGetter,
      data,
      state: {
        ...(columnPinning !== undefined ? { columnPinning } : {}),
      },
      handlers: {
        ...(controlsPinning
          ? {
              onColumnPinningChange: (updater: Updater<ColumnPinningState>) =>
                setColumnPinning(prev =>
                  functionalUpdate(updater, prev ?? { start: [], end: [] }),
                ),
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
      footerPosition: options.footerPosition,
      enableToolbar: panelFlag(options.enableToolbar),
      enableStatusBar: panelFlag(options.enableStatusBar),
      enableAnnouncements: options.enableAnnouncements,
      enableOverflowTooltip: options.enableOverflowTooltip,
      enableRowAnimation: options.enableRowAnimation,
      enableColumnAnimation: options.enableColumnAnimation,
      rowHeight: options.rowHeight,
      headerHeight: options.headerHeight,
      defaultColumn: options.defaultColumn,
      // Фичи-плагины (включая rowActions) композируются из тумблеров через
      // настоящие фабрики. Бизнес-хуки демо — через hook-слайс пользовательской
      // записи, без верхнего параметра hooks.
      plugins: [
        ...argsToPlugins(pluginArgs),
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
          height={sizeArg(height)}
          maxHeight={sizeArg(maxHeight)}
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
          height: sizeArg(containerHeight),
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

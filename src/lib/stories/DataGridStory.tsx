// Демо-компонент историй DataGrid: собирает таблицу из аргументов Storybook.
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  type ColumnPinningState,
  type ExpandedState,
  GroupingState,
  Updater,
  functionalUpdate,
} from '@tanstack/react-table'
import { Grid } from './_shims'
import { loadingArg, panelFlag } from './__mocks__/utils/dataGridControls'
import type { RowSelectionValue } from '../../lib/core/rowSelectionAll'
import type { TesseraFeatureEntry } from '../../lib/core/features'
import { dataModeKeyOf } from '../../lib/core/dataMode'
import { argsKeyOf } from '../../lib/core/pluginArgs'
import type { CoreOptions } from '../../lib/core/commonFeature.types'
import type { DebugAction } from '../../lib/core/debugActions'
import { useCreateTable } from '../../lib/core/useCreateTable'
import { isThenable } from '../util/thenable'
import { useLatest } from '../util/useLatest'
import { DataGrid } from '../../lib/grid/DataGrid'
import { DATA_GRID_THEME_CLASS } from '../ui/theme'
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
import { ConsoleContext } from './demos/consoleContext'
import { loggedCallback, loggedCallbacks } from './demos/consoleLog'
import { useTableConsole } from './demos/useTableConsole'

const expandingInitialState = {}

/** «Сервер» отвечает на повтор загрузки за это время, мс (ADR 0096). */
const RETRY_ANSWER_MS = 800

// Демо cellEditing: показ кнопки разрешён только на этих колонках (требование
// «условие показа по контексту ячейки»). Коммит пишет значение в мок-данные —
// изменение видно сразу в ячейке.
const CELL_EDITABLE_COLUMNS = ['age', 'visits', 'gender']

/** Демо ошибок ячеек (ADR 0150): визитов больше 15 — ошибка данных. */
const demoCellError = (ctx: CellComponentProps) =>
  ctx.column.id === 'visits' && Number(ctx.getValue()) > 15
    ? 'More than 15 visits'
    : undefined

/**
 * Аргументы-договоры на время жизни (ADR 0039) и `dataMode` (ADR 0169) таблица берёт при
 * монтировании: смена такого аргумента из Controls пересоздаёт грид, как велит договор.
 */
const lifetimeKeyOf = (entries: readonly TesseraFeatureEntry[]) =>
  entries
    // Модель, которую несёт интерфейс, держит свои договоры (ADR 0120).
    .flatMap(entry => (entry.model ? [entry, entry.model] : [entry]))
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
    containerFrame,
    appPanelHeight,
    gridClassName,
    containerWidth,
    height,
    maxHeight,
    colorMode,
    contrast,
    localization,
    locale,
    icons,
    stubs,

    showStub,
    headerNesting,
    validateCellEdit,
    editableColumns = CELL_EDITABLE_COLUMNS,

    showBatchToolbar,
    isAllRowsSelected,

    dataOverride,
    columnsOverride,
    initialGrouping,
    initialColumnPinning,
    pinFirstColumn,
    hideAllColumns,
    retrySucceeds,
    initialExpanded,
    expandAll,
    extraPlugins,
    consoleLog,

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

    // «Сервер» отвечает на повтор (ADR 0096): загрузка, затем ошибка снята; при первой
    // загрузке — строки мока вместо пустого ответа. Новая ошибка сбрасывает повтор.
    const [retry, setRetry] = useState<'idle' | 'loading' | 'done'>('idle')
    const [retryFor, setRetryFor] = useState(options.loadError)
    if (retryFor !== options.loadError) {
      setRetryFor(options.loadError)
      setRetry('idle')
    }
    useEffect(() => {
      if (retry !== 'loading') return
      const timer = setTimeout(() => setRetry('done'), RETRY_ANSWER_MS)
      return () => clearTimeout(timer)
    }, [retry])
    const firstLoad = dataOverride?.length === 0
    const answered = retry === 'done' && firstLoad ? undefined : dataOverride
    const onRetry = options.onRetry
    const retryHandler = useMemo(() => {
      if (!onRetry) return undefined
      const logged = consoleLog
        ? loggedCallback(consoleLog, 'onRetry', onRetry)
        : onRetry
      return retrySucceeds
        ? () => {
            logged()
            setRetry('loading')
          }
        : logged
    }, [onRetry, consoleLog, retrySucceeds])
    const { data: mockData, setData: setMockData } = useData({
      count: dataCount,
      nesting: dataNesting,
      showStub,
      skip: answered !== undefined,
    })

    // Явно переданный набор имеет приоритет над генерируемым. Перестановки и правки
    // пишутся в его локальную копию; новый `dataOverride` (ответ «сервера») её сбрасывает.
    const [edited, setEdited] = useState<{ source: any[]; data: any[] }>()
    const data = answered
      ? edited?.source === answered
        ? edited.data
        : answered
      : mockData
    const setData = useCallback(
      (updater: Updater<any[]>) => {
        if (!answered) {
          setMockData(updater)
          return
        }
        setEdited(prev => ({
          source: answered,
          data: functionalUpdate(
            updater,
            prev?.source === answered ? prev.data : answered,
          ),
        }))
      },
      [answered, setMockData],
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

    // Приложение скрыло все колонки своим состоянием (ADR 0123, S2); «Show all» его меняет.
    const controlsVisibility = hideAllColumns !== undefined
    const [columnVisibility, setColumnVisibility] = useState<
      Record<string, boolean>
    >({})
    const [appliedHideAll, setAppliedHideAll] = useState<boolean>()
    if (appliedHideAll !== hideAllColumns) {
      setAppliedHideAll(hideAllColumns)
      setColumnVisibility(hideAllColumns ? hiddenAll(columnsGetter) : {})
    }

    // Начальное раскрытие из аргументов: смена аргумента задаёт срез заново.
    const initialExpandedState: ExpandedState = expandAll
      ? true
      : (initialExpanded ?? expandingInitialState)
    const [expanded, onExpandedChange] =
      useState<ExpandedState>(initialExpandedState)
    const [appliedInitialExpanded, setAppliedInitialExpanded] =
      useState(initialExpandedState)
    if (appliedInitialExpanded !== initialExpandedState) {
      setAppliedInitialExpanded(initialExpandedState)
      onExpandedChange(initialExpandedState)
    }
    // `expandAll` из панели раскрывает или сворачивает всё на лету (SN10).
    const [appliedExpandAll, setAppliedExpandAll] = useState(expandAll)
    if (appliedExpandAll !== expandAll) {
      setAppliedExpandAll(expandAll)
      if (expandAll !== undefined) onExpandedChange(expandAll ? true : {})
    }

    const [rowSelection, onRowSelectionChange] = useState<RowSelectionValue>({})
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
    // Бизнес-колбэки демо — аргументами фабрик (ADR 0027): слайс хуков плагина остаётся его,
    // заданные историей аргументы главнее. В консоли истории — под своими именами.
    const demo = loggedCallbacks(consoleLog, {
      onSelectRow: onSelectRow ?? ((): null => null),
      onSelectAllRowsOnPage: onSelectAllRowsOnPage ?? ((): null => null),
      onTogglePin,
      onToggleColumnSort,
      onExpandRow,
      onToggleColumnVisibility,
      onPageChange,
    })
    // Предикат правки аргументом истории (тесты) — без демо правки.
    const editingDemo =
      options.enableCellEditing && !options.cellEditingCanEditCell
    // Функция ошибок аргументом истории (тесты) — без демо ошибок.
    const errorsDemo =
      options.enableCellErrors && !options.cellErrorsGetCellError
    const demoArgs = {
      rowSelectionOnSelectRow: demo.onSelectRow,
      rowSelectionOnSelectAllRowsOnPage: demo.onSelectAllRowsOnPage,
      rowSelectionIsAllRowsSelected: isAllRowsSelected,
      columnPinningOnTogglePin: demo.onTogglePin,
      columnSortingOnToggleColumnSort: demo.onToggleColumnSort,
      rowExpandingOnExpandRow: demo.onExpandRow,
      columnVisibilityOnToggleColumnVisibility: demo.onToggleColumnVisibility,
      paginationOnPageChange: demo.onPageChange,
      ...(editingDemo
        ? {
            cellEditingCanEditCell: (ctx: CellComponentProps) =>
              editableColumns.includes(ctx.column.id),
            // Проверка историй — по набранному тексту.
            cellEditingValidate:
              validateCellEdit &&
              ((_value: unknown, _ctx: CellComponentProps, text: string) =>
                validateCellEdit(text)),
          }
        : {}),
      ...(errorsDemo ? { cellErrorsGetCellError: demoCellError } : {}),
    }
    // Сохранение истории — промисом: значение пишется в данные после ответа. Ответ
    // приложения — сохранённая строка (ADR 0139) — проходит насквозь.
    const demoCellEdit = (commit: CellEditCommit) => {
      const { rowId, columnId, value } = commit
      const write = () =>
        setData(prev =>
          prev.map(row =>
            row.id === rowId ? { ...row, [columnId]: value } : row,
          ),
        )
      const saved = options.onCellEdit?.(commit)
      if (!isThenable(saved)) {
        write()
        return saved
      }
      return saved.then(answer => {
        write()
        return answer
      })
    }
    // Колбэки, переданные гриду, — с записью в консоль истории (ADR 0124, CL2).
    const pluginArgs = {
      ...loggedCallbacks(consoleLog, {
        ...sliceArgs,
        ...demoArgs,
        ...Object.fromEntries(
          Object.entries(options).filter(([, value]) => value !== undefined),
        ),
        ...(editingDemo ? { onCellEdit: demoCellEdit } : {}),
      }),
    } as FeatureToggles
    const storyPlugins = [...argsToPlugins(pluginArgs), ...(extraPlugins ?? [])]

    // Канал действий грида — в консоль истории (ADR 0125, ADR 0124 CL15).
    // Слушатель истории или теста (`onDebugAction` аргументом) — рядом с консолью.
    const listener = useLatest(options.onDebugAction)
    const hasListener = !!options.onDebugAction
    const onDebugAction = useMemo(
      () =>
        consoleLog || hasListener
          ? (event: DebugAction) => {
              consoleLog?.action({
                plugin: event.plugin,
                action: event.action,
                detail: event.detail,
                source: event.source,
                phase: event.phase,
                id: event.id,
                cause: event.cause,
              })
              listener.current?.(event)
            }
          : undefined,
      [consoleLog, hasListener, listener],
    )

    const table = useCreateTable({
      columns: columnsGetter,
      data,
      state: {
        ...(columnPinning !== undefined ? { columnPinning } : {}),
        ...(controlsVisibility ? { columnVisibility } : {}),
      },
      handlers: {
        ...(controlsVisibility
          ? {
              onColumnVisibilityChange: (
                updater: Updater<Record<string, boolean>>,
              ) => setColumnVisibility(prev => functionalUpdate(updater, prev)),
            }
          : {}),
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
      dataMode: options.dataMode,
      rowCount: options.rowCount,
      totalRowCount: options.totalRowCount,
      locale: locale === 'ru' ? 'ru-RU' : undefined,
      timeZone: options.timeZone,
      dataTypes: options.dataTypes,
      loading:
        retry === 'loading'
          ? firstLoad
            ? 'initial'
            : 'refresh'
          : loadingArg(options.loading),
      skeletonOptions: options.skeletonOptions,
      refreshOptions: options.refreshOptions,
      loadError: retry === 'idle' ? options.loadError : undefined,
      onDebugAction,
      onRetry: retryHandler,
      enableFooter: options.enableFooter,
      footerPosition: options.footerPosition,
      enableToolbar: panelFlag(options.enableToolbar),
      enableStatusBar: panelFlag(options.enableStatusBar),
      enableAnnouncements: options.enableAnnouncements,
      enableKeyboardNavigation: options.enableKeyboardNavigation,
      onActiveCellChange: (pluginArgs as CoreOptions).onActiveCellChange,
      enableOverflowTooltip: options.enableOverflowTooltip,
      enableRowAnimation: options.enableRowAnimation,
      enableColumnAnimation: options.enableColumnAnimation,
      rowHeight: options.rowHeight,
      headerHeight: options.headerHeight,
      defaultColumn: options.defaultColumn,
      // Фичи-плагины (включая rowActions) композируются из тумблеров через
      // настоящие фабрики. Бизнес-хуки демо — через hook-слайс пользовательской
      // записи, без верхнего параметра hooks.
      plugins: storyPlugins,
    })

    useTableConsole(consoleLog, table, {
      data,
      columnDefs: columnsGetter,
      loading: loadingArg(options.loading),
      plugins: storyPlugins
        .filter(entry => entry.enabled !== false)
        .map(entry => entry.id),
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
        {appPanelHeight !== undefined && (
          <div
            data-testid="app-panel"
            style={{
              flex: 'none',
              height: appPanelHeight,
              marginBottom: 8,
              boxSizing: 'border-box',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--muted)',
              color: 'var(--foreground)',
              fontSize: 13,
            }}
          >
            Панель приложения · {appPanelHeight}px
          </div>
        )}
        <DataGrid
          className={gridClassName}
          table={table as never}
          height={sizeArg(height)}
          maxHeight={sizeArg(maxHeight)}
          colorMode={colorMode}
          contrast={contrast}
          localization={labels}
          icons={icons}
          stubs={stubs}
        />
      </>
    )

    const container = sizeArg(containerHeight)
    return (
      <>
        {containerFrame && (
          <div
            className={DATA_GRID_THEME_CLASS}
            data-testid="app-container-label"
            style={{
              padding: '12px 16px 0',
              color: 'var(--muted-foreground)',
              fontSize: 12,
            }}
          >
            Контейнер приложения ·{' '}
            {typeof container === 'number'
              ? `${container}px`
              : (container ?? 'без высоты')}
          </div>
        )}
        <Grid
          style={{
            padding: 16,
            // В рамке высота — у самого контейнера, без отступов истории.
            height: containerFrame ? undefined : container,
            ...(containerWidth !== undefined && {
              width: containerWidth,
              boxSizing: 'border-box',
            }),
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            data-testid={containerFrame ? 'app-container' : undefined}
            style={{
              ...column,
              ...(containerFrame && {
                height: container,
                outline: '1px dashed var(--muted-foreground)',
                outlineOffset: 4,
              }),
            }}
          >
            {body}
          </div>
        </Grid>
      </>
    )
  },
)

/** Все листовые колонки скрыты: видимость, которую задало бы приложение. */
const hiddenAll = (columns: readonly any[]): Record<string, boolean> =>
  Object.fromEntries(
    columns.flatMap(function leaves(column: any): [string, boolean][] {
      return column.columns
        ? column.columns.flatMap(leaves)
        : [[column.id ?? column.accessorKey, false]]
    }),
  )

export const StoryComponent = memo((props: StoryProps) => {
  const contextLog = useContext(ConsoleContext)
  const consoleLog = props.consoleLog ?? contextLog
  return (
    <StoryGrid
      key={`${dataModeKeyOf(props.dataMode)}|${lifetimeKeyOf([
        ...argsToPlugins(props),
        ...(props.extraPlugins ?? []),
      ])}`}
      {...props}
      consoleLog={consoleLog}
      // Под консолью область — по высоте таблицы: консоль сразу за рамкой (ADR 0124);
      // рамка контейнера держит его высоту (ADR 0131).
      containerHeight={
        consoleLog && !props.containerFrame ? 'auto' : props.containerHeight
      }
    />
  )
})

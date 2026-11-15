/**
 * Ядро сборки таблицы. Presence-based композиция: фичи/сервисные
 * колонки/опции выводятся из набора plugins.
 *  - row-модели не передаются опциями — ядровая включается автоматически, остальные
 *    приходят слотами записей;
 *  - hooks/slots/… — опции always-on commonFeature;
 *  - бо́льшую часть срезов держат фичи (uncontrolled); ядро контролирует только
 *    columnPinning (пиннинг сервисных колонок) и columnSizing (авто-слайс), остальное
 *    прокидывается из state/handlers потребителя.
 */
import { useMemo, useState } from 'react'

import { makeStateUpdater, useTable } from '@tanstack/react-table'
import type {
  ReactTable,
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
} from '@tanstack/react-table'

import type { ColumnDef, RowData, TableOptions } from '../types'
import type { CoreOptions } from './commonFeature.types'
import { defaultGetSubRows } from './rowTransactions'
import { dataModeKeyOf, manualOptionsOf, stockRowCountOf } from './dataMode'
import { type DefaultColumnSizing, resolveDefaultColumn } from './defaultColumn'
import { resolveHooks } from './createHooks'
import { injectServiceColumns, orderServiceColumns } from './createColumns'
import {
  buildTesseraFeatures,
  foldEntries,
  foldHooks,
  type TablePlugin,
  type TesseraFeatureEntry,
  type TesseraFeatures,
} from './features'
import {
  useControlledPinning,
  useControlledSizing,
} from './useControlledLayout'
import {
  createPluginArgsStore,
  lifetimeArgViolations,
  pluginArgsSignature,
  rememberPluginArgs,
  resolvePluginEntries,
} from './pluginArgs'
import {
  createPluginSetStore,
  pluginSetSignature,
  rememberPluginSet,
  resolvePluginSet,
} from './pluginSet'
import {
  createSliceStore,
  handlerOf,
  type SliceInput,
  type SliceTable,
  useEffectiveSlices,
  useNarrowContext,
} from './effectiveState'
import {
  type CoreTableHandlers,
  type CoreTableState,
  splitCoreState,
} from './coreState'
import {
  expandIncludedModels,
  pluginSlicesOf,
  withSliceNarrows,
} from './pluginModels'
import { useTableEffects } from './useTableEffects'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'
import { keyboardNavigationEntry } from './keyboardNavigation/entry'
import { draftsEntry } from './drafts/entry'
import { renderKeyOf, tableViewOf } from './tableView'

// Видимость служебных колонок сужается с первого рендера (ADR 0050).
const INITIAL_EFFECTIVE_STATE = { columnVisibility: {} }

/**
 * Ключи опций ядра (ADR 0164): уходят в таблицу все, и непереданные — `undefined`, иначе
 * `useTable`, сливая опции с прежними, оставил бы снятое значение. Вид ключа — вход ли он
 * отрисовки (ADR 0196, §2): значения срезов идут атомами, колбэки читаются живо, начальные
 * значения нужны только при создании.
 */
const CORE_OPTION_KINDS: Record<
  keyof CoreOptions,
  'render' | 'state' | 'callback' | 'initial'
> = {
  dataMode: 'render',
  rowCount: 'render',
  totalRowCount: 'render',
  locale: 'render',
  dataTypes: 'render',
  timeZone: 'render',
  dateLocale: 'render',
  loading: 'render',
  enableFooter: 'render',
  footerPosition: 'render',
  enableToolbar: 'render',
  viewSettingsToolbar: 'render',
  enableStatusBar: 'render',
  enableAnnouncements: 'render',
  enableKeyboardNavigation: 'render',
  activeCell: 'state',
  onActiveCellChange: 'callback',
  initialActiveCell: 'initial',
  drafts: 'state',
  onDraftsChange: 'callback',
  initialDrafts: 'initial',
  enableOverflowTooltip: 'render',
  enableRowAnimation: 'render',
  enableColumnAnimation: 'render',
  enableIncrementalRender: 'render',
  skeletonOptions: 'render',
  refreshOptions: 'render',
  loadError: 'render',
  onRetry: 'callback',
  onDebugAction: 'callback',
  onFailure: 'callback',
  onDataChange: 'callback',
  rowHeight: 'render',
  headerHeight: 'render',
  // Читается при записи, как колбэк: объект, заданный литералом, не будит отрисовку.
  writeLimits: 'callback',
}
const CORE_OPTION_KEYS = Object.keys(CORE_OPTION_KINDS) as (keyof CoreOptions)[]
const RENDER_OPTION_KEYS = CORE_OPTION_KEYS.filter(
  key => CORE_OPTION_KINDS[key] === 'render',
)

const coreOptionsOf = (params: CoreOptions): CoreOptions =>
  Object.fromEntries(CORE_OPTION_KEYS.map(key => [key, params[key]]))

/** Компонент приложения не подписан на срезы (ADR 0196, §1). */
const NO_STATE = () => null

/** Без строкового `id` в строке `getRowId` обязателен — иначе id строк молча `undefined`. */
type RowIdParams<TData extends RowData> = [TData] extends [{ id: string }]
  ? { getRowId?: (row: TData) => string }
  : { getRowId: (row: TData) => string }

export type UseCreateTableParams<
  TData extends RowData,
  TEntries extends readonly TablePlugin[],
> = RowIdParams<TData> &
  CoreOptions & {
    columns: ColumnDef<TesseraFeatures<TEntries>, TData, unknown>[]
    data: TData[]
    plugins?: TEntries

    getSubRows?: (row: TData) => TData[] | undefined

    /**
     * Срезы колонок (ADR 0120, §4). Срез плагина — аргументами его фабрики:
     * `columnSorting({ sorting, onSortingChange })`.
     */
    state?: CoreTableState
    /** Колбэки срезов колонок (прокидываются в опции v9 как есть). */
    handlers?: CoreTableHandlers

    /**
     * Умолчания колонок без своих: размеры дополняют умолчания (`minSize` 48, `maxSize` 750),
     * `aggregationScope` — строки дерева в агрегатах (ADR 0229).
     */
    defaultColumn?: DefaultColumnSizing
  }

const DEFAULT_ENTRIES = [] as const

export const useCreateTable = <
  TData extends RowData,
  const TEntries extends readonly TablePlugin[],
>({
  columns,
  data,
  plugins = DEFAULT_ENTRIES as unknown as TEntries,
  getRowId,
  getSubRows,
  state,
  handlers,
  defaultColumn,
  ...coreOptions
}: UseCreateTableParams<TData, TEntries>) => {
  // Модель, которую несёт интерфейс, — своя запись перед ним (ADR 0120, §3).
  const { entries: withModels, mismatches: modelMismatches } =
    expandIncludedModels(plugins as readonly TesseraFeatureEntry[])
  // Срез активной ячейки — запись ядра в каждой таблице (ADR 0170, §1).
  const requested = [
    keyboardNavigationEntry({
      activeCell: coreOptions.activeCell,
      onActiveCellChange: coreOptions.onActiveCellChange,
      initialActiveCell: coreOptions.initialActiveCell,
    }),
    // Срез черновиков — запись ядра в каждой таблице (ADR 0178, §1).
    draftsEntry({
      drafts: coreOptions.drafts,
      onDraftsChange: coreOptions.onDraftsChange,
      initialDrafts: coreOptions.initialDrafts,
    }),
    ...withModels,
  ]
  // Состав набора — договор на время жизни таблицы (ADR 0039): добавленный позже
  // плагин инертен, удалённый — выключен как enabled: false.
  const [setStore] = useState(() => createPluginSetStore(requested))
  const entries = resolvePluginSet(setStore, requested)

  // Держим набор фич и свёртку по СИГНАТУРЕ структуры активных записей (id +
  // enabled), а не по идентичности массива — иначе новый plugins пересобирал бы всё.
  const signature = pluginSetSignature(entries)

  // Срезы под сужением — атомы-линзы хранилища (ADR 0171, §1); таблица узнаёт его при
  // создании, его фичей набора.
  const [sliceStore] = useState(createSliceStore)
  const features = useMemo(
    () => ({
      ...buildTesseraFeatures(entries),
      effectiveSlicesFeature: sliceStore.feature,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature],
  )

  // Сервисные колонки не зависят от аргументов фабрик — держим их по составу набора:
  // смена аргумента не пересоздаёт колонки и не перестраивает модель.
  const serviceColumns = useMemo(
    () => foldEntries(entries).serviceColumns,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature],
  )

  // Аргументы фабрик живые (ADR 0039): настройка записей пересобирается при смене
  // ЗНАЧЕНИЯ аргументов, функции из аргументов — стабильные обёртки на версию последнего
  // коммита. Хранилища набора и аргументов пишет эффект коммита (ADR 0171, §3): новая
  // ссылка на предикат поднимает атом версии отрисовки — ячейки перерисуются до кадра.
  const [argsStore] = useState(() => createPluginArgsStore(entries))
  useIsomorphicLayoutEffect(() => {
    rememberPluginSet(setStore, requested)
    rememberPluginArgs(argsStore, entries)
  })
  const argsSignature = `${signature}#${pluginArgsSignature(entries)}`
  // Режим данных — договор на время жизни таблицы (ADR 0169, §1): смена после
  // монтирования не применяется.
  const [dataMode] = useState(coreOptions.dataMode)
  const lifetimeViolations = [
    ...lifetimeArgViolations(argsStore, entries),
    ...(dataModeKeyOf(coreOptions.dataMode) === dataModeKeyOf(dataMode)
      ? []
      : ['dataMode']),
  ]

  const folded = useMemo(
    () => foldEntries(resolvePluginEntries(argsStore, entries)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по значению аргументов
    [argsSignature],
  )

  // По значениям: объект, собранный на каждый рендер, сбрасывал бы кэши колонок TanStack.
  const resolvedDefaultColumn = useMemo(
    () =>
      resolveDefaultColumn({
        size: defaultColumn?.size,
        minSize: defaultColumn?.minSize,
        maxSize: defaultColumn?.maxSize,
        flex: defaultColumn?.flex,
        aggregationScope: defaultColumn?.aggregationScope,
      }),
    [
      defaultColumn?.size,
      defaultColumn?.minSize,
      defaultColumn?.maxSize,
      defaultColumn?.flex,
      defaultColumn?.aggregationScope,
    ],
  )

  // TanStack сливает `defaultColumn` в колонки при их сборке, а собирает их заново только
  // по новому массиву `columns`: новые умолчания — новый массив (ADR 0077, CW3).
  const injectedColumns = useMemo(
    () => injectServiceColumns(columns, serviceColumns),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- новый массив на смену умолчаний
    [columns, serviceColumns, resolvedDefaultColumn],
  )

  // Сервисные колонки для пиннинга: id (таргет пина) + объявленная плагином политика —
  // в порядке показа, иначе закрепление переставило бы их (ADR 0010, IV13).
  const servicePins = useMemo(
    () =>
      orderServiceColumns(serviceColumns).map(column => ({
        id: column.id,
        pin: column.pin,
      })),
    [serviceColumns],
  )

  // Потребительский state/handlers: columnPinning/columnSizing перехватываем
  // (сервисный пиннинг + авто-слайс), остальное прокидываем как есть.
  // Срез плагина, переданный ядру в обход типов, вырезается (ADR 0120, MP7).
  const {
    coreState,
    coreHandlers,
    foreign: foreignSlices,
  } = splitCoreState(
    state as Record<string, unknown> | undefined,
    handlers as Record<string, unknown> | undefined,
  )
  const {
    columnPinning: externalPinning,
    columnSizing: externalSizing,
    ...restState
  } = coreState
  const {
    onColumnPinningChange: externalOnPinning,
    onColumnSizingChange: externalOnSizing,
    ...restHandlers
  } = coreHandlers

  // COLUMN PINNING / SIZING — контролирует ядро (сервисный пиннинг, авто-слайс).
  const { displayedPinning, onColumnPinningChange } = useControlledPinning(
    externalPinning as ColumnPinningState | undefined,
    externalOnPinning as OnChangeFn<ColumnPinningState> | undefined,
    servicePins,
  )
  const {
    displayedSizing,
    userSizing,
    onColumnSizingChange,
    onColumnAutoSizingChange,
    onColumnFlexSizingChange,
  } = useControlledSizing(
    externalSizing as ColumnSizingState | undefined,
    externalOnSizing as OnChangeFn<ColumnSizingState> | undefined,
  )

  // Бизнес-хуки из аргументов фабрик плагинов (напр. rowSelection({ onSelectRow }))
  // и из hook-слайсов пользовательских записей сворачиваются ЖИВО каждый рендер:
  // колбэки читаются через table.getHooks() на момент вызова, поэтому не
  // мемоизируются по сигнатуре набора. resolveHooks подкладывает no-op дефолты.
  const resolvedHooks = resolveHooks(foldHooks(entries))

  // Эффективное состояние при сужении параметров (ADR 0039, §4; ADR 0171): TanStack
  // видит «сохранённое ∩ допустимое» через атомы-линзы, сохранённое остаётся нетронутым.
  // Срезы из аргументов плагинов (ADR 0120, §4): с внешним значением их ведёт ядро,
  // как суженные; без него — TanStack, а ядро лишь сообщает новое значение колбэку.
  const slices = pluginSlicesOf(entries)
  const sliceKeys = slices.controlled.join('|')
  const narrow = useMemo(
    () => withSliceNarrows(folded.narrow, slices.controlled),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу срезов
    [folded.narrow, sliceKeys],
  )
  // Первая загрузка видна условиям показа служебных колонок (ADR 0060, SL25).
  const narrowContext = useNarrowContext(folded, coreOptions.loading)
  // Срезы, которыми ядро владеет само: сужение снимается, а обработчик остаётся у владельца.
  const owned: Record<string, unknown> = { columnPinning: displayedPinning }
  const sliceState: Record<string, unknown> = { ...restState, ...slices.state }
  const sliceInitial: Record<string, unknown> = {
    ...INITIAL_EFFECTIVE_STATE,
    ...slices.initial,
  }
  const sliceInputs: Record<string, SliceInput> = Object.fromEntries(
    Object.keys(narrow).map(key => {
      const isOwned = key in owned
      return [
        key,
        {
          value: isOwned ? owned[key] : sliceState[key],
          controlled: !isOwned && sliceState[key] !== undefined,
          owned: isOwned,
          external: restHandlers[handlerOf(key)] as SliceInput['external'],
          listener: slices.listeners[key],
          initial:
            key in sliceInitial ? { value: sliceInitial[key] } : undefined,
        },
      ]
    }),
  )
  const effective = useEffectiveSlices(sliceStore, sliceInputs)
  // Срез плагина, которым владеет TanStack: ядро сообщает новое значение колбэку.
  const ownedSliceHandlers = Object.fromEntries(
    Object.entries(slices.listeners)
      .filter(([key]) => !(key in narrow))
      .map(([key, listener]) => [
        handlerOf(key),
        (updater: unknown) => {
          const t = sliceStore.table() as SliceTable &
            Parameters<typeof makeStateUpdater>[1]
          makeStateUpdater(key as never, t)(updater as never)
          listener(t.atoms[key]?.get())
        },
      ]),
  )

  // Срезы плагинов с внешним значением — тоже здесь: суженный срез линза читает из `state`
  // рендера, а несуженный TanStack — сам (ADR 0171, §2).
  const controlledState = {
    ...restState,
    ...slices.state,
    columnPinning: displayedPinning,
    columnSizing: displayedSizing,
  }

  const options = {
    features,
    columns: injectedColumns,
    data,
    getRowId: getRowId ?? ((row: TData) => (row as { id: string }).id),
    // Умолчание — одна функция: по ней транзакция знает, куда писать детей (ADR 0194).
    getSubRows: getSubRows ?? defaultGetSubRows<TData>,
    defaultColumn: resolvedDefaultColumn,

    // Фичевые опции плагинов (enableSorting и т.п.) — вливаются первыми, чтобы
    // явные поля ниже их не затирались.
    ...folded.options,
    // Автосброс TanStack (`autoResetCellSelection`) возвращает срез к `initialState`:
    // начальное значение среза из аргументов плагина — и туда (ADR 0120, MP9).
    initialState: {
      ...(folded.options.initialState as object | undefined),
      ...slices.initial,
    },

    // Контролируемое состояние: пиннинг/размер перехвачены, остальное — от потребителя.
    state: controlledState,
    // Суженные срезы — атомы-линзы: TanStack читает их раньше `state` (ADR 0171, §1).
    atoms: effective.atoms,
    pluginNarrows: narrow,
    pluginNarrowContext: narrowContext,
    pluginSavedSlice: sliceStore.saved,
    onColumnPinningChange,
    onColumnSizingChange,
    onColumnAutoSizingChange,
    onColumnFlexSizingChange,
    columnUserSizing: userSizing,
    // Прочие onXChange потребителя (onExpandedChange/onRowSelectionChange/
    // onGroupingChange/onRowOrderChange…); для суженных срезов — обёртки слоя.
    ...restHandlers,
    ...ownedSliceHandlers,
    ...effective.handlers,

    hooks: resolvedHooks,
    slots: folded.slots,
    slotActions: folded.slotActions,
    contextMenuActions: folded.contextMenuActions,
    stubEntries: folded.stubEntries,
    draftKinds: folded.draftKinds,
    labelSets: folded.labelSets,
    actionCatalog: folded.actionCatalog,
    keyboardActions: folded.keyboardActions,
    columnTransforms: folded.columnTransforms,
    viewSettingsSections: folded.viewSettingsSections,
    pluginDiagnostics: folded.pluginDiagnostics,
    pluginRenderVersion: argsStore.renderVersion,
    pluginWrappers: folded.wrappers,
    pluginBody: folded.body,
    actionMenu: folded.actionMenu,
    ...coreOptionsOf(coreOptions),
    // Итоги колонок включают футер, флаг его запрещает (ADR 0184, §7).
    enableFooter:
      coreOptions.enableFooter ??
      (folded.options.columnTotalOf ? true : undefined),
    dataMode,
    // Стоковые `manual*` выставляет ядро по режиму, плагины их не задают (ADR 0169, §1).
    ...manualOptionsOf({ ...folded.options, dataMode }),
    // Итог приложения — как есть; стоковый `rowCount` — только страницам с сервера (§4).
    serverRowCount: coreOptions.rowCount,
    rowCount: stockRowCountOf({
      ...folded.options,
      dataMode,
      rowCount: coreOptions.rowCount,
    }),
  }

  // Каст опций — компромисс динамической сборки (Q2): tableFeatures() валидирует
  // слоты в рантайме, но синтетический тип набора не несёт производные опции фич,
  // которых ждёт статическая сигнатура useTable. Каст изолирован здесь.
  useTable(
    options as unknown as TableOptions<TesseraFeatures<TEntries>, TData>,
    NO_STATE,
  )
  type TableView = Omit<
    ReactTable<TesseraFeatures<TEntries>, TData, null>,
    'state'
  >

  // Ссылка таблицы — по входам отрисовки (ADR 0196, §2): значения срезов приходят атомами,
  // колбэки читаются живо, поэтому перерисовка приложения с теми же входами грид не будит.
  const core = sliceStore.table() as unknown as TableView
  const renderKey = renderKeyOf(RENDER_OPTION_KEYS.map(key => coreOptions[key]))
  const table = useMemo(
    () => tableViewOf(core),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- входы отрисовки, не опции целиком
    [
      core,
      features,
      injectedColumns,
      data,
      resolvedDefaultColumn,
      folded,
      narrow,
      narrowContext,
      effective.atoms,
      dataMode,
      renderKey,
    ],
  )

  useTableEffects(
    table,
    sliceStore.table(),
    entries,
    folded,
    signature,
    argsSignature,
    lifetimeViolations,
    modelMismatches,
    foreignSlices,
  )

  return table
}

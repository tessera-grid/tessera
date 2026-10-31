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
import { useMemo, useRef, useState } from 'react'

import { makeStateUpdater, useTable } from '@tanstack/react-table'
import type {
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
} from '@tanstack/react-table'

import type { ColumnDef, RowData, TableOptions } from '../types'
import type { CoreOptions } from './commonFeature.types'
import { dataModeKeyOf, manualOptionsOf, stockRowCountOf } from './dataMode'
import { type DefaultColumnSizing, resolveDefaultColumn } from './defaultColumn'
import { resolveHooks } from './createHooks'
import {
  getColumnsSignature,
  injectServiceColumns,
  orderServiceColumns,
} from './createColumns'
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
  type PluginArgsStore,
} from './pluginArgs'
import {
  createPluginSetStore,
  pluginSetSignature,
  resolvePluginSet,
  type PluginSetStore,
} from './pluginSet'
import { handlerOf, useEffectiveState } from './effectiveState'
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

// Видимость служебных колонок сужается с первого рендера (ADR 0050). Константа: новое
// значение на каждый рендер сбрасывало бы кэш сужения (SC11).
const INITIAL_EFFECTIVE_STATE = { columnVisibility: {} }

/**
 * Ключи опций ядра (ADR 0164): уходят в таблицу все, и непереданные — `undefined`, иначе
 * `useTable`, сливая опции с прежними, оставил бы снятое значение.
 */
const CORE_OPTION_KEYS: Record<keyof CoreOptions, true> = {
  dataMode: true,
  rowCount: true,
  totalRowCount: true,
  locale: true,
  timeZone: true,
  loading: true,
  enableFooter: true,
  footerPosition: true,
  enableToolbar: true,
  enableStatusBar: true,
  enableAnnouncements: true,
  enableOverflowTooltip: true,
  enableRowAnimation: true,
  enableColumnAnimation: true,
  skeletonOptions: true,
  refreshOptions: true,
  loadError: true,
  onRetry: true,
  onDebugAction: true,
  rowHeight: true,
  headerHeight: true,
}

const coreOptionsOf = (params: CoreOptions): CoreOptions =>
  Object.fromEntries(
    Object.keys(CORE_OPTION_KEYS).map(key => [
      key,
      params[key as keyof CoreOptions],
    ]),
  )

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

    /** Размеры колонок без своих; дополняет умолчания (`minSize` 48, `maxSize` 750). */
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
  // Состав набора — договор на время жизни таблицы (ADR 0039): добавленный позже
  // плагин инертен, удалённый — выключен как enabled: false.
  const setStore = useRef<PluginSetStore | null>(null)
  setStore.current ??= createPluginSetStore()
  // Модель, которую несёт интерфейс, — своя запись перед ним (ADR 0120, §3).
  const { entries: withModels, mismatches: modelMismatches } =
    expandIncludedModels(plugins as readonly TesseraFeatureEntry[])
  const entries = resolvePluginSet(setStore.current, withModels)

  // Держим набор фич и свёртку по СИГНАТУРЕ структуры активных записей (id +
  // enabled), а не по идентичности массива — иначе новый plugins пересобирал бы всё.
  const signature = pluginSetSignature(entries)

  const features = useMemo(
    () => buildTesseraFeatures(entries),
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
  // ЗНАЧЕНИЯ аргументов, функции из аргументов — стабильные обёртки на последнюю версию.
  const argsStore = useRef<PluginArgsStore | null>(null)
  argsStore.current ??= createPluginArgsStore()
  rememberPluginArgs(argsStore.current, entries)
  const argsSignature = `${signature}#${pluginArgsSignature(entries)}`
  // Режим данных — договор на время жизни таблицы (ADR 0169, §1): смена после
  // монтирования не применяется.
  const [dataMode] = useState(coreOptions.dataMode)
  const lifetimeViolations = [
    ...lifetimeArgViolations(argsStore.current, entries),
    ...(dataModeKeyOf(coreOptions.dataMode) === dataModeKeyOf(dataMode)
      ? []
      : ['dataMode']),
  ]

  const folded = useMemo(
    () => foldEntries(resolvePluginEntries(argsStore.current!, entries)),
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
      }),
    [defaultColumn?.size, defaultColumn?.minSize, defaultColumn?.maxSize],
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
  const { displayedSizing, onColumnSizingChange, onColumnAutoSizingChange } =
    useControlledSizing(
      externalSizing as ColumnSizingState | undefined,
      externalOnSizing as OnChangeFn<ColumnSizingState> | undefined,
    )

  // Бизнес-хуки из аргументов фабрик плагинов (напр. rowSelection({ onSelectRow }))
  // и из hook-слайсов пользовательских записей сворачиваются ЖИВО каждый рендер:
  // колбэки читаются через table.getHooks() на момент вызова, поэтому не
  // мемоизируются по сигнатуре набора. resolveHooks подкладывает no-op дефолты.
  const resolvedHooks = resolveHooks(foldHooks(entries))

  // Эффективное состояние при сужении параметров (ADR 0039, §4): TanStack видит
  // «сохранённое ∩ допустимое», сохранённое остаётся нетронутым. Сужению отдаётся
  // экземпляр предыдущего рендера, только если его данные и структура колонок совпадают
  // с текущими (строки и колонки уже построены); иначе оно откладывается на повторный
  // рендер.
  const tableRef = useRef<{
    options: { data: unknown; columns: readonly unknown[] }
    atoms: Record<string, { get: () => unknown }>
  }>(null)
  const previous = tableRef.current
  const columnsSignature = getColumnsSignature(injectedColumns)
  const freshTable =
    previous?.options.data === data &&
    getColumnsSignature(previous.options.columns) === columnsSignature
      ? previous
      : null
  // Срезы из аргументов плагинов (ADR 0120, §4): с внешним значением их ведёт ядро,
  // как суженные; без него — TanStack, а ядро лишь сообщает новое значение колбэку.
  const slices = pluginSlicesOf(entries)
  const sliceKeys = slices.controlled.join('|')
  const narrow = useMemo(
    () => withSliceNarrows(folded.narrow, slices.controlled),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу срезов
    [folded.narrow, sliceKeys],
  )
  // Срезы, которыми ядро владеет само: сужение снимается, а обработчик остаётся у владельца.
  const owned = { columnPinning: displayedPinning }
  // `useTable` сливает опции с прежними: обработчик снятого сужения остался бы в
  // таблице и писал бы мимо среза — срез, который снова ведёт TanStack, получает запись в атом.
  const narrowedKeys = useRef(new Set<string>())
  for (const key of Object.keys(narrow)) narrowedKeys.current.add(key)
  const releasedSliceHandlers = Object.fromEntries(
    [...narrowedKeys.current]
      .filter(key => !(key in narrow) && !(key in owned))
      .map(key => [
        handlerOf(key),
        (updater: unknown) =>
          makeStateUpdater(
            key as never,
            tableRef.current as unknown as Parameters<
              typeof makeStateUpdater
            >[1],
          )(updater as never),
      ]),
  )
  const ownedSliceHandlers = Object.fromEntries(
    Object.entries(slices.listeners)
      .filter(([key]) => !(key in narrow))
      .map(([key, listener]) => [
        handlerOf(key),
        (updater: unknown) => {
          const t = tableRef.current as unknown as Parameters<
            typeof makeStateUpdater
          >[1] & { atoms: Record<string, { get: () => unknown }> }
          makeStateUpdater(key as never, t)(updater as never)
          listener(t.atoms[key]?.get())
        },
      ]),
  )
  // Сужение зависит не только от данных: плагин просит пересчёт, когда сменилось то, что
  // оно читает из таблицы (ответы ленивых строк при «раскрыть всё», ADR 0160).
  const [narrowEpoch, setNarrowEpoch] = useState(0)
  const effective = useEffectiveState({
    narrow,
    owned,
    state: { ...restState, ...slices.state },
    handlers: restHandlers,
    listeners: slices.listeners,
    table: freshTable,
    getAtoms: () => tableRef.current?.atoms,
    inputs: [data, columnsSignature, narrowEpoch],
    // Первая загрузка видна условиям показа служебных колонок (ADR 0060, SL25).
    context: {
      options: { ...folded.options, loading: coreOptions.loading },
      slotActions: folded.slotActions,
    },
    initial: { ...INITIAL_EFFECTIVE_STATE, ...slices.initial },
  })

  const controlledState = {
    ...restState,
    ...effective.state,
    columnPinning: effective.state.columnPinning ?? displayedPinning,
    columnSizing: displayedSizing,
  }

  const options = {
    features,
    columns: injectedColumns,
    data,
    getRowId: getRowId ?? ((row: TData) => (row as { id: string }).id),
    getSubRows:
      getSubRows ??
      ((row: TData) => (row as { subRows?: TData[] }).subRows || []),
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
    refreshNarrowing: () => setNarrowEpoch(epoch => epoch + 1),
    onColumnPinningChange,
    onColumnSizingChange,
    onColumnAutoSizingChange,
    // Прочие onXChange потребителя (onExpandedChange/onRowSelectionChange/
    // onGroupingChange/onRowOrderChange…); для суженных срезов — обёртки слоя.
    ...releasedSliceHandlers,
    ...restHandlers,
    ...ownedSliceHandlers,
    ...effective.handlers,

    hooks: resolvedHooks,
    slots: folded.slots,
    slotActions: folded.slotActions,
    contextMenuActions: folded.contextMenuActions,
    stubEntries: folded.stubEntries,
    keyboardActions: folded.keyboardActions,
    pluginDiagnostics: folded.pluginDiagnostics,
    pluginRenderVersion: argsStore.current.renderVersion,
    pluginWrappers: folded.wrappers,
    // Колбэки изменений локального состояния плагинов по ключу среза (DP17).
    pluginStateListeners: Object.fromEntries(
      entries.flatMap(entry =>
        entry.enabled !== false && entry.controlledState?.onChange
          ? [[entry.controlledState.key, entry.controlledState.onChange]]
          : [],
      ),
    ),
    actionMenu: folded.actionMenu,
    ...coreOptionsOf(coreOptions),
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
  const table = useTable(
    options as unknown as TableOptions<TesseraFeatures<TEntries>, TData>,
  )

  tableRef.current = table as unknown as typeof tableRef.current

  useTableEffects(
    table,
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

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
import { useMemo, useRef } from 'react'

import { useTable } from '@tanstack/react-table'
import type {
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
} from '@tanstack/react-table'

import type { ColumnDef, RowData, TableOptions, TableState } from '../types'
import type { SkeletonOptions } from './skeletonOptions'
import type { RefreshOptions } from './loadingDisplay'
import { type DefaultColumnSizing, resolveDefaultColumn } from './defaultColumn'
import { resolveHooks } from './createHooks'
import { getColumnsSignature, injectServiceColumns } from './createColumns'
import {
  buildTesseraFeatures,
  foldEntries,
  foldHooks,
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
import { useEffectiveState } from './effectiveState'
import { useTableEffects } from './useTableEffects'

// Видимость служебных колонок сужается с первого рендера (ADR 0050). Константа: новое
// значение на каждый рендер сбрасывало бы кэш сужения (SC11).
const INITIAL_EFFECTIVE_STATE = { columnVisibility: {} }

/**
 * Ядровые (не плагинные) опции DataGrid (демо/стори типизируют ими свои args).
 * Плагинные фичи включаются через `plugins`.
 */
export interface CreateDataGridOptions {
  /**
   * Загрузка данных сейчас (ADR 0106): `'initial'` — скелет первой загрузки (ADR 0060),
   * `'refresh'` — свечение обновления (ADR 0094), `false` — нет.
   */
  loading?: 'initial' | 'refresh' | false
  enableFooter?: boolean
  enableToolbar?: boolean
  enableStatusBar?: boolean
  enableAnnouncements?: boolean
  enableOverflowTooltip?: boolean
  skeletonOptions?: SkeletonOptions
  refreshOptions?: RefreshOptions
  loadError?: unknown
  onRetry?: () => unknown
  rowHeight?: number
  headerHeight?: number
  defaultColumn?: DefaultColumnSizing
  handlers?: Record<string, unknown>
}

/** Без строкового `id` в строке `getRowId` обязателен — иначе id строк молча `undefined`. */
type RowIdParams<TData extends RowData> = [TData] extends [{ id: string }]
  ? { getRowId?: (row: TData) => string }
  : { getRowId: (row: TData) => string }

export type UseCreateTableParams<
  TData extends RowData,
  TEntries extends readonly TesseraFeatureEntry[],
> = RowIdParams<TData> & {
  columns: ColumnDef<TesseraFeatures<TEntries>, TData, unknown>[]
  data: TData[]
  plugins?: TEntries

  getSubRows?: (row: TData) => TData[] | undefined

  state?: Partial<TableState<TesseraFeatures<TEntries>>>
  /** Контролируемые onXChange потребителя (прокидываются в опции v9 как есть). */
  handlers?: Record<string, unknown>

  /**
   * Загрузка данных сейчас (ADR 0106): `'initial'` — скелет первой загрузки (ADR 0060),
   * `'refresh'` — свечение обновления (ADR 0094), `false` — нет.
   */
  loading?: 'initial' | 'refresh' | false
  enableFooter?: boolean
  /** Верхний тулбар: без флага — по наличию кнопок плагинов, `true` — всегда, `false` — никогда (ADR 0046). */
  enableToolbar?: boolean
  /** Нижняя панель: без флага — по наличию её слотов, `true` — всегда, `false` — никогда (ADR 0046). */
  enableStatusBar?: boolean
  /** `false` — ядро не объявляет изменения скринридеру (ADR 0032, W9). */
  enableAnnouncements?: boolean
  /** `false` — без тултипа у обрезанного текста ячеек (ADR 0075). */
  enableOverflowTooltip?: boolean
  skeletonOptions?: SkeletonOptions
  /** Задержка и минимум показа обновления при `loading: 'refresh'` (ADR 0094). */
  refreshOptions?: RefreshOptions
  /**
   * Отказ загрузки данных (ADR 0096): `Error` или строка; `null` — ошибки нет. С данными —
   * красный свет под шапкой и плашка, без данных — заглушка ошибки.
   */
  loadError?: unknown
  /** Повтор загрузки из плашки и заглушки; промис держит кнопку в ожидании. */
  onRetry?: () => unknown
  /** Высота строк тела, футера и скелета, px; по умолчанию 50, не ниже 40 (ADR 0077). */
  rowHeight?: number
  /** Высота каждой строки шапки, px; по умолчанию — как `rowHeight`, не ниже 36. */
  headerHeight?: number
  /** Размеры колонок без своих; дополняет умолчания (`minSize` 48, `maxSize` 750). */
  defaultColumn?: DefaultColumnSizing
}

const DEFAULT_ENTRIES = [] as const

export const useCreateTable = <
  TData extends RowData,
  const TEntries extends readonly TesseraFeatureEntry[],
>({
  columns,
  data,
  plugins = DEFAULT_ENTRIES as unknown as TEntries,
  getRowId,
  getSubRows,
  state,
  handlers,
  loading,
  enableFooter,
  enableToolbar,
  enableStatusBar,
  enableAnnouncements,
  enableOverflowTooltip,
  skeletonOptions,
  refreshOptions,
  loadError,
  onRetry,
  rowHeight,
  headerHeight,
  defaultColumn,
}: UseCreateTableParams<TData, TEntries>) => {
  // Состав набора — договор на время жизни таблицы (ADR 0039): добавленный позже
  // плагин инертен, удалённый — выключен как enabled: false.
  const setStore = useRef<PluginSetStore | null>(null)
  setStore.current ??= createPluginSetStore()
  const entries = resolvePluginSet(setStore.current, plugins)

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
  const lifetimeViolations = lifetimeArgViolations(argsStore.current, entries)

  const folded = useMemo(
    () => foldEntries(resolvePluginEntries(argsStore.current!, entries)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по значению аргументов
    [argsSignature],
  )

  const injectedColumns = useMemo(
    () => injectServiceColumns(columns, serviceColumns),
    [columns, serviceColumns],
  )

  // Сервисные колонки для пиннинга: id (таргет пина) + объявленная плагином политика.
  const servicePins = useMemo(
    () =>
      serviceColumns.map(column => ({
        id: column.id,
        pin: column.pin,
      })),
    [serviceColumns],
  )

  // Потребительский state/handlers: columnPinning/columnSizing перехватываем
  // (сервисный пиннинг + авто-слайс), остальное прокидываем как есть.
  const {
    columnPinning: externalPinning,
    columnSizing: externalSizing,
    ...restState
  } = (state ?? {}) as Record<string, unknown>
  const {
    onColumnPinningChange: externalOnPinning,
    onColumnSizingChange: externalOnSizing,
    ...restHandlers
  } = (handlers ?? {}) as Record<string, unknown>

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
  const effective = useEffectiveState({
    narrow: folded.narrow,
    owned: { columnPinning: displayedPinning },
    state: restState,
    handlers: restHandlers,
    table: freshTable,
    getAtoms: () => tableRef.current?.atoms,
    inputs: [data, columnsSignature],
    context: { options: folded.options, slotActions: folded.slotActions },
    initial: INITIAL_EFFECTIVE_STATE,
  })

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

    // Контролируемое состояние: пиннинг/размер перехвачены, остальное — от потребителя.
    state: controlledState,
    onColumnPinningChange,
    onColumnSizingChange,
    onColumnAutoSizingChange,
    // Прочие onXChange потребителя (onExpandedChange/onRowSelectionChange/
    // onGroupingChange/onRowOrderChange…); для суженных срезов — обёртки слоя.
    ...restHandlers,
    ...effective.handlers,

    hooks: resolvedHooks,
    slots: folded.slots,
    slotActions: folded.slotActions,
    contextMenuActions: folded.contextMenuActions,
    keyboardActions: folded.keyboardActions,
    pluginDiagnostics: folded.pluginDiagnostics,
    pluginRenderVersion: argsStore.current.renderVersion,
    // Колбэки изменений локального состояния плагинов по ключу среза (DP17).
    pluginStateListeners: Object.fromEntries(
      entries.flatMap(entry =>
        entry.enabled !== false && entry.controlledState?.onChange
          ? [[entry.controlledState.key, entry.controlledState.onChange]]
          : [],
      ),
    ),
    actionMenu: folded.actionMenu,
    loading,
    enableFooter,
    enableToolbar,
    enableStatusBar,
    enableAnnouncements,
    enableOverflowTooltip,
    skeletonOptions,
    refreshOptions,
    loadError,
    onRetry,
    rowHeight,
    headerHeight,
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
  )

  return table
}

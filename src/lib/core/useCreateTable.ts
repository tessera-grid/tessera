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
import { resolveHooks } from './createHooks'
import { shallowEqual } from './reactivity'
import { injectServiceColumns } from './createColumns'
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
import { useTableEffects } from './useTableEffects'

const DEFAULT_COLUMN = {
  minSize: 150,
  maxSize: 750,
}

/**
 * Ядровые (не плагинные) опции DataGrid (демо/стори типизируют ими свои args).
 * Плагинные фичи включаются через `plugins`.
 */
export interface CreateDataGridOptions {
  enableSkeleton?: boolean
  enableLoading?: boolean
  enableFooter?: boolean
  enableAnnouncements?: boolean
  skeletonOptions?: SkeletonOptions
  handlers?: Record<string, unknown>
}

export interface UseCreateTableParams<
  TData extends RowData,
  TEntries extends readonly TesseraFeatureEntry[],
> {
  columns: ColumnDef<TesseraFeatures<TEntries>, TData, unknown>[]
  data: TData[]
  plugins?: TEntries

  getRowId?: (row: TData) => string
  getSubRows?: (row: TData) => TData[] | undefined

  state?: Partial<TableState<TesseraFeatures<TEntries>>>
  /** Контролируемые onXChange потребителя (прокидываются в опции v9 как есть). */
  handlers?: Record<string, unknown>

  enableSkeleton?: boolean
  enableLoading?: boolean
  enableFooter?: boolean
  /** `false` — ядро не объявляет изменения скринридеру (ADR 0032, W9). */
  enableAnnouncements?: boolean
  skeletonOptions?: SkeletonOptions
  defaultColumn?: { minSize?: number; maxSize?: number; size?: number }
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
  enableSkeleton,
  enableLoading,
  enableFooter,
  enableAnnouncements,
  skeletonOptions,
  defaultColumn,
}: UseCreateTableParams<TData, TEntries>) => {
  // Держим набор фич и свёртку по СИГНАТУРЕ структуры активных записей (id +
  // enabled), а не по идентичности массива — иначе новый plugins пересобирал бы всё.
  const signature = plugins
    .filter(entry => entry.enabled !== false)
    .map(entry => entry.id)
    .join('|')

  const features = useMemo(
    () => buildTesseraFeatures(plugins),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature],
  )

  const folded = useMemo(
    () => foldEntries(plugins),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature],
  )

  const injectedColumns = useMemo(
    () => injectServiceColumns(columns, folded.serviceColumns),
    [columns, folded],
  )

  // Сервисные колонки для пиннинга: id (таргет пина) + объявленная плагином политика.
  const servicePins = useMemo(
    () =>
      folded.serviceColumns.map(column => ({
        id: column.id,
        pin: column.pin,
      })),
    [folded],
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
  const resolvedHooks = resolveHooks(foldHooks(plugins))

  // Стабильная ссылка на контролируемый state: потребитель (стори) отдаёт свежий
  // объект state каждый рендер, а v9 useTable публикует его в store в layout-эффекте
  // (table_publishExternalState). При новой ссылке-но-том-же-контенте это давало
  // бесконечный ре-рендер (единый @tanstack/store после свапа). Держим прежнюю
  // ссылку, пока срезы shallow-равны.
  const mergedState = {
    ...restState,
    columnPinning: displayedPinning,
    columnSizing: displayedSizing,
  }
  const stateRef = useRef(mergedState)
  if (!shallowEqual(stateRef.current, mergedState)) {
    stateRef.current = mergedState
  }
  const stableState = stateRef.current

  const options = {
    features,
    columns: injectedColumns,
    data,
    getRowId: getRowId ?? ((row: TData) => (row as { id: string }).id),
    getSubRows:
      getSubRows ??
      ((row: TData) => (row as { subRows?: TData[] }).subRows || []),
    defaultColumn: defaultColumn ?? DEFAULT_COLUMN,

    // Фичевые опции плагинов (enableSorting и т.п.) — вливаются первыми, чтобы
    // явные поля ниже их не затирались.
    ...folded.options,

    // Контролируемое состояние: пиннинг/размер перехвачены, остальное — от потребителя.
    state: stableState,
    onColumnPinningChange,
    onColumnSizingChange,
    onColumnAutoSizingChange,
    // Прочие onXChange потребителя (onExpandedChange/onRowSelectionChange/
    // onGroupingChange/onRowOrderChange…).
    ...restHandlers,

    hooks: resolvedHooks,
    slots: folded.slots,
    slotActions: folded.slotActions,
    contextMenuActions: folded.contextMenuActions,
    keyboardActions: folded.keyboardActions,
    actionMenu: folded.actionMenu,
    enableSkeleton,
    enableLoading,
    enableFooter,
    enableAnnouncements,
    skeletonOptions,
  }

  // Каст опций — компромисс динамической сборки (Q2): tableFeatures() валидирует
  // слоты в рантайме, но синтетический тип набора не несёт производные опции фич,
  // которых ждёт статическая сигнатура useTable. Каст изолирован здесь.
  const table = useTable(
    options as unknown as TableOptions<TesseraFeatures<TEntries>, TData>,
  )

  useTableEffects(table, plugins, folded, signature)

  return table
}

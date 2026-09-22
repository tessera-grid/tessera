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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { functionalUpdate, useTable } from '@tanstack/react-table'
import type {
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
} from '@tanstack/react-table'

import type { ColumnDef, RowData, TableOptions, TableState } from '../types'
import type { SkeletonOptions } from './skeletonOptions'
import { resolveHooks } from './createHooks'
import { shallowEqual } from './reactivity'
import {
  defaultColumnPinningState,
  isSameColumnSizing,
  mergeColumnSizing,
  mergeServiceColumnPinning,
} from './createState'
import { injectServiceColumns } from './createColumns'
import {
  buildTesseraFeatures,
  findDuplicatePluginIds,
  foldEntries,
  foldHooks,
  type TesseraFeatureEntry,
  type TesseraFeatures,
} from './features'
import { logWarn } from './logger'

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
  const serviceIds = useMemo(() => servicePins.map(c => c.id), [servicePins])

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

  // COLUMN PINNING — контролируемый (сервисный пиннинг как display-transform).
  const [internalPinning, setInternalPinning] = useState<ColumnPinningState>(
    defaultColumnPinningState,
  )
  const userPinning =
    (externalPinning as ColumnPinningState | undefined) ?? internalPinning
  const setUserPinning =
    (externalOnPinning as OnChangeFn<ColumnPinningState> | undefined) ??
    setInternalPinning

  const displayedPinning = useMemo(
    () => mergeServiceColumnPinning(userPinning, servicePins),
    [userPinning, servicePins],
  )

  const onColumnPinningChange = useCallback<OnChangeFn<ColumnPinningState>>(
    updater =>
      setUserPinning((prev: ColumnPinningState) => {
        // prev — чистый пользовательский; реконструируем отображаемый (со
        // сервисными), применяем апдейт, срезаем сервисные обратно.
        const displayed = mergeServiceColumnPinning(prev, servicePins)
        const next = functionalUpdate(updater, displayed)
        return {
          start: (next.start ?? []).filter(
            (id: string) => !serviceIds.includes(id),
          ),
          end: (next.end ?? []).filter(
            (id: string) => !serviceIds.includes(id),
          ),
        }
      }),
    [setUserPinning, servicePins, serviceIds],
  )

  // COLUMN SIZING — контролируемый (пользовательский ресайз + авто-слайс плагинов).
  const [internalSizing, setInternalSizing] = useState<ColumnSizingState>({})
  const [autoSizing, setAutoSizing] = useState<ColumnSizingState>({})
  const setUserSizing =
    (externalOnSizing as OnChangeFn<ColumnSizingState> | undefined) ??
    setInternalSizing

  const displayedSizing = useMemo(
    () =>
      mergeColumnSizing(
        externalSizing as ColumnSizingState | undefined,
        internalSizing,
        autoSizing,
      ),
    [externalSizing, internalSizing, autoSizing],
  )

  // Авто-слайс пишут плагины в setup (generic-escape); setup перезапускается
  // при смене идентичности набора → writer бейлит при равенстве, иначе цикл.
  const onColumnAutoSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
    updater =>
      setAutoSizing(prev => {
        const next = functionalUpdate(updater, prev)
        return isSameColumnSizing(prev, next) ? prev : next
      }),
    [],
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
    onColumnSizingChange: setUserSizing,
    onColumnAutoSizingChange,
    // Прочие onXChange потребителя (onExpandedChange/onRowSelectionChange/
    // onGroupingChange/onRowOrderChange…).
    ...restHandlers,

    hooks: resolvedHooks,
    slots: folded.slots,
    slotActions: folded.slotActions,
    contextMenuActions: folded.contextMenuActions,
    actionMenu: folded.actionMenu,
    enableSkeleton,
    enableLoading,
    enableFooter,
    skeletonOptions,
  }

  // Каст опций — компромисс динамической сборки (Q2): tableFeatures() валидирует
  // слоты в рантайме, но синтетический тип набора не несёт производные опции фич,
  // которых ждёт статическая сигнатура useTable. Каст изолирован здесь.
  const table = useTable(
    options as unknown as TableOptions<TesseraFeatures<TEntries>, TData>,
  )

  // Императивный сетап плагинов (generic-escape) — единым эффектом.
  useEffect(
    () => {
      const cleanups = folded.setups.map(setup => setup(table))
      return () => {
        cleanups.forEach(cleanup => cleanup?.())
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature, table],
  )

  // Дев-варн на коллизию id плагинов (DP5): id ключует hooks-scope, локальный state и
  // генерируемую фичу — дубль молча перезапишет их. Печатается один раз на набор.
  const duplicateIds = useMemo(
    () => findDuplicatePluginIds(plugins),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по полному набору id
    [plugins.map(entry => entry.id).join('|')],
  )
  useEffect(() => {
    if (duplicateIds.length === 0) {
      return
    }
    logWarn(
      table,
      `дублирующиеся id плагинов: ${duplicateIds.join(', ')} — id ключует hooks-scope, локальный state и генерируемую фичу; коллизия перезапишет их (последний победил)`,
      `dup-plugin-id:${duplicateIds.join(',')}`,
    )
  }, [duplicateIds, table])

  // Дев-варн на нескольких владельцев cellSlot: владение ячейкой эксклюзивно
  // (владелец ЗАМЕЩАЕТ рендер ячейки). При одновременной активности внешний (первый)
  // замещает контент, остальные не рендерятся — молчаливый конфликт. Ядру «активность»
  // владельца непрозрачна, поэтому сигналим по числу зарегистрированных владельцев
  // (после дедупа по id — одинаковый slot-id схлопнут и конфликтом не считается).
  const cellSlotOwners = folded.slots.cellSlot.map(entry => entry.id)
  useEffect(() => {
    if (cellSlotOwners.length <= 1) {
      return
    }
    logWarn(
      table,
      `несколько владельцев cellSlot: ${cellSlotOwners.join(', ')} — владение ячейкой эксклюзивно; при одновременной активности внешний (первый) замещает контент, остальные не рендерятся`,
      `multi-cell-slot:${cellSlotOwners.join(',')}`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу владельцев
  }, [cellSlotOwners.join('|'), table])

  // Сброс выбора строк при смене опций выбора (ядровая логика). Триггер
  // ТОЛЬКО по изменению самих опций (через ref), а не по идентичности table — иначе
  // нестабильный ref из useTable запускал бы reset каждый рендер (бесконечный цикл).
  const enableRowSelection = (table.options as { enableRowSelection?: unknown })
    .enableRowSelection
  const enableSubRowSelection = (
    table.options as { enableSubRowSelection?: unknown }
  ).enableSubRowSelection
  const prevSelectionOpts = useRef<string | undefined>(undefined)
  const selectionOptsKey = JSON.stringify([
    typeof enableRowSelection === 'function' ? 'fn' : enableRowSelection,
    enableSubRowSelection,
  ])
  useEffect(() => {
    if (prevSelectionOpts.current === selectionOptsKey) {
      return
    }
    prevSelectionOpts.current = selectionOptsKey
    ;(
      table as { resetRowSelection?: (defaultState?: boolean) => void }
    ).resetRowSelection?.(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionOptsKey])

  return table
}

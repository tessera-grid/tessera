import { useMemo } from 'react'

import {
  TableState,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import {
  InferPluginHooks,
  PluginEntryInput,
  RegistryEntry,
  ServiceColumn,
} from '../pluginContract'
import { commonPlugin } from '../commonPlugin'
import { useCreateColumns } from '../createColumns'
import { DEFAULT_COLUMN } from '../createColumns/defaultColumnOptions'
import { useCreateHooks } from '../createHooks'
import { createEmptyRenderSlots, registerSlotInto } from '../createSlots'
import { useCreateState } from '../createState'
import { DEFAULT_SKELETON_OPTIONS } from '../skeletonOverlay/options'
import { FEATURE_OFF_BASELINE, foldPluginOptions } from './pluginOptions'
import { CreateDataGridHandlers, CreateDataGridParams } from './types'
import { usePluginSetups } from './usePluginSetups'
import { useRowSelectionReset } from './useRowSelectionReset'

export const useCreateTable = <
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
  const TPlugins extends readonly PluginEntryInput[] =
    readonly PluginEntryInput[],
>({
  columns: initialColumns,
  data,

  state = {} as Partial<TableState> & TState,
  handlers = {} as CreateDataGridHandlers<TData> & TOptions,
  hooks: externalHooks,
  plugins = [] as unknown as TPlugins,

  debug = false,

  enableSkeleton = false,
  skeletonOptions = DEFAULT_SKELETON_OPTIONS,

  enableLoading = false,

  enableFooter = false,

  defaultColumn = DEFAULT_COLUMN,
}: CreateDataGridParams<TData, THooks, TState, TOptions, TPlugins>) => {
  // Presence-based композиция (ADR 0010): фичи, сервисные колонки и опции
  // выводятся из списка плагинов. Falsy-записи и отключённые (`enabled: false`)
  // отсеиваются; `common` вклеивается ядром всегда.
  const activePlugins = useMemo(
    () =>
      (plugins.filter(Boolean) as RegistryEntry[]).filter(
        plugin => plugin.enabled !== false,
      ),
    [plugins],
  )

  // Сигнатуры СТРУКТУРЫ активного набора. Массив `plugins` нестабилен по
  // идентичности между рендерами (потребитель обычно отдаёт свежий массив, как и
  // демо-`argsToPlugins`), а из него — `activePlugins`. Держим ПРЕЖНИЕ ссылки
  // производных, пока их структура не изменилась — иначе новый `columns`/
  // `_features`/`slots` заставлял бы пересобирать таблицу каждый рендер
  // (перф-регрессия). Тонкие опции (config) при этом продолжают пересчитываться
  // ниже — они и должны отражать смену настроек, на структуру колонок не влияя.
  //
  // Две РАЗДЕЛЬНЫЕ сигнатуры: колонки зависят ТОЛЬКО от плагинов, вносящих
  // сервисную колонку (id/side/order). Тумблер плагина без колонки (сортировка/
  // ресайз/пиннинг/группировка/dnd колонок) не должен пересобирать `pluginColumns`
  // → `columns` → всю таблицу; иначе каждый такой тумблер даёт заметный лаг.
  const pluginSignature = activePlugins.map(plugin => plugin.id).join('|')

  // Фичи для `_features` шире активного набора: плагины с `keepFeatureWhenDisabled`
  // остаются здесь даже выключенными, потому что TanStack фиксирует `_features` на
  // маунте и не перечитывает их — иначе методы фичи (напр. columnDragging
  // `getCanDrag`/`getDraggableIndex`) не появятся при live-включении, и реактивный
  // UI звал бы несуществующий метод. Методы инертны, пока опция плагина выключена.
  const featurePlugins = useMemo(
    () =>
      (plugins.filter(Boolean) as RegistryEntry[]).filter(
        plugin => plugin.enabled !== false || plugin.keepFeatureWhenDisabled,
      ),
    [plugins],
  )

  const featureSignature = featurePlugins.map(plugin => plugin.id).join('|')

  const columnSignature = activePlugins
    .filter(plugin => plugin.column)
    .map(
      plugin =>
        `${plugin.id}#${plugin.column!.id}:${plugin.column!.side}:${plugin.column!.order}`,
    )
    .join('|')

  const features = useMemo(
    () => [commonPlugin, ...featurePlugins.map(plugin => plugin.feature)],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора (фичи — синглтоны)
    [featureSignature],
  )

  const pluginColumns = useMemo<ServiceColumn[]>(
    () =>
      activePlugins.flatMap(plugin => (plugin.column ? [plugin.column] : [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре колонок
    [columnSignature],
  )

  // Сервисные колонки для ядра: id (сев видимости) + объявленный плагином pin.
  const serviceColumns = useMemo(
    () => pluginColumns.map(column => ({ id: column.id, pin: column.pin })),
    [pluginColumns],
  )

  const pluginOptions = useMemo(
    () => ({
      ...FEATURE_OFF_BASELINE,
      ...foldPluginOptions(activePlugins),
    }),
    [activePlugins],
  )

  const columns = useCreateColumns<TData, THooks, TState, TOptions>({
    initialColumns,
    pluginColumns,
  })

  const {
    coreState,
    externalState,

    coreHandlers: { onColumnAutoSizingChange, ...coreHandlers },
    externalHandlers,
  } = useCreateState<TData, THooks, TState, TOptions>({
    columns,
    state,
    handlers,
    serviceColumns,
  })

  const hooks = useCreateHooks(
    useMemo(
      () => externalHooks ?? ({} as NonNullable<typeof externalHooks>),
      [externalHooks],
    ),
  )

  // Слоты собираются реактивно из декларативных объявлений активных плагинов
  // (ADR 0010): при включении/выключении плагина набор кнопок пересобирается, а
  // не «застревает» на составе, зафиксированном при конструировании таблицы (в
  // TanStack `feature.createTable` не переигрывается при смене `_features`).
  // Порядок фолда = порядок активных плагинов, поэтому итоговая раскладка слотов
  // совпадает с прежней императивной регистрацией. Держим по сигнатуре структуры.
  const slots = useMemo(
    () => {
      const built = createEmptyRenderSlots()

      activePlugins.forEach(plugin =>
        plugin.slots?.forEach(slot => registerSlotInto(built, slot)),
      )

      return built
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [pluginSignature],
  )

  const table = useReactTable<
    TData,
    InferPluginHooks<TPlugins> & THooks,
    TState,
    TOptions
  >({
    columns,
    data,

    getRowId: row => row.id,
    getSubRows: row => {
      return row.subRows || []
    },

    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),

    state: {
      ...coreState,
      ...externalState,
    },

    ...coreHandlers,
    ...externalHandlers,

    defaultColumn,

    hooks,
    slots,

    debugAll: debug,

    // Фичевые опции приходят из записей плагинов (presence-based).
    ...pluginOptions,

    // Ядровые опции (не фичи) — остаются на ядре.
    enableSkeleton,
    skeletonOptions,
    enableLoading,

    enableFooter,

    // Writer авто-слайса размеров — generic-механизм ядра; commonPlugin вешает
    // на таблицу table.setColumnAutoSizing, которым пользуются плагины в setup.
    onColumnAutoSizingChange,

    _features: features,
  })

  useRowSelectionReset({ table })
  // Императивный сетап плагинов (generic-escape ADR 0010): напр. плагин rowActions
  // задаёт ширину колонки действий через table.setColumnAutoSizing.
  usePluginSetups({ table, activePlugins })

  return table
}

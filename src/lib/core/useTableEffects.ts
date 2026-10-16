/**
 * Эффекты после создания таблицы: императивный сетап плагинов, дев-варны об
 * инертных плагинах и конфликтах набора, сброс выбора строк при смене его опций.
 */
import { useEffect, useMemo, useRef } from 'react'

import {
  findDuplicatePluginIds,
  type FoldedEntryConfig,
  type TesseraFeatureEntry,
} from './features'
import { readPluginHooks, writePluginAtom } from './definePlugin/channels'
import { logWarn } from './logger'
import type { ModelArgsMismatch } from './pluginModels'
import { foreignSliceMessage } from './coreState'
import { pruneHighlights, readHighlights } from './highlights/highlightFeature'
import { abortServerActions } from './serverActions'
import {
  type PluginDiagnostic,
  reportPluginError,
  warnInertPlugins,
} from './pluginDiagnostics'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

export const useTableEffects = (
  table: unknown,
  plugins: readonly TesseraFeatureEntry[],
  folded: FoldedEntryConfig,
  signature: string,
  argsSignature: string,
  lifetimeViolations: readonly string[],
  modelMismatches: readonly ModelArgsMismatch[] = [],
  foreignSlices: readonly string[] = [],
) => {
  const host = table as Parameters<typeof logWarn>[0]

  // Императивный сетап плагинов (generic-escape) — единым эффектом; перезапускается
  // только при смене состава набора или значения аргументов фабрик (ADR 0039, RX24).
  // `table` в зависимости не входит: обёртка useTable новая на каждом рендере.
  useEffect(
    () => {
      const cleanups = folded.setups.map(setup => setup(table))
      return () => {
        cleanups.forEach(cleanup => cleanup?.())
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по значению аргументов
    [argsSignature],
  )

  // Размонтирование прерывает ожидающее серверное действие (ADR 0116, SA2).
  const { store } = table as { store: object }
  useEffect(() => () => abortServerActions(store), [store])

  // Внешнее значение локального состояния плагина — в срез до отрисовки кадра, только
  // при новой ссылке: та же ссылка не затирает изменения изнутри (ADR 0028, DP8).
  const syncedStates = useRef(new Map<string, unknown>())
  useIsomorphicLayoutEffect(() => {
    for (const entry of plugins) {
      const external = entry.controlledState
      if (
        !external ||
        external.value === undefined ||
        entry.enabled === false ||
        syncedStates.current.get(external.key) === external.value
      ) {
        continue
      }
      syncedStates.current.set(external.key, external.value)
      writePluginAtom(table, external.key, external.value)
    }
  })

  // Согласование состояния плагинов с таблицей — после каждого рендера, и у
  // выключенных записей (ADR 0040, §2).
  useIsomorphicLayoutEffect(() => {
    for (const entry of plugins) {
      if (!entry.reconcile) {
        continue
      }
      const enabled = entry.enabled !== false
      const hooks = enabled
        ? readPluginHooks<Record<string, unknown>>(
            table as { getHooks: () => unknown },
            entry.id,
          )
        : ((entry.hooks?.[entry.id] ?? {}) as Record<string, unknown>)
      try {
        entry.reconcile(table, { enabled, hooks })
      } catch (error) {
        reportPluginError(table, entry.id, error)
      }
    }
  })

  // Подсветка целей, ушедших из данных или колонок, снимается (ADR 0080, §1) — при
  // новой ссылке `data`/`columns`. Скрытые фильтром и страницей строки остаются в
  // core-модели и подсветку сохраняют.
  const pruned = useRef<{ data?: unknown; columns?: unknown }>({})
  useIsomorphicLayoutEffect(() => {
    const t = table as {
      options: { data?: unknown; columns?: unknown }
      getCoreRowModel: () => { rowsById: Record<string, unknown> }
      getGroupedRowModel?: () => { rowsById: Record<string, unknown> }
      getAllFlatColumns: () => { id: string }[]
    }
    const { data, columns } = t.options
    if (pruned.current.data === data && pruned.current.columns === columns) {
      return
    }
    pruned.current = { data, columns }
    if (Object.keys(readHighlights(table)).length === 0) {
      return
    }
    const core = t.getCoreRowModel().rowsById
    const grouped = t.getGroupedRowModel?.().rowsById
    const columnIds = new Set(t.getAllFlatColumns().map(column => column.id))
    pruneHighlights(
      table,
      id => id in core || (!!grouped && id in grouped),
      id => columnIds.has(id),
    )
  })

  // Дев-варн статической инертности плагинов (ADR 0036, PQ2) — на смену набора.
  useEffect(
    () => {
      const { getPluginDiagnostics } = table as {
        getPluginDiagnostics?: () => PluginDiagnostic[]
      }
      if (getPluginDiagnostics) {
        warnInertPlugins(getPluginDiagnostics.call(table), table)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature],
  )

  // Дев-варн на смену аргумента-договора после монтирования (ADR 0039, RX4).
  const violationsKey = lifetimeViolations.join('|')
  useEffect(() => {
    for (const violation of lifetimeViolations) {
      logWarn(
        host,
        `${violation} — договор на время жизни таблицы: смена после монтирования не применяется; пересоздайте таблицу (key)`,
        `lifetime:${violation}`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу нарушений
  }, [violationsKey, host])

  // Дев-варн на коллизию id плагинов (DP5): id ключует hooks-scope, локальный state и
  // генерируемую фичу — дубль молча перезапишет их. Печатается один раз на набор.
  const pluginIdsKey = plugins.map(entry => entry.id).join('|')
  const duplicateIds = useMemo(
    () => findDuplicatePluginIds(plugins),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по полному набору id
    [pluginIdsKey],
  )
  useEffect(() => {
    if (duplicateIds.length === 0) {
      return
    }
    logWarn(
      host,
      `дублирующиеся id плагинов: ${duplicateIds.join(', ')} — id ключует hooks-scope, локальный state и генерируемую фичу; коллизия перезапишет их (последний победил)`,
      `dup-plugin-id:${duplicateIds.join(',')}`,
    )
  }, [duplicateIds, host])

  // Дев-варн: срез плагина передан в state/handlers ядра (ADR 0120, MP7).
  const foreignKey = foreignSlices.join(',')
  useEffect(() => {
    for (const path of foreignSlices) {
      logWarn(host, foreignSliceMessage(path), `foreign-slice:${path}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу срезов
  }, [foreignKey, host])

  // Дев-варн: аргументы модели у интерфейса расходятся с явной моделью (ADR 0120, MP5).
  const mismatchesKey = modelMismatches
    .map(({ modelId, includedBy }) => `${includedBy}>${modelId}`)
    .join(',')
  useEffect(() => {
    for (const { modelId, includedBy } of modelMismatches) {
      logWarn(
        host,
        `аргументы модели у ${includedBy} не действуют: в наборе есть явная ${modelId} — её аргументы главнее; задайте их у ${modelId}`,
        `model-args:${includedBy}>${modelId}`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу расхождений
  }, [mismatchesKey, host])

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
      host,
      `несколько владельцев cellSlot: ${cellSlotOwners.join(', ')} — владение ячейкой эксклюзивно; при одновременной активности внешний (первый) замещает контент, остальные не рендерятся`,
      `multi-cell-slot:${cellSlotOwners.join(',')}`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу владельцев
  }, [cellSlotOwners.join('|'), host])

  // Сброс выбора строк при смене опций выбора (ядровая логика). Триггер
  // ТОЛЬКО по изменению самих опций (через ref), а не по идентичности table — иначе
  // нестабильный ref из useTable запускал бы reset каждый рендер (бесконечный цикл).
  const { enableRowSelection, enableSubRowSelection } = host.options as {
    enableRowSelection?: unknown
    enableSubRowSelection?: unknown
  }
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
}

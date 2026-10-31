/**
 * Эффекты после создания таблицы: императивный сетап плагинов, дев-варны об
 * инертных плагинах и конфликтах набора, сброс выбора строк при смене его опций.
 */
import { useEffect, useMemo, useRef } from 'react'

import {
  findDuplicatePluginIds,
  findPluginOverwrites,
  type FoldedEntryConfig,
  type TesseraFeatureEntry,
} from './features'
import { readPluginHooks, writePluginAtom } from './definePlugin/channels'
import { logWarn } from '../util/logger'
import {
  type ModelArgsMismatch,
  modelArgsMismatchMessage,
} from './pluginModels'
import { foreignSliceMessage } from './coreState'
import { pruneFlashes, readFlashes } from './flashes/flashFeature'
import { pruneHighlights, readHighlights } from './highlights/highlightFeature'
import { followIndexRanges } from './highlights/followRanges'
import { rowSourceOf } from './rowSource'
import { abortServerActions } from './serverActions'
import {
  type PluginDiagnostic,
  reportPluginError,
  warnInertPlugins,
} from './pluginDiagnostics'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'

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

  // Подсветка и вспышки целей, ушедших из данных или колонок, снимаются (ADR 0080, §1;
  // ADR 0134, §4) — при новой ссылке `data`/`columns`. Скрытые фильтром и страницей
  // строки остаются в core-модели и их сохраняют.
  const pruned = useRef<{ data?: unknown; columns?: unknown }>({})
  useIsomorphicLayoutEffect(() => {
    const t = table as {
      options: { data?: unknown; columns?: unknown }
      getAllFlatColumns: () => { id: string }[]
    }
    const { data, columns } = t.options
    if (pruned.current.data === data && pruned.current.columns === columns) {
      return
    }
    pruned.current = { data, columns }
    const highlighted = Object.keys(readHighlights(table)).length > 0
    const flashed = Object.keys(readFlashes(table)).length > 0
    if (!highlighted && !flashed) {
      return
    }
    const rows = rowSourceOf(table)
    const columnIds = new Set(t.getAllFlatColumns().map(column => column.id))
    const hasRow = (id: string) => rows.byId(id) !== undefined
    const hasColumn = (id: string) => columnIds.has(id)
    if (highlighted) {
      pruneHighlights(table, hasRow, hasColumn)
    }
    if (flashed) {
      pruneFlashes(table, hasRow, hasColumn)
    }
  })

  // Диапазоны подсветки и вспышки на индексах следуют за списком строк (ADR 0152, §4).
  useEffect(() => followIndexRanges(table), [table])

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

  // Дев-варн: опцию или хуки плагина перезаписал другой плагин (ADR 0140). Считается по
  // значению аргументов фабрик, а не на каждой перерисовке.
  const overwrites = useMemo(
    () => findPluginOverwrites(plugins),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по значению аргументов
    [argsSignature],
  )
  const overwritesKey = overwrites
    .map(({ kind, key, from, to }) => `${kind}:${key}:${from}:${to}`)
    .join('|')
  useEffect(() => {
    for (const { kind, key, from, to } of overwrites) {
      logWarn(
        host,
        `plugin ${kind} "${key}" set by "${from}" is overwritten by "${to}" — the last plugin in plugins wins`,
        `overwrite:${kind}:${key}:${from}:${to}`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу перезаписей
  }, [overwritesKey, host])

  // Дев-варн: срез плагина передан в state/handlers ядра (ADR 0120, MP7).
  const foreignKey = foreignSlices.join(',')
  useEffect(() => {
    for (const path of foreignSlices) {
      logWarn(host, foreignSliceMessage(path), `foreign-slice:${path}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по составу срезов
  }, [foreignKey, host])

  // Дев-варн: аргументы модели у интерфейса не действуют (ADR 0120, MP5, MP18).
  const mismatchesKey = modelMismatches
    .map(({ modelId, includedBy }) => `${includedBy}>${modelId}`)
    .join(',')
  useEffect(() => {
    for (const mismatch of modelMismatches) {
      logWarn(
        host,
        modelArgsMismatchMessage(mismatch),
        `model-args:${mismatch.includedBy}>${mismatch.modelId}`,
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
  // Монтирование — не смена: начальный выбор (`initialRowSelection`) остаётся, а
  // колбэк среза не зовётся (ADR 0120, MP9).
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
    const previous = prevSelectionOpts.current
    prevSelectionOpts.current = selectionOptsKey
    if (previous === undefined || previous === selectionOptsKey) {
      return
    }
    ;(
      table as { resetRowSelection?: (defaultState?: boolean) => void }
    ).resetRowSelection?.(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionOptsKey])
}

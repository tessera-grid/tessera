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
import { readPluginHooks } from './definePlugin/channels'
import { warnClientOverPartialRows, warnDataModeInServerRows } from './dataMode'
import { logWarn } from '../util/logger'
import {
  type ModelArgsMismatch,
  modelArgsMismatchMessage,
} from './pluginModels'
import { foreignSliceMessage } from './coreState'
import { pruneFailures, readFailures } from './failures/failuresFeature'
import { pruneFlashes, readFlashes } from './flashes/flashFeature'
import { pruneHighlights, readHighlights } from './highlights/highlightFeature'
import { followIndexRanges } from './highlights/followRanges'
import { rowSourceOf } from './rowSource'
import { checkDataChange, type SeenData } from './dataFollow'
import { abortServerActions } from './serverActions'
import {
  type PluginDiagnostic,
  reportPluginError,
  warnInertPlugins,
} from './pluginDiagnostics'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'
import { useLatest } from '../util/useLatest'

/** `instance` — сам экземпляр таблицы: подписки живут дольше рендера, а опции копии `table` — нет. */
export const useTableEffects = (
  table: unknown,
  instance: unknown,
  plugins: readonly TesseraFeatureEntry[],
  folded: FoldedEntryConfig,
  signature: string,
  argsSignature: string,
  lifetimeViolations: readonly string[],
  modelMismatches: readonly ModelArgsMismatch[] = [],
  foreignSlices: readonly string[] = [],
) => {
  const host = table as Parameters<typeof logWarn>[0]
  const { store } = table as { store: object }

  // Размонтирование прерывает ожидающее серверное действие (ADR 0116, SA2).
  useEffect(() => () => abortServerActions(store), [store])

  // Императивный сетап плагинов (generic-escape) — единым эффектом; перезапускается
  // только при смене состава набора или значения аргументов фабрик (ADR 0039, RX24).
  // Подписки `setup` читают живые опции экземпляра (RX28).
  useEffect(
    () => {
      const cleanups = folded.setups.map(setup => setup(instance))
      return () => {
        cleanups.forEach(cleanup => cleanup?.())
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по значению аргументов
    [argsSignature],
  )

  // Согласование состояния плагинов с таблицей — после каждого рендера приложения и каждой
  // смены состояния таблицы, и у выключенных записей (ADR 0040, §2; ADR 0196, §1).
  const reconcile = useLatest(() => {
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
  // Согласование само пишет срезы: повтор — после него, а не внутри. Смена состояния будит
  // согласование после записи, которая её сделала, — запись плагина не прерывается посреди.
  const reconciling = useRef({ running: false, again: false, queued: false })
  const runReconcile = useLatest(() => {
    const state = reconciling.current
    if (state.running) {
      state.again = true
      return
    }
    state.running = true
    try {
      do {
        state.again = false
        reconcile.current()
      } while (state.again)
    } finally {
      state.running = false
    }
  })
  useIsomorphicLayoutEffect(() => runReconcile.current())
  useEffect(() => {
    const state = reconciling.current
    let live = true
    const subscription = (
      store as {
        subscribe: (listener: () => void) => { unsubscribe: () => void }
      }
    ).subscribe(() => {
      if (state.queued) return
      state.queued = true
      queueMicrotask(() => {
        state.queued = false
        if (live) runReconcile.current()
      })
    })
    return () => {
      live = false
      subscription.unsubscribe()
    }
  }, [store, runReconcile])

  // Подсветка и вспышки целей, ушедших из данных или колонок, снимаются (ADR 0080, §1;
  // ADR 0134, §4) — при новой ссылке `data`/`columns`. Скрытые фильтром и страницей
  // строки остаются в core-модели и их сохраняют. Отказы значений ячеек ушедших строк и
  // изменённых извне значений решены (ADR 0177, §5).
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
    if (Object.keys(readFailures(table)).length > 0) {
      pruneFailures(table)
    }
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

  // Новый `data` клиента: активная ячейка и выделение держат свои строки (ADR 0194, IU12).
  const seenData = useRef<SeenData | undefined>(undefined)
  useIsomorphicLayoutEffect(() => {
    seenData.current = checkDataChange(instance, seenData.current)
  })

  // Диапазоны подсветки и вспышки на индексах следуют за списком строк (ADR 0152, §4). Держим по
  // `store`: подписка на новый объект таблицы не увидела бы смену списка в эффекте потомка (TG21).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- таблица живёт вместе со store
  useEffect(() => followIndexRanges(instance), [store])

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

  // Дев-варны режима данных (ADR 0169): противоречие серверной модели строк — на смену
  // набора (MD4); клиентская операция над частью строк — на смену срезов (MD5).
  useEffect(
    () => {
      warnDataModeInServerRows(instance)
      warnClientOverPartialRows(instance)
      const subscription = (
        instance as {
          store: {
            subscribe: (listener: () => void) => { unsubscribe: () => void }
          }
        }
      ).store.subscribe(() => warnClientOverPartialRows(instance))
      return () => subscription.unsubscribe()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по значению аргументов
    [argsSignature, store],
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

  // Дев-варн: действие справочника объявлено дважды — действует первое (ADR 0182, AN1).
  const actionDuplicatesKey = folded.actionDuplicates.join(',')
  useEffect(() => {
    if (!actionDuplicatesKey) return
    logWarn(
      host,
      `actions: duplicate action ${actionDuplicatesKey} — the first declaration is used`,
      `dup-action:${actionDuplicatesKey}`,
    )
  }, [actionDuplicatesKey, host])

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
}

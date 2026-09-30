/**
 * Эффекты после создания таблицы: императивный сетап плагинов, дев-варны об
 * инертных плагинах и конфликтах набора, сброс выбора строк при смене его опций.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

import {
  findDuplicatePluginIds,
  type FoldedEntryConfig,
  type TesseraFeatureEntry,
} from './features'
import { readPluginHooks } from './definePlugin/channels'
import { logWarn } from './logger'
import {
  type PluginDiagnostic,
  reportPluginError,
  warnInertPlugins,
} from './pluginDiagnostics'

export const useTableEffects = (
  table: unknown,
  plugins: readonly TesseraFeatureEntry[],
  folded: FoldedEntryConfig,
  signature: string,
  argsSignature: string,
  lifetimeViolations: readonly string[],
) => {
  const host = table as Parameters<typeof logWarn>[0]

  // Императивный сетап плагинов (generic-escape) — единым эффектом; перезапускается
  // и при смене значения аргументов фабрик (ADR 0039).
  useEffect(
    () => {
      const cleanups = folded.setups.map(setup => setup(table))
      return () => {
        cleanups.forEach(cleanup => cleanup?.())
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по значению аргументов
    [argsSignature, table],
  )

  // Согласование состояния плагинов с таблицей — после каждого рендера, и у
  // выключенных записей (ADR 0040, §2).
  useLayoutEffect(() => {
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
      host,
      `дублирующиеся id плагинов: ${duplicateIds.join(', ')} — id ключует hooks-scope, локальный state и генерируемую фичу; коллизия перезапишет их (последний победил)`,
      `dup-plugin-id:${duplicateIds.join(',')}`,
    )
  }, [duplicateIds, host])

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

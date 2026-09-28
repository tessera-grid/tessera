/**
 * Эффекты после создания таблицы: императивный сетап плагинов, дев-варны о
 * конфликтах набора и сброс выбора строк при смене его опций.
 */
import { useEffect, useMemo, useRef } from 'react'

import {
  findDuplicatePluginIds,
  type FoldedEntryConfig,
  type TesseraFeatureEntry,
} from './features'
import { logWarn } from './logger'

export const useTableEffects = (
  table: unknown,
  plugins: readonly TesseraFeatureEntry[],
  folded: FoldedEntryConfig,
  signature: string,
) => {
  const host = table as Parameters<typeof logWarn>[0]

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

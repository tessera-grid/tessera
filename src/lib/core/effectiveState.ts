/**
 * Эффективное состояние при сужении параметров (ADR 0039, §4, RX8–RX12). Плагин
 * объявляет сужение среза (`narrow`): функцию «сохранённое → допустимое». Ядро
 * хранит сохранённое значение само (неконтролируемый срез) или берёт его у
 * потребителя (контролируемый) и отдаёт TanStack эффективное через `state` — мемо
 * row-моделей видят изменившийся срез штатно. Сохранённое не переписывается: вернули
 * параметр — вернулось прежнее состояние; контролируемому потребителю `on*Change`
 * из-за сужения не приходит.
 */
import { useLayoutEffect, useRef, useState } from 'react'

import { functionalUpdate } from '@tanstack/react-table'

/**
 * Сужение среза. `table` — экземпляр с текущими данными и колонками или `null`
 * (монтирование, смена данных). Возвращает то же значение, если сужать нечего;
 * `undefined` — без таблицы не посчитать (ядро пересчитает после рендера).
 */
export type NarrowState = (value: any, table: any) => unknown

export type NarrowMap = Record<string, NarrowState[]>

const MAX_FORCED_RENDERS = 2

const handlerOf = (key: string) =>
  `on${key.charAt(0).toUpperCase()}${key.slice(1)}Change`

/** Применить цепочку сужений; `undefined` от любого звена — без таблицы не посчитать. */
export const applyNarrow = (
  narrows: readonly NarrowState[],
  value: unknown,
  table: unknown,
): unknown => {
  let current = value
  for (const narrow of narrows) {
    const next = narrow(current, table)
    if (next === undefined) {
      return undefined
    }
    current = next
  }
  return current
}

interface CacheEntry {
  raw: unknown
  narrows: readonly NarrowState[]
  token: unknown
  result: unknown
}

interface EffectiveStateParams {
  narrow: NarrowMap
  /**
   * Срезы, которыми ядро уже владеет само (пиннинг): их значение сужается, но
   * обработчик смены остаётся у владельца.
   */
  owned: Record<string, unknown>
  state: Record<string, unknown>
  handlers: Record<string, unknown>
  /** Экземпляр с текущими данными — для сужения; `null`, если данные сменились. */
  table: unknown
  /** Атомы любого прежнего экземпляра — источник сохранённого значения. */
  getAtoms: () => Record<string, { get: () => unknown }> | undefined
  /** Меняется вместе с данными и колонками: сужение по строкам пересчитывается. */
  token: unknown
}

export const useEffectiveState = ({
  narrow,
  owned,
  state,
  handlers,
  table,
  getAtoms,
  token,
}: EffectiveStateParams) => {
  const [inner, setInner] = useState<Record<string, unknown>>({})
  const cache = useRef(new Map<string, CacheEntry>())
  const [, forceRender] = useState(0)
  const forced = useRef(0)
  let pending = false

  const stateOut: Record<string, unknown> = {}
  const handlersOut: Record<string, unknown> = {}

  for (const key of Object.keys(narrow)) {
    const isOwned = key in owned
    const handlerName = handlerOf(key)
    const external = handlers[handlerName] as
      ((updater: unknown) => void) | undefined
    const raw = isOwned
      ? owned[key]
      : state[key] !== undefined
        ? state[key]
        : key in inner
          ? inner[key]
          : getAtoms()?.[key]?.get()

    if (!isOwned)
      handlersOut[handlerName] = (updater: unknown) => {
        if (external) {
          external(updater)
          return
        }
        setInner(prev => ({
          ...prev,
          [key]: functionalUpdate(
            updater as never,
            (key in prev ? prev[key] : getAtoms()?.[key]?.get()) as never,
          ),
        }))
      }

    if (raw === undefined) {
      continue
    }
    const cached = cache.current.get(key)
    let result: unknown
    if (
      cached &&
      cached.raw === raw &&
      cached.narrows === narrow[key] &&
      cached.token === token
    ) {
      result = cached.result
    } else {
      result = applyNarrow(narrow[key], raw, table)
      if (result === undefined) {
        pending = true
        result = raw
      } else {
        cache.current.set(key, { raw, narrows: narrow[key], token, result })
      }
    }
    stateOut[key] = result
  }

  // Сужение, которому нужна таблица, до её обновления не посчитать — пересчёт после
  // коммита. Предел — если данные новые каждый рендер (не мемоизированы), таблица
  // никогда не «свежая», и без предела это был бы бесконечный цикл.
  useLayoutEffect(() => {
    if (!pending) {
      forced.current = 0
      return
    }
    if (forced.current < MAX_FORCED_RENDERS) {
      forced.current += 1
      forceRender(tick => tick + 1)
    }
  })

  return { state: stateOut, handlers: handlersOut }
}

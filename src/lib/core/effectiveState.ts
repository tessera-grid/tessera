/**
 * Эффективное состояние при сужении параметров (ADR 0039, §4, RX8–RX12). Плагин
 * объявляет сужение среза (`narrow`): функцию «сохранённое → допустимое». Ядро
 * хранит сохранённое значение само (неконтролируемый срез) или берёт его у
 * потребителя (контролируемый) и отдаёт TanStack эффективное через `state` — мемо
 * row-моделей видят изменившийся срез штатно. Сохранённое не переписывается: вернули
 * параметр — вернулось прежнее состояние; контролируемому потребителю `on*Change`
 * из-за сужения не приходит.
 */
import { useRef, useState } from 'react'

import { functionalUpdate } from '@tanstack/react-table'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

/** Текущая свёртка набора (опции, действия слотов) — свежее, чем опции `table`. */
export interface NarrowContext {
  options: Record<string, unknown>
  slotActions: Partial<Record<string, readonly unknown[]>>
}

/**
 * Сужение среза. `table` — экземпляр с текущими данными и колонками или `null`
 * (монтирование, смена данных). Возвращает то же значение, если сужать нечего;
 * `undefined` — без таблицы не посчитать (ядро пересчитает после рендера).
 */
export type NarrowState = (
  value: any,
  table: any,
  context: NarrowContext,
) => unknown

export type NarrowMap = Record<string, NarrowState[]>

const MAX_FORCED_RENDERS = 2

const handlerOf = (key: string) =>
  `on${key.charAt(0).toUpperCase()}${key.slice(1)}Change`

/** Применить цепочку сужений; `undefined` от любого звена — без таблицы не посчитать. */
export const applyNarrow = (
  narrows: readonly NarrowState[],
  value: unknown,
  table: unknown,
  context: NarrowContext = { options: {}, slotActions: {} },
): unknown => {
  let current = value
  for (const narrow of narrows) {
    const next = narrow(current, table, context)
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
  inputs: readonly unknown[]
  result: unknown
}

const sameInputs = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])

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
  /** Данные и подпись структуры колонок: при смене любого сужение пересчитывается. */
  inputs: readonly unknown[]
  context: NarrowContext
  /** Начальное значение среза, которым TanStack не владеет до первого рендера. */
  initial?: Record<string, unknown>
  /** Колбэки срезов из аргументов плагинов: получают новое значение (ADR 0120, MP8). */
  listeners?: Record<string, ((next: unknown) => void) | undefined>
}

export const useEffectiveState = ({
  narrow,
  owned,
  state,
  handlers,
  table,
  getAtoms,
  inputs,
  context,
  initial = {},
  listeners = {},
}: EffectiveStateParams) => {
  const [inner, setInner] = useState<Record<string, unknown>>({})
  // Синхронная копия `inner`: новое значение нужно колбэку сразу, вне функции обновления.
  const innerRef = useRef(inner)
  const cache = useRef(new Map<string, CacheEntry>())
  const [tick, forceRender] = useState(0)
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
          : key in initial
            ? initial[key]
            : getAtoms()?.[key]?.get()

    const listener = listeners[key]
    if (!isOwned)
      handlersOut[handlerName] = (updater: unknown) => {
        external?.(updater)
        // Без контролируемого значения срез хранит ядро — и при колбэке потребителя.
        if (state[key] !== undefined && (external || listener)) {
          listener?.(functionalUpdate(updater as never, state[key] as never))
          return
        }
        const prev = innerRef.current
        const next = functionalUpdate(
          updater as never,
          (key in prev
            ? prev[key]
            : key in initial
              ? initial[key]
              : getAtoms()?.[key]?.get()) as never,
        )
        innerRef.current = { ...prev, [key]: next }
        setInner(innerRef.current)
        listener?.(next)
      }

    if (raw === undefined) {
      // Сброс в `undefined` (`resetGlobalFilter`) — тоже значение: TanStack читает своё
      // свойство `undefined` как начальное, а без свойства — прежнее из базового атома.
      if (!isOwned && state[key] === undefined && key in inner) {
        stateOut[key] = undefined
      }
      continue
    }
    const cached = cache.current.get(key)
    let result: unknown
    if (
      cached &&
      cached.raw === raw &&
      cached.narrows === narrow[key] &&
      sameInputs(cached.inputs, inputs)
    ) {
      result = cached.result
    } else {
      result = applyNarrow(narrow[key], raw, table, context)
      if (result === undefined) {
        pending = true
        result = raw
      } else {
        cache.current.set(key, { raw, narrows: narrow[key], inputs, result })
      }
    }
    stateOut[key] = result
  }

  // Сужение, которому нужна таблица, до её обновления не посчитать — пересчёт после
  // коммита; `tick` перезапускает проверку после каждой принудительной перерисовки.
  // Предел — если данные новые каждый рендер (не мемоизированы), таблица никогда не
  // «свежая», и без предела это был бы бесконечный цикл.
  useIsomorphicLayoutEffect(() => {
    if (!pending) {
      forced.current = 0
      return
    }
    if (forced.current < MAX_FORCED_RENDERS) {
      forced.current += 1
      forceRender(previous => previous + 1)
    }
  }, [pending, tick])

  return { state: stateOut, handlers: handlersOut }
}

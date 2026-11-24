import {
  type Range,
  type Virtualizer,
  defaultRangeExtractor,
} from '../../../vendor/tanstack-virtual/react-virtual'
import { startTransition, useEffect, useState } from 'react'

/** Полоса окна включена; перф WB7–WB8 выключает её для базы. */
export const windowBand = { enabled: true }

export interface WindowBand {
  /** Индексы окна: видимое и запас по ходу прокрутки (ADR 0202, §1). */
  (range: Range): number[]
  /** Первый и последний индекс полосы последнего вызова, без закреплённых далёких строк. */
  current: () => readonly [number, number] | null
  /** Окно — в покой: видимое и, если нужен, симметричный запас (ADR 0202, §1а). */
  rest: (visibleOnly?: boolean) => void
  /** Полоса дорастает из покоя без сдвига: следующее окно — полоса вперёд. Было ли в покое. */
  grow: () => boolean
  isResting: () => boolean
}

/**
 * Полоса окна виртуализатора: впереди по ходу прокрутки `2 × overscan` элементов, позади —
 * один; держится, пока впереди не меньше `⌈overscan / 2⌉` или полоса у края списка. Создаётся
 * в покое: окно — видимое и симметричный запас, пока по оси не сдвинулись или полоса не выросла.
 */
export const createWindowBand = (): WindowBand => {
  let band: [number, number] | null = null
  let lastStart: number | undefined
  let forward = true
  let resting = true
  let visibleOnly = false
  let last: readonly [number, number] | null = null
  const symmetric = (range: Range) => {
    band = null
    const indexes = defaultRangeExtractor(range)
    last = indexes.length ? [indexes[0]!, indexes.at(-1)!] : null
    return indexes
  }
  const extract = (range: Range): number[] => {
    if (!windowBand.enabled) return symmetric(range)
    const { startIndex: start, endIndex: end, overscan, count } = range
    if (count === 0) {
      band = null
      last = null
      return []
    }
    if (lastStart === undefined) lastStart = start
    if (start !== lastStart) {
      forward = start > lastStart
      resting = false
    }
    lastStart = start
    if (resting) {
      const indexes = symmetric(visibleOnly ? { ...range, overscan: 0 } : range)
      // Окно покоя — полоса для первого сдвига: держится, пока видимое внутри и впереди есть запас.
      band = last ? [last[0], last[1]] : null
      return indexes
    }
    const margin = Math.max(1, Math.ceil(overscan / 2))
    const keep =
      band !== null &&
      band[1] < count &&
      start >= band[0] &&
      end <= band[1] &&
      (forward
        ? band[1] - end >= margin || band[1] === count - 1
        : start - band[0] >= margin || band[0] === 0)
    if (!keep) {
      const ahead = Math.max(1, overscan * 2)
      band = forward
        ? [Math.max(0, start - 1), Math.min(count - 1, end + ahead)]
        : [Math.max(0, start - ahead), Math.min(count - 1, end + 1)]
    }
    const [from, to] = band!
    last = band
    const indexes = new Array<number>(to - from + 1)
    for (let i = from; i <= to; i++) indexes[i - from] = i
    return indexes
  }
  return Object.assign(extract, {
    current: () => last,
    rest: (onlyVisible = false) => {
      resting = true
      visibleOnly = onlyVisible
    },
    grow: () => {
      if (!resting) return false
      resting = false
      band = null
      forward = true
      return true
    },
    isResting: () => resting,
  })
}

/**
 * Как рисовать окно после уведомления виртуализатора: синхронно в событии прокрутки, если в
 * видимом диапазоне есть индекс не из отрисованного окна (ADR 0202, §2); переходом React, пока
 * окно ни разу не нарисовано, — первое окно режется на куски (ADR 0203, §1).
 */
/** `incremental` — включён ли первый рендер по кускам (ADR 0203). */
export const createWindowFlush = (incremental: () => boolean) => {
  let rendered = new Set<number>()
  return {
    /** Окно, что показывает этот рендер. */
    show: (indexes: readonly number[]) => {
      rendered = new Set(indexes)
    },
    flush: (instance: Virtualizer<any, any>): boolean | 'transition' => {
      if (rendered.size === 0 && incremental()) return 'transition'
      const range = instance.range
      if (!range) return false
      for (let i = range.startIndex; i <= range.endIndex; i++) {
        if (!rendered.has(i)) return true
      }
      return false
    },
  }
}

/**
 * Покой и рост полосы (ADR 0202, §1а): смена списка строк — окно в покой; в следующем кадре
 * полоса дорастает переходом React, который прерывает ввод. Без рендера порциями (ADR 0203,
 * `deferred: false`) покоя нет: окно рисуется одним проходом, без переходов. Возвращает версию
 * окна — зависимость `rangeExtractor`: без неё виртуализатор отдаст прежние индексы.
 */
export const useBandRest = (
  band: WindowBand,
  listKey: unknown,
  deferred: boolean,
  visibleOnReplace = false,
) => {
  const [state, setState] = useState({ key: listKey, version: 0 })
  if (!deferred) band.grow()
  else if (windowBand.enabled && state.key !== listKey) {
    band.rest(visibleOnReplace)
    setState({ key: listKey, version: state.version + 1 })
  }
  useEffect(() => {
    if (!deferred || !windowBand.enabled || !band.isResting()) return
    const id = requestAnimationFrame(() =>
      startTransition(() => {
        if (band.grow()) setState(s => ({ ...s, version: s.version + 1 }))
      }),
    )
    return () => cancelAnimationFrame(id)
  }, [band, state.version, deferred])
  return state.version
}

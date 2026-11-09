import {
  type Range,
  type Virtualizer,
  defaultRangeExtractor,
} from '../../../vendor/tanstack-virtual/react-virtual'

/** Полоса окна включена; перф WB7–WB8 выключает её для базы. */
export const windowBand = { enabled: true }

export interface WindowBand {
  /** Индексы окна: видимое и запас по ходу прокрутки (ADR 0202, §1). */
  (range: Range): number[]
  /** Первый и последний индекс полосы последнего вызова, без закреплённых далёких строк. */
  current: () => readonly [number, number] | null
}

/**
 * Полоса окна виртуализатора: впереди по ходу прокрутки `2 × overscan` элементов, позади —
 * один; держится, пока впереди не меньше `⌈overscan / 2⌉` или полоса у края списка.
 */
export const createWindowBand = (): WindowBand => {
  let band: [number, number] | null = null
  let lastStart = -1
  let forward = true
  let last: readonly [number, number] | null = null
  const extract = (range: Range): number[] => {
    if (!windowBand.enabled) {
      band = null
      const indexes = defaultRangeExtractor(range)
      last = indexes.length ? [indexes[0]!, indexes.at(-1)!] : null
      return indexes
    }
    const { startIndex: start, endIndex: end, overscan, count } = range
    if (count === 0) {
      band = null
      last = null
      return []
    }
    if (start !== lastStart) forward = start > lastStart
    lastStart = start
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
  return Object.assign(extract, { current: () => last })
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

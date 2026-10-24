/**
 * Вспышка итога на цели асинхронного действия (ADR 0134): срез `flashes` и
 * `table.flashOutcome`. Ядровая фича, всегда включена, как подсветка (ADR 0080), но
 * со своим срезом: подсветку приложения вспышка не трогает. Цели — по id, поэтому
 * вспышка переживает размонтирование цели виртуализацией.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import { readGridToken } from '../announcer'
import { reportAction } from '../debugActions'
import {
  type HighlightTarget,
  parseTargetKey,
  targetKey,
} from '../highlights/highlightFeature'
import { parseDuration } from '../../ui/buttonStates/useErrorFlash'
import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'

/** Итог: здесь появилось, сервер принял запись, грид вернул прежнее. */
export type FlashOutcome = 'arrived' | 'accepted' | 'reverted'

export interface FlashEntry {
  outcome: FlashOutcome
  /** Новая вспышка той же цели — новый объект: перерисовка только этой цели. */
  id: number
  /** Удержание вышло, вспышка гаснет переходом. */
  out?: true
  /** Момент по `performance.now()`, когда кончается удержание или угасание. */
  until: number
}

/** Ключ цели — как у подсветки: `r` — строка, `c` — ячейка, `k` — колонка. */
export type Flashes = Record<string, FlashEntry>

interface FlashStateSlice {
  flashes: Flashes
}
interface FlashOptionsSlice {
  onFlashesChange?: (updater: Updater<Flashes>) => void
}
interface FlashTableAPI {
  setFlashes: (updater: Updater<Flashes>) => void
  /** Вспышка итога на строке, ячейке или колонке (ADR 0134). */
  flashOutcome: (
    target: HighlightTarget | readonly HighlightTarget[],
    outcome: FlashOutcome,
  ) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    flashFeature: TableFeature
  }
  interface TableState_FeatureMap {
    flashFeature: FlashStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    flashFeature: FlashOptionsSlice
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    flashFeature: FlashTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const OUTCOMES: readonly FlashOutcome[] = ['arrived', 'accepted', 'reverted']

const EMPTY: Flashes = {}

/** Запас времени без смонтированного грида, мс: удержание и угасание любого итога. */
const FALLBACK = { hold: 300, fade: 500 }

const tokenMs = (table: unknown, name: string): number | undefined => {
  const value = readGridToken(table, name)
  return value ? parseDuration(value) : undefined
}

/** Удержание и угасание вспышки по токенам темы грида — одни у всех итогов. */
export const flashTiming = (table: unknown) => ({
  hold: tokenMs(table, '--tsr-comp-flash-duration') ?? FALLBACK.hold,
  fade: tokenMs(table, '--tsr-comp-flash-fade-duration') ?? FALLBACK.fade,
})

/* --------------------------------- срез --------------------------------- */

type FlashesAtom = { get: () => Flashes; set: (value: Flashes) => void }
type FlashTable = {
  atoms: { flashes?: FlashesAtom }
  store: object
}

export const readFlashes = (table: unknown): Flashes =>
  (table as FlashTable | undefined)?.atoms?.flashes?.get() ?? EMPTY

const write = (table: unknown, updater: (prev: Flashes) => Flashes) =>
  (table as { setFlashes?: (updater: Updater<Flashes>) => void }).setFlashes?.(
    updater,
  )

let nextId = 1

/** Один таймер на таблицу — на ближайший конец удержания или угасания. */
const timers = new WeakMap<object, ReturnType<typeof setTimeout>>()

/** Удержание вышло — гаснуть; угасание вышло — убрать. */
export const advanceFlashes = (
  flashes: Flashes,
  now: number,
  fade: number,
): Flashes => {
  let next: Flashes | undefined
  for (const key of Object.keys(flashes)) {
    const entry = flashes[key]!
    if (entry.until > now) {
      continue
    }
    next ??= { ...flashes }
    if (entry.out) {
      delete next[key]
    } else {
      next[key] = { ...entry, out: true, until: now + fade }
    }
  }
  return next ?? flashes
}

const sweep = (table: unknown) => {
  const store = (table as FlashTable).store
  clearTimeout(timers.get(store))
  timers.delete(store)
  const now = performance.now()
  if (Object.values(readFlashes(table)).some(entry => entry.until <= now)) {
    const { fade } = flashTiming(table)
    write(table, prev => advanceFlashes(prev, now, fade))
  }
  const left = Object.values(readFlashes(table))
  if (left.length > 0) {
    const due = Math.min(...left.map(entry => entry.until)) - now
    timers.set(
      store,
      setTimeout(() => sweep(table), Math.max(0, due)),
    )
  }
}

export const flashOutcome = (
  table: unknown,
  target: HighlightTarget | readonly HighlightTarget[],
  outcome: FlashOutcome,
) => {
  if (!OUTCOMES.includes(outcome)) {
    return
  }
  const targets = (
    Array.isArray(target) ? target : [target]
  ) as HighlightTarget[]
  if (targets.length === 0) {
    return
  }
  const until = performance.now() + flashTiming(table).hold
  write(table, prev => {
    const next = { ...prev }
    for (const item of targets) {
      next[targetKey(item)] = { outcome, id: nextId++, until }
    }
    return next
  })
  sweep(table)
}

/** Убрать вспышки целей, которых больше нет в данных или колонках. */
export const pruneFlashes = (
  table: unknown,
  hasRow: (rowId: string) => boolean,
  hasColumn: (columnId: string) => boolean,
) => {
  const gone = Object.keys(readFlashes(table)).filter(key => {
    const { rowId, columnId } = parseTargetKey(key)
    return (
      (rowId !== undefined && !hasRow(rowId)) ||
      (columnId !== undefined && !hasColumn(columnId))
    )
  })
  if (gone.length === 0) {
    return
  }
  write(table, prev => {
    const next = { ...prev }
    gone.forEach(key => delete next[key])
    return next
  })
  sweep(table)
}

export const flashFeature: TableFeature = {
  getInitialState: state => ({ flashes: EMPTY, ...state }),
  getDefaultTableOptions: table => ({
    onFlashesChange: makeStateUpdater('flashes', table),
  }),
  constructTableAPIs: table => {
    assignTableAPIs('flashFeature', table, {
      table_setFlashes: {
        fn: (updater: Updater<Flashes>) => {
          const opts = table.options as FlashOptionsSlice
          if (opts.onFlashesChange) {
            opts.onFlashesChange(updater)
            return
          }
          const atom = (table as unknown as FlashTable).atoms.flashes
          atom?.set(functionalUpdate(updater, atom.get()))
        },
      },
      table_flashOutcome: {
        fn: (
          target: HighlightTarget | readonly HighlightTarget[],
          outcome: FlashOutcome,
        ) => {
          reportAction(table, {
            plugin: 'core',
            action: 'flashOutcome',
            detail: () => ({ target, outcome }),
          })
          flashOutcome(table, target, outcome)
        },
      },
    })
  },
}

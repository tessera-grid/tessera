/**
 * Публичная подсветка строк, ячеек и колонок (ADR 0080): срез `highlights` и
 * `table.highlight`/`table.clearHighlights`. Ядровая фича, всегда включена: API
 * доступно приложению и любому плагину. Цели — по id, поэтому подсветка переживает
 * размонтирование строки виртуализацией.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import { announce, readGridToken } from '../announcer'
import { logWarn } from '../logger'
import { parseDuration } from '../../ui/buttonStates/useErrorFlash'
import { revealColumn, scrollToRow } from '../scrollToRow/scrollToRowFeature'
import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'

export type HighlightTarget =
  | { row: string }
  | { cell: readonly [rowId: string, columnId: string] }
  | { column: string }

export type HighlightTone = 'danger' | 'warning' | 'success' | (string & {})

export interface HighlightOptions {
  /** Встроенный или свой тон; по умолчанию `warning`. */
  tone?: HighlightTone
  /** Держать столько миллисекунд, затем погасить. Без него — до снятия. */
  duration?: number
  /** Снять, когда промис выполнится или будет отклонён. */
  until?: PromiseLike<unknown>
  /** Группа подсветок; по умолчанию `'default'`. */
  key?: string
  /** Текст для скринридера: объявляется и висит `aria-description` цели. */
  label?: string
  /** Докрутить к цели: к строке, ячейке или колонке (ADR 0104). */
  reveal?: boolean
}

export interface HighlightHandle {
  clear: () => void
}

export interface HighlightEntry {
  id: number
  key: string
  tone: string
  label?: string
}

export interface HighlightTargetState {
  /** Подсветки цели по порядку постановки; видна последняя. */
  list: HighlightEntry[]
  /** Снятая подсветка, пока гаснет переходом. */
  out?: HighlightEntry
}

/** Ключ цели: `r` — строка, `c` — ячейка, `k` — колонка. */
export type Highlights = Record<string, HighlightTargetState>

interface HighlightStateSlice {
  highlights: Highlights
}
interface HighlightOptionsSlice {
  onHighlightsChange?: (updater: Updater<Highlights>) => void
}
interface HighlightTableAPI {
  setHighlights: (updater: Updater<Highlights>) => void
  /** Подсветить строку, ячейку или колонку (ADR 0080). */
  highlight: (
    target: HighlightTarget,
    options?: HighlightOptions,
  ) => HighlightHandle
  /** Снять подсветки группы `key`; без ключа — все. */
  clearHighlights: (key?: string) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    highlightFeature: TableFeature
  }
  interface TableState_FeatureMap {
    highlightFeature: HighlightStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    highlightFeature: HighlightOptionsSlice
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    highlightFeature: HighlightTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const SEP = '\u0000'

export const rowHighlightKey = (rowId: string) => `r${SEP}${rowId}`
export const cellHighlightKey = (rowId: string, columnId: string) =>
  `c${SEP}${rowId}${SEP}${columnId}`
export const columnHighlightKey = (columnId: string) => `k${SEP}${columnId}`

export const targetKey = (target: HighlightTarget): string =>
  'row' in target
    ? rowHighlightKey(target.row)
    : 'cell' in target
      ? cellHighlightKey(target.cell[0], target.cell[1])
      : columnHighlightKey(target.column)

/** Строка и колонка, к которым относится ключ цели. */
export const parseTargetKey = (
  key: string,
): { rowId?: string; columnId?: string } => {
  const [kind, a, b] = key.split(SEP)
  return kind === 'r'
    ? { rowId: a }
    : kind === 'c'
      ? { rowId: a, columnId: b }
      : { columnId: a }
}

const TONE = /^[a-z0-9-]+$/

const EMPTY: Highlights = {}

/* ----------------------------- чистые операции ---------------------------- */

/** Видимая подсветка цели и признак «гаснет». */
export const visibleHighlight = (
  state: HighlightTargetState | undefined,
): { entry?: HighlightEntry; out: boolean } => {
  const last = state?.list[state.list.length - 1]
  if (last) {
    return { entry: last, out: false }
  }
  return { entry: state?.out, out: !!state?.out }
}

/** Поставить подсветку: та же группа заменяет прежнюю, новая — последней. */
export const addEntry = (
  highlights: Highlights,
  key: string,
  entry: HighlightEntry,
): Highlights => {
  const prev = highlights[key]
  const list = (prev?.list ?? []).filter(item => item.key !== entry.key)
  return { ...highlights, [key]: { list: [...list, entry] } }
}

/**
 * Убрать подсветки, прошедшие фильтр `drop`. Цель, у которой не осталось видимой,
 * гаснет: снятая последняя уходит в `out`. Возвращает ключи погасших целей.
 */
export const removeEntries = (
  highlights: Highlights,
  drop: (entry: HighlightEntry, key: string) => boolean,
): { next: Highlights; faded: string[] } => {
  let next: Highlights | undefined
  const faded: string[] = []
  for (const key of Object.keys(highlights)) {
    const state = highlights[key]!
    const list = state.list.filter(entry => !drop(entry, key))
    if (list.length === state.list.length) {
      continue
    }
    next ??= { ...highlights }
    if (list.length > 0) {
      next[key] = { list }
    } else {
      next[key] = { list, out: state.list[state.list.length - 1] }
      faded.push(key)
    }
  }
  return { next: next ?? highlights, faded }
}

/** Убрать цели целиком, без затухания. */
export const dropTargets = (
  highlights: Highlights,
  keys: readonly string[],
): Highlights => {
  const gone = keys.filter(key => key in highlights)
  if (gone.length === 0) {
    return highlights
  }
  const next = { ...highlights }
  gone.forEach(key => delete next[key])
  return next
}

/** Закончить затухание: цель без подсветок уходит из среза. */
export const finishFade = (highlights: Highlights, key: string): Highlights => {
  const state = highlights[key]
  if (!state?.out || state.list.length > 0) {
    return highlights
  }
  return dropTargets(highlights, [key])
}

/* --------------------------------- фича --------------------------------- */

type HighlightsAtom = {
  get: () => Highlights
  set: (value: Highlights) => void
}
type HighlightTable = {
  atoms: { highlights?: HighlightsAtom }
  store: object
  options: HighlightOptionsSlice & { enableAnnouncements?: boolean }
}

export const readHighlights = (table: unknown): Highlights =>
  (table as HighlightTable | undefined)?.atoms?.highlights?.get() ?? EMPTY

const write = (table: unknown, updater: (prev: Highlights) => Highlights) =>
  (
    table as { setHighlights?: (updater: Updater<Highlights>) => void }
  ).setHighlights?.(updater)

let nextId = 1

const fadeTimers = new WeakMap<
  object,
  Map<string, ReturnType<typeof setTimeout>>
>()

const timersOf = (table: unknown) => {
  const store = (table as HighlightTable).store
  let timers = fadeTimers.get(store)
  if (!timers) {
    timers = new Map()
    fadeTimers.set(store, timers)
  }
  return timers
}

/** Затухание по токену темы; без смонтированного грида гаснуть нечему. */
const scheduleFades = (table: unknown, keys: readonly string[]) => {
  if (keys.length === 0) {
    return
  }
  const fade = parseDuration(
    readGridToken(table, '--tsr-comp-highlight-fade-duration'),
  )
  const timers = timersOf(table)
  for (const key of keys) {
    clearTimeout(timers.get(key))
    if (fade <= 0) {
      write(table, prev => finishFade(prev, key))
      continue
    }
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        write(table, prev => finishFade(prev, key))
      }, fade),
    )
  }
}

/** Снять подсветки по фильтру; погасшие цели гаснут переходом. */
export const removeHighlights = (
  table: unknown,
  drop: (entry: HighlightEntry, key: string) => boolean,
) => {
  const { next, faded } = removeEntries(readHighlights(table), drop)
  if (next === readHighlights(table)) {
    return
  }
  write(table, () => next)
  scheduleFades(table, faded)
}

/** Убрать подсветки целей, которых больше нет в данных или колонках, без затухания. */
export const pruneHighlights = (
  table: unknown,
  hasRow: (rowId: string) => boolean,
  hasColumn: (columnId: string) => boolean,
) => {
  const highlights = readHighlights(table)
  const gone = Object.keys(highlights).filter(key => {
    const { rowId, columnId } = parseTargetKey(key)
    return (
      (rowId !== undefined && !hasRow(rowId)) ||
      (columnId !== undefined && !hasColumn(columnId))
    )
  })
  if (gone.length > 0) {
    write(table, prev => dropTargets(prev, gone))
  }
}

const NOOP: HighlightHandle = { clear: () => {} }

/** Докрутка к цели подсветки: строка, ячейка — строка и колонка, колонка — горизонталь. */
const revealTarget = (table: unknown, target: HighlightTarget) =>
  'row' in target
    ? scrollToRow(table, target.row)
    : 'cell' in target
      ? scrollToRow(table, target.cell[0], { columnId: target.cell[1] })
      : revealColumn(table, target.column)

export const highlight = (
  table: unknown,
  target: HighlightTarget,
  options: HighlightOptions = {},
): HighlightHandle => {
  const tone = options.tone ?? 'warning'
  if (!TONE.test(tone)) {
    logWarn(
      table as Parameters<typeof logWarn>[0],
      `[tessera] highlight: недопустимое имя тона «${tone}» — нужны [a-z0-9-]`,
      `highlight-tone:${tone}`,
    )
    return NOOP
  }
  const entry: HighlightEntry = {
    id: nextId++,
    key: options.key ?? 'default',
    tone,
    label: options.label,
  }
  const key = targetKey(target)
  clearTimeout(timersOf(table).get(key))
  timersOf(table).delete(key)
  write(table, prev => addEntry(prev, key, entry))

  const opts = (table as HighlightTable).options
  if (entry.label && opts.enableAnnouncements !== false) {
    announce(table, entry.label)
  }
  if (options.reveal) {
    void revealTarget(table, target)
  }

  const timers: ReturnType<typeof setTimeout>[] = []
  let cleared = false
  const clear = () => {
    if (cleared) {
      return
    }
    cleared = true
    timers.forEach(clearTimeout)
    removeHighlights(table, item => item.id === entry.id)
  }

  if (options.duration !== undefined) {
    timers.push(setTimeout(clear, options.duration))
  }
  options.until?.then(clear, clear)
  return { clear }
}

export const clearHighlights = (table: unknown, key?: string) =>
  removeHighlights(table, entry => key === undefined || entry.key === key)

export const highlightFeature: TableFeature = {
  getInitialState: state => ({ highlights: EMPTY, ...state }),
  getDefaultTableOptions: table => ({
    onHighlightsChange: makeStateUpdater('highlights', table),
  }),
  constructTableAPIs: table => {
    assignTableAPIs('highlightFeature', table, {
      table_setHighlights: {
        fn: (updater: Updater<Highlights>) => {
          const opts = table.options as HighlightOptionsSlice
          if (opts.onHighlightsChange) {
            opts.onHighlightsChange(updater)
            return
          }
          const atom = (table as unknown as HighlightTable).atoms.highlights
          atom?.set(functionalUpdate(updater, atom.get()))
        },
      },
      table_highlight: {
        fn: (target: HighlightTarget, options?: HighlightOptions) =>
          highlight(table, target, options),
      },
      table_clearHighlights: {
        fn: (key?: string) => clearHighlights(table, key),
      },
    })
  },
}

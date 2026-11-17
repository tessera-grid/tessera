/**
 * Реестр отказов (ADR 0177, §6): нерешённые отказанные действия — значение ячейки, действие
 * строки или колонки, запрос данных таблицы, процесс вне таблицы. Встроенные плагины и
 * `trackCellAction` пишут сюда, места показа читают отсюда; приложение — `getFailures()` и
 * `onFailure`. Срез живёт в TanStack Store: строка уходит из окна, а отказ остаётся.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import type { FlashTarget } from '../highlights/highlightFeature'
import { announceLabel } from '../announcer'
import { flashOutcome } from '../flashes/flashFeature'
import { useSliceProjection } from '../reactivity'
import { type ActionRef, actionLabelOf } from '../actions'
import type { TableLabels } from '../localization'

/** Объект отказа: ячейка, строка, колонка, диапазон, вся таблица или процесс вне таблицы. */
export type FailureTarget = FlashTarget | { table: true } | { process: string }

export interface Failure {
  /** Один отказ одного объекта: новый отказ того же объекта заменяет запись. */
  key: string
  /**
   * Действие справочника (ADR 0182, §5): журнал и объявления называют запись его подписью
   * по текущему словарю. Встроенный код пишет только его.
   */
  action?: ActionRef
  /** Имя действия от приложения — его переводом, как есть; без `action`. */
  label?: string
  target: FailureTarget
  /** Причина из ответа. */
  reason: string
  /** Момент отказа, мс от эпохи. */
  time: number
  /** Повтор — есть, только если источник умеет повторять сам. */
  retry?: () => unknown
  /**
   * За записью стоит несохранённая правка: сбросить её; запись уходит после вызова
   * (ADR 0227, §6). У записи без правки поля нет — её только закрывают.
   */
  discard?: () => void
  /** Одно применение: отказы с одним `batch` и одной причиной журнал показывает группой. */
  batch?: string
  /**
   * Действия над набором записей одного источника одним вызовом (ADR 0227, §4): журнал зовёт
   * функцию первой записи с ключами всех записей того же `owner`; без поля — `retry`/`discard`
   * каждой записи.
   */
  bulk?: FailureBulk
}

export interface FailureBulk {
  /** Источник: записи с одним `owner` принимают ключи друг друга. */
  owner: string
  retry?: (keys: readonly string[]) => void
  discard?: (keys: readonly string[]) => void
}

export type Failures = Record<string, Failure>

/** Имя записи: подпись действия справочника или имя от приложения. */
export const failureName = (
  table: unknown,
  failure: Pick<Failure, 'action' | 'label'>,
  labels?: TableLabels,
): string =>
  failure.action
    ? actionLabelOf(table, failure.action, labels)
    : (failure.label ?? '')

export type FailureReport = Omit<Failure, 'key' | 'time'> & {
  key?: string
  time?: number
}

interface FailuresStateSlice {
  failures: Failures
}
interface FailuresOptions {
  onFailuresChange?: (updater: Updater<Failures>) => void
}
interface FailuresTableAPI {
  setFailures: (updater: Updater<Failures>) => void
  /** Нерешённые отказы, от старых к новым. */
  getFailures: () => Failure[]
  /** Записать отказ; ключ по умолчанию — от цели. Возвращает ключ записи. */
  reportFailure: (report: FailureReport) => string
  /** Снять отказ: решён или закрыт. */
  resolveFailure: (key: string) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    failuresFeature: TableFeature
  }
  interface TableState_FeatureMap {
    failuresFeature: FailuresStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    failuresFeature: FailuresOptions
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    failuresFeature: FailuresTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

type FailuresAtom = { get: () => Failures; set: (value: Failures) => void }
type FailuresTable = {
  atoms: { failures?: FailuresAtom }
  baseAtoms?: { failures?: FailuresAtom }
  options: FailuresOptions & { onFailure?: (failure: Failure) => void }
  setFailures?: (updater: Updater<Failures>) => void
}

const EMPTY: Failures = {}

/** Ключ отказа значения ячейки. */
export const cellFailureKey = (rowId: string, columnId: string) =>
  `cell\u0000${rowId}\u0000${columnId}`

/** Ключ записи по цели: один отказ одного объекта. */
export const failureKeyOf = (target: FailureTarget): string => {
  if ('cell' in target) return cellFailureKey(target.cell[0], target.cell[1])
  if ('row' in target) return `row\u0000${target.row}`
  if ('column' in target) return `column\u0000${target.column}`
  if ('process' in target) return `process\u0000${target.process}`
  if ('table' in target) return 'table'
  return `range\u0000${JSON.stringify(target)}`
}

// Через API таблицы: обёртка `useTable` несёт сырые опции без обработчика среза.
const write = (table: unknown, updater: Updater<Failures>) =>
  (table as FailuresTable | undefined)?.setFailures?.(updater)

/** Текущий срез; без фичи — пустой. */
export const readFailures = (table: unknown): Failures =>
  (table as FailuresTable | undefined)?.atoms?.failures?.get() ?? EMPTY

type ValueRow = { getValue: (columnId: string) => unknown }

type FailureRowSource = {
  byId: (id: string) => unknown
  whenLoaded?: unknown
}

const sourceOf = (table: unknown) =>
  (table as { getRowSource?: () => FailureRowSource }).getRowSource?.()

const rowOf = (table: unknown, rowId: string) =>
  sourceOf(table)?.byId(rowId) as ValueRow | undefined

/** Значение ячейки на момент отказа: изменилось извне — отказ решён (ADR 0177, §5). */
const reportedValues = new WeakMap<Failure, unknown>()

/** Записать отказ (ADR 0177, OB14); ключ — от цели, если не задан. */
export const reportFailure = (table: unknown, report: FailureReport) => {
  const failure: Failure = {
    ...report,
    key: report.key ?? failureKeyOf(report.target),
    time: report.time ?? Date.now(),
  }
  if ('cell' in failure.target) {
    const [rowId, columnId] = failure.target.cell
    const row = rowOf(table, rowId)
    if (row) reportedValues.set(failure, row.getValue(columnId))
  }
  write(table, prev => ({ ...prev, [failure.key]: failure }))
  ;(table as FailuresTable).options.onFailure?.(failure)
  return failure.key
}

/**
 * Записать отказы одной записью в срез (ADR 0219, WR10; ADR 0227, §3): отказы одного ответа;
 * `resolve` — ключи снятых отказов, в той же записи. `onFailure` — на каждый отказ.
 */
export const reportFailures = (
  table: unknown,
  reports: readonly FailureReport[],
  resolve: readonly string[] = [],
) => {
  if (reports.length === 0) {
    if (resolve.length > 0) resolveFailures(table, resolve)
    return
  }
  const now = Date.now()
  const failures = reports.map(report => {
    const failure: Failure = {
      ...report,
      key: report.key ?? failureKeyOf(report.target),
      time: report.time ?? now,
    }
    if ('cell' in failure.target) {
      const [rowId, columnId] = failure.target.cell
      const row = rowOf(table, rowId)
      if (row) reportedValues.set(failure, row.getValue(columnId))
    }
    return failure
  })
  write(table, prev => {
    const next = { ...prev }
    for (const key of resolve) delete next[key]
    for (const failure of failures) next[failure.key] = failure
    return next
  })
  const onFailure = (table as FailuresTable).options.onFailure
  if (onFailure) for (const failure of failures) onFailure(failure)
}

/** Снять отказы по ключам одной записью в срез; нет записей — ничего. */
export const resolveFailures = (table: unknown, keys: Iterable<string>) =>
  write(table, prev => {
    let next: Failures | undefined
    for (const key of keys) {
      if (!(key in prev)) continue
      next ??= { ...prev }
      delete next[key]
    }
    return next ?? prev
  })

/**
 * Снять отказы ячеек, для которых `written` отвечает «да», — проходом по отказам, а не по
 * ячейкам: отказов мало, ячеек операции записи — до сотен тысяч (ADR 0219, §10).
 */
export const resolveCellFailures = (
  table: unknown,
  written: (rowId: string, columnId: string) => boolean,
) => {
  const keys: string[] = []
  for (const failure of Object.values(readFailures(table)))
    if ('cell' in failure.target && written(...failure.target.cell))
      keys.push(failure.key)
  if (keys.length > 0) resolveFailures(table, keys)
}

/** Снять отказ; нет записи — ничего. */
export const resolveFailure = (table: unknown, key: string) =>
  write(table, prev => {
    if (!(key in prev)) return prev
    const next = { ...prev }
    delete next[key]
    return next
  })

/**
 * Отказы значений ячеек, чья строка ушла из данных или чьё значение изменилось извне, решены
 * (ADR 0177, §5, OB11); прочие цели ведут их источники. Серверная модель строк: строки нет в
 * кэше — она не загружена или вытеснена, отказ остаётся (ADR 0227, AO20).
 */
export const pruneFailures = (table: unknown) => {
  const failures = readFailures(table)
  const source = sourceOf(table)
  const partial = !!source?.whenLoaded
  const gone: string[] = []
  for (const failure of Object.values(failures)) {
    if (!('cell' in failure.target)) continue
    const [rowId, columnId] = failure.target.cell
    const row = source?.byId(rowId) as ValueRow | undefined
    if (
      (!row && !partial) ||
      (row &&
        reportedValues.has(failure) &&
        !Object.is(row.getValue(columnId), reportedValues.get(failure)))
    )
      gone.push(failure.key)
  }
  if (gone.length === 0) return
  write(table, prev => {
    const next = { ...prev }
    for (const key of gone) delete next[key]
    return next
  })
}

/**
 * Позвать `done` один раз, когда запись `key` ушла из реестра или её заменил новый отказ:
 * закрытие записи без правки снимает то, что источник показывает рядом (ADR 0227, §6).
 * Возвращает снятие подписки.
 */
export const whenFailureGone = (
  table: unknown,
  key: string,
  done: () => void,
): (() => void) => {
  const failure = readFailures(table)[key]
  const store = (
    table as {
      store?: {
        subscribe: (listener: () => void) => { unsubscribe: () => void }
      }
    }
  ).store
  if (!failure || !store) return () => {}
  let live = true
  const subscription = store.subscribe(() => {
    if (!live || readFailures(table)[key] === failure) return
    live = false
    subscription.unsubscribe()
    done()
  })
  return () => {
    live = false
    subscription.unsubscribe()
  }
}

/**
 * Позвать `done` один раз, когда в реестре не осталось ни одной записи с этим `batch`: отказы
 * одного применения решены (ADR 0227, AO22). Записей нет уже сейчас — `done` не зовётся.
 * Возвращает снятие подписки.
 */
export const whenBatchResolved = (
  table: unknown,
  batch: string,
  done: () => void,
): (() => void) => {
  const store = (
    table as {
      store?: {
        subscribe: (listener: () => void) => { unsubscribe: () => void }
      }
    }
  ).store
  const holds = (failures: Failures) =>
    Object.values(failures).some(failure => failure.batch === batch)
  let seen = readFailures(table)
  if (!store || !holds(seen)) return () => {}
  let live = true
  const subscription = store.subscribe(() => {
    const failures = readFailures(table)
    if (!live || failures === seen) return
    seen = failures
    if (holds(failures)) return
    live = false
    subscription.unsubscribe()
    done()
  })
  return () => {
    live = false
    subscription.unsubscribe()
  }
}

/**
 * Изменение занятого объекта не принято (ADR 0177, §3): вспышка отката на нём и объявление;
 * это не отказ — в реестр не пишется.
 */
export const ignoreBusyChange = (
  table: unknown,
  target: FlashTarget,
  name: string,
) => {
  flashOutcome(table, target, 'reverted')
  announceLabel(table, labels => labels.announceStillSaving(name))
}

/** Отказ значения ячейки или `undefined`. */
export const cellFailureOf = (
  failures: Failures,
  rowId: string,
  columnId: string,
): Failure | undefined => failures[cellFailureKey(rowId, columnId)]

/** Отказ значения ячейки — перерисовывает только её (ADR 0177, §5). */
export const useCellFailure = (
  table: unknown,
  rowId: string,
  columnId: string,
): Failure | undefined =>
  useSliceProjection(table, 'failures', (failures: Failures) =>
    cellFailureOf(failures ?? EMPTY, rowId, columnId),
  )

export const failuresFeature: TableFeature = {
  getInitialState: state => ({ failures: EMPTY, ...state }),
  getDefaultTableOptions: table => ({
    onFailuresChange: makeStateUpdater('failures', table),
  }),
  constructTableAPIs: table => {
    assignTableAPIs('failuresFeature', table, {
      table_setFailures: {
        fn: (updater: Updater<Failures>) => {
          const t = table as unknown as FailuresTable
          if (t.options.onFailuresChange) {
            t.options.onFailuresChange(updater)
            return
          }
          // `table.atoms` в v9 — производные, только для чтения.
          const atom = t.baseAtoms?.failures
          atom?.set(functionalUpdate(updater, atom.get()))
        },
      },
      table_getFailures: {
        fn: () =>
          Object.values(readFailures(table)).sort((a, b) => a.time - b.time),
      },
      table_reportFailure: {
        fn: (report: FailureReport) => reportFailure(table, report),
      },
      table_resolveFailure: {
        fn: (key: string) => resolveFailure(table, key),
      },
    })
  },
}

/**
 * Зеркало среза отказов плагина в реестр (ADR 0177, OB13): новая или изменённая запись — отказ
 * по `reportOf`, ушедшая снимает его. Ключ записи реестра — от цели.
 */
export const mirrorFailures = <T>(
  table: unknown,
  prev: Readonly<Record<string, T>>,
  next: Readonly<Record<string, T>>,
  reportOf: (id: string, value: T) => FailureReport,
) => {
  if (prev === next) return
  for (const [id, value] of Object.entries(prev))
    if (!(id in next))
      resolveFailure(table, failureKeyOf(reportOf(id, value).target))
  for (const [id, value] of Object.entries(next))
    if (prev[id] !== value) reportFailure(table, reportOf(id, value))
}

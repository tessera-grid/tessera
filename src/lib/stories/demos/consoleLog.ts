/**
 * Журнал консоли историй (ADR 0124): хранилище вне React — запись не перерисовывает ни
 * историю, ни грид. Виджет `StoryConsole` рисует записи по подписке прямо в DOM.
 */

import type { DebugActionSource } from '../../core/debugActions'

export type ConsoleKind = 'action' | 'callback' | 'state' | 'lifecycle'

export const CONSOLE_KINDS: readonly ConsoleKind[] = [
  'action',
  'callback',
  'state',
  'lifecycle',
]

/** Откуда действие: канал грида или сама история (шаг, контрол, демо). */
export type ConsoleSource = DebugActionSource | 'story'

export interface ConsoleEntry {
  id: number
  kind: ConsoleKind
  name: string
  detail: string
  /** Время последней склеенной записи по часам, мс от эпохи. */
  time: number
  /** Сколько выполнялся колбэк, мс; у промиса — до завершения. */
  duration?: number
  /** Сколько записей склеено в эту. */
  count: number
  /** Запись в группе действия: идёт под ним с отступом. */
  child: boolean
  /** Действие: откуда оно. */
  source?: ConsoleSource
  /** Действие грида: его номер в канале (ADR 0125) — на него ссылается `cause`. */
  actionId?: number
  /** Итог: номер исходного действия грида. */
  cause?: number
  /** Действие грида: подпись справочника на языке таблицы (ADR 0182, AN8). */
  label?: string
}

export interface ConsoleAction {
  plugin: string
  action: string
  detail?: unknown
  source?: ConsoleSource
  phase?: 'start' | 'end'
  /** Номер действия в канале грида. */
  id?: number
  cause?: number
  /** Подпись действия из справочника таблицы (ADR 0182, AN8). */
  label?: string
}

export interface ConsoleLog {
  /** Действие самой истории: кнопка демо, ответ мок-сервера. */
  log: (name: string, detail?: string) => void
  /** Действие грида из `onDebugAction` или истории (шаг гайда, контрол). */
  action: (input: ConsoleAction) => number
  /** Запись колбэка, среза или цикла; номер записи — для `measured`. */
  write: (
    kind: Exclude<ConsoleKind, 'action'>,
    name: string,
    detail?: string,
  ) => number
  /** Длительность колбэка записи `id`. */
  measured: (id: number, duration: number) => void
  clear: () => void
  entries: () => readonly ConsoleEntry[]
  subscribe: (listener: () => void) => () => void
  /** Новое монтирование грида истории; номер — первый «смонтирован», дальше «пересоздан». */
  mounted: () => number
}

/** Записей в журнале не больше: старые уходят. */
export const CONSOLE_LIMIT = 500
/** Длина значения в записи, символов: длиннее — обрезается «…». */
export const DETAIL_LIMIT = 120

/**
 * Конец кадра, в котором React применил последствия действия: следующий кадр и задача
 * после него — эффекты уже прошли. Вне браузера — следующая задача.
 */
const afterFrame = (callback: () => void) => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => setTimeout(callback, 0))
  } else {
    setTimeout(callback, 0)
  }
}

/**
 * Значение одной строкой, не длиннее `limit`: обход останавливается, как только строка
 * переросла предел, — большие данные не сериализуются целиком.
 */
export const preview = (value: unknown, limit = DETAIL_LIMIT): string => {
  let out = ''
  const seen = new WeakSet<object>()
  const full = () => out.length > limit
  const put = (text: string) => {
    out += text
  }
  const walk = (item: unknown): void => {
    if (full()) return
    if (typeof item === 'function') return put('ƒ')
    if (typeof item === 'string') {
      return put(JSON.stringify(item.slice(0, limit + 1)))
    }
    if (typeof item === 'bigint') return put(`${item}n`)
    if (item === undefined) return put('undefined')
    if (item === null || typeof item !== 'object') return put(String(item))
    if (seen.has(item)) return put('…')
    // Строка, колонка и таблица TanStack — коротко, а не дампом внутренностей.
    const model = item as Record<string, unknown>
    if (typeof model.getValue === 'function' && 'original' in model) {
      return put(`row:${String(model.id)}`)
    }
    if ('columnDef' in model && typeof model.getSize === 'function') {
      return put(`column:${String(model.id)}`)
    }
    if (typeof model.getState === 'function') return put('table')
    seen.add(item)
    // Обход прерывается, как только строка переросла предел: остаток не читается.
    if (Array.isArray(item)) {
      put('[')
      for (let index = 0; index < item.length && !full(); index++) {
        if (index > 0) put(',')
        walk(item[index])
      }
      return put(']')
    }
    put('{')
    let first = true
    for (const key in item) {
      if (full()) break
      if (!Object.hasOwn(item, key)) continue
      if (!first) put(',')
      first = false
      put(`${key}:`)
      walk(model[key])
    }
    put('}')
  }
  walk(value)
  return out.length > limit ? `${out.slice(0, limit)}…` : out
}

export const createConsoleLog = (
  now: () => number = () => Date.now(),
  frameEnd: (callback: () => void) => void = afterFrame,
): ConsoleLog => {
  let entries: readonly ConsoleEntry[] = []
  let nextId = 0
  let mounts = 0
  /** Открытая группа: действие и его записи; у жеста — до `end`, иначе — до конца кадра. */
  let group: { id: number; gesture: boolean } | null = null
  const listeners = new Set<() => void>()
  // Подписчики узнают о записи сразу: обновление виджета — в том же событии, что и
  // запись (колбэк, эффект, смена среза).
  const notify = () => {
    for (const listener of listeners) listener()
  }
  const add = (entry: Omit<ConsoleEntry, 'id' | 'count' | 'time'>) => {
    nextId += 1
    entries = [
      ...entries,
      { ...entry, id: nextId, count: 1, time: now() },
    ].slice(-CONSOLE_LIMIT)
    notify()
    return nextId
  }
  /** Записи открытой группы после её действия. */
  const groupEntries = () => {
    if (!group) return []
    const start = entries.findIndex(entry => entry.id === group!.id)
    return start < 0 ? [] : entries.slice(start + 1)
  }
  /** Одинаковая запись (вид и имя) склеивается только внутри открытой группы. */
  const mergeIntoGroup = (kind: ConsoleKind, name: string, detail: string) => {
    const same = groupEntries().find(
      entry => entry.kind === kind && entry.name === name,
    )
    if (!same) return undefined
    entries = entries.map(entry =>
      entry === same
        ? {
            ...entry,
            detail,
            time: now(),
            duration: undefined,
            count: entry.count + 1,
          }
        : entry,
    )
    notify()
    return same.id
  }
  const closeGroupAfterFrame = (id: number) =>
    frameEnd(() => {
      if (group?.id === id && !group.gesture) group = null
    })

  const action = (input: ConsoleAction): number => {
    const name =
      input.plugin === 'story' || input.plugin === input.action
        ? input.action
        : `${input.plugin} · ${input.action}`
    // Строка — текст как есть: подпись журнала демо, текст отказа.
    const detail =
      input.detail === undefined
        ? ''
        : typeof input.detail === 'string'
          ? input.detail
          : preview(input.detail)
    const fields = {
      kind: 'action' as const,
      name,
      detail,
      source: input.source ?? 'api',
      ...(input.id !== undefined && { actionId: input.id }),
      ...(input.cause !== undefined && { cause: input.cause }),
      ...(input.label !== undefined && { label: input.label }),
    }
    // Внутри жеста — его запись: смена цели, конец жеста, вложенные действия.
    if (group?.gesture && input.phase !== 'start') {
      const id =
        mergeIntoGroup('action', name, detail) ??
        add({ ...fields, child: true })
      if (input.phase === 'end') group = null
      return id
    }
    const id = add({ ...fields, child: false })
    group = { id, gesture: input.phase === 'start' }
    if (!group.gesture) closeGroupAfterFrame(id)
    return id
  }

  const write = (
    kind: Exclude<ConsoleKind, 'action'>,
    name: string,
    detail = '',
  ) => {
    if (!group) return add({ kind, name, detail, child: false })
    return (
      mergeIntoGroup(kind, name, detail) ??
      add({ kind, name, detail, child: true })
    )
  }

  return {
    log: (name, detail) =>
      void action({ plugin: 'story', action: name, detail, source: 'story' }),
    action,
    write,
    measured: (id, duration) => {
      const index = entries.findIndex(entry => entry.id === id)
      if (index < 0) return
      const next = entries.slice()
      next[index] = { ...entries[index]!, duration }
      entries = next
      notify()
    },
    clear: () => {
      entries = []
      group = null
      notify()
    },
    entries: () => entries,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    mounted: () => (mounts += 1),
  }
}

/** Колбэк истории с записью в журнал; обёртка на каждый исходный колбэк — одна. */
const wrappers = new WeakMap<
  ConsoleLog,
  WeakMap<(...args: never[]) => unknown, Map<string, unknown>>
>()

export const loggedCallback = <T extends (...args: never[]) => unknown>(
  log: ConsoleLog,
  name: string,
  callback: T,
): T => {
  let byCallback = wrappers.get(log)
  if (!byCallback) {
    byCallback = new WeakMap()
    wrappers.set(log, byCallback)
  }
  let byName = byCallback.get(callback)
  if (!byName) {
    byName = new Map()
    byCallback.set(callback, byName)
  }
  let wrapper = byName.get(name) as T | undefined
  if (!wrapper) {
    wrapper = ((...args: Parameters<T>) => {
      const id = log.write(
        'callback',
        name,
        preview(args.length === 1 ? args[0] : args),
      )
      const start = performance.now()
      const finish = () => log.measured(id, performance.now() - start)
      const result = callback(...args)
      // Промис гриду — тот же: длительность снимается отдельной подпиской.
      if (result instanceof Promise) result.then(finish, finish)
      else finish()
      return result
    }) as T
    byName.set(name, wrapper)
  }
  return wrapper
}

/** Колбэки `on*` объекта — с записью в журнал; остальные поля — как есть. */
export const loggedCallbacks = <T extends object>(
  log: ConsoleLog | undefined,
  record: T,
): T => {
  if (!log) return record
  let changed = false
  const fields = record as Record<string, unknown>
  const next = { ...fields }
  for (const [key, value] of Object.entries(fields)) {
    if (/^on[A-Z]/.test(key) && typeof value === 'function') {
      next[key] = loggedCallback(
        log,
        key,
        value as (...args: never[]) => unknown,
      )
      changed = true
    }
  }
  return changed ? (next as T) : record
}

const describe = (value: unknown): string =>
  typeof value === 'string' ? `"${value}"` : JSON.stringify(value)

/** Поля события одной строкой: `rowId="row-3" reason="cancel"`. */
export const describeEvent = (payload: Record<string, unknown>) =>
  Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${describe(value)}`)
    .join(' ')

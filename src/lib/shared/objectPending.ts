/**
 * Ожидание действия над строкой или колонкой (ADR 0177, §1, §3): волна на объекте в общем срезе
 * `actionStatus`, а не дуга на кнопке-источнике. Плагин зеркалит сюда свой срез ожиданий.
 */
import type { FlashTarget } from '../core/highlights/highlightFeature'
import { cellPendingOf } from '../core/headerActions/actionStatus'
import {
  type ActionStatus,
  readActionStatus,
  writeActionStatus,
} from '../core/headerActions/actionStatusFeature'

type Change = readonly [key: string, target: readonly FlashTarget[] | undefined]

const apply = (table: unknown, changes: readonly Change[]) =>
  writeActionStatus(table, status => {
    let next: ActionStatus | undefined
    for (const [key, target] of changes) {
      if (!target && !(key in status)) continue
      next ??= { ...status }
      if (target) next[key] = { pending: true, target, wave: true }
      else delete next[key]
    }
    return next ?? status
  })

/** Поставить (`target`) или снять (`undefined`) ожидание объекта под ключом `key`. */
export const setObjectPending = (
  table: unknown,
  key: string,
  target: readonly FlashTarget[] | undefined,
) => apply(table, [[key, target]])

/**
 * Зеркало среза ожиданий плагина: новая или изменённая запись ставит волну по `targetOf`
 * (`undefined` — запись не ждёт), ушедшая снимает. Ключ — `prefix` и id записи.
 */
export const mirrorPending = <T>(
  table: unknown,
  prefix: string,
  prev: Readonly<Record<string, T>>,
  next: Readonly<Record<string, T>>,
  targetOf: (id: string, value: T) => readonly FlashTarget[] | undefined,
) => {
  if (prev === next) return
  const changes: Change[] = []
  for (const id of Object.keys(prev))
    if (!(id in next)) changes.push([`${prefix}:${id}`, undefined])
  for (const [id, value] of Object.entries(next))
    if (prev[id] !== value)
      changes.push([`${prefix}:${id}`, targetOf(id, value)])
  if (changes.length > 0) apply(table, changes)
}

/** Ячейка занята — своим сохранением или действием её строки или колонки (OB5). */
export const isCellBusy = (table: unknown, rowId: string, columnId: string) =>
  !!cellPendingOf(table, readActionStatus(table), rowId, columnId)

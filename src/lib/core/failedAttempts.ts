/**
 * Отказ действия по цели (ADR 0127, ADR 0136): номер попытки и ошибка — из неё отметка
 * отказа на кнопке берёт причину. Запись снимают повтор, успех и уход цели (IR13, IR14).
 */
export interface FailedAttempt {
  attempt: number
  error: unknown
}

export type FailedAttempts = Readonly<Record<string, FailedAttempt>>

/** Без записи цели — тот же объект: подписчики соседних целей не перерисовываются. */
export const withoutFailure = (
  prev: FailedAttempts,
  id: string,
): FailedAttempts => {
  if (!(id in prev)) return prev
  const next = { ...prev }
  delete next[id]
  return next
}

/** Без записей целей, которых больше нет; без таких — тот же объект. */
export const withoutGone = (
  prev: FailedAttempts,
  exists: (id: string) => boolean,
): FailedAttempts => {
  const gone = Object.keys(prev).filter(id => !exists(id))
  if (gone.length === 0) return prev
  const next = { ...prev }
  gone.forEach(id => delete next[id])
  return next
}

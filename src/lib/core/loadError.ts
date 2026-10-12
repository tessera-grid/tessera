/**
 * Ошибка загрузки данных (ADR 0096): приложение отдаёт её опцией `loadError`, грид
 * показывает красный свет под шапкой и плашку (данные есть) или заглушку (данных нет).
 */

/** Есть ли ошибка: `null`, `undefined` и `false` — нет. */
export const hasLoadError = (error: unknown): boolean =>
  error != null && error !== false

/** Причина отказа для подписи: `message` ошибки или сама строка; иначе — нет. */
export const loadErrorReason = (error: unknown): string | undefined => {
  if (typeof error === 'string') {
    return error.trim() || undefined
  }
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : undefined
}

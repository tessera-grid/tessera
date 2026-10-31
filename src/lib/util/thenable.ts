/** Бизнес-колбэк вернул промис — асинхронный контракт (ADR 0041). */
export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as { then?: unknown } | null)?.then === 'function'

/** Текст отказа (AS10): `Error.message`, строка — как есть; иначе — подпись по умолчанию. */
export const rejectionText = (reason: unknown): string | undefined => {
  if (reason instanceof Error) {
    return reason.message || undefined
  }
  return typeof reason === 'string' && reason ? reason : undefined
}

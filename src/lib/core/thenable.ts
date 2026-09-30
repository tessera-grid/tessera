/** Бизнес-колбэк вернул промис — асинхронный контракт (ADR 0041). */
export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as { then?: unknown } | null)?.then === 'function'

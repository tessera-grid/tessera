// Показ обновления данных (ADR 0094, §3): свечение и приглушение появляются с задержкой
// и держатся не меньше минимума — быстрый ответ не мигает, медленный не вспыхивает.

export interface LoadingOptions {
  /** Через сколько мс после включения `enableLoading` показать обновление. */
  delayMs?: number
  /** Сколько мс показанное обновление держится хотя бы. */
  minDurationMs?: number
}

export const DEFAULT_LOADING_OPTIONS: Required<LoadingOptions> = {
  delayMs: 300,
  minDurationMs: 500,
}

export const resolveLoadingOptions = (
  options: LoadingOptions | undefined,
): Required<LoadingOptions> => ({
  delayMs: options?.delayMs ?? DEFAULT_LOADING_OPTIONS.delayMs,
  minDurationMs:
    options?.minDurationMs ?? DEFAULT_LOADING_OPTIONS.minDurationMs,
})

export interface LoadingClock {
  now: () => number
  setTimeout: (run: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const browserClock: LoadingClock = {
  now: () => performance.now(),
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: handle => clearTimeout(handle as number),
}

export interface LoadingDisplay {
  /** Загрузка идёт или нет — по флагу приложения. */
  set: (loading: boolean) => void
  dispose: () => void
}

/**
 * Решает, показано ли обновление; о смене сообщает `onChange`. Опции читаются в момент
 * события: их смена на лету не сбрасывает показанное.
 */
export const createLoadingDisplay = (
  options: () => Required<LoadingOptions>,
  onChange: (shown: boolean) => void,
  clock: LoadingClock = browserClock,
): LoadingDisplay => {
  let shown = false
  let shownAt = 0
  let timer: unknown = null

  const cancel = () => {
    if (timer !== null) clock.clearTimeout(timer)
    timer = null
  }
  const show = (next: boolean) => {
    timer = null
    shown = next
    if (next) shownAt = clock.now()
    onChange(next)
  }

  return {
    set: loading => {
      cancel()
      if (loading) {
        if (!shown)
          timer = clock.setTimeout(() => show(true), options().delayMs)
        return
      }
      if (!shown) return
      const left = options().minDurationMs - (clock.now() - shownAt)
      if (left > 0) timer = clock.setTimeout(() => show(false), left)
      else show(false)
    },
    dispose: cancel,
  }
}

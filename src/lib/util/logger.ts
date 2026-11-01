// Уровневый логгер плагинов. Единый канал для предупреждений о
// совместимости, ошибок и dev-инфо по плагинам. Порог берётся из
// `table.options.logLevel`; если не задан — 'warn' в dev / 'silent' в проде, так
// что подключённый, но инертный плагин по умолчанию слышен разработчику и молчит
// в продакшене. Поток ленивый: строка пишется, когда исполнился её код-путь
// (`getCan*` реально вызвался).

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

let productionOverride: boolean | undefined

// Точечный `process.env.NODE_ENV` бандлер потребителя заменяет литералом; если
// `process` недоступен (browser-ESM без бандлера) — падаем в dev, чтобы сигнал
// не потерялся молча. Оверрайд — для тестов (среда резолвит NODE_ENV на
// трансформе, рантайм-стаб её не переопределяет).
export const isProduction = (): boolean => {
  if (productionOverride !== undefined) return productionOverride

  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}

const defaultLevel = (): LogLevel => (isProduction() ? 'silent' : 'warn')

// Dedup: одно сообщение на ключ за сессию — `getCan*` зовётся на каждый рендер,
// поэтому предупреждение с ключом-причиной не спамит.
const emitted = new Set<string>()

export interface LoggerHost {
  options?: { logLevel?: LogLevel }
}

const CONSOLE: Record<
  Exclude<LogLevel, 'silent'>,
  (message: string) => void
> = {
  error: message => console.error(message),
  warn: message => console.warn(message),
  info: message => console.info(message),
  debug: message => (console.debug ?? console.log)(message),
}

const write = (
  host: LoggerHost,
  level: Exclude<LogLevel, 'silent'>,
  message: string,
  dedupKey?: string,
): void => {
  const threshold = host.options?.logLevel ?? defaultLevel()
  if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[threshold]) return

  if (dedupKey !== undefined) {
    if (emitted.has(dedupKey)) return
    emitted.add(dedupKey)
  }

  CONSOLE[level](`[tessera] ${message}`)
}

/** Сообщение уровня `level` будет напечатано: дорогую проверку без печати можно пропустить. */
export const shouldLog = (
  host: LoggerHost,
  level: Exclude<LogLevel, 'silent'>,
): boolean =>
  LEVEL_WEIGHT[level] <= LEVEL_WEIGHT[host.options?.logLevel ?? defaultLevel()]

/**
 * Пишут `console.*` через порог `host.options.logLevel`. `host` — обычно
 * `table`. `dedupKey` (стабильная строка причины) печатает сообщение единожды за
 * сессию; без него — каждый раз.
 */
export const logError = (
  host: LoggerHost,
  message: string,
  dedupKey?: string,
) => write(host, 'error', message, dedupKey)

export const logWarn = (host: LoggerHost, message: string, dedupKey?: string) =>
  write(host, 'warn', message, dedupKey)

export const logInfo = (host: LoggerHost, message: string, dedupKey?: string) =>
  write(host, 'info', message, dedupKey)

export const logDebug = (
  host: LoggerHost,
  message: string,
  dedupKey?: string,
) => write(host, 'debug', message, dedupKey)

/** Сброс dedup-множества между тестами. */
export const __resetLogger = (): void => emitted.clear()

/** Форсирует ответ прод-гейта в тестах (см. обоснование у `isProduction`). */
export const __setLoggerProduction = (value: boolean | undefined): void => {
  productionOverride = value
}

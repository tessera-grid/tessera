/**
 * Ожидаемые сообщения `console.error` истории (ADR 0093, VR18): история, которая показывает
 * падение плагина, перечисляет их параметром `consoleErrors` с причиной; любое другое
 * сообщение по-прежнему роняет её тест.
 */
export interface ConsoleErrors {
  /** Образцы сообщений, которые история пишет нарочно. */
  expected: readonly RegExp[]
  /** Почему история их пишет. */
  reason: string
}

// Список — на `globalThis`: `preview` и настройка Vitest могут получить разные копии модуля.
const holder = globalThis as { __tesseraConsoleErrors?: readonly RegExp[] }

/** Ожидаемые сообщения истории, которая идёт сейчас; без параметра — никаких. */
export const expectConsoleErrors = (errors: ConsoleErrors | undefined) => {
  holder.__tesseraConsoleErrors = errors?.expected ?? []
}

export const isExpectedConsoleError = (message: string) =>
  (holder.__tesseraConsoleErrors ?? []).some(pattern => pattern.test(message))

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

/** Действие без записи справочника роняет тест, а не теряется в выводе (ADR 0182, AN24). */
export const watchUnknownActions = () => {
  const original = console.warn
  const found: string[] = []
  return {
    start: () => {
      found.length = 0
      console.warn = (...args: unknown[]) => {
        const message = args.map(String).join(' ')
        if (message.includes('unknown action "')) found.push(message)
        original(...args)
      }
    },
    stop: () => {
      console.warn = original
      if (found.length > 0) {
        throw new Error(`Действие без справочника:\n${found.join('\n')}`)
      }
    },
  }
}

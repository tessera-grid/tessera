import { afterEach, beforeEach } from 'vitest'

import { expectConsoleErrors, isExpectedConsoleError } from './consoleErrors'

// История каталога рендерится без `console.error` (ADR 0093, VR1): ошибка React или
// грида роняет её тест, а не теряется в выводе. Сообщения, которые история пишет нарочно,
// она перечисляет параметром `consoleErrors` (VR18).

/**
 * Сообщения тестовой среды, а не грида. `storybook/test` оборачивает действия `play` в
 * `act`, а ленивые модули (ADR 0061) приостанавливаются по задумке — React жалуется на
 * приостановку внутри `act`, которого в браузере пользователя нет.
 */
const ENVIRONMENT_NOISE = [/A component suspended inside an `act` scope/]

const errors: string[] = []
const original = console.error

beforeEach(() => {
  errors.length = 0
  expectConsoleErrors(undefined)
  console.error = (...args: unknown[]) => {
    const message = args.map(String).join(' ')
    if (
      !ENVIRONMENT_NOISE.some(noise => noise.test(message)) &&
      !isExpectedConsoleError(message)
    ) {
      errors.push(message)
    }
    original(...args)
  }
})

afterEach(() => {
  console.error = original
  if (errors.length > 0) {
    throw new Error(`console.error в истории:\n${errors.join('\n')}`)
  }
})

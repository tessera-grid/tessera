import { afterEach, beforeEach } from 'vitest'

// История каталога рендерится без `console.error` (ADR 0093, VR1): ошибка React или
// грида роняет её тест, а не теряется в выводе.

const errors: string[] = []
const original = console.error

beforeEach(() => {
  errors.length = 0
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '))
    original(...args)
  }
})

afterEach(() => {
  console.error = original
  if (errors.length > 0) {
    throw new Error(`console.error в истории:\n${errors.join('\n')}`)
  }
})

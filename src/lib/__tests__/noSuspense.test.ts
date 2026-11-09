import { describe, expect, it } from 'vitest'

import { modules, sourceOf } from './importGraph'

/** `React.lazy`, `<Suspense>` и их импорт из `react`. */
const SUSPENSE =
  /\blazy\s*\(|<Suspense\b|import\s*\{[^}]*\b(?:Suspense|lazy)\b[^}]*\}\s*from\s*'react'/

describe('ленивые модули без Suspense (ADR 0107)', () => {
  it('RM34: в коде библиотеки нет React.lazy и <Suspense> — ленивые модули через preloadable с заглушкой fallback', () => {
    const offenders = modules()
      .filter(module => SUSPENSE.test(sourceOf(module.path)))
      .map(module => module.path)
    expect(offenders).toEqual([])
  })
})

// Канал dev-предупреждений о совместимости плагинов (ADR 0022). Когда один
// плагин делает другой инертным (тихое `getCan*` → false) или два плагина
// конфликтуют, стык обязан сообщить об этом разработчику — иначе подключённый,
// но неработающий плагин остаётся тихой загадкой (см. C2 в docs/open-issues.md).

const emitted = new Set<string>()

let productionOverride: boolean | undefined

// Гейтим по `process.env.NODE_ENV` — норма экосистемы (React, TanStack,
// dnd-kit): бандлер потребителя заменяет токен литералом на сборке, поэтому в
// проде ветка мертва и no-op. Наш vite-build токен НЕ запекает (сохраняет как в
// зависимостях), отдавая решение среде потребителя. Если `process` недоступен
// вовсе (browser-ESM без бандлера) — чтение бросает, и мы падаем в dev, чтобы
// сигнал не потерялся молча.
const isProduction = (): boolean => {
  if (productionOverride !== undefined) return productionOverride

  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}

/**
 * Печатает `console.warn` один раз на `key` (dedup) и молчит в проде. `key` —
 * стабильная строка причины (`'rowDragging:grouping'`), поэтому один и тот же
 * инертный стык предупреждает единожды за сессию, а не на каждый рендер
 * `getCan*`.
 */
export const devWarn = (key: string, message: string): void => {
  if (isProduction()) return
  if (emitted.has(key)) return

  emitted.add(key)
  console.warn(`[tessera] ${message}`)
}

/** Сброс dedup-множества между тестами (аналог cleanup из ADR 0009). */
export const __resetDevWarn = (): void => {
  emitted.clear()
}

/**
 * Форсирует ответ прод-гейта в тестах (среда/бандлер резолвят `process.env` на
 * трансформе, рантайм-стаб их не переопределяет). `undefined` — вернуть реальный
 * гейт по окружению.
 */
export const __setDevWarnProduction = (value: boolean | undefined): void => {
  productionOverride = value
}

// Истории каталога вне axe (ADR 0093, VR2) — у каждой причина. Список только
// сокращается: исправили историю — уберите запись и параметр `a11y` из истории.

export interface CatalogExclusion {
  /** Файл истории относительно `src/lib/stories`. */
  file: string
  /** Экспорт истории. */
  story: string
  reason: string
}

export const A11Y_EXCLUSIONS: CatalogExclusion[] = []

/**
 * Тесты о демо-историях, оставшиеся в наборах фич (ADR 0093, VR13): `play` истории не
 * может того, что им нужно. Остальные — `play` своих историй.
 */
export const KEPT_STORY_TESTS: Record<string, string> = {
  HC13: 'цвета Highlight видны только в эмуляции forced-colors Playwright — play её не включает',
  TU14: 'экран без наведения и с касаниями — проект touch; каталог идёт в настольном Chromium',
  ND15: 'перетаскивание группы настоящей мышью Playwright в широком окне — play окно не меняет',
}

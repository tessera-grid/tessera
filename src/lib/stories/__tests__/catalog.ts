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

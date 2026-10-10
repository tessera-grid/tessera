// Наборы вне прогона в Firefox и WebKit (ADR 0084, CB3) — у каждого причина.
// Список только сокращается: исправили набор — уберите запись.

/** Набор мобильной эмуляции: только проект `mobile`. */
export const MOBILE_SUITE = 'src/lib/stories/__tests__/visual/mobile.test.tsx'

export interface EngineExclusion {
  file: string
  reason: string
}

export const ENGINE_EXCLUSIONS: EngineExclusion[] = [
  {
    file: 'src/lib/stories/__tests__/visual/a11y-tree.test.tsx',
    reason: 'снимки дерева доступности через CDP — только Chromium (ADR 0033)',
  },
  {
    file: MOBILE_SUITE,
    reason: 'касания — проект mobile, эмуляция iPhone и Pixel',
  },
]

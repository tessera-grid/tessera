// Наборы вне прогона в Firefox и WebKit (ADR 0084, CB3) — у каждого причина.
// Список только сокращается: исправили набор — уберите запись.

/** Набор мобильной эмуляции: только проект `mobile`. */
export const MOBILE_SUITE = 'src/lib/stories/__tests__/visual/mobile.test.tsx'

/** Набор касаний (ADR 0086): проект `touch` в `npm test` и проект `mobile`. */
export const TOUCH_SUITE = 'src/lib/stories/__tests__/visual/touch.test.tsx'

/**
 * Chromium как экран с касаниями: `hover: none` и `pointer: coarse`. Эмуляция касаний
 * через CDP медиа-признаков не меняет — только настройки Blink при запуске.
 */
export const TOUCH_BLINK_SETTINGS =
  '--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2'

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
    file: 'src/lib/stories/__tests__/visual/work-counters.test.tsx',
    reason:
      'раскладки и пересчёты стилей — трейс CDP, только Chromium; счёт React от движка не зависит (ADR 0099)',
  },
  {
    file: MOBILE_SUITE,
    reason: 'касания — проект mobile, эмуляция iPhone и Pixel',
  },
  {
    file: TOUCH_SUITE,
    reason: 'касания — проекты touch и mobile (ADR 0086)',
  },
]

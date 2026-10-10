import type { BrowserCommand } from 'vitest/node'

// Эмуляция системной настройки «меньше движения» (`prefers-reduced-motion`) в
// реальном Chromium: нужна контракту движения (ADR 0017, MO3).
export const reducedMotion: BrowserCommand<[reduce: boolean]> = async (
  { page },
  reduce,
) => {
  await page.emulateMedia({
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  })
}

// Эмуляция высокой контрастности Windows (`forced-colors: active`, ADR 0087).
export const forcedColors: BrowserCommand<[active: boolean]> = async (
  { page },
  active,
) => {
  await page.emulateMedia({ forcedColors: active ? 'active' : 'none' })
}

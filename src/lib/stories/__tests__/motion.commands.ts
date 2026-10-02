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

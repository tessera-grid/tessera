// Поддерживаемые браузеры (ADR 0084, CB1) — один источник для цели сборки; тот же
// порог записан в `browserslist` package.json. Safari строже Tailwind v4 (16.4): до 17.1
// VoiceOver неполно читает строки шапки на display: contents.
export const BROWSER_TARGETS = {
  chrome: '111',
  edge: '111',
  firefox: '128',
  safari: '17.1',
  ios: '17.1',
  opera: '98',
} as const

/** Samsung Internet 22 — Chromium 111; цели сборки для него нет, его покрывает `chrome`. */
export const SAMSUNG_TARGET = '22'

/** `build.target` Vite / esbuild. */
export const BUILD_TARGET = Object.entries(BROWSER_TARGETS).map(
  ([browser, version]) => `${browser}${version}`,
)

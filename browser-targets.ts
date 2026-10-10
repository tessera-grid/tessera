// Поддерживаемые браузеры (ADR 0084, CB1) — один источник для цели сборки; тот же
// порог записан в `browserslist` package.json. Совпадает с порогом Tailwind v4.
export const BROWSER_TARGETS = {
  chrome: '111',
  edge: '111',
  firefox: '128',
  safari: '16.4',
  ios: '16.4',
} as const

/** `build.target` Vite / esbuild. */
export const BUILD_TARGET = Object.entries(BROWSER_TARGETS).map(
  ([browser, version]) => `${browser}${version}`,
)

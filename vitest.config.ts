import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { configDefaults, defineConfig } from 'vitest/config'

import {
  perfRecord,
  perfTraceStart,
  perfTraceStop,
} from './src/lib/stories/__tests__/perf.commands'

// Tests run in a real browser (Playwright/Chromium) because Tessera's
// virtualization and performance behaviour depend on real layout and frame
// timing — neither of which jsdom provides. This config is intentionally
// separate from vite.config.ts (the library build) so the dts/lib-mode plugins
// never run under the test bundler.
export default defineConfig({
  plugins: [react()],
  // Mirror the `@` → src alias from vite.config.ts / tsconfig so story-derived
  // tests can resolve shadcn primitives (which import `@/lib/utils`).
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Base UI `Menu` тянет `@base-ui/utils` (fastHooks), который иначе не попадает в
  // авто-пребандл vitest browser mode и ломает ESM-interop React (`import * as
  // React` → null). Пребандлим меню — esbuild собирает поддерево с единым React.
  optimizeDeps: {
    // Base UI `Menu` тянет `@base-ui/utils` (fastHooks), а `@tanstack/table-v9`
    // (v9 под алиасом) — свой React через ESM-interop; без пребандла vitest browser
    // mode ломает единый React (`import * as React` → null в useState). Пребандлим,
    // чтобы esbuild собрал их поддеревья с единым React.
    include: ['@base-ui/react/menu', '@tanstack/table-v9', '@tanstack/react-store'],
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // v9-слой миграции гоняется отдельным node-конфигом (vitest.v9.config.ts),
    // а не в браузере — исключаем его из основного прогона.
    exclude: [...configDefaults.exclude, 'src/v9/**'],
    setupFiles: ['./vitest.setup.ts'],
    // Perf tests measure real main-thread work via process-wide CDP tracing;
    // parallel test files would contend for CPU and pollute each other's
    // traces, so run files one at a time for stable, uncontended measurements.
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      // Use the real Chromium headless channel for authentic frame timing —
      // the performance tests rely on requestAnimationFrame running at the true
      // display cadence.
      provider: playwright({
        launchOptions: { channel: 'chromium' },
      }),
      instances: [{ browser: 'chromium' }],
      commands: { perfTraceStart, perfTraceStop, perfRecord },
    },
  },
})

import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { configDefaults, defineConfig } from 'vitest/config'

import { axTree } from './src/lib/stories/__tests__/a11y.commands'

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
    // Base UI `Menu` тянет `@base-ui/utils` (fastHooks), а TanStack — свой React
    // через ESM-interop; без пребандла vitest browser mode ломает единый React
    // (`import * as React` → null в useState). Пребандлим, чтобы esbuild собрал их
    // поддеревья с единым React.
    include: [
      '@base-ui/react/menu',
      '@tanstack/react-table',
      '@tanstack/react-store',
    ],
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Исключаем из основного (dev) прогона: node-тесты логики (vitest.node.config.ts)
    // и перф-тесты — последние меряются на PROD-сборке отдельным vitest.perf.config.ts
    // (dev-сборка завышает работу кадра ~2×; бюджеты RAIL сверяются с прод-релизом).
    exclude: [
      ...configDefaults.exclude,
      'src/lib/__tests__/**',
      'src/lib/stories/__tests__/performance/**',
    ],
    setupFiles: ['./vitest.setup.ts'],
    // Файлы гоняются по одному: визуальные тесты сравнивают скриншоты реального
    // layout, а параллельные браузерные вкладки конкурируют за ресурсы и делают
    // рендер/тайминги нестабильными.
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      // Реальный Chromium headless — визуальные тесты сверяют настоящий рендер.
      provider: playwright({
        launchOptions: { channel: 'chromium' },
      }),
      instances: [{ browser: 'chromium' }],
      // Дерево доступности Chromium через CDP (ADR 0033).
      commands: { axTree },
    },
  },
})

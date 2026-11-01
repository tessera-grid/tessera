import { fileURLToPath } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import {
  configDefaults,
  defineConfig,
  type TestProjectInlineConfiguration,
} from 'vitest/config'

import {
  MOBILE_SUITE,
  TOUCH_BLINK_SETTINGS,
  TOUCH_SUITE,
} from './src/lib/stories/__tests__/engines.ts'
import { testCommands } from './vitest.commands.ts'

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
      '@base-ui/react/toolbar',
      '@base-ui/react/popover',
      '@base-ui/react/combobox',
      '@base-ui/react/checkbox',
      '@tanstack/react-table',
      '@tanstack/react-store',
      // Помощники историй каталога (ADR 0093): без пребандла Vite перестраивает зависимости
      // посреди прогона, и следующий набор не загружается.
      'storybook/internal/core-events',
      'storybook/preview-api',
      'storybook/test',
    ],
  },
  test: {
    // Два проекта одного `npm test`: браузерный (визуальные тесты в Chromium) и
    // модульный `unit` (node, vitest.node.config.ts).
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          // Исключаем модульные тесты — у них проект `unit` — и перф-тесты: те меряются
          // на PROD-сборке отдельным vitest.perf.config.ts (dev-сборка завышает работу
          // кадра ~2×; бюджеты RAIL сверяются с прод-релизом).
          exclude: [
            ...configDefaults.exclude,
            'src/lib/__tests__/**',
            'src/lib/stories/__tests__/performance/**',
            // Касания — только в мобильной эмуляции `test:engines` (ADR 0084, CB4).
            MOBILE_SUITE,
            TOUCH_SUITE,
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
            commands: testCommands,
          },
        },
      },
      {
        extends: true,
        test: {
          // Экран с касаниями в Chromium (ADR 0086): без наведения, грубый указатель.
          name: 'touch',
          include: [TOUCH_SUITE],
          setupFiles: ['./vitest.setup.ts'],
          fileParallelism: false,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: {
                channel: 'chromium',
                args: [TOUCH_BLINK_SETTINGS],
              },
              contextOptions: { hasTouch: true },
            }),
            instances: [{ browser: 'chromium' }],
            commands: testCommands,
          },
        },
      },
      // Каталог визуальных состояний (ADR 0093, VR1–VR2): каждая история — тест в
      // Chromium: рендер, `play` и axe; светлая и тёмная тема — по проекту.
      ...(['light', 'dark'] as const).map(
        (theme): TestProjectInlineConfiguration => ({
          extends: true,
          plugins: [
            storybookTest({ initialGlobals: { theme, catalog: true } }),
          ],
          test: {
            name: theme === 'light' ? 'storybook' : 'storybook-dark',
            setupFiles: ['./.storybook/vitest.setup.ts'],
            fileParallelism: false,
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({
                launchOptions: { channel: 'chromium' },
                // Холст каталога — с уменьшенным движением, как снимки Chromatic (VR16).
                contextOptions: { reducedMotion: 'reduce' },
              }),
              instances: [{ browser: 'chromium' }],
            },
          },
        }),
      ),
      './vitest.node.config.ts',
    ],
  },
})

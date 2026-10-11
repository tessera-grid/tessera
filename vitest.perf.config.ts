import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

import {
  perfRecord,
  perfTraceStart,
  perfTraceStop,
} from './src/lib/stories/__tests__/perf.commands'
import { TOUCH_BLINK_SETTINGS } from './src/lib/stories/__tests__/engines'
import { forcedColors } from './src/lib/stories/__tests__/motion.commands'
import { testCommands } from './vitest.commands'

const commands = { perfTraceStart, perfTraceStop, perfRecord, forcedColors }
/** Набор утечек (ADR 0092, LK14): dev-сборка React держит отладочные ссылки. */
const MEMORY = 'src/lib/stories/__tests__/memory/**/*.test.tsx'
/** Перф касаний (ADR 0086, TU13): тот же файл и в проекте без наведения. */
const TOUCH_PERF = 'src/lib/stories/__tests__/performance/touch.test.tsx'

// Перф-прогон против PRODUCTION-сборки React. Пользователь получает прод, поэтому
// бюджеты RAIL сверяются с ним (общая практика: perf профилируют на prod-сборке).
// Основной vitest.config.ts гоняет dev-сборку (jsxDEV + валидации пропов +
// логирование рендеров) — она завышает работу кадра в ~2× и не отражает релиз.
// Здесь mode=production + define NODE_ENV + прод-пребандл react в esbuild.
// Запуск: npm run perf
export default defineConfig({
  mode: 'production',
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
    __DEV__: 'false',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      '@base-ui/react/menu',
      '@base-ui/react/toolbar',
      '@base-ui/react/popover',
      '@base-ui/react/checkbox',
      '@tanstack/react-table',
      '@tanstack/react-store',
      // Помощники историй каталога (ADR 0093) — как в vitest.config.ts.
      'storybook/internal/core-events',
      'storybook/preview-api',
      'storybook/test',
    ],
    // Прод-пребандл: esbuild режет dev-ветки React (NODE_ENV) → production-рантайм.
    esbuildOptions: {
      define: { 'process.env.NODE_ENV': '"production"' },
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    // Один повтор упавшего кейса: случайный выброс шумной машины уходит, регрессия
    // падает оба раза. Дашборд хранит последнюю попытку.
    retry: 1,
    projects: [
      {
        extends: true,
        test: {
          name: 'perf',
          include: [
            'src/lib/stories/__tests__/performance/**/*.{test,spec}.{ts,tsx}',
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: { channel: 'chromium' },
            }),
            instances: [{ browser: 'chromium' }],
            commands,
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'perf-touch',
          include: [TOUCH_PERF],
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
            commands,
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'memory-prod',
          include: [MEMORY],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: { channel: 'chromium' },
            }),
            instances: [{ browser: 'chromium' }],
            commands: testCommands,
          },
        },
      },
    ],
  },
})

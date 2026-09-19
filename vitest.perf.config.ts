import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

import {
  perfRecord,
  perfTraceStart,
  perfTraceStop,
} from './src/lib/stories/__tests__/perf.commands'

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
      '@tanstack/react-table',
      '@tanstack/react-store',
    ],
    // Прод-пребандл: esbuild режет dev-ветки React (NODE_ENV) → production-рантайм.
    esbuildOptions: {
      define: { 'process.env.NODE_ENV': '"production"' },
    },
  },
  test: {
    include: [
      'src/lib/stories/__tests__/performance/**/*.{test,spec}.{ts,tsx}',
    ],
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: { channel: 'chromium' },
      }),
      instances: [{ browser: 'chromium' }],
      commands: { perfTraceStart, perfTraceStop, perfRecord },
    },
  },
})

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

import base from './vitest.config'

// Наборы, чьё поведение зависит от движка браузера, — в Firefox и WebKit (основной
// `npm test` идёт в одном Chromium). Сессии правки: `blur` у удаляемого из DOM
// редактора браузеры шлют по-разному (ADR 0040, SS3, SS7–SS9).
// Запуск: npm run test:browsers
export default defineConfig({
  ...base,
  test: {
    name: 'engines',
    include: ['src/lib/stories/__tests__/visual/action-sessions.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
})

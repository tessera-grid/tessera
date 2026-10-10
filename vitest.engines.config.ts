import { playwright } from '@vitest/browser-playwright'
import { devices } from 'playwright'
import { configDefaults, defineConfig } from 'vitest/config'

import {
  ENGINE_EXCLUSIONS,
  MOBILE_SUITE,
} from './src/lib/stories/__tests__/engines'
import base from './vitest.config'
import { testCommands } from './vitest.commands'

// Прогон в движках (ADR 0084): все визуальные наборы в Firefox и WebKit, кроме
// исключений с причиной, и мобильная эмуляция с касаниями. Не барьер — обязателен
// перед публикацией в npm. Запуск: npm run test:engines

const { defaultBrowserType: _iphoneEngine, ...iphone } = devices['iPhone 15']
const { defaultBrowserType: _pixelEngine, ...pixel } = devices['Pixel 7']

const shared = {
  setupFiles: ['./vitest.setup.ts'],
  fileParallelism: false,
}

export default defineConfig({
  ...base,
  test: {
    projects: [
      {
        extends: true,
        test: {
          ...shared,
          name: 'engines',
          include: ['src/lib/stories/__tests__/visual/**/*.test.tsx'],
          exclude: [
            ...configDefaults.exclude,
            ...ENGINE_EXCLUSIONS.map(exclusion => exclusion.file),
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'firefox' }, { browser: 'webkit' }],
            commands: testCommands,
          },
        },
      },
      {
        extends: true,
        test: {
          ...shared,
          name: 'mobile',
          include: [MOBILE_SUITE],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              {
                browser: 'webkit',
                name: 'iphone',
                provider: playwright({ contextOptions: iphone }),
              },
              {
                browser: 'chromium',
                name: 'pixel',
                provider: playwright({ contextOptions: pixel }),
              },
            ],
            commands: testCommands,
          },
        },
      },
    ],
  },
})

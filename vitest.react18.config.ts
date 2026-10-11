import { fileURLToPath } from 'node:url'

import { playwright } from '@vitest/browser-playwright'
import { configDefaults, defineConfig } from 'vitest/config'

import {
  MOBILE_SUITE,
  TOUCH_BLINK_SETTINGS,
  TOUCH_SUITE,
} from './src/lib/stories/__tests__/engines'
import {
  REACT18_EXCLUSIONS,
  REACT18_ROOT,
  SSR_SUITE,
} from './src/lib/stories/__tests__/react18'
import base from './vitest.config'
import { testCommands } from './vitest.commands'

// Прогон на React 18 (ADR 0091, EV1): браузерные наборы `npm test` с React и React DOM
// 18 из `tools/react18` (`npm ci --prefix tools/react18`). Не барьер — обязателен перед
// публикацией в npm. Запуск: npm run test:react18

const react18 = (name: string) =>
  fileURLToPath(new URL(`./${REACT18_ROOT}/${name}`, import.meta.url))

const excluded = REACT18_EXCLUSIONS.map(exclusion => exclusion.file)

const shared = {
  setupFiles: ['./vitest.setup.ts'],
  fileParallelism: false,
}

export default defineConfig({
  ...base,
  resolve: {
    alias: [
      ...Object.entries(base.resolve?.alias ?? {}).map(
        ([find, replacement]) => ({
          find,
          replacement: replacement as string,
        }),
      ),
      { find: /^react-dom(?=\/|$)/, replacement: react18('react-dom') },
      { find: /^react(?=\/|$)/, replacement: react18('react') },
    ],
  },
  // Свой кэш пребандла: иначе зависимости, собранные с React 19, попали бы сюда.
  cacheDir: 'node_modules/.vite-react18',
  test: {
    projects: [
      {
        extends: true,
        test: {
          ...shared,
          name: 'react18',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: [
            ...configDefaults.exclude,
            'src/lib/__tests__/**',
            'src/lib/stories/__tests__/performance/**',
            MOBILE_SUITE,
            TOUCH_SUITE,
            ...excluded,
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: { channel: 'chromium' } }),
            instances: [{ browser: 'chromium' }],
            commands: testCommands,
          },
        },
      },
      {
        extends: true,
        test: {
          // Серверный рендер (EV4, EV6) в node: зависимости проходят через Vite, иначе
          // node подгрузил бы им React 19 из корня мимо алиасов.
          name: 'react18-unit',
          include: [SSR_SUITE],
          environment: 'node',
          setupFiles: ['./vitest.react18.setup.ts'],
          server: {
            deps: { inline: [/^(?!.*tools[\\/]react18).*node_modules/] },
          },
        },
      },
      {
        extends: true,
        test: {
          ...shared,
          name: 'react18-touch',
          include: [TOUCH_SUITE],
          exclude: [...configDefaults.exclude, ...excluded],
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
    ],
  },
})

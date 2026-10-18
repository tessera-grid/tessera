import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

import base from './vitest.config.ts'
import { testCommands } from './vitest.commands.ts'

// Наборы, чьё поведение зависит от движка браузера, — в Firefox и WebKit (основной
// `npm test` идёт в одном Chromium). Сессии правки: `blur` у удаляемого из DOM
// редактора браузеры шлют по-разному (ADR 0040, SS3, SS7–SS9). Вход в грид с
// клавиатуры: Firefox держит прокручиваемые области в порядке Tab (ADR 0021, KN32).
// Кольцо фокуса после мыши: Firefox не даёт :focus-visible фокусу от скрипта (CB5).
// Раскрытие кнопок ячейки без возможностей только Chromium (CB6). Смена кольца кнопки
// посреди нажатия: Firefox терял клик (BS18). Линии дерева при дробном масштабе: Firefox и
// WebKit схлопывали линию в 1px (TL7).
// Запуск: npm run test:browsers
export default defineConfig({
  ...base,
  test: {
    name: 'engines',
    include: [
      'src/lib/stories/__tests__/visual/action-sessions.test.tsx',
      'src/lib/stories/__tests__/visual/keyboard-entry.test.tsx',
      'src/lib/stories/__tests__/visual/focus-modality.test.tsx',
      'src/lib/stories/__tests__/visual/reveal-engines.test.tsx',
      'src/lib/stories/__tests__/visual/ring-press.test.tsx',
      'src/lib/stories/__tests__/visual/tree-lines-zoom.test.tsx',
    ],
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'firefox' }, { browser: 'webkit' }],
      commands: testCommands,
    },
  },
})

import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// Конфиг node-тестов параллельного v9-слоя (src/v9/**). Отдельно от основного
// браузерного прогона (vitest.config.ts). Запуск:
//   npx vitest run --config vitest.v9.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/v9/**/*.test.ts'],
    environment: 'node',
  },
})

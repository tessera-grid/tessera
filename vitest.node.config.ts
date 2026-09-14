import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// Конфиг node-тестов логики (src/lib/__tests__/**). Отдельно от основного
// браузерного прогона (vitest.config.ts). Запуск:
//   npx vitest run --config vitest.node.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/lib/__tests__/**/*.test.{ts,tsx}'],
    // node по умолчанию; DOM-тесты реактивности задают happy-dom докблоком
    // `// @vitest-environment happy-dom` пофайлово.
    environment: 'node',
  },
})

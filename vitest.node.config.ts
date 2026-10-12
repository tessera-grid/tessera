import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// Конфиг модульных тестов логики (src/lib/__tests__/**) — проект `unit` в
// vitest.config.ts, идёт в `npm test`. Отдельно: `npm test -- --project unit`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    name: 'unit',
    include: ['src/lib/__tests__/**/*.test.{ts,tsx}'],
    // Самопроверка perf:compare — настоящие прогоны, `npm run perf:selftest`.
    exclude: ['**/node_modules/**', 'src/lib/__tests__/**/*.selftest.test.ts'],
    // node по умолчанию; DOM-тесты реактивности задают happy-dom докблоком
    // `// @vitest-environment happy-dom` пофайлово.
    environment: 'node',
  },
})

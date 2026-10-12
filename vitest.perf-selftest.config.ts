import { defineConfig } from 'vitest/config'

// Самопроверка `perf:compare` (ADR 0099, PF15–PF16): настоящие прогоны перф-кейсов,
// ~20 мин — вне `npm test`. Запуск: `npm run perf:selftest`.
export default defineConfig({
  test: {
    name: 'perf-selftest',
    include: ['src/lib/__tests__/**/*.selftest.test.ts'],
    environment: 'node',
    fileParallelism: false,
  },
})

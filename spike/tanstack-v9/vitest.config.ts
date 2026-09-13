import { defineConfig } from 'vitest/config'

// Изолированный конфиг спайка: node-окружение (без браузера/playwright основного
// прогона), подхватывает ТОЛЬКО тест спайка. Запуск:
//   npx vitest run --config spike/tanstack-v9/vitest.config.ts
export default defineConfig({
  test: {
    include: ['spike/tanstack-v9/**/*.test.ts'],
    environment: 'node',
  },
})

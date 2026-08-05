import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Tests run in a real browser (Playwright/Chromium) because Tessera's
// virtualization and performance behaviour depend on real layout and frame
// timing — neither of which jsdom provides. This config is intentionally
// separate from vite.config.ts (the library build) so the dts/lib-mode plugins
// never run under the test bundler.
export default defineConfig({
  plugins: [react()],
  // Mirror the `@` → src alias from vite.config.ts / tsconfig so story-derived
  // tests can resolve shadcn primitives (which import `@/lib/utils`).
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      // Use the real Chromium headless channel for authentic frame timing —
      // the performance tests rely on requestAnimationFrame running at the true
      // display cadence.
      provider: playwright({
        launchOptions: { channel: 'chromium' },
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
})

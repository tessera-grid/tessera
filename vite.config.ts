import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tailwindcss from '@tailwindcss/vite'

const resolvePath = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url))

const STORY_TEST_GLOBS = ['src/lib/stories/**']

// Storybook подхватывает этот конфиг — генерацию типов там отключаем
const isStorybook = process.env.npm_lifecycle_event?.includes('storybook')

export default defineConfig({
  resolve: {
    alias: {
      '@': resolvePath('src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    !isStorybook &&
      dts({
        tsconfigPath: './tsconfig.json',
        include: ['src'],
        exclude: STORY_TEST_GLOBS,
      }),
  ],
  build: {
    // Единый dist/style.css вместо пофайлового сплита
    cssCodeSplit: false,
    lib: {
      entry: {
        index: resolvePath('src/index.ts'),
        plugins: resolvePath('src/plugins.ts'),
        ui: resolvePath('src/ui.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      // Стабильное имя единого CSS-файла (vite 8/rolldown иначе назвал бы его
      // по имени пакета — tessera.css)
      cssFileName: 'style',
    },
    rollupOptions: {
      // Внешние оставляем только peer-зависимости и крупные раннеры (их приносит
      // потребитель). shadcn-примитивы (@base-ui/react, cva, tailwind-merge,
      // clsx, lucide-react) БАНДЛИМ в dist — пакет самодостаточен.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^@tanstack\//,
        /^@dnd-kit\//,
      ],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
})

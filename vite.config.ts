import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tailwindcss from '@tailwindcss/vite'

import { BUILD_TARGET } from './browser-targets'

const resolvePath = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url))

const STORY_TEST_GLOBS = ['src/lib/stories/**', 'src/**/__tests__/**']

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
        // Корень деклараций — src: dist/index.d.ts и т. п. по путям exports.
        entryRoot: 'src',
        include: ['src'],
        exclude: STORY_TEST_GLOBS,
        // Ошибка генерации декларации (TS4023 и т. п.) молча пропускает файл .d.ts —
        // сборка падает, а не публикует ссылку на несуществующий файл.
        afterDiagnostic: diagnostics => {
          if (diagnostics.length > 0) {
            throw new Error(
              `dts: ${diagnostics.length} ошибок генерации деклараций`,
            )
          }
        },
      }),
  ],
  build: {
    // Порог поддерживаемых браузеров (ADR 0084, CB1).
    target: BUILD_TARGET,
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
      // Модуль на файл: сборщик потребителя выбрасывает модули неиспользуемых
      // плагинов целиком (sideEffects в package.json — только CSS), ADR 0010, IV3.
      output: { preserveModules: true, preserveModulesRoot: 'src' },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
})

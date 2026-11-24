import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import { BUILD_TARGET } from './browser-targets.ts'
import {
  withExtensions,
  writeCommonJsDeclarations,
} from './scripts/declarations.ts'

const resolvePath = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url))

const STORY_TEST_GLOBS = ['src/lib/stories/**', 'src/**/__tests__/**']

// Storybook подхватывает этот конфиг — генерацию типов там отключаем
const isStorybook = process.env.npm_lifecycle_event?.includes('storybook')

export default defineConfig({
  resolve: {
    alias: {
      '@': resolvePath('src'),
      'use-sync-external-store/shim/with-selector.js': resolvePath(
        'src/lib/util/useSyncExternalStore',
      ),
      'use-sync-external-store/shim/with-selector': resolvePath(
        'src/lib/util/useSyncExternalStore',
      ),
      'use-sync-external-store/shim/index.js': resolvePath(
        'src/lib/util/useSyncExternalStore',
      ),
      'use-sync-external-store/shim': resolvePath(
        'src/lib/util/useSyncExternalStore',
      ),
    },
  },
  plugins: [
    react(),
    !isStorybook &&
      dts({
        tsconfigPath: './tsconfig.json',
        // Корень деклараций — src: dist/index.d.ts и т. п. по путям exports.
        entryRoot: 'src',
        include: ['src'],
        exclude: STORY_TEST_GLOBS,
        // Импорты деклараций с расширением и копия в .d.cts для require (ADR 0091).
        beforeWriteFile: (filePath, content) => ({
          filePath,
          content: withExtensions(
            content,
            join(
              resolvePath('src'),
              relative(resolvePath('dist'), dirname(filePath)),
            ),
          ),
        }),
        afterBuild: () => {
          writeCommonJsDeclarations(resolvePath('dist'))
        },
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
      // потребитель). примитивы (@base-ui/react, clsx, lucide-react)
      // БАНДЛИМ в dist — пакет самодостаточен.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^@tanstack\//,
        /^@dnd-kit\//,
      ],
      // Модуль на файл: сборщик потребителя выбрасывает модули неиспользуемых
      // плагинов целиком (sideEffects в package.json — только CSS), ADR 0010, IV3.
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        // Входы — клиентские модули для серверных компонентов (ADR 0091, EV9).
        banner: chunk => (chunk.isEntry ? "'use client';" : ''),
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
})

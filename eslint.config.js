import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'storybook-static',
      'coverage',
      '.claude',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    // Старые inline-директивы из прежнего Nx-пресета больше не актуальны
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // Классические правила hooks; новые строгие правила react-hooks 7
      // (React Compiler) можно включить отдельной задачей
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Аугментации типов используют пустые интерфейсы намеренно
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  // ADR 0010 (R1): слой `core` не импортирует конкретные плагины — стрелка
  // зависимости смотрит вверх (плагины → контракт core/pluginContract ← ядро).
  // Инверсия выполнена целиком, включая `createHooks` (types-mode b: `PluginsHooks`
  // пуст, тип хуков выводится из набора `plugins`), поэтому уровень — `error`.
  {
    files: ['src/lib/core/**/*.{ts,tsx}'],
    ignores: ['src/lib/core/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/plugins', '**/plugins/**'],
              message:
                'ADR 0010 (R1): core не импортирует конкретные плагины. Плагин приносит feature/column/state-слайс сам (RegistryEntry), а core остаётся обобщённым. Контракт — в core/pluginContract.',
            },
          ],
        },
      ],
    },
  },
  // Демо-истории — послабления
  {
    files: ['src/lib/stories/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Node-скрипты сборки/отчётов
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Отключает правила ESLint, конфликтующие с Prettier (должно идти последним)
  prettier,
)

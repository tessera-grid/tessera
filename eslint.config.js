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
      // Полный набор react-hooks 7, включая правила React Compiler.
      ...reactHooks.configs['recommended-latest'].rules,
      '@typescript-eslint/no-explicit-any': 'off',
      // `interface X extends Y {}` — легитимный паттерн (declaration merging,
      // номинальные псевдонимы), пустое тело здесь не ошибка.
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
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
  // Сборка ядра читает и пишет хранилища аргументов плагинов, ref прежней таблицы и
  // кэш сужения во время рендера: живые аргументы видят последнюю версию функций уже в
  // этом рендере (ADR 0039). Сборка без этого — отдельная задача (roadmap).
  {
    files: ['src/lib/core/useCreateTable.ts', 'src/lib/core/effectiveState.ts'],
    rules: {
      'react-hooks/refs': 'off',
    },
  },
  // Тестовые хосты отдают тесту экземпляр таблицы и сеттеры через переменные модуля —
  // это канал наблюдения, а не состояние компонента.
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
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

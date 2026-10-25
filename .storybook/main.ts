import type { StorybookConfig } from '@storybook/react-vite'

/**
 * Наборы историй (ADR 0117 §8): `storybook dev` и тесты — все файлы; сборка для
 * Chromatic — без песочниц обвязки `*.dev`; публичный набор (`STORYBOOK_TARGET=public`, и
 * в сборке, и в `storybook dev`) — ещё и без историй только для снимков `*.vr`.
 */
const build = process.argv.includes('build')
const publicStories = process.env.STORYBOOK_TARGET === 'public'

const config: StorybookConfig = {
  stories: [
    publicStories
      ? '../src/**/!(*.dev|*.vr).stories.@(ts|tsx)'
      : build
        ? '../src/**/!(*.dev).stories.@(ts|tsx)'
        : '../src/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    'storybook-addon-pseudo-states',
  ],
  // Порядок дерева: песочница всех фич, ядро, фичи, служебные разделы; внутри раздела —
  // порядок экспортов файла. Storybook 11 сортирует индекс отсюда, а не из preview.
  storySorts: [
    {
      order: [
        'Tessera',
        [
          'DataGrid',
          [
            'Playground',
            'Core',
            'Data loading',
            'Columns',
            'Rows',
            'Cells',
            'Filtering',
            'Export',
            'Panels',
            'Accessibility',
            'Plugin API',
            'Data & scale',
          ],
          'Customization',
          'Theming',
          'UI',
        ],
      ],
    },
  ],
  framework: {
    name: '@storybook/react-vite',
    // Истории, как и тесты, — в StrictMode (ADR 0091, ADR 0093 VR1).
    options: { strictMode: true },
  },
  // Бренд — единый источник brand/ в корне: Storybook раздаёт только логотип и фавикон.
  staticDirs: [
    { from: '../brand/storybook', to: '/brand/storybook' },
    { from: '../brand/favicon', to: '/brand/favicon' },
  ],
  managerHead: head => `${head}
    <link rel="icon" type="image/svg+xml" href="brand/favicon/favicon.svg" />
    <link rel="icon" sizes="48x48" href="brand/favicon/favicon.ico" />`,
}

export default config

import type { StorybookConfig } from '@storybook/react-vite'

/**
 * `*.dev.stories.tsx` — песочницы обвязки историй: в `storybook dev` и тестах, но не в
 * `storybook build` (и значит не в Chromatic).
 */
const build = process.argv.includes('build')

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    build
      ? '../src/**/!(*.dev).stories.@(ts|tsx)'
      : '../src/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    'storybook-addon-pseudo-states',
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

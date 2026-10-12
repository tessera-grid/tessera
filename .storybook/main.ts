import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
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
  staticDirs: [{ from: './brand', to: '/brand' }],
  managerHead: head => `${head}
    <link rel="icon" type="image/svg+xml" href="brand/favicon.svg" />
    <link rel="icon" sizes="48x48" href="brand/favicon.ico" />`,
}

export default config

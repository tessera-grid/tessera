import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming/create'

// Логотип Tessera в шапке Storybook — под системную тему на момент загрузки.
const dark = window.matchMedia('(prefers-color-scheme: dark)').matches

addons.setConfig({
  theme: create({
    base: dark ? 'dark' : 'light',
    brandTitle: 'Tessera',
    brandImage: dark
      ? 'brand/storybook-brand-dark.svg'
      : 'brand/storybook-brand-light.svg',
    brandTarget: '_self',
  }),
})

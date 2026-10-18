import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming/create'
import {
  defaultConfig,
  type TagBadgeParameters,
} from 'storybook-addon-tag-badges/manager-helpers'

// Логотип Tessera в шапке Storybook — под системную тему на момент загрузки.
const dark = window.matchMedia('(prefers-color-scheme: dark)').matches

addons.setConfig({
  theme: create({
    base: dark ? 'dark' : 'light',
    brandTitle: 'Tessera',
    brandImage: dark
      ? 'brand/storybook/storybook-brand-dark.svg'
      : 'brand/storybook/storybook-brand-light.svg',
    brandTarget: '_self',
  }),
  // Значки тегов в боковой панели; свои — перед стандартными, у них приоритет.
  tagBadges: [
    {
      tags: 'done',
      badge: { text: 'done', style: 'green', tooltip: 'Фича готова' },
    },
    ...defaultConfig,
  ] satisfies TagBadgeParameters,
})

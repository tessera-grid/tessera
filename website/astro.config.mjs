// Сайт документации (ADR 0113): Starlight, английский в корне, русский в /ru/,
// справочник API из публичных деклараций, Storybook рядом в /tessera/storybook/.

import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightTypeDoc from 'starlight-typedoc'

import { API_LABEL, sidebar } from './sidebar.mjs'
import typedoc from './typedoc.config.mjs'

export const SITE = 'https://tessera-grid.github.io'
export const BASE = '/tessera/'

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'Tessera',
      description: 'A headless, plugin-driven data grid for React.',
      logo: {
        light: '../brand/lockup/lockup-color-light-bg.svg',
        dark: '../brand/lockup/lockup-color-dark-bg.svg',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        ru: { label: 'Русский', lang: 'ru' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/tessera-grid/tessera',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        Banner: './src/components/Banner.astro',
      },
      plugins: [
        starlightTypeDoc({
          entryPoints: typedoc.entryPoints,
          tsconfig: typedoc.tsconfig,
          output: 'api',
          sidebar: { label: API_LABEL, collapsed: true },
          typeDoc: typedoc,
        }),
      ],
      sidebar,
    }),
  ],
})

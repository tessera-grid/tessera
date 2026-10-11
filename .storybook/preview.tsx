import type { CSSProperties } from 'react'

import type { Preview } from '@storybook/react'
import clsx from 'clsx'

import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
// Тема shadcn (токены :root/.dark + Tailwind-утилиты) — из неё выводятся и
// --data-grid-*, и стили shadcn-компонентов внутри демо.
import '../src/styles/global.css'
import {
  BASE_MODES,
  CatalogEnvironment,
  type Contrast,
  type Palette,
  PlayArgs,
} from '../src/lib/stories/__mocks__/catalog'
import { pinClock } from '../src/lib/stories/__mocks__/clock'
import './catalog.css'

const INTER_STACK =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"

// Дата историй закреплена до импорта моков: данные, «сегодня» фильтра дат и календарь
// одинаковы при каждой загрузке (ADR 0093, VR3).
pinClock()

type ThemeName = 'light' | 'dark'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme (drives the grid colorMode and demo chrome)',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
    // Оси каталога визуальных состояний (ADR 0093, VR9): палитра и контраст.
    palette: {
      description: 'Palette the grid theme bridges from',
      defaultValue: 'stories',
      toolbar: {
        title: 'Palette',
        icon: 'paintbrush',
        items: [
          { value: 'stories', title: 'App palette (shadcn)' },
          { value: 'tessera', title: 'Fallback palette' },
        ],
        dynamicTitle: true,
      },
    },
    contrast: {
      description: 'Increased contrast (data-tsr-contrast on an ancestor)',
      defaultValue: 'standard',
      toolbar: {
        title: 'Contrast',
        icon: 'eye',
        items: [
          { value: 'standard', title: 'Standard contrast' },
          { value: 'more', title: 'More contrast' },
        ],
        dynamicTitle: true,
      },
    },
    // Холст каталога: без полос прокрутки, не ниже 640 px (VR16). Включают проекты
    // каталога в Vitest и режимы Chromatic, в живом Storybook — выключен.
    catalog: { description: 'Visual catalog canvas', defaultValue: false },
  },
  parameters: {
    // Снимки Chromatic (ADR 0093, §6): каждая история — в базовом режиме, узловые —
    // во всех режимах осей (тег `vr-modes` и `vrModes`); движение уменьшено.
    chromatic: { modes: BASE_MODES, prefersReducedMotion: 'reduce' },
    // Псевдо-состояния наведения и фокуса (ADR 0093, VR8) ищут узлы во всём `body`:
    // в проектах каталога корня `#storybook-root` нет, а порталы лежат вне него.
    pseudo: { rootSelector: 'body' },
    // axe по каждой истории каталога — падение на нарушении, `color-contrast` включён
    // (ADR 0093, VR2). Как в наборах доступности (ADR 0020): `region` — правило
    // страницы, а не встраиваемого грида; `scrollable-region-focusable` — без
    // keyboardNavigation грид только для чтения, с ним правило проверяет A7.
    // Стражи фокуса Base UI (aria-hidden + tabindex=0) — штатная ловушка фокуса
    // поповера, aria-hidden-focus на них — ложное срабатывание (CV17).
    a11y: {
      test: 'error',
      context: { exclude: [['[data-base-ui-focus-guard]']] },
      options: {
        rules: {
          region: { enabled: false },
          'scrollable-region-focusable': { enabled: false },
        },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Порядок групп: от ядра к фичам и служебным песочницам; внутри фичи — порядок
    // экспортов файла (Basic первым).
    options: {
      storySort: {
        order: [
          'Tessera',
          [
            'DataGrid',
            [
              'Core',
              'Columns',
              'Rows',
              'Cells',
              'Filtering',
              'Export',
              'Panels',
              'Accessibility',
              'Plugin API',
              'Data & scale',
              'Sizing',
            ],
            'Theming',
            'UI',
          ],
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme: ThemeName =
        context.globals.theme === 'dark' ? 'dark' : 'light'
      const palette: Palette =
        context.globals.palette === 'tessera' ? 'tessera' : 'stories'
      const contrast: Contrast =
        context.globals.contrast === 'more' ? 'more' : 'standard'
      const catalog = context.globals.catalog === true

      // Держим colorMode грида в синхроне с тумблером тулбара. Светлый — 'auto': тест,
      // ставящий `.dark` на <html>, получает тёмный грид (ADR 0090). Только у историй
      // грида: примитивы `/ui` отдали бы проп в DOM.
      if ('colorMode' in context.argTypes) {
        context.args.colorMode = theme === 'dark' ? 'dark' : 'auto'
      }

      return (
        // Класс `dark` активирует токены .dark из global.css для всего канваса —
        // и для демо-хрома, и для вложенных shadcn-компонентов.
        <div
          className={clsx({ dark: theme === 'dark' })}
          data-theme={theme}
          data-tsr-contrast={contrast === 'more' ? 'more' : undefined}
          style={
            {
              minHeight: catalog ? 'max(100vh, 640px)' : '100vh',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontFamily: INTER_STACK,
              // Грид в демо использует Inter (переопределяет системный дефолт
              // библиотеки через собственный токен).
              '--data-grid-font-family': INTER_STACK,
            } as CSSProperties
          }
        >
          <CatalogEnvironment catalog={catalog} palette={palette}>
            {catalog ? (
              <PlayArgs storyId={context.id}>
                {updates => <Story args={{ ...context.args, ...updates }} />}
              </PlayArgs>
            ) : (
              <Story />
            )}
          </CatalogEnvironment>
        </div>
      )
    },
  ],
}

export default preview

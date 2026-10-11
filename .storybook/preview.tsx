import type { CSSProperties } from 'react'

import type { Preview } from '@storybook/react'
import clsx from 'clsx'

import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
// Тема shadcn (токены :root/.dark + Tailwind-утилиты) — из неё выводятся и
// --data-grid-*, и стили shadcn-компонентов внутри демо.
import '../src/styles/global.css'
import { pinClock } from '../src/lib/stories/__mocks__/clock'

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
  },
  parameters: {
    // axe по каждой истории каталога — падение на нарушении, `color-contrast` включён
    // (ADR 0093, VR2). Как в наборах доступности (ADR 0020): `region` — правило
    // страницы, а не встраиваемого грида; `scrollable-region-focusable` — без
    // keyboardNavigation грид только для чтения, с ним правило проверяет A7.
    a11y: {
      test: 'error',
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
          style={
            {
              minHeight: '100vh',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontFamily: INTER_STACK,
              // Грид в демо использует Inter (переопределяет системный дефолт
              // библиотеки через собственный токен).
              '--data-grid-font-family': INTER_STACK,
            } as CSSProperties
          }
        >
          <Story />
        </div>
      )
    },
  ],
}

export default preview

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
import { StoryLocaleProvider } from '../src/lib/stories/__mocks__/storyLocale'
import { type ConsoleErrors, expectConsoleErrors } from './consoleErrors'
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
    },
    // Язык подписей таблицы (ADR 0132): английские умолчания или русский словарь историй.
    locale: {
      description: 'Language of the table and UI kit labels',
      defaultValue: 'en',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'ru', title: 'Русский' },
        ],
        dynamicTitle: true,
      },
    },
    // Холст каталога: без полос прокрутки, не ниже 640 px (VR16). Включают проекты
    // каталога в Vitest и режимы Chromatic, в живом Storybook — выключен.
    catalog: { description: 'Visual catalog canvas', defaultValue: false },
  },
  parameters: {
    // Холст без полей Storybook: отступ задаёт сама история (16px), как у грида.
    layout: 'fullscreen',
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
  },
  // Сообщения `console.error`, которые история пишет нарочно (ADR 0093, VR18).
  beforeEach: ({ parameters }) => {
    expectConsoleErrors(parameters.consoleErrors as ConsoleErrors | undefined)
    // Палец прошлой истории не переходит в следующую: вид без наведения — только по касанию
    // в своей истории (ADR 0231, §2).
    if (
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-tsr-input') === 'touch'
    )
      document.documentElement.removeAttribute('data-tsr-input')
  },
  // Число на вкладке Controls Storybook считает по всем argTypes с контролом, без учёта
  // `controls.include`: скрытым списком контролам — `table.disable` (ADR 0117).
  argTypesEnhancers: [
    ({ argTypes, parameters }) => {
      const include: unknown = parameters.controls?.include
      if (!Array.isArray(include)) return argTypes
      return Object.fromEntries(
        Object.entries(argTypes).map(([name, argType]) => [
          name,
          include.includes(name)
            ? argType
            : { ...argType, table: { ...argType.table, disable: true } },
        ]),
      )
    },
  ],
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
      // Язык подписей — из тулбара, как и тема: историям таблицы — аргументом `locale`,
      // историям кита — контекстом `StoryLocaleProvider`.
      const locale = context.globals.locale === 'ru' ? 'ru' : 'en'
      if ('locale' in context.args) context.args.locale = locale

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
              // Шрифт приложения историй — Inter: грид берёт его через `--font-sans`, как
              // в приложении на shadcn и Tailwind (ADR 0019, TK6).
              '--font-sans': INTER_STACK,
            } as CSSProperties
          }
        >
          <CatalogEnvironment catalog={catalog} palette={palette}>
            <StoryLocaleProvider value={locale}>
              {catalog ? (
                <PlayArgs storyId={context.id}>
                  {updates => <Story args={{ ...context.args, ...updates }} />}
                </PlayArgs>
              ) : (
                <Story />
              )}
            </StoryLocaleProvider>
          </CatalogEnvironment>
        </div>
      )
    },
  ],
}

export default preview

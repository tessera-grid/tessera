import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin, readPluginHooks } from '../core/definePlugin'
import { Button } from '../ui/Button'
import { Stub } from '../ui/Stub'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import {
  byTestId,
  guideNext,
  pressEscape,
  settle,
  until,
} from './__mocks__/catalogPlay'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import type { ConsoleLog } from './demos/consoleLog'
import { openViewSettingsSection } from './__mocks__/viewSettings'
import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'

/**
 * Заглушки пустой таблицы (ADR 0123): реестр причин — нет данных, нет колонок, все
 * колонки скрыты, фильтр ничего не нашёл, ошибка загрузки; свой вид — пропом `stubs`,
 * своя причина — записью плагина. `Playground` — песочница, S1–S5 — сценарии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Stubs',
} satisfies Meta<StoryProps>

export default meta

/** Область фиксированной высоты: заглушка — на всю таблицу. */
const FIXED_HEIGHT = {
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
} as const

/** Тулбар со всеми функциями и нижняя панель: что с ними без колонок (ES10). */
const PANELS = {
  enableQuickSearch: true,
  enableColumnFiltering: true,
  enableColumnVisibility: true,
  enableDataExport: true,
  enablePagination: true,
} satisfies Partial<StoryProps>

const PANEL_CONTROLS = [
  'enableQuickSearch',
  'enableColumnFiltering',
  'enableColumnVisibility',
  'enableDataExport',
  'enablePagination',
]

const disabled = (id: string) =>
  byTestId(id)?.getAttribute('aria-disabled') === 'true' ||
  (byTestId(id) as HTMLButtonElement | null)?.disabled === true
const waitTestId = (id: string) =>
  until(() => expect(byTestId(id)).not.toBeNull())
const bodyRows = (canvas: HTMLElement) =>
  canvas.querySelectorAll('.data-grid__body-row')

/** «Нет связи» автора плагина: своя причина, главнее встроенных (S5). */
const offline = definePlugin<{ enabled?: boolean; offline?: boolean }>()({
  id: 'offlineDemo',
  hooks: o => ({ offline: o.offline }),
  stubs: [
    {
      id: 'offline',
      priority: 5,
      placement: 'grid',
      when: ({ table }) =>
        !!readPluginHooks<{ offline?: boolean }>(
          table as { getHooks: () => unknown },
          'offlineDemo',
        ).offline,
      title: () => 'You are offline',
      description: () => 'Data will appear once the connection is back.',
      testId: 'offline-stub',
    },
  ],
})

/**
 * Песочница заглушек и снимок каталога `body.empty`: по умолчанию данных нет — заглушка
 * библиотеки. `columnCount: 0` — нет колонок, `hideAllColumns` — все скрыты.
 */
export const StubsPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: {
    ...vrStates('body.empty'),
    ...showControls(['showStub', 'hideAllColumns', ...PANEL_CONTROLS]),
  },
  args: { ...FIXED_HEIGHT, showStub: true },
}

// --- S1 ------------------------------------------------------------------------------

const NO_COLUMNS: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Ожидание списка колонок от сервера',
      en: 'Waiting for the column list from the server',
    },
    hint: {
      ru: 'Структура таблицы еще неизвестна. Тулбар, тело таблицы и статусбар находятся в состоянии загрузки.',
      en: 'The structure of the table is not known yet. The toolbar, the table body, and the status bar are in the loading state.',
    },
    props: () => ({
      loading: 'initial',
      dataOverride: [],
      columnsOverride: [],
    }),
  },
  {
    title: {
      ru: 'Данные пришли, колонки — нет',
      en: 'Data arrived, columns did not',
    },
    hint: {
      ru: 'Список колонок отсутствует. В таблице отображается заглушка, без заголовков и строк.',
      en: 'There is no column list. The table shows a placeholder, with no headers or rows.',
    },
    props: ({ rows }) => ({ loading: false, dataOverride: rows }),
  },
]

/** S1: сервер прислал данные без колонок. */
export const StubsNoColumns: StoryObj<StoryProps> = {
  name: 'No columns',
  parameters: {
    scenario: '0123/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Данные без колонок', en: 'Data without columns' }}
      steps={NO_COLUMNS}
      args={guideArgs({ ...FIXED_HEIGHT, ...PANELS }, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(NO_COLUMNS[0]!.title.ru, async () => {
      for (const id of [
        'quick-search-skeleton',
        'export-skeleton',
        'view-settings-skeleton',
      ]) {
        await waitTestId(id)
      }
      await expect(
        canvas.querySelector('.data-grid__body-row--skeleton'),
      ).not.toBeNull()
      await expect(byTestId('pagination-range')?.textContent).toBe('')
    })
    await step(NO_COLUMNS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitTestId('no-columns-stub')
      await expect(byTestId('no-columns-stub')).toHaveTextContent(
        labels.noColumnsTitle,
      )
      await expect(bodyRows(canvas)).toHaveLength(0)
      await expect(
        canvas.querySelectorAll('[role="columnheader"]'),
      ).toHaveLength(0)
      for (const id of [
        'quick-search',
        'export-button',
        'view-settings-button',
      ]) {
        await until(() => expect(disabled(id), id).toBe(true))
      }
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

/**
 * Пользователь снимает флажок всех колонок в разделе «Колонки» «Настроек вида» и закрывает «Настройки вида», как
 * `Escape`: заглушку ничто не заслоняет (ADR 0133).
 */
const hideAllFromMenu = (root: HTMLElement) => {
  const menu = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="column-visibility-menu"]',
    )
  const run = () => {
    const box = menu()?.querySelector<HTMLElement>(
      '[data-testid="column-visibility-all"] [role="checkbox"]',
    )
    if (box && menu()!.hasAttribute('data-open')) {
      box.click()
      pressEscape()
      return
    }
    openViewSettingsSection(root, 'columns')
    setTimeout(run, 100)
  }
  setTimeout(run, 0)
}

const COLUMNS_HIDDEN: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Видимость колонок в тулбаре',
      en: 'Column visibility in the toolbar',
    },
    hint: {
      ru: 'Таблица отображает список колонок. Включен виджет по управлению их видимостью.',
      en: 'The table shows its columns. A control for their visibility is turned on.',
    },
  },
  {
    title: {
      ru: 'Пользователь скрыл все колонки',
      en: 'The user hid all columns',
    },
    hint: {
      ru: 'Пользователь снял флажок всех колонок в меню видимости. Все колонки скрыты, в таблице отображается заглушка.',
      en: 'The user cleared the checkbox for all columns in the visibility menu. All columns are hidden, and the table shows a placeholder.',
    },
    enter: hideAllFromMenu,
  },
]

/** S2: пользователь скрыл все колонки в меню — заглушка с кнопкой возврата. */
export const StubsColumnsHidden: StoryObj<StoryProps> = {
  name: 'All columns hidden',
  parameters: {
    scenario: '0123/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Все колонки скрыты', en: 'All columns hidden' }}
      steps={COLUMNS_HIDDEN}
      args={guideArgs({ ...FIXED_HEIGHT, enableColumnVisibility: true }, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(COLUMNS_HIDDEN[0]!.title.ru, async () => {
      await until(() => expect(bodyRows(canvas).length).toBeGreaterThan(0))
      await expect(
        canvas.querySelectorAll('[role="columnheader"]').length,
      ).toBeGreaterThan(0)
      await expect(byTestId('view-settings-button')).not.toBeNull()
      await expect(byTestId('view-settings-button')).not.toHaveAttribute(
        'data-active',
      )
    })
    await step(COLUMNS_HIDDEN[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitTestId('columns-hidden-stub')
      await until(() => expect(byTestId('column-visibility-menu')).toBeNull())
      await until(() =>
        expect(document.activeElement).not.toBe(
          byTestId('view-settings-button'),
        ),
      )
      await expect(bodyRows(canvas)).toHaveLength(0)
      await expect(
        canvas.querySelectorAll('[role="columnheader"]'),
      ).toHaveLength(0)
      await expect(byTestId('columns-hidden-show-all')).toHaveTextContent(
        columnVisibilityLabels(labels).showAllColumns,
      )
      await expect(disabled('view-settings-button')).toBe(false)
      await expect(byTestId('view-settings-button')).toHaveAttribute(
        'data-active',
        'true',
      )
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

const NO_DATA: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Данные загружаются', en: 'Data is loading' },
    hint: {
      ru: 'Данных еще нет, в теле таблицы отображаются скелеты.',
      en: 'There is no data yet; the table body shows skeletons.',
    },
    props: () => ({ loading: 'initial', dataOverride: [] }),
  },
  {
    title: {
      ru: 'Данные на сервере отсутствуют',
      en: 'The server has no data',
    },
    hint: {
      ru: 'В теле таблицы отображается заглушка.',
      en: 'The table body shows a placeholder.',
    },
    props: () => ({ loading: false }),
  },
]

/** S3: строк нет — заглушка библиотеки по умолчанию. */
export const StubsNoData: StoryObj<StoryProps> = {
  name: 'No data',
  parameters: {
    scenario: '0123/S3',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Пустой ответ', en: 'An empty response' }}
      steps={NO_DATA}
      args={guideArgs(FIXED_HEIGHT, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(NO_DATA[0]!.title.ru, async () => {
      await until(() =>
        expect(
          canvas.querySelector('.data-grid__body-row--skeleton'),
        ).not.toBeNull(),
      )
      await expect(byTestId('no-data-stub')).toBeNull()
    })
    await step(NO_DATA[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitTestId('no-data-stub')
      await expect(byTestId('no-data-stub')).toHaveTextContent(labels.noData)
      await expect(byTestId('no-data-stub')!.querySelector('svg')).not.toBe(
        null,
      )
    })
    await settle()
  },
}

// --- S4 ------------------------------------------------------------------------------

/**
 * Фон своей заглушки — оттенки приложения поверх поверхности темы: мягкие пятна в обеих
 * темах, текст на них сохраняет контраст.
 */
const ORDERS_BACKGROUND = [
  'radial-gradient(circle at 20% 15%, color-mix(in oklch, #6366f1 28%, transparent), transparent 55%)',
  'radial-gradient(circle at 85% 90%, color-mix(in oklch, #ec4899 24%, transparent), transparent 50%)',
  'linear-gradient(135deg, color-mix(in oklch, #6366f1 8%, var(--tsr-sys-surface)), color-mix(in oklch, #ec4899 8%, var(--tsr-sys-surface)))',
].join(', ')

/** Своя заглушка пустого ответа: текст, фон и действие приложения, без иллюстрации таблицы. */
const ordersStub = (log: ConsoleLog) => (
  <Stub
    data-testid="own-no-data"
    // На всю область заглушки: `Stub` ставит содержимое посередине.
    style={{ height: '100%', background: ORDERS_BACKGROUND }}
    title="No orders yet"
    description="Orders you create appear here."
    action={
      <Button
        data-testid="own-no-data-action"
        onClick={() => log.log('Create order')}
      >
        Create order
      </Button>
    }
  />
)

const OWN_STUB: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Данные загружаются', en: 'Data is loading' },
    hint: {
      ru: 'Данных еще нет, в теле таблицы отображаются скелеты.',
      en: 'There is no data yet; the table body shows skeletons.',
    },
    props: ({ log }) => ({
      loading: 'initial',
      dataOverride: [],
      stubs: { noData: ordersStub(log) },
    }),
  },
  {
    title: {
      ru: 'Данные на сервере отсутствуют',
      en: 'The server has no data',
    },
    hint: {
      ru: 'Приложение заменило заглушку таблицы своей. В теле таблицы отображается заглушка приложения с его текстом и действием.',
      en: "The app replaced the table's placeholder with its own. The table body shows the app's placeholder with its text and action.",
    },
    props: () => ({ loading: false }),
  },
]

/** S4: приложение показывает свою заглушку пустого ответа — пропом `stubs`. */
export const StubsCustom: StoryObj<StoryProps> = {
  name: 'Custom stubs',
  parameters: {
    scenario: '0123/S4',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Своя заглушка', en: 'A custom placeholder' }}
      steps={OWN_STUB}
      args={guideArgs(FIXED_HEIGHT, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OWN_STUB[0]!.title.ru, async () => {
      await until(() =>
        expect(
          canvas.querySelector('.data-grid__body-row--skeleton'),
        ).not.toBeNull(),
      )
      await expect(byTestId('own-no-data')).toBeNull()
    })
    await step(OWN_STUB[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitTestId('own-no-data')
      await expect(byTestId('no-data-stub')).not.toHaveTextContent(
        storyLabels(args.locale).noData,
      )
      await expect(byTestId('own-no-data-action')).toHaveTextContent(
        'Create order',
      )
    })
    await settle()
  },
}

// --- S5 ------------------------------------------------------------------------------

const PLUGIN_REASON: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Связь есть', en: 'Connected' },
    hint: { ru: 'Таблица со строками.', en: 'The table has rows.' },
  },
  {
    title: { ru: 'Связь пропала', en: 'The connection is lost' },
    hint: {
      ru: 'Вместо таблицы — заглушка плагина о потере связи.',
      en: "In place of the table is the plugin's placeholder about the lost connection.",
    },
    props: () => ({ extraPlugins: [offline({ offline: true })] }),
  },
]

/** S5: автор плагина добавляет свою причину в реестр. */
export const StubsPluginReason: StoryObj<StoryProps> = {
  name: 'Plugin reason',
  parameters: {
    scenario: '0123/S5',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Своя причина плагина', en: "A plugin's own reason" }}
      steps={PLUGIN_REASON}
      args={guideArgs(
        { ...FIXED_HEIGHT, extraPlugins: [offline({ offline: false })] },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PLUGIN_REASON[0]!.title.ru, async () => {
      await until(() => expect(bodyRows(canvas).length).toBeGreaterThan(0))
      await expect(byTestId('offline-stub')).toBeNull()
    })
    await step(PLUGIN_REASON[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitTestId('offline-stub')
      await expect(byTestId('offline-stub')).toHaveTextContent(
        'You are offline',
      )
      await expect(bodyRows(canvas)).toHaveLength(0)
    })
    await settle()
  },
}

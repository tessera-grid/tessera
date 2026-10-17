import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin, readPluginHooks } from '../core/definePlugin'
import { ILLUSTRATION_SIZE } from '../core/stubs'
import { EmptyStateIllustration } from '../ui/icons/EmptyStateIllustration'
import { Stub } from '../ui/Stub'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import { byTestId, guideNext, settle, until } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/**
 * Заглушки пустой таблицы (ADR 0123): реестр причин — нет данных, нет колонок, все
 * колонки скрыты, фильтр ничего не нашёл, ошибка загрузки; свой вид — пропом `stubs`,
 * своя причина — записью плагина. `Default` — песочница, S1–S5 — сценарии.
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
      media: 'emptyState',
      mediaSize: ILLUSTRATION_SIZE,
      testId: 'offline-stub',
    },
  ],
})

/**
 * Песочница заглушек и снимок каталога `body.empty`: по умолчанию данных нет — заглушка
 * библиотеки. `columnCount: 0` — нет колонок, `hideAllColumns` — все скрыты.
 */
export const StubsDefault: StoryObj<StoryProps> = {
  name: 'Default',
  parameters: {
    ...vrStates('body.empty'),
    ...showControls(['showStub', 'hideAllColumns', ...PANEL_CONTROLS]),
  },
  args: { ...FIXED_HEIGHT, showStub: true },
}

// --- S1 ------------------------------------------------------------------------------

const NO_COLUMNS: readonly GuideStoryStep[] = [
  {
    title: 'Колонки и данные загружаются',
    hint: 'columns: [] — скелет одинаковых колонок, в тулбаре скелеты (ADR 0122).',
    props: () => ({
      loading: 'initial',
      dataOverride: [],
      columnsOverride: [],
    }),
  },
  {
    title: 'Данные пришли, колонки — нет',
    hint: 'Показать нечего: заглушка «No columns» вместо таблицы; поиск, «Экспорт», «Фильтры» и «Колонки» выключены.',
    props: ({ rows }) => ({ loading: false, dataOverride: rows }),
  },
]

/** S1: сервер прислал данные без колонок. */
export const StubsNoColumns: StoryObj<StoryProps> = {
  name: 'No columns',
  parameters: {
    scenario: '0123/S1',
    ...showControls(PANEL_CONTROLS),
  },
  args: { ...FIXED_HEIGHT, ...PANELS },
  render: args => (
    <GuideStory
      title="Данные без колонок"
      steps={NO_COLUMNS}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(NO_COLUMNS[0]!.title, async () => {
      await waitTestId('column-visibility-skeleton')
    })
    await step(NO_COLUMNS[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('no-columns-stub')
      await expect(bodyRows(canvas)).toHaveLength(0)
      for (const id of [
        'quick-search',
        'export-button',
        'filter-summary-button',
        'column-visibility-button',
      ]) {
        await until(() => expect(disabled(id), id).toBe(true))
      }
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

const COLUMNS_HIDDEN: readonly GuideStoryStep[] = [
  {
    title: 'Таблица с колонками',
    hint: 'Видимостью колонок владеет приложение (columnVisibility).',
  },
  {
    title: 'Приложение скрыло все колонки',
    hint: 'Через меню так нельзя (CV9), а состоянием приложения — можно: заглушка с «Show all», «Колонки» в тулбаре доступна.',
    props: () => ({ hideAllColumns: true }),
  },
  {
    title: 'Пользователь показывает все колонки',
    hint: '«Show all» возвращает скрытые колонки — строки снова на месте.',
    enter: root =>
      root
        .querySelector<HTMLElement>('[data-testid="columns-hidden-show-all"]')
        ?.click(),
  },
]

/** S2: приложение скрыло все колонки, пользователь их возвращает. */
export const StubsColumnsHidden: StoryObj<StoryProps> = {
  name: 'All columns hidden',
  parameters: {
    scenario: '0123/S2',
    ...showControls(['enableColumnVisibility']),
  },
  args: { ...FIXED_HEIGHT, enableColumnVisibility: true },
  render: args => (
    <GuideStory
      title="Все колонки скрыты"
      steps={COLUMNS_HIDDEN}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(COLUMNS_HIDDEN[0]!.title, async () => {
      await until(() => expect(bodyRows(canvas).length).toBeGreaterThan(0))
    })
    await step(COLUMNS_HIDDEN[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('columns-hidden-stub')
      await expect(disabled('column-visibility-button')).toBe(false)
    })
    await step(COLUMNS_HIDDEN[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(bodyRows(canvas).length).toBeGreaterThan(0))
      await expect(byTestId('columns-hidden-stub')).toBeNull()
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

const NO_DATA: readonly GuideStoryStep[] = [
  {
    title: 'Данные загружаются',
    hint: 'Скелет первой загрузки главнее любой заглушки.',
    props: () => ({ loading: 'initial', dataOverride: [] }),
  },
  {
    title: 'Сервер ответил: строк нет',
    hint: 'Заглушка библиотеки по умолчанию — иллюстрация и «No data»; свою задают в stubs.noData.',
    props: () => ({ loading: false }),
  },
]

/** S3: строк нет — заглушка библиотеки по умолчанию. */
export const StubsNoData: StoryObj<StoryProps> = {
  name: 'No data',
  parameters: {
    scenario: '0123/S3',
    ...showControls([], {
      dataCount: 'Строк нет: сценарий — про пустой ответ',
    }),
  },
  args: FIXED_HEIGHT,
  render: args => (
    <GuideStory
      title="Пустой ответ"
      steps={NO_DATA}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NO_DATA[0]!.title, async () => {
      await until(() =>
        expect(
          canvas.querySelector('.data-grid__body-row--skeleton'),
        ).not.toBeNull(),
      )
      await expect(byTestId('no-data-stub')).toBeNull()
    })
    await step(NO_DATA[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('no-data-stub')
      await expect(byTestId('no-data-stub')!.querySelector('svg')).not.toBe(
        null,
      )
    })
    await settle()
  },
}

// --- S4 ------------------------------------------------------------------------------

/** Своя заглушка приложения — примитивом кита `Stub`. */
const ownStub = (title: string, testId: string) => (
  <Stub
    data-testid={testId}
    media={<EmptyStateIllustration width={96} height={96} />}
    title={title}
    description="Our own stub from the stubs prop."
  />
)

const CUSTOM: readonly GuideStoryStep[] = [
  {
    title: 'Пустой ответ — своя заглушка',
    hint: 'stubs.noData — узел приложения вместо заглушки библиотеки.',
    props: () => ({ dataOverride: [] }),
  },
  {
    title: 'Колонок нет — своя заглушка',
    hint: 'stubs.noColumns; какую заглушку показать, по-прежнему решает грид.',
    props: () => ({ columnsOverride: [] }),
  },
]

/** S4: приложение подменяет вид заглушек своими. */
export const StubsCustom: StoryObj<StoryProps> = {
  name: 'Custom stubs',
  parameters: {
    scenario: '0123/S4',
    ...showControls([], {
      dataCount: 'Строк нет: сценарий — про свои заглушки',
    }),
  },
  args: {
    ...FIXED_HEIGHT,
    stubs: {
      noData: ownStub('Nothing here yet', 'own-no-data'),
      noColumns: ownStub('Pick columns to see data', 'own-no-columns'),
    },
  },
  render: args => (
    <GuideStory
      title="Свои заглушки"
      steps={CUSTOM}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CUSTOM[0]!.title, async () => {
      await waitTestId('own-no-data')
    })
    await step(CUSTOM[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('own-no-columns')
      await expect(byTestId('own-no-data')).toBeNull()
    })
    await settle()
  },
}

// --- S5 ------------------------------------------------------------------------------

const PLUGIN_REASON: readonly GuideStoryStep[] = [
  {
    title: 'Связь есть',
    hint: 'Плагин автора добавил причину «offline» в реестр полем stubs у definePlugin.',
  },
  {
    title: 'Связь пропала',
    hint: 'Условие записи плагина выполнено, а её приоритет выше встроенных: заглушка «You are offline».',
    props: () => ({ extraPlugins: [offline({ offline: true })] }),
  },
]

/** S5: автор плагина добавляет свою причину в реестр. */
export const StubsPluginReason: StoryObj<StoryProps> = {
  name: 'Plugin reason',
  parameters: {
    scenario: '0123/S5',
    ...showControls([]),
  },
  args: { ...FIXED_HEIGHT, extraPlugins: [offline({ offline: false })] },
  render: args => (
    <GuideStory
      title="Своя причина плагина"
      steps={PLUGIN_REASON}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PLUGIN_REASON[0]!.title, async () => {
      await until(() => expect(bodyRows(canvas).length).toBeGreaterThan(0))
      await expect(byTestId('offline-stub')).toBeNull()
    })
    await step(PLUGIN_REASON[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('offline-stub')
    })
    await settle()
  },
}

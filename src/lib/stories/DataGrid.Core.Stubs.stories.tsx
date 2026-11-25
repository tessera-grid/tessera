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
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import { untilDone } from './__mocks__/cellGestures'
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

const NO_COLUMNS: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Ожидание списка колонок от сервера',
      en: 'Waiting for the column list from the server',
    },
    hint: {
      ru: 'Структура таблицы ещё неизвестна — панели и строки грузятся.',
      en: 'The table structure is not known yet; the panels and rows are loading.',
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
      ru: 'Сервер прислал строки без колонок — на месте таблицы заглушка, кнопки панели, которым нечего делать, выключены.',
      en: 'The server sent rows without columns; a placeholder replaces the table, and panel buttons with nothing to do are turned off.',
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
    <DemoStory
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
  let timer: ReturnType<typeof setTimeout>
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
    timer = setTimeout(run, 100)
  }
  timer = setTimeout(run, 0)
  return () => clearTimeout(timer)
}

const COLUMNS_HIDDEN: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Таблица с колонками', en: 'A table with columns' },
    hint: {
      ru: 'У таблицы есть меню колонок, все колонки видны.',
      en: 'The table has a column menu; all columns are visible.',
    },
  },
  {
    title: {
      ru: 'Пользователь скрыл все колонки',
      en: 'The user hid all columns',
    },
    hint: {
      ru: 'Пользователь скрыл все колонки в меню — на месте таблицы заглушка с кнопкой вернуть их.',
      en: 'The user hid all columns in the menu; a placeholder with a button to bring them back replaces the table.',
    },
    enter: hideAllFromMenu,
  },
  {
    title: { ru: 'Колонки возвращены', en: 'Columns are back' },
    hint: {
      ru: 'Пользователь нажал кнопку заглушки — все колонки снова видны.',
      en: 'The user pressed the placeholder button; all columns are visible again.',
    },
    enter: root => {
      let stopHiding: (() => void) | undefined
      let shown = false
      const stopShowing = untilDone(
        current => shown && bodyRows(current).length > 0,
        current => {
          const showAll = byTestId('columns-hidden-show-all')
          if (showAll) {
            stopHiding?.()
            showAll.click()
            shown = true
            return
          }
          if (!stopHiding && !shown) stopHiding = hideAllFromMenu(current)
        },
      )(root, undefined as never)
      return () => {
        stopShowing()
        stopHiding?.()
      }
    },
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
    <DemoStory
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
      await waitTestId('view-settings-button')
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
    await step(COLUMNS_HIDDEN[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(byTestId('columns-hidden-stub')).toBeNull()
        expect(bodyRows(canvas).length).toBeGreaterThan(0)
        expect(
          canvas.querySelectorAll('[role="columnheader"]').length,
        ).toBeGreaterThan(0)
        expect(byTestId('view-settings-button')).not.toHaveAttribute(
          'data-active',
        )
      })
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

const NO_DATA: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Данные загружаются', en: 'Data is loading' },
    hint: {
      ru: 'Данных ещё нет — на месте строк скелеты.',
      en: 'There is no data yet; skeletons stand in place of the rows.',
    },
    props: () => ({ loading: 'initial', dataOverride: [] }),
  },
  {
    title: {
      ru: 'Данные на сервере отсутствуют',
      en: 'The server has no data',
    },
    hint: {
      ru: 'Сервер ответил пустым списком — на месте строк заглушка.',
      en: 'The server answered with an empty list; a placeholder stands in place of the rows.',
    },
    props: () => ({ loading: false }),
  },
  {
    title: { ru: 'Низкая таблица', en: 'A short table' },
    hint: {
      ru: 'Таблица стала ниже — картинка заглушки убрана целиком, текст остался.',
      en: 'The table got shorter; the placeholder picture is removed entirely, and the text stays.',
    },
    props: () => ({ containerHeight: '260', height: '160', maxHeight: '160' }),
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
    <DemoStory
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
    await step(NO_DATA[2]!.title.ru, async () => {
      await guideNext(canvas)
      // Картинка целиком или никак (ES15): текст на месте, картинки нет.
      await until(() =>
        expect(
          byTestId('no-data-stub')!.querySelector('svg')?.closest('[hidden]'),
        ).not.toBeNull(),
      )
      await expect(byTestId('no-data-stub')).toHaveTextContent(labels.noData)
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

const OWN_STUB: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Данные загружаются', en: 'Data is loading' },
    hint: {
      ru: 'Данных ещё нет — на месте строк скелеты.',
      en: 'There is no data yet; skeletons stand in place of the rows.',
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
      ru: 'Сервер ответил пустым списком — на месте строк заглушка приложения со своим текстом и действием.',
      en: "The server answered with an empty list; the app's placeholder with its own text and action stands in place of the rows.",
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
    <DemoStory
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

const PLUGIN_REASON: readonly DemoStoryStep[] = [
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
    <DemoStory
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

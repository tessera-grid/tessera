import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin, readPluginHooks } from '../core/definePlugin'
import type { TesseraFeatureEntry } from '../core/features'
import type { ViewSettingsSection } from '../core/viewSettings'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  consoleText,
  guideNext,
  headCell,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { storyLabels } from './__mocks__/storyLabels'
import {
  type StoryLocale,
  type StoryText,
  storyLocaleOf,
  textOf,
} from './__mocks__/storyText'
import { getData } from './__mocks__/data'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  closeViewSettings,
  hiddenOnMount,
  openViewSettingsSection,
  viewSettingsButton,
  viewSettingsLevel,
  viewSettingsPopover,
  viewSettingsRow,
  viewSettingsSectionOpen,
} from './__mocks__/viewSettings'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Настройки вида (ADR 0215): одна кнопка тулбара с разделами плагинов — фильтр, сортировка,
 * группировка, колонки и разделы авторов. `Playground` — всё включено; S1 — сводка и снятие, S2 —
 * колонки, S3 — свой раздел автора, S4 — отказ сервера.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/View settings',
} satisfies Meta<StoryProps>

export default meta

/** Фамилия скрыта, строки отфильтрованы и отсортированы по ней. */
const HIDDEN = 'lastName'

const VIEW_ARGS: Partial<StoryProps> = {
  enableQuickSearch: true,
  enableColumnFiltering: true,
  enableColumnSorting: true,
  enableRowGrouping: true,
  enableColumnVisibility: true,
  columnSortingInitialSorting: [{ id: HIDDEN, desc: true }],
  columnFilteringInitialColumnFilters: [
    { id: HIDDEN, value: { operator: 'contains', value: 'a' } },
  ],
  extraPlugins: [hiddenOnMount(HIDDEN)],
  columnCount: 5,
  dataCount: 40,
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
}

export const ViewSettingsPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableQuickSearch',
    'enableColumnFiltering',
    'enableColumnSorting',
    'enableRowGrouping',
    'enableColumnVisibility',
    'quickSearchToolbar',
  ]),
  args: VIEW_ARGS,
}

/** Число на кнопке «Настройки вида»; `null` — бабла нет. */
const viewSettingsCount = (root: HTMLElement) => {
  const bubble = viewSettingsButton(root)?.querySelector<HTMLElement>(
    '[data-active-indicator]',
  )
  return bubble?.dataset.shown === 'true'
    ? (bubble.dataset.count ?? null)
    : null
}
const valueOf = (id: string) =>
  viewSettingsRow(id)
    ?.querySelector('[data-popup-nav-value]')
    ?.textContent?.trim() ?? null
const levelsOf = () => [
  ...(viewSettingsLevel()?.querySelectorAll<HTMLElement>(
    '[data-view-settings-level]',
  ) ?? []),
]
const removeOf = (id: string) =>
  viewSettingsLevel()?.querySelector<HTMLElement>(
    `[data-view-settings-level="${id}"] [data-view-settings-remove]`,
  ) ?? null

/** Открыть «Настройки вида» на первом уровне; `true` — открыт. */
const openViewSettings = (root: HTMLElement) => {
  if (viewSettingsLevel()?.querySelector('[data-view-settings-sections]'))
    return true
  if (viewSettingsPopover())
    viewSettingsPopover()
      ?.querySelector<HTMLElement>('[data-popup-level-back]')
      ?.click()
  else viewSettingsButton(root)?.click()
  return false
}

// --- S1 ------------------------------------------------------------------------------

const SUMMARY: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Таблица настроена', en: 'The table is set up' },
    hint: {
      ru: 'Строки отфильтрованы по фамилии и отсортированы по ней в обратном порядке, а колонка фамилии скрыта. Число на кнопке настроек вида — сколько настроек сейчас меняет таблицу.',
      en: 'Rows are filtered by last name and sorted by it in reverse order, and the last name column is hidden. The number on the view settings button shows how many settings are currently changing the table.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл настройки вида',
      en: 'The user opened the view settings',
    },
    hint: {
      ru: 'Каждая строка говорит, сколько в разделе включено: одно условие фильтра, один уровень сортировки, одна скрытая колонка. Группировки нет — её строка погашена.',
      en: 'Each row shows how much is turned on in its section: one filter condition, one sorting level, one hidden column. There is no grouping, so its row is dimmed.',
    },
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () =>
        !!viewSettingsLevel()?.querySelector('[data-view-settings-sections]'),
      openViewSettings,
    ),
  },
  {
    title: {
      ru: 'Пользователь открыл сортировку',
      en: 'The user opened sorting',
    },
    hint: {
      ru: 'Раздел перечисляет уровни сортировки: фамилия по убыванию, с отметкой, что колонка скрыта.',
      en: 'The section lists the sorting levels: last name, descending, with a mark that the column is hidden.',
    },
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () => !!viewSettingsSectionOpen('sorting'),
      root => openViewSettingsSection(root, 'sorting'),
    ),
  },
  {
    title: {
      ru: 'Пользователь снял сортировку',
      en: 'The user removed sorting',
    },
    hint: {
      ru: 'Последний уровень снят — раздел закрылся, строка сортировки погасла, число на кнопке уменьшилось.',
      en: 'The last level is removed: the section closed, the sorting row dimmed, and the number on the button went down.',
    },
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () =>
        valueOf('sorting') !== null &&
        !viewSettingsRow('sorting')?.dataset.active,
      root => {
        if (removeOf(HIDDEN)) removeOf(HIDDEN)!.click()
        else openViewSettingsSection(root, 'sorting')
      },
    ),
  },
]

/** ADR 0215, S1: «Настройки вида» показывают фильтр и сортировку по скрытой колонке; сортировку снимают. */
export const ViewSettingsSummary: StoryObj<StoryProps> = {
  name: 'Hidden column settings',
  parameters: { scenario: '0215/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Настройки вида', en: 'View settings' }}
      steps={SUMMARY}
      args={guideArgs(VIEW_ARGS, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SUMMARY[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(headCell(canvas, HIDDEN)).toBeNull())
      await until(() => expect(viewSettingsCount(canvas)).toBe('3'))
    })
    await step(SUMMARY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(viewSettingsRow('sorting')).not.toBeNull())
      await expect(
        viewSettingsRow('sorting')!.querySelector('[data-popup-nav-value]'),
      ).toHaveTextContent(storyLabels(args.locale).viewSettingsActiveCount(1))
      await expect(viewSettingsRow('grouping')!.dataset.active).toBeUndefined()
      await settle()
    })
    await step(SUMMARY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(levelsOf()).toHaveLength(1))
      await expect(levelsOf()[0]!.dataset.hiddenColumn).toBe('true')
      await settle()
    })
    await step(SUMMARY[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(viewSettingsRow('sorting')?.dataset.active).toBeUndefined(),
      )
      // Число на кнопке — из её подписки на срезы: догоняет строку раздела.
      await until(() => expect(viewSettingsCount(canvas)).toBe('2'))
      await settle()
    })
  },
}

// --- S2 ------------------------------------------------------------------------------

const COLUMNS_ARGS: Partial<StoryProps> = {
  enableColumnVisibility: true,
  enableColumnSorting: true,
  columnCount: 5,
  dataCount: 40,
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
}

const columnBox = (id: string) =>
  viewSettingsSectionOpen('columns')?.querySelector<HTMLElement>(
    `[data-column-id="${id}"] [role="checkbox"]`,
  ) ?? null

const COLUMNS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Все колонки видны', en: 'All columns are visible' },
    hint: {
      ru: 'Таблица показывает все колонки. Настройки вида ничего не меняют — числа на их кнопке нет.',
      en: 'The table shows all columns. The view settings change nothing, so their button has no number.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл раздел колонок',
      en: 'The user opened the columns section',
    },
    hint: {
      ru: 'Раздел колонок открывается и тогда, когда ничего не скрыто: в нём колонки скрывают. Поле поиска уже в фокусе.',
      en: 'The columns section opens even when nothing is hidden: this is where columns get hidden. The search field already has focus.',
    },
    states: ['overlay.viewSettings'],
    enter: untilDone(
      root => !!columnBox(HIDDEN) && !!headCell(root, HIDDEN),
      root => {
        if (!viewSettingsSectionOpen('columns'))
          openViewSettingsSection(root, 'columns')
        else if (columnBox(HIDDEN)?.getAttribute('aria-checked') === 'false')
          columnBox(HIDDEN)?.click()
      },
    ),
  },
  {
    title: { ru: 'Пользователь скрыл колонку', en: 'The user hid a column' },
    hint: {
      ru: 'Колонки фамилии больше нет в таблице, на кнопке настроек вида появилось число.',
      en: 'The last name column is gone from the table, and a number appeared on the view settings button.',
    },
    states: ['overlay.viewSettings'],
    enter: untilDone(
      root => !headCell(root, HIDDEN),
      root => {
        if (!viewSettingsSectionOpen('columns'))
          openViewSettingsSection(root, 'columns')
        else columnBox(HIDDEN)?.click()
      },
    ),
  },
]

/** ADR 0215, S2: раздел «Колонки» — скрыть колонку. */
export const ViewSettingsColumns: StoryObj<StoryProps> = {
  name: 'Columns section',
  parameters: { scenario: '0215/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Колонки в настройках вида',
        en: 'Columns in the view settings',
      }}
      steps={COLUMNS}
      args={guideArgs(COLUMNS_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(COLUMNS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(viewSettingsButton(canvas)).not.toBeNull())
      await until(() => expect(viewSettingsCount(canvas)).toBeNull())
    })
    await step(COLUMNS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(columnBox(HIDDEN)).not.toBeNull())
      await settle()
    })
    await step(COLUMNS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headCell(canvas, HIDDEN)).toBeNull())
      await until(() => expect(viewSettingsCount(canvas)).toBe('1'))
      await settle()
    })
  },
}

// --- S3 ------------------------------------------------------------------------------

interface OnlyMineHooks {
  enabled?: boolean
  on?: boolean
  onTurnOff?: () => void
}

const ON: StoryText = { ru: 'вкл.', en: 'on' }
const OFF: StoryText = { ru: 'выкл.', en: 'off' }
/** Значение раздела «выключено» на любом языке: действие шага языка не знает. */
const isOff = (value: string | null) => value === OFF.ru || value === OFF.en

/**
 * Раздел автора на языке истории: состояние держит приложение, плагин читает его живо и
 * снимает колбэком. Подписи таблицы языка не несут, поэтому раздел собран под язык.
 */
const onlyMineSection = (locale: StoryLocale): ViewSettingsSection => {
  const t = (text: StoryText) => textOf(text, locale)
  const hooks = (table: unknown) =>
    readPluginHooks<OnlyMineHooks>(table as never, 'onlyMine')
  return {
    id: 'onlyMine',
    plugin: 'onlyMine',
    icon: 'filterActive',
    slices: [],
    label: () => t({ ru: 'Только мои строки', en: 'Only my rows' }),
    active: table => !!hooks(table).on,
    value: table => t(hooks(table).on ? ON : OFF),
    levels: table => [
      {
        id: 'mine',
        label: t({ ru: 'Ответственный — я', en: 'Assignee: me' }),
        removeLabel: t({ ru: 'Показать все строки', en: 'Show all rows' }),
        remove: () => hooks(table).onTurnOff?.(),
      },
    ],
  }
}

const onlyMineFor = (locale: StoryLocale) =>
  definePlugin<OnlyMineHooks>()({
    id: 'onlyMine',
    diagnose: () => undefined,
    hooks: o => ({ on: o.on, onTurnOff: o.onTurnOff }),
    viewSettingsSections: [onlyMineSection(locale)],
  })

/** Плагин раздела на каждый язык — один раз на модуль. */
const ONLY_MINE = { en: onlyMineFor('en'), ru: onlyMineFor('ru') }
const onlyMine = (locale: string | undefined) =>
  ONLY_MINE[storyLocaleOf(locale)]

const ALL_ROWS = getData(40)
/** Строки текущего пользователя — каждая третья. */
const MY_ROWS = ALL_ROWS.filter((_, index) => index % 3 === 0)

const OWN_ARGS: Partial<StoryProps> = {
  enableColumnSorting: true,
  enableColumnVisibility: true,
  columnCount: 5,
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
}

const OWN: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Только мои строки', en: 'Only my rows' },
    hint: {
      ru: 'Приложение показывает только строки текущего пользователя. Его плагин добавил в настройки вида свой раздел.',
      en: "The app shows only the current user's rows. Its plugin added its own section to the view settings.",
    },
    props: ({ app, args }) => ({
      dataOverride: MY_ROWS,
      extraPlugins: [
        onlyMine(args.locale)({
          on: true,
          onTurnOff: () =>
            app.update(props => ({
              ...props,
              dataOverride: ALL_ROWS,
              extraPlugins: [
                onlyMine(args.locale)({ on: false }) as TesseraFeatureEntry,
              ],
            })),
        }) as TesseraFeatureEntry,
      ],
    }),
  },
  {
    title: {
      ru: 'Раздел приложения в настройках вида',
      en: "The app's section in the view settings",
    },
    hint: {
      ru: 'Строка раздела стоит после встроенных — с именем, значком и значением, которые задал плагин.',
      en: 'The section row comes after the built-in ones, with the name, icon, and value that the plugin set.',
    },
    states: ['overlay.viewSettings'],
    enter: untilDone(() => !!viewSettingsRow('onlyMine'), openViewSettings),
  },
  {
    title: {
      ru: 'Пользователь показал все строки',
      en: 'The user showed all rows',
    },
    hint: {
      ru: 'Кнопкой в разделе пользователь снял ограничение: приложение вернуло все строки, строка раздела погасла.',
      en: 'With the button in the section, the user removed the restriction: the app brought back all rows, and the section row dimmed.',
    },
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () => isOff(valueOf('onlyMine')),
      root => {
        if (removeOf('mine')) removeOf('mine')!.click()
        else openViewSettingsSection(root, 'onlyMine')
      },
    ),
  },
]

/** ADR 0215, S3: плагин автора вкладывает свой раздел «Настроек вида». */
export const ViewSettingsOwnSection: StoryObj<StoryProps> = {
  name: 'Own section',
  parameters: { scenario: '0215/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Свой раздел', en: 'A custom section' }}
      steps={OWN}
      args={guideArgs(OWN_ARGS, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OWN[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(viewSettingsCount(canvas)).toBe('1'))
    })
    await step(OWN[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(valueOf('onlyMine')).toBe(textOf(ON, args.locale)),
      )
      await settle()
    })
    await step(OWN[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(valueOf('onlyMine')).toBe(textOf(OFF, args.locale)),
      )
      await expect(viewSettingsCount(canvas)).toBeNull()
      await settle()
    })
  },
}

// --- S4 ------------------------------------------------------------------------------

/** Ответ «сервера» на смену сортировки: отказ после короткого ожидания. */
const SORT_REFUSAL = 'The server could not change the sorting'
const refuseSort = () =>
  new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(SORT_REFUSAL)), 600),
  )

/** Строки с «сервера» — уже по фамилии в обратном порядке. */
const serverSorted = getData(40)
  .slice()
  .sort((a, b) => String(b.lastName).localeCompare(String(a.lastName)))

const REFUSED_ARGS: Partial<StoryProps> = {
  enableColumnSorting: true,
  enableColumnVisibility: true,
  dataMode: { sorting: 'server' },
  columnSortingInitialSorting: [{ id: HIDDEN, desc: true }],
  extraPlugins: [hiddenOnMount(HIDDEN)],
  dataOverride: serverSorted,
  onToggleColumnSort: refuseSort,
  columnCount: 5,
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
}

const banner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')

const REFUSED: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Сортировка на сервере по скрытой колонке',
      en: 'Server sorting by a hidden column',
    },
    hint: {
      ru: 'Строки сортирует сервер — по фамилии в обратном порядке. Колонка фамилии скрыта.',
      en: 'The server sorts the rows by last name in reverse order. The last name column is hidden.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл сортировку',
      en: 'The user opened sorting',
    },
    hint: {
      ru: 'Раздел сортировки в настройках вида: фамилия с отметкой, что колонка скрыта.',
      en: 'The sorting section in the view settings: last name, with a mark that the column is hidden.',
    },
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () => !!viewSettingsSectionOpen('sorting'),
      root => openViewSettingsSection(root, 'sorting'),
    ),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь снял сортировку, таблица отправила запрос серверу, сервер отказал. Сортировка вернулась, под шапкой — сообщение с причиной и повтором.',
      en: 'The user removed sorting, the table sent a request to the server, and the server refused. The sorting came back, and below the header there is a message with the reason and a retry button.',
    },
    states: ['body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => {
        if (banner(root))
          return (
            !!viewSettingsRow('sorting')?.dataset.active ||
            !!viewSettingsSectionOpen('sorting')
          )
        if (removeOf(HIDDEN)) removeOf(HIDDEN)!.click()
        else openViewSettingsSection(root, 'sorting')
        return false
      }, signal)
    }),
  },
]

/** ADR 0215, S4: сервер отказывает в снятии сортировки из «Настроек вида» — откат и плашка. */
export const ViewSettingsServerRefused: StoryObj<StoryProps> = {
  name: 'Refused by the server',
  parameters: { scenario: '0215/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ сервера', en: 'Server refusal' }}
      steps={REFUSED}
      args={guideArgs(REFUSED_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFUSED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(viewSettingsCount(canvas)).toBe('2'))
    })
    await step(REFUSED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(levelsOf()).toHaveLength(1))
      await settle()
    })
    await step(REFUSED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(banner(canvas)).toHaveTextContent(SORT_REFUSAL)
      await expect(viewSettingsCount(canvas)).toBe('2')
      await expect(consoleText()).toContain('onToggleColumnSort')
      await settle()
    })
  },
}

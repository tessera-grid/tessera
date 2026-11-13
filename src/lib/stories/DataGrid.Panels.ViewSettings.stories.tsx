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
    title: 'Таблица настроена',
    hint: 'Строки отфильтрованы по фамилии и отсортированы по ней в обратном порядке, а колонка фамилии скрыта. Число на кнопке настроек вида — сколько настроек сейчас меняет таблицу.',
  },
  {
    title: 'Пользователь открыл настройки вида',
    hint: 'Каждая строка говорит, сколько в разделе включено: одно условие фильтра, один уровень сортировки, одна скрытая колонка. Группировки нет — её строка погашена.',
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () =>
        !!viewSettingsLevel()?.querySelector('[data-view-settings-sections]'),
      openViewSettings,
    ),
  },
  {
    title: 'Пользователь открыл сортировку',
    hint: 'Раздел перечисляет уровни сортировки: фамилия по убыванию, с отметкой, что колонка скрыта.',
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () => !!viewSettingsSectionOpen('sorting'),
      root => openViewSettingsSection(root, 'sorting'),
    ),
  },
  {
    title: 'Пользователь снял сортировку',
    hint: 'Последний уровень снят — раздел закрылся, строка сортировки погасла, число на кнопке уменьшилось.',
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
      title="Настройки вида"
      steps={SUMMARY}
      args={guideArgs(VIEW_ARGS, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SUMMARY[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(headCell(canvas, HIDDEN)).toBeNull())
      await until(() => expect(viewSettingsCount(canvas)).toBe('3'))
    })
    await step(SUMMARY[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(viewSettingsRow('sorting')).not.toBeNull())
      await expect(
        viewSettingsRow('sorting')!.querySelector('[data-popup-nav-value]'),
      ).toHaveTextContent(storyLabels(args.locale).viewSettingsActiveCount(1))
      await expect(viewSettingsRow('grouping')!.dataset.active).toBeUndefined()
      await settle()
    })
    await step(SUMMARY[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(levelsOf()).toHaveLength(1))
      await expect(levelsOf()[0]!.dataset.hiddenColumn).toBe('true')
      await settle()
    })
    await step(SUMMARY[3]!.title, async () => {
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
    title: 'Все колонки видны',
    hint: 'Таблица показывает все колонки. Настройки вида ничего не меняют — числа на их кнопке нет.',
  },
  {
    title: 'Пользователь открыл раздел колонок',
    hint: 'Раздел колонок открывается и тогда, когда ничего не скрыто: в нём колонки скрывают. Поле поиска уже в фокусе.',
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
    title: 'Пользователь скрыл колонку',
    hint: 'Колонки фамилии больше нет в таблице, на кнопке настроек вида появилось число.',
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
      title="Колонки в настройках вида"
      steps={COLUMNS}
      args={guideArgs(COLUMNS_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(COLUMNS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(viewSettingsButton(canvas)).not.toBeNull())
      await until(() => expect(viewSettingsCount(canvas)).toBeNull())
    })
    await step(COLUMNS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(columnBox(HIDDEN)).not.toBeNull())
      await settle()
    })
    await step(COLUMNS[2]!.title, async () => {
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

/** Раздел автора: состояние держит приложение, плагин читает его живо и снимает колбэком. */
const onlyMineSection: ViewSettingsSection = {
  id: 'onlyMine',
  plugin: 'onlyMine',
  icon: 'filterActive',
  slices: [],
  label: () => 'Только мои строки',
  active: table =>
    !!readPluginHooks<OnlyMineHooks>(table as never, 'onlyMine').on,
  value: table =>
    readPluginHooks<OnlyMineHooks>(table as never, 'onlyMine').on
      ? 'вкл.'
      : 'выкл.',
  levels: table => [
    {
      id: 'mine',
      label: 'Ответственный — я',
      removeLabel: 'Показать все строки',
      remove: () =>
        readPluginHooks<OnlyMineHooks>(
          table as never,
          'onlyMine',
        ).onTurnOff?.(),
    },
  ],
}

const onlyMine = definePlugin<OnlyMineHooks>()({
  id: 'onlyMine',
  diagnose: () => undefined,
  hooks: o => ({ on: o.on, onTurnOff: o.onTurnOff }),
  viewSettingsSections: [onlyMineSection],
})

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
    title: 'Только мои строки',
    hint: 'Приложение показывает только строки текущего пользователя. Его плагин добавил в настройки вида свой раздел.',
    props: ({ app }) => ({
      dataOverride: MY_ROWS,
      extraPlugins: [
        onlyMine({
          on: true,
          onTurnOff: () =>
            app.update(props => ({
              ...props,
              dataOverride: ALL_ROWS,
              extraPlugins: [onlyMine({ on: false }) as TesseraFeatureEntry],
            })),
        }) as TesseraFeatureEntry,
      ],
    }),
  },
  {
    title: 'Раздел приложения в настройках вида',
    hint: 'Строка раздела стоит после встроенных — с именем, значком и значением, которые задал плагин.',
    states: ['overlay.viewSettings'],
    enter: untilDone(() => !!viewSettingsRow('onlyMine'), openViewSettings),
  },
  {
    title: 'Пользователь показал все строки',
    hint: 'Кнопкой в разделе пользователь снял ограничение: приложение вернуло все строки, строка раздела погасла.',
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () => valueOf('onlyMine') === 'выкл.',
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
      title="Свой раздел"
      steps={OWN}
      args={guideArgs(OWN_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OWN[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(viewSettingsCount(canvas)).toBe('1'))
    })
    await step(OWN[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(valueOf('onlyMine')).toBe('вкл.'))
      await settle()
    })
    await step(OWN[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(valueOf('onlyMine')).toBe('выкл.'))
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
    title: 'Сортировка на сервере по скрытой колонке',
    hint: 'Строки сортирует сервер — по фамилии в обратном порядке. Колонка фамилии скрыта.',
  },
  {
    title: 'Пользователь открыл сортировку',
    hint: 'Раздел сортировки в настройках вида: фамилия с отметкой, что колонка скрыта.',
    states: ['overlay.viewSettings'],
    enter: untilDone(
      () => !!viewSettingsSectionOpen('sorting'),
      root => openViewSettingsSection(root, 'sorting'),
    ),
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь снял сортировку, таблица отправила запрос серверу, сервер отказал. Сортировка вернулась, под шапкой — сообщение с причиной и повтором.',
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
      title="Отказ сервера"
      steps={REFUSED}
      args={guideArgs(REFUSED_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFUSED[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(viewSettingsCount(canvas)).toBe('2'))
    })
    await step(REFUSED[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(levelsOf()).toHaveLength(1))
      await settle()
    })
    await step(REFUSED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(banner(canvas)).toHaveTextContent(SORT_REFUSAL)
      await expect(viewSettingsCount(canvas)).toBe('2')
      await expect(consoleText()).toContain('onToggleColumnSort')
      await settle()
    })
  },
}

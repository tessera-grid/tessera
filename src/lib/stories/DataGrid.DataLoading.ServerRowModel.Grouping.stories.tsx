import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { storyLabels } from './__mocks__/storyLabels'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { StoryComponent } from './DataGridStory'
import {
  layout,
  bodyRows,
  skeletonRows,
  hasRow,
  server,
  release,
  refreshing,
  allGroupItems,
  aggregate,
  groupServer,
  groupProps,
  groupButton,
  groupRows,
  groupRowOf,
  parisItems,
} from './__mocks__/serverRowModelGuide'

/**
 * Серверная группировка (ADR 0144): `Playground` — сто тысяч строк, сгруппированных «сервером»,
 * колонка группировки и число строк групп — контролами; S1 — группировка по колонке, S2 —
 * раскрытие группы, S3 — итог в футере, S4 — отказ сервера; S1 ADR 0160 — «раскрыть всё».
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Grouping',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

interface GroupingPlaygroundArgs extends StoryProps {
  groupBy: 'none' | 'city' | 'vip'
  groupCounts: boolean
}

export const ServerGroupingPlayground: StoryObj<GroupingPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(['groupBy', 'groupCounts'], {
    dataCount: 'the demo server provides the rows',
    columnCount: 'the demo sets the columns',
  }),
  // Список сгруппирован по городу при открытии: группы приходят с сервера свёрнутыми.
  args: { ...layout, groupBy: 'city', groupCounts: true },
  argTypes: {
    groupBy: {
      description: 'The column the list is grouped by when it opens',
      control: 'select',
      options: ['none', 'city', 'vip'],
    },
    groupCounts: {
      description: 'The server sends the row count of each group',
      control: 'boolean',
    },
  },
  render: ({ groupBy, groupCounts, ...args }) => (
    <StoryComponent
      key={groupBy}
      {...normalizeArgs(args)}
      {...groupProps({
        grouping: groupBy === 'none' ? [] : [groupBy],
        counts: groupCounts,
      })!(AT_REST)}
    />
  ),
  // Снимок — в покое: первое окно пришло.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await until(() => expect(bodyRows(canvas).length).toBeGreaterThan(0))
    await settle()
  },
}

const footerOf = (root: HTMLElement, columnId: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__footer-cell[data-column-id="${columnId}"]`,
  )?.textContent ?? ''
const failureShown = (root: HTMLElement) =>
  !!root.querySelector('[data-testid="load-error-banner"]')

/** Пользователь нажал группировку по городу; «сервер» держит ответ. */
const groupByCity = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!groupButton(root) && hasRow(root, 0), signal)
  server.hold = true
  groupButton(root)!.click()
  await pollUntil(() => server.held.length > 0 && refreshing(root), signal)
}

const GROUP_BY: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Пользователь открыл список', en: 'The user opened the list' },
    hint: {
      ru: 'Сервер отдаёт сто тысяч строк блоками. Таблица держит только те, что рядом с экраном.',
      en: 'The server returns a hundred thousand rows in blocks. The table keeps only the ones near the screen.',
    },
    props: groupProps({}),
  },
  {
    title: {
      ru: 'Пользователь сгруппировал по городу',
      en: 'The user grouped by city',
    },
    hint: {
      ru: 'Группы по всем строкам знает только сервер, поэтому таблица попросила у него группы и вернулась к началу. Пока ответ в пути, на экране прежние строки в состоянии обновления данных.',
      en: 'Only the server knows the groups across all rows, so the table asked it for the groups and went back to the top. While the response is on its way, the screen shows the previous rows in the data refresh state.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0 || groupRows(root).length > 0) return
      await groupByCity(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Каждая строка — город: рядом с названием число строк в нём, в колонках визитов и возраста — сумма и среднее, которые посчитал сервер.',
      en: 'Each row is a city: next to the name is its row count, and the visits and age columns show the sum and the average the server calculated.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && groupRows(root).length === 0) {
        await groupByCity(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(
        () => groupRows(root).length > 0 && !refreshing(root),
        signal,
      )
    }),
  },
]

/** ADR 0144, S1: группировка по колонке — строки-группы с числом строк и агрегатами. */
export const ServerRowModelGroupBy: StoryObj<StoryProps> = {
  name: 'Group by a column',
  parameters: { scenario: '0144/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Группировка на сервере', en: 'Grouping on the server' }}
      steps={GROUP_BY}
      reset={() => {
        groupServer.refuse = false
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_BY[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(groupRows(canvas)).toHaveLength(0))
    })
    await step(GROUP_BY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(server.held.length).toBeGreaterThan(0)
    })
    await step(GROUP_BY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const paris = groupRowOf(canvas, 'Paris')!
      await expect(cellText(paris, 'city')).toMatch(PARIS_COUNT)
      await expect(cellText(paris, 'visits')).toBe(String(parisTotals().visits))
      await expect(cellText(paris, 'age')).toBe(String(parisTotals().age))
      await settle()
    })
  },
}

/** Пользователь раскрыл группу «Paris»; «сервер» держит её строки. */
const expandParis = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!groupRowOf(root, 'Paris'), signal)
  server.hold = true
  const toggle = groupRowOf(root, 'Paris')!.querySelector<HTMLElement>(
    '.row-expand-button',
  )!
  if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
  await pollUntil(
    () => server.held.length > 0 && skeletonRows(root) > 0,
    signal,
  )
}
const parisRowsShown = (root: HTMLElement) =>
  bodyRows(root).some(
    row => row.dataset.groupRow !== 'true' && row.dataset.rowId !== undefined,
  )

const EXPAND_GROUP: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Список сгруппирован по городу',
      en: 'The list is grouped by city',
    },
    hint: {
      ru: 'Каждая строка — город с числом строк и агрегатами. Самих строк городов таблица ещё не загружала.',
      en: "Each row is a city with its row count and aggregates. The table has not loaded the cities' rows yet.",
    },
    props: groupProps({ grouping: ['city'] }),
  },
  {
    title: { ru: 'Пользователь раскрыл город', en: 'The user expanded a city' },
    hint: {
      ru: 'Таблица попросила у сервера строки только этого города. Число строк в нём уже известно, поэтому скелеты заняли всю высоту группы, и полоса прокрутки не прыгнет, когда строки придут.',
      en: 'The table asked the server for the rows of this city only. Its row count is already known, so skeletons took the full height of the group, and the scrollbar will not jump when the rows arrive.',
    },
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (parisRowsShown(root) || server.held.length > 0) return
      await expandParis(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Строки города встали под ним с отступом уровня. Остальные приходят блоками по мере прокрутки, как у списка без группировки.',
      en: "The city's rows took their place below it, indented one level. The rest arrive in blocks as the user scrolls, as in a list without grouping.",
    },
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && !parisRowsShown(root)) {
        await expandParis(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(
        () => parisRowsShown(root) && skeletonRows(root) === 0,
        signal,
      )
    }),
  },
]

/** ADR 0144, S2: раскрытие группы — её строки приходят блоками. */
export const ServerRowModelExpandGroup: StoryObj<StoryProps> = {
  name: 'Expand a group',
  parameters: { scenario: '0144/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Строки группы с сервера',
        en: 'Group rows from the server',
      }}
      steps={EXPAND_GROUP}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const parisRequests = () =>
      server.parents.filter(
        id => id === groupRowOf(canvas, 'Paris')?.dataset.rowId,
      )
    await step(EXPAND_GROUP[0]!.title.ru, async () => {
      await until(() => expect(!!groupRowOf(canvas, 'Paris')).toBe(true))
      await until(() => expect(parisRequests()).toEqual([]))
    })
    await step(EXPAND_GROUP[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(parisRequests()).toHaveLength(1)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
      // Скелеты — на все строки группы: пять городов, двадцать тысяч строк и шапка.
      await expect(
        canvas.querySelector('[aria-rowcount]')?.getAttribute('aria-rowcount'),
      ).toBe(String(5 + parisCount() + 1))
    })
    await step(EXPAND_GROUP[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(parisRowsShown(canvas)).toBe(true)
      await settle()
    })
  },
}

const TOTALS_QUERY = 'Paris'
const searchField = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('input[data-testid="quick-search"]')

/** Пользователь ищет город; «сервер» держит ответ. */
const searchParis = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!searchField(root) && hasRow(root, 0), signal)
  server.hold = true
  const field = searchField(root)!
  field.focus()
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!
  setValue.call(field, TOTALS_QUERY)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  await pollUntil(() => server.held.length > 0 && refreshing(root), signal)
}
const allVisits = () => String(aggregate(allGroupItems()).visits)
const parisCount = () => parisItems().length
const parisTotals = () => aggregate(parisItems())
/** Число строк группы рядом с её названием: «Paris (20,000)» в любой локали чисел. */
const PARIS_COUNT = /^Paris \(20\D?000\)$/
const cellText = (row: HTMLElement, columnId: string) =>
  row.querySelector(`[data-column-id="${columnId}"]`)?.textContent ?? ''

const TOTALS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Итог в футере', en: 'The total in the footer' },
    hint: {
      ru: 'Под списком — итог по всем ста тысячам строк: сумма визитов и средний возраст. Его посчитал сервер, загружены лишь строки рядом с экраном.',
      en: 'Below the list is the total over all one hundred thousand rows: the sum of visits and the average age. The server calculated it; only the rows near the screen are loaded.',
    },
    props: groupProps({ search: true }),
  },
  {
    title: {
      ru: 'Пользователь ищет город',
      en: 'The user searches for a city',
    },
    hint: {
      ru: 'Поиск выполняет сервер, поэтому таблица попросила у него новое начало списка вместе с новым итогом. Пока ответ в пути, на экране прежние строки и прежний итог в состоянии обновления данных.',
      en: 'The server runs the search, so the table asked it for a new start of the list along with a new total. While the response is on its way, the screen shows the previous rows and the previous total in the data refresh state.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0 || footerOf(root, 'visits') !== allVisits()) {
        return
      }
      await searchParis(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'В списке только строки этого города, а итог в футере посчитан по ним — по всей найденной выборке, а не по загруженным строкам.',
      en: "The list has only this city's rows, and the total in the footer is calculated from them: over the whole search result, not over the loaded rows.",
    },
    enter: stepAction(async (root, { signal }) => {
      if (
        server.held.length === 0 &&
        footerOf(root, 'visits') === allVisits()
      ) {
        await searchParis(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(
        () => footerOf(root, 'visits') !== allVisits() && !refreshing(root),
        signal,
      )
    }),
  },
]

/** ADR 0144, S3: итог списка в футере меняется вместе с поиском. */
export const ServerRowModelTotals: StoryObj<StoryProps> = {
  name: 'Totals in the footer',
  parameters: { scenario: '0144/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Итог списка с сервера',
        en: 'The list total from the server',
      }}
      steps={TOTALS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TOTALS[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(footerOf(canvas, 'visits')).toBe(allVisits()))
    })
    await step(TOTALS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(searchField(canvas)!.value).toBe(TOTALS_QUERY)
      await expect(footerOf(canvas, 'visits')).toBe(allVisits())
    })
    await step(TOTALS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(footerOf(canvas, 'visits')).toBe(
        String(parisTotals().visits),
      )
      await expect(footerOf(canvas, 'age')).toBe(String(parisTotals().age))
      await expect(
        new Set(bodyRows(canvas).map(row => cellText(row, 'city'))),
      ).toEqual(new Set([TOTALS_QUERY]))
      await settle()
    })
  },
}

const GROUPING_REFUSED: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Пользователь открыл список', en: 'The user opened the list' },
    hint: {
      ru: 'Сервер отдаёт строки списка блоками, группировки нет.',
      en: "The server returns the list's rows in blocks; there is no grouping.",
    },
    props: groupProps({}),
  },
  {
    title: {
      ru: 'Пользователь сгруппировал по городу',
      en: 'The user grouped by city',
    },
    hint: {
      ru: 'Таблица попросила у сервера группы. Пока ответ в пути, на экране прежние строки в состоянии обновления данных.',
      en: 'The table asked the server for groups. While the response is on its way, the screen shows the previous rows in the data refresh state.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = true
      if (server.held.length > 0 || failureShown(root)) return
      await groupByCity(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер не смог сгруппировать список. Таблица вернулась к прежнему виду без группировки, а плашка над строками называет причину и предлагает повторить.',
      en: 'The server could not group the list. The table returned to its previous ungrouped view, and a banner above the rows names the reason and offers a retry.',
    },
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = true
      if (server.held.length === 0 && !failureShown(root)) {
        await groupByCity(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(() => failureShown(root) && !refreshing(root), signal)
    }),
  },
]

/** ADR 0144, S4: сервер отказал в группировке — таблица возвращается к прежнему виду. */
export const ServerRowModelGroupingRefused: StoryObj<StoryProps> = {
  name: 'Grouping refused',
  parameters: { scenario: '0144/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ в группировке', en: 'Grouping refused' }}
      steps={GROUPING_REFUSED}
      reset={() => {
        groupServer.refuse = true
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUPING_REFUSED[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(groupRows(canvas)).toHaveLength(0))
    })
    await step(GROUPING_REFUSED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(server.held.length).toBeGreaterThan(0)
    })
    await step(GROUPING_REFUSED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(failureShown(canvas)).toBe(true)
      await expect(groupRows(canvas)).toHaveLength(0)
      await expect(
        groupButton(canvas)!.closest('[data-button-active]'),
      ).toHaveAttribute('data-button-active', 'false')
      await settle()
    })
  },
}

// --- ADR 0160, S1: «раскрыть всё» в серверных группах ----------------------------------

const expandAllButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.row-expand-all-button')
const groupExpanded = (row: HTMLElement) =>
  row.getAttribute('data-expanded') === 'true'
/** Первая группа раскрыта, её строки пришли. */
const firstGroupLoaded = (root: HTMLElement) => {
  const rows = bodyRows(root)
  return (
    rows.length > 1 &&
    groupExpanded(rows[0]!) &&
    rows[1]!.dataset.groupRow !== 'true'
  )
}

/** Пользователь нажал «раскрыть всё»; «сервер» держит строки групп. */
const expandAll = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(
    () => !!expandAllButton(root) && groupRows(root).length > 0,
    signal,
  )
  server.hold = true
  if (!groupRows(root).every(groupExpanded)) expandAllButton(root)!.click()
  await pollUntil(
    () => server.held.length > 0 && skeletonRows(root) > 0,
    signal,
  )
}

const EXPAND_ALL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Группы свёрнуты', en: 'Groups are collapsed' },
    hint: {
      ru: 'Сервер сгруппировал строки по городу; группы свёрнуты, их строки таблица ещё не загружала. В шапке колонки с кнопками раскрытия — кнопка, которая раскрывает все группы сразу.',
      en: 'The server grouped the rows by city; the groups are collapsed, and the table has not loaded their rows yet. The header of the column with expand buttons has a button that expands all groups at once.',
    },
    // Отказ прошлого гайда снят до открытия таблицы: она открывается с группами.
    props: context => {
      groupServer.refuse = false
      return groupProps({ grouping: ['city'] })!(context)
    },
  },
  {
    title: {
      ru: 'Пользователь раскрыл всё',
      en: 'The user expanded everything',
    },
    hint: {
      ru: 'Раскрыты все группы, но строки таблица попросила только у групп на экране: под ними — блоки скелетов, пока ответ в пути. Группы ниже попросят свои строки, когда до них дойдёт прокрутка.',
      en: 'All groups are expanded, but the table asked only for the rows of the groups on screen: below them are skeleton blocks while the response is on its way. Groups further down will ask for their rows when scrolling reaches them.',
    },
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0 || firstGroupLoaded(root)) return
      await expandAll(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Строки первой группы встали под ней с отступом уровня. Кнопка в шапке теперь сворачивает всё.',
      en: "The first group's rows took their place below it, indented one level. The button in the header now collapses everything.",
    },
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && !firstGroupLoaded(root)) {
        await expandAll(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(
        () => firstGroupLoaded(root) && skeletonRows(root) === 0,
        signal,
      )
    }),
  },
]

/** ADR 0160, S1: «раскрыть всё» раскрывает серверные группы, строки просят видимые. */
export const ServerGroupingExpandAll: StoryObj<StoryProps> = {
  name: 'Expand all',
  parameters: { scenario: '0160/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Раскрыть всё', en: 'Expand all' }}
      steps={EXPAND_ALL}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EXPAND_ALL[0]!.title.ru, async () => {
      await until(() => expect(groupRows(canvas).length > 0).toBe(true))
      await until(() =>
        expect(groupRows(canvas).some(groupExpanded)).toBe(false),
      )
    })
    await step(EXPAND_ALL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(groupRows(canvas).every(groupExpanded)).toBe(true)
      // Строки просят только группы на экране.
      await expect(new Set(server.parents).size).toBeLessThanOrEqual(2)
    })
    await step(EXPAND_ALL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(firstGroupLoaded(canvas)).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0184, S7 ----------------------------------------------------------------------

const NESTED_GROUPS = ['city', 'vip']

const groupCountOf = (canvas: HTMLElement) =>
  groupRowOf(canvas, 'Paris')
    ?.querySelector('[data-group-count]')
    ?.textContent?.trim()

const ROW_COUNT: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Сервер прислал число подгрупп',
      en: 'The server sent the subgroup count',
    },
    hint: {
      ru: 'Рядом с городом стоит число его подгрупп: сервер сообщил только их, этого хватает, чтобы раскрыть группу.',
      en: 'Next to the city is the number of its subgroups: the server reported only those, which is enough to expand the group.',
    },
    props: groupProps({ grouping: NESTED_GROUPS, rowCounts: false }),
  },
  {
    title: {
      ru: 'Сервер прислал число строк',
      en: 'The server sent the row count',
    },
    hint: {
      ru: 'Теперь сервер сообщает и число строк данных, поэтому рядом с городом стоит оно: человеку важнее, сколько записей внутри.',
      en: 'Now the server reports the number of data rows too, so that is what appears next to the city: a person cares more about how many records are inside.',
    },
    props: groupProps({ grouping: NESTED_GROUPS, rowCounts: true }),
    remount: true,
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!groupRowOf(root, 'Paris'), signal)
    }),
  },
]

/** ADR 0184, S7: подпись группы считает строки данных на всех уровнях. */
export const ServerGroupRowCount: StoryObj<StoryProps> = {
  name: 'Row count of a group',
  parameters: { scenario: '0184/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Число строк группы', en: 'Group row count' }}
      steps={ROW_COUNT}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ROW_COUNT[0]!.title.ru, async () => {
      await until(() => expect(!!groupRowOf(canvas, 'Paris')).toBe(true))
      await until(() => expect(groupCountOf(canvas)).toBe('(3)'))
    })
    await step(ROW_COUNT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(groupCountOf(canvas)).toBe(
          storyLabels(args.locale).groupRowCount(parisItems().length),
        ),
      )
    })
    await settle()
  },
}

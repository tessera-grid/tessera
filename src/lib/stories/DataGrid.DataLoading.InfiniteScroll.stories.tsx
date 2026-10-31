import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import type { InfiniteScrollLoadContext } from '../plugins'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  byTestId,
  consoleText,
  guideNext,
  orderedRows,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { filteringColumns } from './__mocks__/filteringData'
import { storyLabels } from './__mocks__/storyLabels'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideApp,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import {
  INITIAL_QUERY,
  InfiniteScrollDemo,
  type InfiniteScrollDemoProps,
  type Query,
  SERVER_DATA,
  SERVER_TOTAL,
  select,
} from './demos/infiniteScrollDemos'

/**
 * Бесконечная прокрутка — лента (ADR 0081): `Playground` — лента в покое, режимы —
 * контролами; S1 — итог неизвестен, S2 — сбой и повтор, S3 — сортировка на сервере.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Infinite scroll',
} satisfies Meta<StoryProps>

export default meta

const layout = { containerHeight: '600', height: '480', maxHeight: '480' }

export const InfiniteScrollPlayground: StoryObj<InfiniteScrollDemoProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'serverDelayMs',
      'blockSize',
      'knownTotal',
      'failFirstAttempt',
      'serverQuery',
    ],
    {
      dataCount: 'данные подаёт демо',
      columnCount: 'колонки задаёт демо',
    },
  ),
  // Известный итог: счётчик «Loaded N of M»; режимы ленты — контролами.
  args: {
    ...layout,
    serverDelayMs: 700,
    blockSize: 50,
    knownTotal: true,
    failFirstAttempt: false,
    serverQuery: false,
  },
  argTypes: {
    serverDelayMs: {
      description: 'Время ответа «сервера», мс',
      control: { type: 'range', min: 0, max: 3000, step: 100 },
    },
    blockSize: {
      description: 'Строк в блоке',
      control: { type: 'range', min: 5, max: 200, step: 5 },
    },
    knownTotal: {
      description: 'Сервер сообщает итог; иначе — только что строки ещё есть',
      control: 'boolean',
    },
    failFirstAttempt: {
      description: 'Первая попытка каждого блока падает, повтор проходит',
      control: 'boolean',
    },
    serverQuery: {
      description: 'Сортировка, фильтры колонок и поиск — на сервере',
      control: 'boolean',
    },
  },
  render: args => <InfiniteScrollDemo {...normalizeArgs(args)} />,
}

// --- «Сервер» гайдов ------------------------------------------------------------------

const BLOCK = 50
const SERVER_DELAY_MS = 500
const FAILURE = 'Server error: 503 Service Unavailable'

/** Лента, которую приложение держит сейчас, и ответы «сервера» в пути. */
const feed = {
  table: undefined as unknown,
  rows: SERVER_DATA.slice(0, BLOCK),
  query: INITIAL_QUERY as Query,
  failed: new Set<number>(),
  /** Ответ, который «сервер» держит до следующего шага гайда. */
  held: undefined as (() => void) | undefined,
}

/** Новое открытие таблицы — новая лента: прежние ответы ей не принадлежат. */
const feedReset: TesseraFeatureEntry = {
  id: 'infiniteScrollFeedReset',
  setup: table => {
    // `setup` повторяется при смене аргументов плагинов, а обёртка таблицы новая на каждом
    // рендере: новое открытие узнаётся по хранилищу состояния.
    const store = (table as { store: unknown }).store
    if (feed.table === store) return
    feed.table = store
    feed.rows = SERVER_DATA.slice(0, BLOCK)
    feed.query = INITIAL_QUERY
    feed.failed.clear()
    feed.held = undefined
  },
}

type FeedMode = { hold?: boolean; failFirst?: boolean }

/** Приложение дописывает блок «сервера» в конец ленты. */
const append = (app: GuideApp, loaded: number) => {
  const all = select(feed.query)
  feed.rows = [...feed.rows, ...all.slice(loaded, loaded + BLOCK)]
  app.update(props => ({
    ...props,
    dataOverride: feed.rows,
    infiniteScrollHasMore: feed.rows.length < all.length,
  }))
}

/** `onLoadMore` приложения: «сервер» отвечает с задержкой, держит ответ или отказывает. */
const loadMore =
  (app: GuideApp, { hold, failFirst }: FeedMode) =>
  ({ signal, loaded }: InfiniteScrollLoadContext) =>
    new Promise<void>((resolve, reject) => {
      const answer = () => {
        if (signal.aborted) return resolve()
        if (failFirst && !feed.failed.has(loaded)) {
          feed.failed.add(loaded)
          return reject(new Error(FAILURE))
        }
        append(app, loaded)
        resolve()
      }
      if (hold) feed.held = answer
      else setTimeout(answer, SERVER_DELAY_MS)
    })

/** Лента гайда: первый блок, колбэк загрузки и сброс при новом открытии. */
const feedProps =
  (mode: FeedMode, knownTotal = true): GuideStoryStep['props'] =>
  ({ app }) => ({
    columnsOverride: filteringColumns,
    dataOverride: SERVER_DATA.slice(0, BLOCK),
    enableInfiniteScroll: true,
    infiniteScrollHasMore: true,
    rowCount: knownTotal ? SERVER_TOTAL : undefined,
    infiniteScrollLoadedCount: true,
    onLoadMore: loadMore(app, mode),
    extraPlugins: [feedReset],
  })

const scroller = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__container')
const loaded = (root: HTMLElement) =>
  new Set(orderedRows(root).map(row => row.dataset.rowId)).size
const tailRows = (root: HTMLElement) =>
  root.querySelectorAll(
    '.data-grid__body--infinite-tail .data-grid__body-row--skeleton',
  ).length
const errorRow = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="infinite-scroll-error"]')
const loadedText = () => byTestId('loaded-rows-count')?.textContent ?? ''

/** Пользователь прокручивает таблицу к краю загруженных строк. */
const scrollToEnd = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(
    () => !!scroller(root)?.querySelector('.data-grid__body-row'),
    signal,
  )
  const el = scroller(root)!
  el.scrollTop = el.scrollHeight
}

/** Строк загружено: последний блок дописан, в пути ничего нет. */
const settledAt = (root: HTMLElement, count: number) =>
  feed.rows.length === count && tailRows(root) === 0 && !feed.held

// --- ADR 0081 S1 ---------------------------------------------------------------------

const UNKNOWN_TOTAL: readonly GuideStoryStep[] = [
  {
    title: 'Первая порция',
    hint: 'Таблица показала первый блок строк. Сервер не сообщает, сколько строк всего: нижняя панель называет только число загруженных.',
    props: feedProps({ hold: true }, false),
  },
  {
    title: 'Пользователь докрутил до края',
    hint: 'Таблица попросила следующий блок. Пока он в пути, внизу — строки-скелеты.',
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (feed.rows.length > BLOCK) return
      await scrollToEnd(root, signal)
      await pollUntil(() => !!feed.held && tailRows(root) > 0, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Строки дописаны в конец, счётчик загруженных вырос, прокрутка осталась на месте.',
    enter: stepAction(async (root, { signal }) => {
      if (feed.rows.length === BLOCK && !feed.held) {
        await scrollToEnd(root, signal)
        await pollUntil(() => !!feed.held, signal)
      }
      const answer = feed.held
      feed.held = undefined
      answer?.()
      await pollUntil(() => settledAt(root, BLOCK * 2), signal)
    }),
  },
]

/** ADR 0081, S1: сервер не знает итога — счётчик называет только загруженные строки. */
export const InfiniteScrollUnknownTotal: StoryObj<StoryProps> = {
  name: 'Unknown total',
  parameters: { scenario: '0081/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Итог неизвестен"
      steps={UNKNOWN_TOTAL}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(UNKNOWN_TOTAL[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(loadedText()).toBe(labels.loadedRows(BLOCK)))
    })
    await step(UNKNOWN_TOTAL[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(tailRows(canvas)).toBeGreaterThan(0)
      await expect(consoleText()).toContain('onLoadMore')
    })
    await step(UNKNOWN_TOTAL[2]!.title, async () => {
      const top = scroller(canvas)!.scrollTop
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(loadedText()).toBe(labels.loadedRows(BLOCK * 2)))
      await expect(scroller(canvas)!.scrollTop).toBe(top)
      await settle()
    })
  },
}

// --- ADR 0081 S2 ---------------------------------------------------------------------

const ERRORS: readonly GuideStoryStep[] = [
  {
    title: 'Первая порция',
    hint: 'Таблица показала первый блок строк, нижняя панель называет, сколько загружено из общего числа.',
    props: feedProps({ failFirst: true }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь докрутил до края, сервер не отдал следующий блок. Внизу — строка ошибки с причиной и кнопкой повтора, загруженные строки на месте.',
    states: ['body.loadFailed'],
    enter: stepAction(async (root, { signal }) => {
      if (feed.rows.length > BLOCK) return
      await scrollToEnd(root, signal)
      await pollUntil(() => !!errorRow(root), signal)
    }),
  },
  {
    title: 'Пользователь повторил запрос',
    hint: 'Повтор дописал блок, строка ошибки ушла, счётчик вырос.',
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => {
        if (feed.rows.length > BLOCK) return true
        if (errorRow(root))
          errorRow(root)!.querySelector<HTMLElement>('button')?.click()
        else if (tailRows(root) === 0) {
          const el = scroller(root)
          if (el) el.scrollTop = el.scrollHeight
        }
        return false
      }, signal)
      await pollUntil(() => settledAt(root, BLOCK * 2), signal)
    }),
  },
]

/** ADR 0081, S2: сервер отказал — строка ошибки, повтор догружает блок. */
export const InfiniteScrollErrors: StoryObj<StoryProps> = {
  name: 'Errors',
  parameters: {
    scenario: '0081/S2',
    requirements: ['IS18'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Сбой загрузки и повтор"
      steps={ERRORS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(ERRORS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(loadedText()).toBe(labels.loadedRowsOf(BLOCK, SERVER_TOTAL)),
      )
    })
    await step(ERRORS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(errorRow(canvas)).toHaveTextContent(FAILURE)
      await expect(loadedText()).toBe(labels.loadedRowsOf(BLOCK, SERVER_TOTAL))
    })
    await step(ERRORS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(errorRow(canvas)).toBeNull()
      await expect(loadedText()).toBe(
        labels.loadedRowsOf(BLOCK * 2, SERVER_TOTAL),
      )
      await settle()
    })
  },
}

// --- ADR 0081 S3 ---------------------------------------------------------------------

/** Приложение перезапрашивает первую порцию под новым условием выборки. */
const reload = (app: GuideApp) => {
  app.update(props => ({ ...props, loading: 'refresh' }))
  setTimeout(() => {
    const all = select(feed.query)
    feed.rows = all.slice(0, BLOCK)
    feed.failed.clear()
    app.update(props => ({
      ...props,
      loading: false,
      dataOverride: feed.rows,
      infiniteScrollHasMore: feed.rows.length < all.length,
      rowCount: all.length,
    }))
  }, SERVER_DELAY_MS)
}

const firstNames = (root: HTMLElement) =>
  orderedRows(root).map(
    row =>
      row.querySelector('[data-column-id="name"]')?.textContent?.trim() ?? '',
  )
const sortedByName = (root: HTMLElement) =>
  feed.query.sort?.id === 'name' &&
  feed.rows.length === BLOCK &&
  firstNames(root)[0] === feed.rows[0]?.name

const SERVER_QUERY: readonly GuideStoryStep[] = [
  {
    title: 'Два блока загружены',
    hint: 'Пользователь докрутил до края, и таблица дописала второй блок.',
    props: ({ app, ...context }) => ({
      ...feedProps({})!({ app, ...context }),
      enableColumnSorting: true,
      dataMode: { sorting: 'server' },
      columnSortingMultiSort: false,
      onToggleColumnSort: (id: string, direction: 'asc' | 'desc' | false) => {
        feed.query = {
          ...feed.query,
          sort: direction ? { id, desc: direction === 'desc' } : undefined,
        }
        reload(app)
      },
    }),
    enter: stepAction(async (root, { signal }) => {
      if (feed.rows.length === BLOCK) await scrollToEnd(root, signal)
      await pollUntil(() => settledAt(root, BLOCK * 2), signal)
    }),
  },
  {
    title: 'Пользователь отсортировал по имени',
    hint: 'Новое условие ушло серверу, пока он отвечает, таблица в состоянии обновления данных. Таблица вернулась в начало: пришла первая порция в новом порядке, счётчик снова один блок.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => {
        if (feed.query.sort?.id === 'name') return true
        root
          .querySelector<HTMLElement>(
            '.data-grid__head-cell[data-column-id="name"] .column-sort__button',
          )
          ?.click()
        return false
      }, signal)
      await pollUntil(() => sortedByName(root), signal)
    }),
  },
]

/** ADR 0081, S3: смена сортировки — лента начинается заново с новой первой порцией. */
export const InfiniteScrollServerQuery: StoryObj<StoryProps> = {
  name: 'Server sort & filter',
  parameters: { scenario: '0081/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Сортировка на сервере"
      steps={SERVER_QUERY}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(SERVER_QUERY[0]!.title, async () => {
      await waitForRows(canvas)
      await stepDone(canvas)
      await expect(loadedText()).toBe(
        labels.loadedRowsOf(BLOCK * 2, SERVER_TOTAL),
      )
    })
    await step(SERVER_QUERY[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBe(0)
      await expect(loadedText()).toBe(labels.loadedRowsOf(BLOCK, SERVER_TOTAL))
      await expect(consoleText()).toContain('onToggleColumnSort')
      await settle()
    })
  },
}

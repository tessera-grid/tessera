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
import { untilDone } from './__mocks__/cellGestures'
import { filteringColumns } from './__mocks__/filteringData'
import { storyLabels } from './__mocks__/storyLabels'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  DemoStory,
  type GuideApp,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import {
  INITIAL_QUERY,
  InfiniteScrollDemo,
  type InfiniteScrollDemoProps,
  type Query,
  SERVER_DATA,
  SERVER_TOTAL,
  select,
} from './demos/infiniteScrollDemos'
import { infiniteScrollLabels } from '../plugins/infiniteScroll/labels'

/**
 * Бесконечная прокрутка — лента (ADR 0081): `Playground` — лента в покое, режимы —
 * контролами; S1 — итог неизвестен, S2 — сбой и повтор, S3 — сортировка на сервере; выбор
 * всего до прихода строк — S4 ADR 0179.
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
      dataCount: 'the demo supplies the data',
      columnCount: 'the demo defines the columns',
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
      description: '“Server” response time, ms',
      control: { type: 'range', min: 0, max: 3000, step: 100 },
    },
    blockSize: {
      description: 'Rows per block',
      control: { type: 'range', min: 5, max: 200, step: 5 },
    },
    knownTotal: {
      description:
        'The server reports the total; otherwise only that more rows exist',
      control: 'boolean',
    },
    failFirstAttempt: {
      description: 'The first attempt for each block fails; the retry succeeds',
      control: 'boolean',
    },
    serverQuery: {
      description: 'Sorting, column filters, and search run on the server',
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
      // Ответ прошлой ленты (таблица уже открыта заново) новой ленте не принадлежит.
      const table = feed.table
      const answer = () => {
        if (signal.aborted || feed.table !== table) return resolve()
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
  (mode: FeedMode, knownTotal = true): DemoStoryStep['props'] =>
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

const UNKNOWN_TOTAL: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Первая порция', en: 'The first batch' },
    hint: {
      ru: 'Таблица показала первый блок строк. Сервер не сообщает, сколько строк всего: нижняя панель называет только число загруженных.',
      en: 'The table showed the first block of rows. The server does not report the total row count, so the status bar shows only how many are loaded.',
    },
    props: feedProps({ hold: true }, false),
  },
  {
    title: {
      ru: 'Пользователь докрутил до края',
      en: 'The user scrolled to the edge',
    },
    hint: {
      ru: 'Таблица попросила следующий блок. Пока он в пути, внизу — строки-скелеты.',
      en: 'The table requested the next block. While it is on its way, skeleton rows appear at the bottom.',
    },
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (feed.rows.length > BLOCK) return
      await scrollToEnd(root, signal)
      await pollUntil(() => !!feed.held && tailRows(root) > 0, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Строки дописаны в конец, счётчик загруженных вырос, прокрутка осталась на месте.',
      en: 'The rows were appended at the end, the loaded count went up, and the scroll position stayed put.',
    },
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
    <DemoStory
      title={{ ru: 'Итог неизвестен', en: 'Unknown total' }}
      steps={UNKNOWN_TOTAL}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(UNKNOWN_TOTAL[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(loadedText()).toBe(
          infiniteScrollLabels(labels).loadedRows(BLOCK),
        ),
      )
    })
    await step(UNKNOWN_TOTAL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(tailRows(canvas)).toBeGreaterThan(0)
      await expect(consoleText()).toContain('onLoadMore')
    })
    await step(UNKNOWN_TOTAL[2]!.title.ru, async () => {
      const top = scroller(canvas)!.scrollTop
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(loadedText()).toBe(
          infiniteScrollLabels(labels).loadedRows(BLOCK * 2),
        ),
      )
      await expect(scroller(canvas)!.scrollTop).toBe(top)
      await settle()
    })
  },
}

// --- ADR 0081 S2 ---------------------------------------------------------------------

const ERRORS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Первая порция', en: 'The first batch' },
    hint: {
      ru: 'Таблица показала первый блок строк, нижняя панель называет, сколько загружено из общего числа.',
      en: 'The table showed the first block of rows; the status bar shows how many are loaded out of the total.',
    },
    props: feedProps({ failFirst: true }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь докрутил до края, сервер не отдал следующий блок. Внизу — строка ошибки с причиной и кнопкой повтора, загруженные строки на месте.',
      en: 'The user scrolled to the edge, and the server did not return the next block. At the bottom is an error row with the reason and a retry button; the loaded rows stay in place.',
    },
    states: ['body.loadFailed'],
    enter: stepAction(async (root, { signal }) => {
      if (feed.rows.length > BLOCK) return
      await scrollToEnd(root, signal)
      await pollUntil(() => !!errorRow(root), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь повторил запрос',
      en: 'The user retried the request',
    },
    hint: {
      ru: 'Повтор дописал блок, строка ошибки ушла, счётчик вырос.',
      en: 'The retry appended the block, the error row went away, and the count went up.',
    },
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
    <DemoStory
      title={{ ru: 'Сбой загрузки и повтор', en: 'Loading failure and retry' }}
      steps={ERRORS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(ERRORS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(loadedText()).toBe(
          infiniteScrollLabels(labels).loadedRowsOf(BLOCK, SERVER_TOTAL),
        ),
      )
    })
    await step(ERRORS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(errorRow(canvas)).toHaveTextContent(FAILURE)
      await expect(loadedText()).toBe(
        infiniteScrollLabels(labels).loadedRowsOf(BLOCK, SERVER_TOTAL),
      )
    })
    await step(ERRORS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(errorRow(canvas)).toBeNull()
      await expect(loadedText()).toBe(
        infiniteScrollLabels(labels).loadedRowsOf(BLOCK * 2, SERVER_TOTAL),
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

const SERVER_QUERY: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Первый блок загружен', en: 'The first block is loaded' },
    hint: {
      ru: 'Таблица загрузила первый блок строк. Следующий она допишет, когда пользователь докрутит до края.',
      en: 'The table loaded the first block of rows. It will append the next one when the user scrolls to the edge.',
    },
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
  },
  {
    title: { ru: 'Два блока загружены', en: 'Two blocks are loaded' },
    hint: {
      ru: 'Пользователь докрутил до края, и таблица дописала второй блок.',
      en: 'The user scrolled to the edge, and the table appended the second block.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (feed.rows.length === BLOCK) await scrollToEnd(root, signal)
      await pollUntil(() => settledAt(root, BLOCK * 2), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отсортировал по имени',
      en: 'The user sorted by name',
    },
    hint: {
      ru: 'Новое условие ушло серверу, пока он отвечает, таблица в состоянии обновления данных. Таблица вернулась в начало: пришла первая порция в новом порядке, счётчик снова один блок.',
      en: 'The new condition went to the server; while the server responds, the table shows that its data is refreshing. The table went back to the top: the first batch arrived in the new order, and the count is back to one block.',
    },
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
    <DemoStory
      title={{ ru: 'Сортировка на сервере', en: 'Sorting on the server' }}
      steps={SERVER_QUERY}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(SERVER_QUERY[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(SERVER_QUERY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(loadedText()).toBe(
          infiniteScrollLabels(labels).loadedRowsOf(BLOCK * 2, SERVER_TOTAL),
        ),
      )
    })
    await step(SERVER_QUERY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(scroller(canvas)!.scrollTop).toBe(0))
      await until(() =>
        expect(loadedText()).toBe(
          infiniteScrollLabels(labels).loadedRowsOf(BLOCK, SERVER_TOTAL),
        ),
      )
      await until(() => expect(consoleText()).toContain('onToggleColumnSort'))
      await settle()
    })
  },
}

// --- ADR 0179 S4 ---------------------------------------------------------------------

/** Число выбранных строк в нижней панели — цифрами, без разделителей языка. */
const selectedCount = () =>
  (byTestId('selected-rows-count')?.textContent ?? '').replace(/\D/g, '')
const headBox = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[role="columnheader"] [role="checkbox"]')
const everyChecked = (root: HTMLElement) =>
  orderedRows(root).length > 0 &&
  orderedRows(root).every(
    row =>
      row.querySelector('[role="checkbox"]')?.getAttribute('aria-checked') ===
      'true',
  )

const SELECT_ALL: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Первая порция', en: 'The first batch' },
    hint: {
      ru: 'Таблица показала первый блок строк, остальные придут при прокрутке. Ни одна строка не выбрана.',
      en: 'The table showed the first block of rows; the rest will arrive on scroll. No row is selected.',
    },
    props: context => ({
      ...feedProps({})!(context),
      enableRowSelection: true,
      rowSelectionSelectedCount: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь выбрал все строки',
      en: 'The user selected all rows',
    },
    hint: {
      ru: 'Пользователь отметил флажок в заголовке. Выбраны все строки ленты, и ещё не загруженные; нижняя панель называет их число.',
      en: 'The user checked the checkbox in the header. All rows of the feed are selected, including those not loaded yet; the status bar shows their count.',
    },
    states: ['body.selection'],
    enter: untilDone(
      root => everyChecked(root) && selectedCount() === String(SERVER_TOTAL),
      root => {
        if (headBox(root)?.getAttribute('aria-checked') !== 'true')
          headBox(root)?.click()
      },
    ),
  },
  {
    title: { ru: 'Пришли следующие строки', en: 'The next rows arrived' },
    hint: {
      ru: 'Пользователь докрутил до края, и сервер прислал следующий блок. Пришедшие строки тоже выбраны.',
      en: 'The user scrolled to the edge, and the server sent the next block. The rows that arrived are selected too.',
    },
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => {
        if (selectedCount() === String(SERVER_TOTAL)) return true
        headBox(root)?.click()
        return false
      }, signal)
      await scrollToEnd(root, signal)
      await pollUntil(() => settledAt(root, BLOCK * 2), signal)
      await scrollToEnd(root, signal)
      await pollUntil(() => everyChecked(root), signal)
    }),
  },
]

/** ADR 0179, S4: пользователь выбирает всё в ленте до прихода остальных строк. */
export const InfiniteScrollSelectAll: StoryObj<StoryProps> = {
  name: 'Select all',
  parameters: { scenario: '0179/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Выбор всего в ленте',
        en: 'Selecting everything in a feed',
      }}
      steps={SELECT_ALL}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SELECT_ALL[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(everyChecked(canvas)).toBe(false)
    })
    await step(SELECT_ALL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCount()).toBe(String(SERVER_TOTAL)))
      await expect(everyChecked(canvas)).toBe(true)
    })
    await step(SELECT_ALL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(feed.rows.length).toBe(BLOCK * 2)
      await expect(everyChecked(canvas)).toBe(true)
      await expect(selectedCount()).toBe(String(SERVER_TOTAL))
      await settle()
    })
  },
}

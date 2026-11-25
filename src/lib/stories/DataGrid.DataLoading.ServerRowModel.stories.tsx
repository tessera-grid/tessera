import { Meta, StoryObj } from '@storybook/react'
import { mod } from './__mocks__/platformKeys'
import { expect } from 'storybook/test'
import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  waitForRows,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import {
  SERVER_FAILURE,
  ServerRowModelDemo,
  type ServerRowModelDemoProps,
} from './demos/serverRowModelDemos'
import {
  layout,
  bodyRows,
  skeletonRows,
  scroller,
  hasRow,
  server,
  release,
  serverReset,
  sortedSet,
  serverProps,
  scrollTo,
  refreshing,
  SORT_REFUSAL,
  layerOf,
  nextFrame,
  press,
  searchProps,
} from './__mocks__/serverRowModelGuide'

/**
 * Серверная модель строк (ADR 0138): `Playground` — триста тысяч строк с «сервера» в покое,
 * объём, итог, отказы и размер блока — контролами; S1 — прыжок в середину, S2 — отказ
 * блока и повтор, S3 — итог неизвестен, S4 — смена сортировки, S5 — открыть на записи;
 * ADR 0142, S1 — миллион строк: ползунком в конец, колесом и клавишами; ADR 0228, S1 — поиск
 * сужает список, оставшиеся строки подтягиваются. Группировка, выбор
 * строк, выделение ячеек, правка и вложенные строки — в подразделах (ADR 0151).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model',
} satisfies Meta<StoryProps>

export default meta

const errorRow = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="rows-load-error"]')

export const ServerRowModelPlayground: StoryObj<ServerRowModelDemoProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'serverDelayMs',
      'serverTotal',
      'knownTotal',
      'failFirstAttempt',
      'blockSize',
      'maxBlocks',
    ],
    {
      dataCount: 'Rows come from the demo server',
      columnCount: 'Columns are set by the demo',
    },
  ),
  // Триста тысяч строк с известным итогом: таблица загружает только видимые блоки.
  args: {
    ...layout,
    serverDelayMs: 600,
    serverTotal: 300_000,
    knownTotal: true,
    failFirstAttempt: false,
    blockSize: 100,
    maxBlocks: 100,
  },
  argTypes: {
    serverDelayMs: {
      description: 'Server response time, ms',
      control: { type: 'range', min: 0, max: 3000, step: 100 },
    },
    serverTotal: {
      description: 'Rows on the server',
      control: 'select',
      options: [1000, 100_000, 300_000, 1_000_000],
    },
    knownTotal: {
      description:
        'The server reports the total; otherwise a block shorter than usual marks the end of the list',
      control: 'boolean',
    },
    failFirstAttempt: {
      description:
        'The first attempt for every block except the first fails, and the retry succeeds',
      control: 'boolean',
    },
    blockSize: {
      description: 'Rows per server request',
      control: { type: 'range', min: 10, max: 500, step: 10 },
    },
    maxBlocks: {
      description: 'How many blocks the table keeps in memory',
      control: { type: 'range', min: 2, max: 200, step: 1 },
    },
  },
  render: args => <ServerRowModelDemo {...normalizeArgs(args)} />,
  // Снимок — в покое: первое окно пришло.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await until(() => expect(hasRow(canvas, 0)).toBe(true))
    await settle()
  },
}

// --- ADR 0138 S1 ---------------------------------------------------------------------

const JUMP_TOTAL = 300_000
const JUMP_BLOCK = 100
const middleShown = (root: HTMLElement) =>
  bodyRows(root).some(row => {
    const index = Number(row.dataset.index)
    return index > JUMP_TOTAL / 2 - 1000 && index < JUMP_TOTAL / 2 + 1000
  })

/** Пользователь прыгнул в середину, «сервер» держит ответы окна. */
const jump = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => hasRow(root, 0), signal)
  server.hold = true
  scrollTo(root, 0.5)
  await pollUntil(
    () => server.held.length > 0 && skeletonRows(root) > 0,
    signal,
  )
}

const JUMP: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Начало списка', en: 'The start of the list' },
    hint: {
      ru: 'Сервер сообщил, что строк триста тысяч. Полоса прокрутки сразу рассчитана на весь список, а таблица загрузила только строки, которые видны.',
      en: 'The server reported three hundred thousand rows. The scrollbar is sized for the whole list right away, and the table loaded only the rows that are visible.',
    },
    props: serverProps({
      total: JUMP_TOTAL,
      knownTotal: true,
      blockSize: JUMP_BLOCK,
    }),
  },
  {
    title: {
      ru: 'Пользователь прыгнул в середину',
      en: 'The user jumped to the middle',
    },
    hint: {
      ru: 'Таблица попросила у сервера только строки нового места. Пока ответ в пути, на месте строк — скелеты по раскладке колонок.',
      en: 'The table asked the server only for the rows at the new position. While the response is on its way, skeletons matching the column layout stand in for the rows.',
    },
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (middleShown(root) || server.held.length > 0) return
      await jump(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Строки встали на место скелетов, прокрутка не сдвинулась. Строки между началом и серединой таблица не загружала.',
      en: "The rows replaced the skeletons, and the scroll position didn't move. The table didn't load the rows between the start and the middle.",
    },
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && !middleShown(root)) {
        await jump(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(
        () => middleShown(root) && skeletonRows(root) === 0,
        signal,
      )
    }),
  },
]

/** ADR 0138, S1: прыжок ползунком в середину трёхсот тысяч строк — скелеты, затем окно. */
export const ServerRowModelJump: StoryObj<StoryProps> = {
  name: 'Jump to the middle',
  parameters: { scenario: '0138/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Прыжок в середину', en: 'Jumping to the middle' }}
      steps={JUMP}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(JUMP[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(JUMP[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
    })
    await step(JUMP[2]!.title.ru, async () => {
      const top = scroller(canvas)!.scrollTop
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBe(top)
      // Запрошены только начало и блоки у середины.
      await expect(
        server.starts.filter(
          start => start > 0 && Math.abs(start - JUMP_TOTAL / 2) > 1000,
        ),
      ).toEqual([])
      await settle()
    })
  },
}

// --- ADR 0138 S2 ---------------------------------------------------------------------

const ERROR_BLOCK = 50
const ERROR_TOTAL = 1000

/** Пользователь прокрутил ко второму блоку, «сервер» отказал. */
const reachFailure = async (root: HTMLElement, signal: AbortSignal) => {
  server.failed.clear()
  await pollUntil(() => hasRow(root, 0), signal)
  const el = scroller(root)!
  const rowHeight = bodyRows(root)[0]!.getBoundingClientRect().height
  el.scrollTop = (ERROR_BLOCK - 4) * rowHeight
  await pollUntil(() => !!errorRow(root), signal)
}

const BLOCK_ERROR: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Первые строки', en: 'The first rows' },
    hint: {
      ru: 'Таблица загрузила с сервера первый блок строк.',
      en: 'The table loaded the first block of rows from the server.',
    },
    props: serverProps({
      total: ERROR_TOTAL,
      knownTotal: true,
      blockSize: ERROR_BLOCK,
      failBlock: ERROR_BLOCK,
    }),
  },
  {
    title: { ru: 'Сервер отказал в блоке', en: 'The server refused a block' },
    hint: {
      ru: 'Пользователь прокрутил ниже, и сервер не отдал следующий блок. На его месте — строка ошибки с причиной и кнопкой повтора; загруженные строки выше на месте.',
      en: "The user scrolled down, and the server didn't return the next block. In its place is an error row with the reason and a retry button; the loaded rows above stay in place.",
    },
    states: ['body.loadFailed'],
    enter: stepAction(async (root, { signal }) => {
      if (hasRow(root, ERROR_BLOCK)) return
      await reachFailure(root, signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь повторил запрос',
      en: 'The user retried the request',
    },
    hint: {
      ru: 'Повтор запросил у сервера только этот блок. Его строки встали на место, строка ошибки ушла.',
      en: 'The retry asked the server for that block only. Its rows took their places, and the error row is gone.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (!errorRow(root) && !hasRow(root, ERROR_BLOCK)) {
        await reachFailure(root, signal)
      }
      errorRow(root)?.querySelector<HTMLElement>('button')?.click()
      await pollUntil(
        () => hasRow(root, ERROR_BLOCK) && !errorRow(root),
        signal,
      )
    }),
  },
]

/** ADR 0138, S2: сервер отказал в блоке — строка ошибки, повтор догружает блок. */
export const ServerRowModelBlockError: StoryObj<StoryProps> = {
  name: 'Block error',
  parameters: { scenario: '0138/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отказ блока и повтор', en: 'A block refusal and a retry' }}
      steps={BLOCK_ERROR}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(BLOCK_ERROR[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(errorRow(canvas)).toBeNull())
    })
    await step(BLOCK_ERROR[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(errorRow(canvas)).toHaveTextContent(SERVER_FAILURE)
      await expect(hasRow(canvas, ERROR_BLOCK - 1)).toBe(true)
    })
    await step(BLOCK_ERROR[2]!.title.ru, async () => {
      const before = server.starts.length
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(server.starts.slice(before)).toEqual([ERROR_BLOCK])
      await settle()
    })
  },
}

// --- ADR 0138 S3 ---------------------------------------------------------------------

const UNKNOWN_BLOCK = 50
const UNKNOWN_TOTAL = 120
/** Последняя строка второго блока — видна у края, когда блок пришёл. */
const SECOND_LAST = UNKNOWN_BLOCK * 2 - 1

/** Пользователь докрутил до края загруженных строк, «сервер» держит ответ. */
const toEdge = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => hasRow(root, 0), signal)
  server.hold = true
  scrollTo(root, 1)
  await pollUntil(() => server.held.length > 0, signal)
}

const UNKNOWN: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Первый блок', en: 'The first block' },
    hint: {
      ru: 'Сервер не сообщает, сколько строк всего. Таблица показала первый блок, а под ним — ещё один блок скелетов: полоса прокрутки рассчитана только на них.',
      en: "The server doesn't report the total number of rows. The table showed the first block and one more block of skeletons below it: the scrollbar is sized for just those.",
    },
    props: serverProps({
      total: UNKNOWN_TOTAL,
      knownTotal: false,
      blockSize: UNKNOWN_BLOCK,
    }),
  },
  {
    title: {
      ru: 'Пользователь докрутил до скелетов',
      en: 'The user scrolled down to the skeletons',
    },
    hint: {
      ru: 'Таблица попросила следующий блок. Пока он в пути, на его месте — скелеты.',
      en: "The table asked for the next block. While it's on its way, skeletons stand in its place.",
    },
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (hasRow(root, SECOND_LAST) || server.held.length > 0) return
      await toEdge(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Блок встал на место скелетов, прокрутка не сдвинулась. Под ним снова блок скелетов: список вырос, а где он кончается, таблица ещё не знает.',
      en: "The block replaced the skeletons, and the scroll position didn't move. Below it is another block of skeletons: the list grew, but the table doesn't know yet where it ends.",
    },
    enter: stepAction(async (root, { signal }) => {
      if (!hasRow(root, SECOND_LAST) && server.held.length === 0) {
        await toEdge(root, signal)
      }
      release()
      await pollUntil(() => hasRow(root, SECOND_LAST), signal)
    }),
  },
  {
    title: { ru: 'Последний блок короче', en: 'The last block is shorter' },
    hint: {
      ru: 'Пользователь докрутил дальше. Сервер вернул строк меньше, чем в блоке, — таблица поняла, что список кончился: скелетов внизу больше нет, полоса прокрутки перестала расти.',
      en: 'The user scrolled further. The server returned fewer rows than a block holds, so the table knows the list has ended: there are no more skeletons at the bottom, and the scrollbar stopped growing.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (!hasRow(root, SECOND_LAST)) {
        await toEdge(root, signal)
        release()
        await pollUntil(() => hasRow(root, SECOND_LAST), signal)
      }
      server.hold = false
      release()
      await pollUntil(() => {
        if (hasRow(root, UNKNOWN_TOTAL - 1)) return skeletonRows(root) === 0
        scrollTo(root, 1)
        return false
      }, signal)
    }),
  },
]

/** ADR 0138, S3: сервер не знает итога — список растёт по блокам до короткого блока. */
export const ServerRowModelUnknownTotal: StoryObj<StoryProps> = {
  name: 'Unknown total',
  parameters: { scenario: '0138/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Итог неизвестен', en: 'The total is unknown' }}
      steps={UNKNOWN}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNKNOWN[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(skeletonRows(canvas)).toBe(0))
    })
    await step(UNKNOWN[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
    })
    await step(UNKNOWN[2]!.title.ru, async () => {
      const top = scroller(canvas)!.scrollTop
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBe(top)
    })
    await step(UNKNOWN[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(hasRow(canvas, UNKNOWN_TOTAL - 1)).toBe(true)
      await expect(skeletonRows(canvas)).toBe(0)
      await settle()
    })
  },
}

// --- ADR 0138 S4 ---------------------------------------------------------------------

const SORT_TOTAL = 10_000
const SORT_BLOCK = 50
const SORT_FROM = 500

const sortButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="name"] .column-sort__button',
  )
const firstRowId = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__body-row[data-index="0"]')
    ?.dataset.rowId
const sortedFirst = () =>
  sortedSet([{ id: 'name', desc: true }], SORT_TOTAL)[0]!.id
const citySortButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="city"] .column-sort__button',
  )
const nameSort = (root: HTMLElement) =>
  root
    .querySelector('.data-grid__head-cell[data-column-id="name"]')
    ?.getAttribute('aria-sort')
const sortBanner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')

/** Пользователь ушёл далеко от начала списка. */
const browse = async (root: HTMLElement, signal: AbortSignal) => {
  if (hasRow(root, SORT_FROM)) return
  await pollUntil(() => hasRow(root, 0), signal)
  const el = scroller(root)!
  const rowHeight = bodyRows(root)[0]!.getBoundingClientRect().height
  el.scrollTop = SORT_FROM * rowHeight
  await pollUntil(() => hasRow(root, SORT_FROM), signal)
}

/** Пользователь отсортировал по имени; «сервер» держит ответ. */
const sortByName = async (root: HTMLElement, signal: AbortSignal) => {
  await browse(root, signal)
  // Кнопки шапки — из ленивого модуля (ADR 0061).
  await pollUntil(() => !!sortButton(root), signal)
  server.hold = true
  sortButton(root)!.click()
  await pollUntil(
    () =>
      server.held.length > 0 &&
      scroller(root)!.scrollTop === 0 &&
      refreshing(root),
    signal,
  )
}

const SORTING: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Начало списка', en: 'The start of the list' },
    hint: {
      ru: 'Сервер отдаёт строки блоками, таблица показывает начало списка.',
      en: 'The server returns rows in blocks, and the table shows the start of the list.',
    },
    props: serverProps({
      total: SORT_TOTAL,
      knownTotal: true,
      blockSize: SORT_BLOCK,
      sortable: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь листает список',
      en: 'The user scrolls through the list',
    },
    hint: {
      ru: 'Пользователь прокрутил список далеко от начала. Таблица показывает строки, которые сервер прислал для этого места.',
      en: 'The user scrolled the list far from the start. The table shows the rows the server sent for that position.',
    },
    enter: stepAction(async (root, { signal }) => {
      server.refuseSort = undefined
      if (refreshing(root) || firstRowId(root) === sortedFirst()) return
      await browse(root, signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отсортировал по имени',
      en: 'The user sorted by name',
    },
    hint: {
      ru: 'Новый порядок знает только сервер, поэтому таблица попросила у него начало списка в этом порядке и вернулась к началу. Пока ответ в пути, на экране прежние строки в состоянии обновления данных.',
      en: 'Only the server knows the new order, so the table asked it for the start of the list in that order and went back to the start. While the response is on its way, the screen shows the previous rows in the data refresh state.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0) return
      await sortByName(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Строки встали в новом порядке с начала списка, обновление закончилось, кнопка сортировки показывает направление.',
      en: 'The rows appear in the new order from the start of the list, the refresh is over, and the sort button shows the direction.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && firstRowId(root) !== sortedFirst()) {
        await sortByName(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(
        () => firstRowId(root) === sortedFirst() && !refreshing(root),
        signal,
      )
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь отсортировал по другой колонке, сервер не прислал список в новом порядке. Таблица вернула прежний порядок и строки, под шапкой — сообщение с причиной и повтором.',
      en: "The user sorted by another column, and the server didn't send the list in the new order. The table restored the previous order and rows, and below the header there's a message with the reason and a retry.",
    },
    states: ['body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      if (sortBanner(root)) return
      if (firstRowId(root) !== sortedFirst()) {
        if (server.held.length === 0) await sortByName(root, signal)
        server.hold = false
        release()
        await pollUntil(
          () => firstRowId(root) === sortedFirst() && !refreshing(root),
          signal,
        )
      }
      server.refuseSort = 'city'
      citySortButton(root)?.click()
      await pollUntil(
        () =>
          !!sortBanner(root) &&
          !refreshing(root) &&
          nameSort(root) === 'descending',
        signal,
      )
    }),
  },
]

/** ADR 0138, S4: смена сортировки — прежние строки под обновлением, новый порядок с начала. */
export const ServerRowModelSorting: StoryObj<StoryProps> = {
  name: 'Sorting',
  parameters: { scenario: '0138/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Смена сортировки', en: 'Changing the sort' }}
      steps={SORTING}
      reset={() => {
        server.refuseSort = undefined
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SORTING[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(SORTING[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(hasRow(canvas, SORT_FROM)).toBe(true)
    })
    await step(SORTING[2]!.title.ru, async () => {
      const before = server.starts.length
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBe(0)
      await expect(refreshing(canvas)).toBe(true)
      await expect(firstRowId(canvas)).toBe('item-id-0')
      await expect(server.starts.slice(before)).toContain(0)
    })
    await step(SORTING[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(firstRowId(canvas)).toBe(sortedFirst())
      await expect(refreshing(canvas)).toBe(false)
      await settle()
    })
    await step(SORTING[4]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(sortBanner(canvas)).toHaveTextContent(SORT_REFUSAL)
      await expect(
        citySortButton(canvas)?.querySelector('[data-failure-indicator]'),
      ).toBeNull()
      await expect(nameSort(canvas)).toBe('descending')
      await expect(firstRowId(canvas)).toBe(sortedFirst())
      await settle()
    })
  },
}

// --- ADR 0138 S5 ---------------------------------------------------------------------

const RECORD_TOTAL = 300_000
const RECORD_BLOCK = 100
/** Место записи из ссылки: его сообщает сервер. */
const RECORD_INDEX = 114_321
const RECORD_ID = `item-id-${RECORD_INDEX}`

interface RecordApi {
  scrollToRow: (
    rowId: string,
    options?: { index?: number; align?: 'center' },
  ) => Promise<boolean>
  highlight: (target: { row: string }) => unknown
}

/** Таблица для шагов: строку открывает приложение. */
const record = {
  table: null as RecordApi | null,
  opening: null as Promise<boolean> | null,
}

const recordHost: TesseraFeatureEntry = {
  id: 'serverRowModelRecordHost',
  setup: table => {
    record.table = table as unknown as RecordApi
    record.opening = null
    return () => {
      record.table = null
    }
  },
}

const recordRow = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${RECORD_ID}"]`,
  )
const recordHighlighted = (root: HTMLElement) =>
  recordRow(root)?.hasAttribute('data-highlight') === true

/** Приложение просит таблицу открыть запись; «сервер» держит её блок. */
const openRecord = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!record.table && hasRow(root, 0), signal)
  server.hold = true
  record.opening = record.table!.scrollToRow(RECORD_ID, {
    index: RECORD_INDEX,
    align: 'center',
  })
  await pollUntil(
    () => server.held.length > 0 && skeletonRows(root) > 0,
    signal,
  )
}

const OPEN_AT_RECORD: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Таблица открыта в начале',
      en: 'The table is open at the start',
    },
    hint: {
      ru: 'Пользователь пришёл по ссылке на запись далеко в списке. Сервер сообщил приложению, на каком месте списка она стоит, а таблица пока открыта в начале.',
      en: "The user followed a link to a record far down the list. The server told the app the record's position in the list, and the table is still open at the start.",
    },
    props: ({ app, ...context }) => ({
      ...serverProps({
        total: RECORD_TOTAL,
        knownTotal: true,
        blockSize: RECORD_BLOCK,
      })!({ app, ...context }),
      extraPlugins: [serverReset, recordHost],
    }),
  },
  {
    title: {
      ru: 'Приложение открыло место записи',
      en: "The app opened the record's position",
    },
    hint: {
      ru: 'Приложение попросило таблицу показать запись на этом месте. Таблица перешла туда сразу, а пока строки в пути, на их месте — скелеты.',
      en: 'The app asked the table to show the record at that position. The table went there right away, and while the rows are on their way, skeletons stand in their place.',
    },
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (record.opening) return
      await openRecord(root, signal)
    }),
  },
  {
    title: { ru: 'Запись пришла', en: 'The record arrived' },
    hint: {
      ru: 'Сервер прислал строки этого места. Запись стоит посередине таблицы, и приложение подсветило её.',
      en: 'The server sent the rows for that position. The record is in the middle of the table, and the app highlighted it.',
    },
    states: ['body.highlight'],
    enter: stepAction(async (root, { signal }) => {
      if (!record.opening) await openRecord(root, signal)
      server.hold = false
      release()
      const shown = await record.opening!
      signal.throwIfAborted()
      if (shown) record.table?.highlight({ row: RECORD_ID })
      await pollUntil(() => recordHighlighted(root), signal)
    }),
  },
]

/** ADR 0138, S5: приложение открывает список на записи по ссылке. */
export const ServerRowModelOpenAtRecord: StoryObj<StoryProps> = {
  name: 'Open at record',
  parameters: { scenario: '0138/S5', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Открыть на записи', en: 'Open at a record' }}
      steps={OPEN_AT_RECORD}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OPEN_AT_RECORD[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(scroller(canvas)!.scrollTop).toBe(0))
      await until(() => expect(recordRow(canvas)).toBeNull())
    })
    await step(OPEN_AT_RECORD[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBeGreaterThan(0)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
      await expect(recordRow(canvas)).toBeNull()
    })
    await step(OPEN_AT_RECORD[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const row = recordRow(canvas)!.getBoundingClientRect()
      const area = scroller(canvas)!.getBoundingClientRect()
      const head = canvas
        .querySelector('.data-grid__head')!
        .getBoundingClientRect()
      // Посередине области строк — между шапкой и низом области прокрутки.
      await expect(
        Math.abs((row.top + row.bottom) / 2 - (head.bottom + area.bottom) / 2),
      ).toBeLessThan(row.height)
      await expect(recordHighlighted(canvas)).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0142 S1 ---------------------------------------------------------------------

const MILLION = 1_000_000
const MILLION_LAST = MILLION - 1
const WHEEL_NOTCH = 100
const WHEEL_NOTCHES = 3
const atEnd = (root: HTMLElement) =>
  layerOf(root).top() >= layerOf(root).maxTop() - 1
/** Верх строки относительно области прокрутки. */
const rowTop = (root: HTMLElement, index: number) => {
  const row = root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="item-id-${index}"]`,
  )
  return row
    ? row.getBoundingClientRect().top -
        scroller(root)!.getBoundingClientRect().top
    : undefined
}
const lastRowCell = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="item-id-${MILLION_LAST}"] [data-kn-cell]`,
  )
const activeRowIndex = (root: HTMLElement) =>
  Number(
    root
      .querySelector<HTMLElement>('[data-kn-cell][data-kn-active="true"]')
      ?.closest<HTMLElement>('.data-grid__body-row')?.dataset.index,
  )

/** Пользователь протянул ползунок в самый низ. */
const dragToEnd = async (root: HTMLElement, signal: AbortSignal) => {
  // Последний шаг может вернуть ползунок в конец после подъёма колесом.
  await pollUntil(() => bodyRows(root).length > 0, signal)
  scrollTo(root, 1)
  await pollUntil(() => atEnd(root) && hasRow(root, MILLION_LAST), signal)
}

/** Пользователь крутит колесо вверх: щелчки мыши подряд. */
const wheelUp = async (root: HTMLElement, signal: AbortSignal) => {
  await nextFrame()
  const target = layerOf(root).maxTop() - WHEEL_NOTCH * WHEEL_NOTCHES
  for (let notch = 0; notch < WHEEL_NOTCHES; notch++) {
    scroller(root)!.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -WHEEL_NOTCH,
        bubbles: true,
        cancelable: true,
      }),
    )
  }
  await pollUntil(() => Math.abs(layerOf(root).top() - target) < 1, signal)
}

const MILLION_ROWS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Миллион строк', en: 'A million rows' },
    hint: {
      ru: 'Сервер сообщил, что строк миллион — это выше, чем браузер умеет прокручивать. Таблица сжала полосу прокрутки: ползунок по-прежнему отмеряет весь список, видны первые строки.',
      en: 'The server reported a million rows, which is more than the browser can scroll. The table compressed the scrollbar: the thumb still measures the whole list, and the first rows are visible.',
    },
    props: ({ app, ...context }) => ({
      ...serverProps({
        total: MILLION,
        knownTotal: true,
        blockSize: JUMP_BLOCK,
      })!({ app, ...context }),
      enableKeyboardNavigation: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь протянул ползунок в конец',
      en: 'The user dragged the thumb to the end',
    },
    hint: {
      ru: 'Таблица запросила у сервера последние строки и показала их: внизу — миллионная строка. Шапка осталась у верха таблицы.',
      en: 'The table requested the last rows from the server and showed them: the millionth row is at the bottom. The header stayed at the top of the table.',
    },
    enter: stepAction(async (root, { signal }) => {
      await dragToEnd(root, signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь прокрутил колесом вверх',
      en: 'The user scrolled up with the wheel',
    },
    hint: {
      ru: 'Три щелчка колеса плавно сдвинули строки ровно настолько, насколько и в коротком списке: сжатая полоса прокрутки на шаг колеса не влияет.',
      en: "Three wheel clicks smoothly moved the rows exactly as far as in a short list: the compressed scrollbar doesn't affect the wheel step.",
    },
    enter: stepAction(async (root, { signal }) => {
      if (!atEnd(root)) await dragToEnd(root, signal)
      await wheelUp(root, signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь перешёл к началу клавишами',
      en: 'The user went to the start with the keyboard',
    },
    keyboard: true,
    hint: {
      ru: 'Пользователь выбрал ячейку последней строки, нажал Ctrl+Home и стрелку вниз. Активная ячейка перешла в первую строку, и таблица вернулась к началу списка: клавиши проходят его целиком.',
      en: 'The user selected a cell in the last row, then pressed Ctrl+Home and the down arrow. The active cell moved to the first row, and the table returned to the start of the list: the keys cover the whole list.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (!hasRow(root, MILLION_LAST)) await dragToEnd(root, signal)
      await nextFrame()
      const cell = lastRowCell(root)!
      cell.focus({ preventScroll: true })
      press(cell, 'Home', mod())
      await nextFrame()
      // Ctrl+Home ведёт в шапку, стрелка вниз — в первую строку (ADR 0021).
      press(document.activeElement as HTMLElement, 'ArrowDown')
      // Координаты Firefox в растянутой области — с точностью до пикселя (ADR 0142).
      await pollUntil(
        () => activeRowIndex(root) === 0 && layerOf(root).top() < 1,
        signal,
      )
    }),
  },
]

/** ADR 0142, S1: миллион строк — ползунком в конец, затем колесом и клавишами. */
export const ServerRowModelMillionRows: StoryObj<StoryProps> = {
  name: 'Million rows',
  parameters: { scenario: '0142/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Миллион строк', en: 'A million rows' }}
      steps={MILLION_ROWS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MILLION_ROWS[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(MILLION_ROWS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(hasRow(canvas, MILLION_LAST)).toBe(true)
    })
    await step(MILLION_ROWS[2]!.title.ru, async () => {
      const watched = MILLION_LAST - 2
      const before = rowTop(canvas, watched)!
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(rowTop(canvas, watched)! - before).toBeCloseTo(
          WHEEL_NOTCH * WHEEL_NOTCHES,
          0,
        ),
      )
    })
    await step(MILLION_ROWS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(activeRowIndex(canvas)).toBe(0)
      await settle()
    })
  },
}

// --- ADR 0228 S1 ---------------------------------------------------------------------

const NARROW_QUERY = 'Paris'
/** Строка города: каждая пятая в наборе «сервера» — вторая в найденном списке. */
const NARROW_KEPT = 'item-id-5'
const narrowField = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('input[data-testid="quick-search"]')
const rowIndexOf = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)
    ?.dataset.index
const narrowed = (root: HTMLElement) =>
  rowIndexOf(root, NARROW_KEPT) === '1' && !refreshing(root)

/** Пользователь ищет город; «сервер» держит ответ. */
const searchCity = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!narrowField(root) && hasRow(root, 0), signal)
  server.hold = true
  const field = narrowField(root)!
  field.focus()
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!
  setValue.call(field, NARROW_QUERY)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  await pollUntil(() => server.held.length > 0 && refreshing(root), signal)
}

const SEARCH_MOTION: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Начало списка', en: 'The start of the list' },
    hint: {
      ru: 'Сервер отдаёт строки блоками, таблица показывает начало списка.',
      en: 'The server returns rows in blocks, and the table shows the start of the list.',
    },
    props: searchProps,
  },
  {
    title: {
      ru: 'Пользователь ищет город',
      en: 'The user searches for a city',
    },
    hint: {
      ru: 'Поиск выполняет сервер, поэтому таблица попросила у него новое начало списка. Пока ответ в пути, на экране прежние строки в состоянии обновления данных.',
      en: 'The server runs the search, so the table asked it for a new start of the list. While the response is on its way, the screen shows the previous rows in the data refresh state.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0 || narrowed(root)) return
      await searchCity(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Строки этого города, которые уже были на экране, подтянулись к своим новым местам, остальные погасли. Строки, которых на экране не было, проявились на своих местах.',
      en: "The rows of this city that were already on screen moved up to their new places, and the others faded out. The rows that weren't on screen faded in at their places.",
    },
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && !narrowed(root)) {
        await searchCity(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(() => narrowed(root), signal)
    }),
  },
]

/** ADR 0228, S1: поиск сужает список — оставшиеся строки подтягиваются, прочие гаснут. */
export const ServerRowModelSearchMotion: StoryObj<StoryProps> = {
  name: 'Search narrows the list',
  parameters: { scenario: '0228/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Поиск сужает список',
        en: 'Search narrows the list',
      }}
      steps={SEARCH_MOTION}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SEARCH_MOTION[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(SEARCH_MOTION[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(narrowField(canvas)!.value).toBe(NARROW_QUERY)
      await expect(rowIndexOf(canvas, NARROW_KEPT)).toBe('5')
    })
    await step(SEARCH_MOTION[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(rowIndexOf(canvas, NARROW_KEPT)).toBe('1')
      await expect(hasRow(canvas, 1)).toBe(false)
      await settle()
    })
  },
}

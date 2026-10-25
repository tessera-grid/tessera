import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import type { ServerRowsRequest, ServerRowsResponse } from '../plugins'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { type FilteringItem, filteringColumns } from './__mocks__/filteringData'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import {
  SERVER_FAILURE,
  ServerRowModelDemo,
  type ServerRowModelDemoProps,
  serverAnswer,
} from './demos/serverRowModelDemos'

/**
 * Серверная модель строк (ADR 0138): `Playground` — триста тысяч строк с «сервера» в покое,
 * объём, итог, отказы и размер блока — контролами; S1 — прыжок в середину, S2 — отказ
 * блока и повтор, S3 — итог неизвестен.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model',
} satisfies Meta<StoryProps>

export default meta

const layout = { containerHeight: '600', height: '480', maxHeight: '480' }

const bodyRows = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>('.data-grid__body-row[data-row-id]'),
]
const skeletonRows = (root: HTMLElement) =>
  root.querySelectorAll('[data-pending-row]').length
const scroller = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__container')
const errorRow = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="rows-load-error"]')
const hasRow = (root: HTMLElement, index: number) =>
  !!root.querySelector(`.data-grid__body-row[data-row-id="item-id-${index}"]`)

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
      dataCount: 'строки подаёт «сервер» демо',
      columnCount: 'колонки задаёт демо',
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
      description: 'Время ответа «сервера», мс',
      control: { type: 'range', min: 0, max: 3000, step: 100 },
    },
    serverTotal: {
      description: 'Строк на «сервере»',
      control: 'select',
      options: [1000, 100_000, 300_000, 1_000_000],
    },
    knownTotal: {
      description:
        'Сервер сообщает итог; иначе конец списка — блок короче обычного',
      control: 'boolean',
    },
    failFirstAttempt: {
      description:
        'Первая попытка каждого блока, кроме первого, падает, повтор проходит',
      control: 'boolean',
    },
    blockSize: {
      description: 'Строк в одном запросе к серверу',
      control: { type: 'range', min: 10, max: 500, step: 10 },
    },
    maxBlocks: {
      description: 'Сколько блоков таблица держит в памяти',
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

// --- «Сервер» гайдов ------------------------------------------------------------------

const SERVER_DELAY_MS = 500

/** Запросы, которые «сервер» получил, и ответы, которые он держит до шага гайда. */
const server = {
  table: undefined as unknown,
  hold: false,
  held: [] as (() => void)[],
  failed: new Set<number>(),
  starts: [] as number[],
}

/** Отдать ответы, которые «сервер» держал. */
const release = () => {
  const held = server.held
  server.held = []
  for (const answer of held) answer()
}

/** Новое открытие таблицы — новый кэш: прежние ответы ей не принадлежат. */
const serverReset: TesseraFeatureEntry = {
  id: 'serverRowModelGuideReset',
  setup: table => {
    // `setup` повторяется при смене аргументов плагинов, а обёртка таблицы новая на каждом
    // рендере: новое открытие узнаётся по хранилищу состояния.
    const store = (table as { store: unknown }).store
    if (server.table === store) return
    server.table = store
    // Окно таблицы просит строки раньше этого `setup`: удержанный запрос новой таблицы
    // отдаётся, ответы прежней она не примет.
    server.hold = false
    release()
    server.starts = []
  },
}

type ServerMode = {
  total: number
  knownTotal: boolean
  blockSize: number
  /** Начало блока, чья первая попытка падает. */
  failBlock?: number
}

const serverProps =
  ({
    total,
    knownTotal,
    blockSize,
    failBlock,
  }: ServerMode): GuideStoryStep['props'] =>
  () => ({
    columnsOverride: filteringColumns,
    dataOverride: [],
    enableServerRowModel: true,
    serverRowModelBlockSize: blockSize,
    serverRowModelRowCount: knownTotal ? total : undefined,
    serverRowModelGetRows: ({ start, end, signal }: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<FilteringItem>>((resolve, reject) => {
        server.starts.push(start)
        const answer = () => {
          if (signal.aborted) return
          if (start === failBlock && !server.failed.has(start)) {
            server.failed.add(start)
            return reject(new Error(SERVER_FAILURE))
          }
          resolve(serverAnswer({ start, end }, total, knownTotal))
        }
        if (server.hold) server.held.push(answer)
        else setTimeout(answer, SERVER_DELAY_MS)
      }),
    extraPlugins: [serverReset],
  })

/** Пользователь ставит прокрутку на долю высоты списка. */
const scrollTo = (root: HTMLElement, fraction: number) => {
  const el = scroller(root)!
  el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction
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

const JUMP: readonly GuideStoryStep[] = [
  {
    title: 'Начало списка',
    hint: 'Сервер сообщил, что строк триста тысяч. Полоса прокрутки сразу рассчитана на весь список, а таблица загрузила только строки, которые видны.',
    props: serverProps({
      total: JUMP_TOTAL,
      knownTotal: true,
      blockSize: JUMP_BLOCK,
    }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь прыгнул в середину',
    hint: 'Таблица попросила у сервера только строки нового места. Пока ответ в пути, на месте строк — скелеты по раскладке колонок.',
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (middleShown(root) || server.held.length > 0) return
      await jump(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Строки встали на место скелетов, прокрутка не сдвинулась. Строки между началом и серединой таблица не загружала.',
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
    <GuideStory
      title="Прыжок в середину"
      steps={JUMP}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(JUMP[0]!.title, async () => {
      await stepDone(canvas)
    })
    await step(JUMP[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
    })
    await step(JUMP[2]!.title, async () => {
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

const BLOCK_ERROR: readonly GuideStoryStep[] = [
  {
    title: 'Первые строки',
    hint: 'Таблица загрузила с сервера первый блок строк.',
    props: serverProps({
      total: ERROR_TOTAL,
      knownTotal: true,
      blockSize: ERROR_BLOCK,
      failBlock: ERROR_BLOCK,
    }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
    }),
  },
  {
    title: 'Сервер отказал в блоке',
    hint: 'Пользователь прокрутил ниже, и сервер не отдал следующий блок. На его месте — строка ошибки с причиной и кнопкой повтора; загруженные строки выше на месте.',
    states: ['body.loadFailed'],
    enter: stepAction(async (root, { signal }) => {
      if (hasRow(root, ERROR_BLOCK)) return
      await reachFailure(root, signal)
    }),
  },
  {
    title: 'Пользователь повторил запрос',
    hint: 'Повтор запросил у сервера только этот блок. Его строки встали на место, строка ошибки ушла.',
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
    <GuideStory
      title="Отказ блока и повтор"
      steps={BLOCK_ERROR}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(BLOCK_ERROR[0]!.title, async () => {
      await stepDone(canvas)
      await expect(errorRow(canvas)).toBeNull()
    })
    await step(BLOCK_ERROR[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(errorRow(canvas)).toHaveTextContent(SERVER_FAILURE)
      await expect(hasRow(canvas, ERROR_BLOCK - 1)).toBe(true)
    })
    await step(BLOCK_ERROR[2]!.title, async () => {
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

const UNKNOWN: readonly GuideStoryStep[] = [
  {
    title: 'Первый блок',
    hint: 'Сервер не сообщает, сколько строк всего. Таблица показала первый блок, а под ним — ещё один блок скелетов: полоса прокрутки рассчитана только на них.',
    props: serverProps({
      total: UNKNOWN_TOTAL,
      knownTotal: false,
      blockSize: UNKNOWN_BLOCK,
    }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь докрутил до скелетов',
    hint: 'Таблица попросила следующий блок. Пока он в пути, на его месте — скелеты.',
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (hasRow(root, SECOND_LAST) || server.held.length > 0) return
      await toEdge(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Блок встал на место скелетов, прокрутка не сдвинулась. Под ним снова блок скелетов: список вырос, а где он кончается, таблица ещё не знает.',
    enter: stepAction(async (root, { signal }) => {
      if (!hasRow(root, SECOND_LAST) && server.held.length === 0) {
        await toEdge(root, signal)
      }
      release()
      await pollUntil(() => hasRow(root, SECOND_LAST), signal)
    }),
  },
  {
    title: 'Последний блок короче',
    hint: 'Пользователь докрутил дальше. Сервер вернул строк меньше, чем в блоке, — таблица поняла, что список кончился: скелетов внизу больше нет, полоса прокрутки перестала расти.',
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
    <GuideStory
      title="Итог неизвестен"
      steps={UNKNOWN}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNKNOWN[0]!.title, async () => {
      await stepDone(canvas)
      await expect(skeletonRows(canvas)).toBe(0)
    })
    await step(UNKNOWN[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
    })
    await step(UNKNOWN[2]!.title, async () => {
      const top = scroller(canvas)!.scrollTop
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBe(top)
    })
    await step(UNKNOWN[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(hasRow(canvas, UNKNOWN_TOTAL - 1)).toBe(true)
      await expect(skeletonRows(canvas)).toBe(0)
      await settle()
    })
  },
}

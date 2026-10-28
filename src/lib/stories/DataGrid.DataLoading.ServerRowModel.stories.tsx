import { Meta, StoryObj } from '@storybook/react'
import { expect, spyOn } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import { scrollLayer } from '../core/scrollStretch'
import type {
  ExportRequest,
  ServerRowsRequest,
  ServerRowsResponse,
} from '../plugins'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  consoleText,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import {
  type FilteringItem,
  filteringColumns,
  filteringItemAt,
} from './__mocks__/filteringData'
import {
  clickByMouse,
  copyFrom,
  dragCells,
  isSelected,
  pressCell,
  untilDone,
} from './__mocks__/cellGestures'
import { storyLabels } from './__mocks__/storyLabels'
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
 * блока и повтор, S3 — итог неизвестен, S4 — смена сортировки, S5 — открыть на записи,
 * S6 — выбрать всё, кроме нескольких строк, и выгрузить; S7 — вложенные строки с сервера;
 * ADR 0139, S1 — правка ячейки, сервер возвращает сохранённую строку; ADR 0142, S1 —
 * миллион строк: ползунком в конец, колесом и клавишами; ADR 0146, S1–S4 — диапазон через
 * незагруженные строки, копирование с догрузкой, сверх предела и отказ сервера.
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
  /** Строки, чьих вложенных строк просили. */
  parents: [] as string[],
  /** Колонка, сортировку по которой «сервер» отклоняет. */
  refuseSort: undefined as string | undefined,
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
    server.parents = []
    server.refuseSort = undefined
  },
}

type ServerMode = {
  total: number
  knownTotal: boolean
  blockSize: number
  /** Начало блока, чья первая попытка падает. */
  failBlock?: number
  /** Сортировку по колонке считает «сервер». */
  sortable?: boolean
  /** Выделение ячеек и клавиатура (ADR 0146). */
  selection?: boolean
}

/** Весь набор «сервера» в порядке сортировки; один расчёт на порядок. */
const sortedSets = new Map<string, FilteringItem[]>()
const sortedSet = (sorting: ServerRowsRequest['sorting'], total: number) => {
  const key = `${total}:${JSON.stringify(sorting)}`
  let set = sortedSets.get(key)
  if (!set) {
    set = Array.from({ length: total }, (_, i) => filteringItemAt(i))
    const [sort] = sorting
    if (sort) {
      const id = sort.id as keyof FilteringItem
      set.sort((a, b) => {
        const order = String(a[id]).localeCompare(String(b[id]), undefined, {
          numeric: true,
        })
        return sort.desc ? -order : order
      })
    }
    sortedSets.set(key, set)
  }
  return set
}

const serverProps =
  ({
    total,
    knownTotal,
    blockSize,
    failBlock,
    sortable,
    selection,
  }: ServerMode): GuideStoryStep['props'] =>
  () => ({
    columnsOverride: filteringColumns,
    dataOverride: [],
    enableServerRowModel: true,
    serverRowModelBlockSize: blockSize,
    serverRowModelRowCount: knownTotal ? total : undefined,
    ...(sortable && {
      enableColumnSorting: true,
      columnSortingMultiSort: false,
    }),
    ...(selection && {
      enableCellSelection: true,
      enableKeyboardNavigation: true,
    }),
    serverRowModelGetRows: ({
      start,
      end,
      sorting,
      signal,
    }: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<FilteringItem>>((resolve, reject) => {
        server.starts.push(start)
        const answer = () => {
          if (signal.aborted) return
          if (start === failBlock && !server.failed.has(start)) {
            server.failed.add(start)
            return reject(new Error(SERVER_FAILURE))
          }
          if (
            sortable &&
            server.refuseSort !== undefined &&
            sorting[0]?.id === server.refuseSort
          ) {
            return reject(new Error(SORT_REFUSAL))
          }
          if (sortable) {
            resolve({
              rows: sortedSet(sorting, total).slice(start, end),
              rowCount: total,
            })
            return
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

// --- ADR 0138 S4 ---------------------------------------------------------------------

const SORT_TOTAL = 10_000
const SORT_BLOCK = 50
const SORT_FROM = 500

const sortButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="name"] .column-sort__button',
  )
const refreshing = (root: HTMLElement) =>
  !!root.querySelector('.data-grid-theme[data-refreshing]')
const firstRowId = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__body-row[data-index="0"]')
    ?.dataset.rowId
const sortedFirst = () =>
  sortedSet([{ id: 'name', desc: true }], SORT_TOTAL)[0]!.id
const SORT_REFUSAL = 'The server could not sort the list'
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
const sortFailed = (button: HTMLElement | null) =>
  button
    ?.querySelector('[data-failure-indicator]')
    ?.getAttribute('data-shown') === 'true'

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

const SORTING: readonly GuideStoryStep[] = [
  {
    title: 'Пользователь листает список',
    hint: 'Пользователь прокрутил список далеко от начала. Таблица показывает строки, которые сервер прислал для этого места.',
    props: serverProps({
      total: SORT_TOTAL,
      knownTotal: true,
      blockSize: SORT_BLOCK,
      sortable: true,
    }),
    enter: stepAction(async (root, { signal }) => {
      server.refuseSort = undefined
      if (refreshing(root) || firstRowId(root) === sortedFirst()) return
      await browse(root, signal)
    }),
  },
  {
    title: 'Пользователь отсортировал по имени',
    hint: 'Новый порядок знает только сервер, поэтому таблица попросила у него начало списка в этом порядке и вернулась к началу. Пока ответ в пути, на экране прежние строки в состоянии обновления данных, а кнопка сортировки ждёт.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0) return
      await sortByName(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Строки встали в новом порядке с начала списка, обновление закончилось, кнопка сортировки показывает направление.',
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
    title: 'Сервер отказал',
    hint: 'Пользователь отсортировал по другой колонке, сервер не прислал список в новом порядке. Таблица вернула прежний порядок и строки, кнопка сортировки отмечена отказом, под шапкой — сообщение с причиной и повтором.',
    states: ['body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      if (sortFailed(citySortButton(root))) return
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
          sortFailed(citySortButton(root)) &&
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
    <GuideStory
      title="Смена сортировки"
      steps={SORTING}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SORTING[0]!.title, async () => {
      await stepDone(canvas)
      await expect(hasRow(canvas, SORT_FROM)).toBe(true)
    })
    await step(SORTING[1]!.title, async () => {
      const before = server.starts.length
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBe(0)
      await expect(refreshing(canvas)).toBe(true)
      await expect(sortButton(canvas)).toHaveAttribute('aria-busy', 'true')
      await expect(firstRowId(canvas)).toBe('item-id-0')
      await expect(server.starts.slice(before)).toContain(0)
    })
    await step(SORTING[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(firstRowId(canvas)).toBe(sortedFirst())
      await expect(refreshing(canvas)).toBe(false)
      await expect(sortButton(canvas)).not.toHaveAttribute('aria-busy')
      await settle()
    })
    await step(SORTING[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(sortBanner(canvas)).toHaveTextContent(SORT_REFUSAL)
      await expect(sortFailed(citySortButton(canvas))).toBe(true)
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

const OPEN_AT_RECORD: readonly GuideStoryStep[] = [
  {
    title: 'Таблица открыта в начале',
    hint: 'Пользователь пришёл по ссылке на запись далеко в списке. Сервер сообщил приложению, на каком месте списка она стоит, а таблица пока открыта в начале.',
    props: ({ app, ...context }) => ({
      ...serverProps({
        total: RECORD_TOTAL,
        knownTotal: true,
        blockSize: RECORD_BLOCK,
      })!({ app, ...context }),
      extraPlugins: [serverReset, recordHost],
    }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
    }),
  },
  {
    title: 'Приложение открыло место записи',
    hint: 'Приложение попросило таблицу показать запись на этом месте. Таблица перешла туда сразу, а пока строки в пути, на их месте — скелеты.',
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (record.opening) return
      await openRecord(root, signal)
    }),
  },
  {
    title: 'Запись пришла',
    hint: 'Сервер прислал строки этого места. Запись стоит посередине таблицы, и приложение подсветило её.',
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
    <GuideStory
      title="Открыть на записи"
      steps={OPEN_AT_RECORD}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OPEN_AT_RECORD[0]!.title, async () => {
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBe(0)
      await expect(recordRow(canvas)).toBeNull()
    })
    await step(OPEN_AT_RECORD[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scroller(canvas)!.scrollTop).toBeGreaterThan(0)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
      await expect(recordRow(canvas)).toBeNull()
    })
    await step(OPEN_AT_RECORD[2]!.title, async () => {
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

// --- ADR 0138 S6 ---------------------------------------------------------------------

const SELECT_TOTAL = 10_000
const SELECT_BLOCK = 50
/** Строки, с которых пользователь снимает выбор. */
const UNCHECKED = [1, 3]

/** Запрос серверной выгрузки и его завершение — у «сервера» гайда. */
const selectExport = {
  request: undefined as ExportRequest | undefined,
  finish: undefined as (() => void) | undefined,
}

const exportReset: TesseraFeatureEntry = {
  id: 'serverRowModelExportReset',
  setup: () => {
    selectExport.request = undefined
    selectExport.finish?.()
    selectExport.finish = undefined
  },
}

const rowCheckbox = (root: HTMLElement, index: number) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"] .row-select-checkbox`,
  )
const headCheckbox = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__head-cell .row-select-checkbox')
const isChecked = (element: Element | null) =>
  !!element?.hasAttribute('data-checked')
const exportButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="export-button"]')
const selectedCount = (root: HTMLElement) =>
  root
    .querySelector('[data-testid="selected-rows-count"]')
    ?.textContent?.trim() ?? ''

/** Пользователь выбирает весь список флажком в шапке. */
const selectAll = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!rowCheckbox(root, 0), signal)
  if (!isChecked(rowCheckbox(root, 0))) headCheckbox(root)!.click()
  await pollUntil(() => isChecked(rowCheckbox(root, 0)), signal)
}

/** Пользователь снимает флажки нескольких строк. */
const uncheckSome = async (root: HTMLElement, signal: AbortSignal) => {
  await selectAll(root, signal)
  for (const index of UNCHECKED) {
    if (isChecked(rowCheckbox(root, index))) rowCheckbox(root, index)!.click()
    await pollUntil(() => !isChecked(rowCheckbox(root, index)), signal)
  }
}

const SELECT_ALL_EXCEPT: readonly GuideStoryStep[] = [
  {
    title: 'Список с флажками',
    hint: 'Сервер отдаёт строки блоками, у каждой строки — флажок выбора. Пока ничего не выбрано.',
    props: ({ app, ...context }) => ({
      ...serverProps({
        total: SELECT_TOTAL,
        knownTotal: true,
        blockSize: SELECT_BLOCK,
      })!({ app, ...context }),
      enableRowSelection: true,
      rowSelectionSelectedCount: true,
      enableDataExport: true,
      dataExportServer: true,
      // Одна комбинация: кнопка выгружает выбранное сразу, без панели.
      dataExportAllow: { rows: ['selected'], columns: ['visible'] },
      onExport: (request: ExportRequest) =>
        new Promise<void>(resolve => {
          selectExport.request = request
          selectExport.finish = resolve
        }),
      extraPlugins: [serverReset, exportReset],
    }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowCheckbox(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь выбрал всё',
    hint: 'Флажок в шапке выбрал весь список — десять тысяч строк, хотя загружена лишь малая их часть. Нижняя панель считает весь итог, новых запросов к серверу нет.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectAll(root, signal)
    }),
  },
  {
    title: 'Пользователь снял две строки',
    hint: 'Снятые строки стали исключениями: остальные по-прежнему выбраны, флажок в шапке показывает частичный выбор, счётчик уменьшился на две.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await uncheckSome(root, signal)
    }),
  },
  {
    title: 'Пользователь выгрузил выбранное',
    hint: 'Файл собирает сервер: приложение получило запрос «все строки, кроме двух снятых» вместе с текущей выборкой. Пока сервер готовит файл, кнопка выгрузки ждёт.',
    enter: stepAction(async (root, { signal }) => {
      await uncheckSome(root, signal)
      await pollUntil(() => !!exportButton(root), signal)
      if (!selectExport.request) exportButton(root)!.click()
      await pollUntil(
        () =>
          !!selectExport.request &&
          exportButton(root)!.getAttribute('aria-busy') === 'true',
        signal,
      )
    }),
  },
]

/** ADR 0138, S6: пользователь выбирает всё, кроме нескольких строк, и выгружает выбранное. */
export const ServerRowModelSelectAllExcept: StoryObj<StoryProps> = {
  name: 'Select all except',
  parameters: { scenario: '0138/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбрать всё, кроме"
      steps={SELECT_ALL_EXCEPT}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(SELECT_ALL_EXCEPT[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isChecked(rowCheckbox(canvas, 0))).toBe(false)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(SELECT_ALL_EXCEPT[1]!.title, async () => {
      const before = server.starts.length
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isChecked(headCheckbox(canvas))).toBe(true)
      await expect(isChecked(rowCheckbox(canvas, 2))).toBe(true)
      await until(() =>
        expect(selectedCount(canvas)).toBe(labels.selectedRows(SELECT_TOTAL)),
      )
      await expect(server.starts.length).toBe(before)
    })
    await step(SELECT_ALL_EXCEPT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(headCheckbox(canvas)).toHaveAttribute('data-indeterminate')
      for (const index of UNCHECKED) {
        await expect(isChecked(rowCheckbox(canvas, index))).toBe(false)
      }
      await expect(isChecked(rowCheckbox(canvas, 2))).toBe(true)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          labels.selectedRows(SELECT_TOTAL - UNCHECKED.length),
        ),
      )
    })
    await step(SELECT_ALL_EXCEPT[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectExport.request?.selection).toEqual({
        all: true,
        except: UNCHECKED.map(index => `item-id-${index}`),
      })
      await expect(selectExport.request?.query).toEqual({
        sorting: [],
        columnFilters: [],
        globalFilter: '',
        grouping: [],
        aggregations: {},
      })
      await expect(exportButton(canvas)).toHaveAttribute('aria-busy', 'true')
    })
  },
}

// --- ADR 0138 S7 ---------------------------------------------------------------------

const TREE_TOTAL = 1000
const TREE_BLOCK = 50
const TREE_CHILDREN = 4
const TREE_PARENT = 'item-id-1'

const toggleOf = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"] .row-expand-button`,
  )
const childShown = (root: HTMLElement) =>
  !!root.querySelector(`.data-grid__body-row[data-row-id="${TREE_PARENT}.0"]`)
const childRequests = () => server.parents.filter(id => id === TREE_PARENT)

/** Пользователь раскрыл строку, «сервер» держит ответ с вложенными строками. */
const expandParent = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!toggleOf(root, TREE_PARENT), signal)
  server.hold = true
  if (toggleOf(root, TREE_PARENT)!.getAttribute('aria-expanded') !== 'true') {
    toggleOf(root, TREE_PARENT)!.click()
  }
  await pollUntil(
    () => server.held.length > 0 && skeletonRows(root) > 0,
    signal,
  )
}

const treeProps: GuideStoryStep['props'] = () => ({
  columnsOverride: filteringColumns,
  dataOverride: [],
  enableServerRowModel: true,
  serverRowModelBlockSize: TREE_BLOCK,
  serverRowModelRowCount: TREE_TOTAL,
  enableRowExpanding: true,
  rowExpandingHasChildren: (row: { depth: number }) => row.depth === 0,
  serverRowModelGetRows: ({
    start,
    end,
    parentId,
    signal,
  }: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<FilteringItem>>(resolve => {
      server.starts.push(start)
      if (parentId) server.parents.push(parentId)
      const answer = () => {
        if (signal.aborted) return
        if (!parentId) {
          resolve(serverAnswer({ start, end }, TREE_TOTAL, true))
          return
        }
        // Вложенные строки — свои записи «сервера» с id родителя в начале.
        const first = TREE_TOTAL + Number(parentId.split('-').at(-1)) * 100
        resolve({
          rows: Array.from(
            { length: Math.max(0, Math.min(end, TREE_CHILDREN) - start) },
            (_, k) => ({
              ...filteringItemAt(first + start + k),
              id: `${parentId}.${start + k}`,
            }),
          ),
          rowCount: TREE_CHILDREN,
        })
      }
      if (server.hold && parentId) server.held.push(answer)
      else setTimeout(answer, SERVER_DELAY_MS)
    }),
  extraPlugins: [serverReset],
})

const LAZY_CHILDREN: readonly GuideStoryStep[] = [
  {
    title: 'Строки со вложенными записями',
    hint: 'Сервер отдаёт верхний уровень списка блоками. У строк со вложенными записями — кнопка раскрытия; самих вложенных строк таблица ещё не загружала.',
    props: treeProps,
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!toggleOf(root, TREE_PARENT), signal)
    }),
  },
  {
    title: 'Пользователь раскрыл строку',
    hint: 'Таблица попросила у сервера вложенные строки только этой строки. Пока ответ в пути, под ней — блок строк-скелетов.',
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (childShown(root) || server.held.length > 0) return
      await expandParent(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Вложенные строки встали под родителем с отступом уровня. Их столько, сколько сообщил сервер, — строки ниже подтянулись вплотную.',
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && !childShown(root)) {
        await expandParent(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(
        () => childShown(root) && skeletonRows(root) === 0,
        signal,
      )
    }),
  },
]

/** ADR 0138, S7: пользователь раскрывает строку, вложенные строки приходят с сервера. */
export const ServerRowModelLazyChildren: StoryObj<StoryProps> = {
  name: 'Lazy children',
  parameters: { scenario: '0138/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title="Вложенные строки с сервера"
      steps={LAZY_CHILDREN}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LAZY_CHILDREN[0]!.title, async () => {
      await stepDone(canvas)
      await expect(childRequests()).toEqual([])
    })
    await step(LAZY_CHILDREN[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(childRequests()).toHaveLength(1)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
      await expect(childShown(canvas)).toBe(false)
    })
    await step(LAZY_CHILDREN[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const rows = bodyRows(canvas)
      const parent = rows.findIndex(row => row.dataset.rowId === TREE_PARENT)
      await expect(
        rows
          .slice(parent + 1, parent + 1 + TREE_CHILDREN)
          .map(row => row.dataset.rowId),
      ).toEqual(
        Array.from({ length: TREE_CHILDREN }, (_, k) => `${TREE_PARENT}.${k}`),
      )
      await expect(rows[parent + 1 + TREE_CHILDREN]?.dataset.rowId).toBe(
        'item-id-2',
      )
      await settle()
    })
  },
}

// --- ADR 0139 S1 ---------------------------------------------------------------------

const EDIT_TOTAL = 1000
const EDIT_BLOCK = 50
const EDIT_ROW = 'item-id-1'
const TYPED_AGE = '33.6'
const SAVED_AGE = '34'

/** Сохранение на «сервере» ждёт шага гайда. */
const edit = { save: undefined as (() => void) | undefined }

const ageCellOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${EDIT_ROW}"] .data-grid__body-cell[data-column-id="age"]`,
  )
const ageInput = (root: ParentNode) =>
  ageCellOf(root)?.querySelector<HTMLInputElement>('input') ?? null
const ageEditButton = (root: ParentNode) =>
  ageCellOf(root)?.querySelector<HTMLElement>('.cell__button button') ?? null
/** Значение в ячейке — без кнопки правки. */
const ageText = (root: ParentNode) => {
  const copy = ageCellOf(root)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}
const agePending = (root: ParentNode) =>
  ageEditButton(root)?.getAttribute('aria-busy') === 'true'

/** Набрать значение в поле — как ввод с клавиатуры. */
const typeAge = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Пользователь открывает правку возраста, набирает число и сохраняет клавишей Enter. */
const saveAge = (root: HTMLElement) => {
  const input = ageInput(root)
  if (!input) ageEditButton(root)?.click()
  else if (input.value !== TYPED_AGE) typeAge(input, TYPED_AGE)
  else
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
}

const editProps: GuideStoryStep['props'] = context => ({
  ...serverProps({
    total: EDIT_TOTAL,
    knownTotal: true,
    blockSize: EDIT_BLOCK,
  })!(context),
  enableCellEditing: true,
  // «Сервер» округляет возраст до целого и отдаёт сохранённую строку.
  onCellEdit: ({ rowId, value }: { rowId: string; value: string }) =>
    new Promise<FilteringItem>(resolve => {
      edit.save = () =>
        resolve({
          ...filteringItemAt(Number(rowId.split('-').at(-1))),
          age: Math.round(Number(value)),
        })
    }),
})

const EDIT_CELL: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Сервер отдаёт строки блоками, данные строк держит таблица. Возраст можно править: у ячеек колонки при наведении появляется кнопка правки.',
    props: editProps,
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!ageCellOf(root), signal)
    }),
  },
  {
    title: 'Пользователь сохранил правку',
    hint: 'Пользователь поправил возраст и сохранил. Пока сервер отвечает, кнопка правки ждёт, а в ячейке — введённое значение.',
    states: ['body.pending'],
    enter: untilDone(agePending, saveAge),
  },
  {
    title: 'Сервер сохранил запись',
    hint: 'Сервер сохранил запись и вернул её: возраст округлён до целого. Таблица показывает сохранённое значение, ячейка коротко вспыхнула.',
    immediate: true,
    enter: untilDone(
      root => ageText(root) === SAVED_AGE && !agePending(root),
      root => (agePending(root) ? edit.save?.() : saveAge(root)),
    ),
  },
]

/** ADR 0139, S1: пользователь правит число, сервер возвращает сохранённую строку. */
export const ServerRowModelEditCell: StoryObj<StoryProps> = {
  name: 'Edit a cell',
  parameters: { scenario: '0139/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Правка на сервере"
      steps={EDIT_CELL}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_CELL[0]!.title, async () => {
      await stepDone(canvas)
      await expect(ageText(canvas)).toBe('25')
    })
    // Шаги правки идут таймером до своего состояния — ждём само состояние.
    await step(EDIT_CELL[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(agePending(canvas)).toBe(true))
      await expect(ageText(canvas)).toBe(TYPED_AGE)
    })
    await step(EDIT_CELL[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(ageText(canvas)).toBe(SAVED_AGE))
      await settle()
    })
  },
}

// --- ADR 0142 S1 ---------------------------------------------------------------------

const MILLION = 1_000_000
const MILLION_LAST = MILLION - 1
const WHEEL_NOTCH = 100
const WHEEL_NOTCHES = 3

const layerOf = (root: HTMLElement) => scrollLayer(scroller(root)!)
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
  await pollUntil(() => hasRow(root, 0), signal)
  scrollTo(root, 1)
  await pollUntil(() => atEnd(root) && hasRow(root, MILLION_LAST), signal)
}

/** Ввод пользователя — после кадра: действие шага стартует внутри эффекта React. */
const nextFrame = () => new Promise(requestAnimationFrame)

/** Нажатие клавиши на элементе с фокусом — как ввод пользователя. */
const press = (
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  )

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

const MILLION_ROWS: readonly GuideStoryStep[] = [
  {
    title: 'Миллион строк',
    hint: 'Сервер сообщил, что строк миллион — это выше, чем браузер умеет прокручивать. Таблица сжала полосу прокрутки: ползунок по-прежнему отмеряет весь список, видны первые строки.',
    props: ({ app, ...context }) => ({
      ...serverProps({
        total: MILLION,
        knownTotal: true,
        blockSize: JUMP_BLOCK,
      })!({ app, ...context }),
      enableKeyboardNavigation: true,
    }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
      if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
      await pollUntil(() => hasRow(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь протянул ползунок в конец',
    hint: 'Таблица запросила у сервера последние строки и показала их: внизу — миллионная строка. Шапка осталась у верха таблицы.',
    enter: stepAction(async (root, { signal }) => {
      await dragToEnd(root, signal)
    }),
  },
  {
    title: 'Пользователь прокрутил колесом вверх',
    hint: 'Три щелчка колеса плавно сдвинули строки ровно настолько, насколько и в коротком списке: сжатая полоса прокрутки на шаг колеса не влияет.',
    enter: stepAction(async (root, { signal }) => {
      if (!atEnd(root)) await dragToEnd(root, signal)
      await wheelUp(root, signal)
    }),
  },
  {
    title: 'Пользователь перешёл к началу клавишами',
    hint: 'Пользователь выбрал ячейку последней строки, нажал Ctrl+Home и стрелку вниз. Активная ячейка перешла в первую строку, и таблица вернулась к началу списка: клавиши проходят его целиком.',
    enter: stepAction(async (root, { signal }) => {
      if (!hasRow(root, MILLION_LAST)) await dragToEnd(root, signal)
      await nextFrame()
      const cell = lastRowCell(root)!
      cell.focus({ preventScroll: true })
      press(cell, 'Home', { ctrlKey: true })
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
    <GuideStory
      title="Миллион строк"
      steps={MILLION_ROWS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MILLION_ROWS[0]!.title, async () => {
      await stepDone(canvas)
      await expect(hasRow(canvas, 0)).toBe(true)
    })
    await step(MILLION_ROWS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(hasRow(canvas, MILLION_LAST)).toBe(true)
    })
    await step(MILLION_ROWS[2]!.title, async () => {
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
    await step(MILLION_ROWS[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(activeRowIndex(canvas)).toBe(0)
      await settle()
    })
  },
}

// --- ADR 0144: серверная группировка -------------------------------------------------

const GROUP_TOTAL = 100_000
const GROUP_BLOCK = 50
const GROUP_REFUSAL = 'Server error: grouping is not available'

/** Колонки группировки: сумма визитов и средний возраст — агрегаты сервера. */
const groupingColumns = filteringColumns.map(column =>
  column.id === 'visits'
    ? { ...column, aggregationFn: 'sum' as const }
    : column.id === 'age'
      ? { ...column, aggregationFn: 'mean' as const }
      : column,
) as typeof filteringColumns

/** Строка-группа «сервера»: значение группы, агрегаты и число строк в ней. */
interface GroupItem extends FilteringItem {
  count?: number
}

let groupItems: FilteringItem[] | undefined
const allGroupItems = () =>
  (groupItems ??= Array.from({ length: GROUP_TOTAL }, (_, i) =>
    filteringItemAt(i),
  ))

/** Строки выборки «сервера»: поиск по имени и городу, путь групп. */
const groupSelections = new Map<string, FilteringItem[]>()
const groupSelectionOf = ({
  globalFilter,
  grouping,
  groupKeys,
}: ServerRowsRequest) => {
  const key = JSON.stringify([globalFilter, grouping, groupKeys])
  let items = groupSelections.get(key)
  if (!items) {
    const query = globalFilter.trim().toLowerCase()
    items = allGroupItems().filter(
      item =>
        (!query ||
          item.name.toLowerCase().includes(query) ||
          item.city.toLowerCase().includes(query)) &&
        groupKeys.every(
          (value, level) =>
            item[grouping[level] as keyof FilteringItem] === value,
        ),
    )
    groupSelections.set(key, items)
  }
  return items
}

/** Агрегаты «сервера»: сумма визитов и средний возраст среди известных. */
const aggregate = (items: readonly FilteringItem[]) => {
  let visits = 0
  let ages = 0
  let known = 0
  for (const item of items) {
    visits += item.visits
    if (item.age !== null) {
      ages += item.age
      known++
    }
  }
  return { visits, age: known ? Math.round(ages / known) : null }
}

/** Ответ «сервера» с группировкой: группы уровня или строки данных, итоги у корня. */
const groupAnswer = (
  request: ServerRowsRequest,
): ServerRowsResponse<GroupItem> => {
  const items = groupSelectionOf(request)
  const level = request.groupKeys.length
  let rows: GroupItem[] = items
  if (level < request.grouping.length) {
    const column = request.grouping[level] as keyof FilteringItem
    const groups = new Map<unknown, FilteringItem[]>()
    for (const item of items) {
      const members = groups.get(item[column])
      if (members) members.push(item)
      else groups.set(item[column], [item])
    }
    rows = [...groups]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([value, members]) => ({
        id: '',
        name: '',
        city: column === 'city' ? (value as string) : '',
        vip: column === 'vip' ? (value as boolean | null) : null,
        ...aggregate(members),
        count: members.length,
      }))
  }
  return {
    rows: rows.slice(request.start, request.end),
    rowCount: rows.length,
    ...(level === 0 && {
      totals: aggregate(items),
      leafCount: items.length,
    }),
  }
}

const groupServer = { refuse: false }

const groupProps =
  ({
    grouping = [],
    search = false,
    counts = true,
  }: {
    grouping?: string[]
    search?: boolean
    /** Сервер присылает число строк групп. */
    counts?: boolean
  }): GuideStoryStep['props'] =>
  () => ({
    columnsOverride: groupingColumns,
    dataOverride: [],
    enableServerRowModel: true,
    serverRowModelBlockSize: GROUP_BLOCK,
    serverRowModelGetGroupChildCount: counts
      ? (row: GroupItem) => row.count
      : undefined,
    enableRowGrouping: true,
    rowGroupingInitialGrouping: grouping,
    enableRowExpanding: true,
    enableFooter: true,
    ...(search && { enableQuickSearch: true }),
    serverRowModelGetRows: (request: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<GroupItem>>((resolve, reject) => {
        server.starts.push(request.start)
        if (request.parentId) server.parents.push(request.parentId)
        const answer = () => {
          if (request.signal.aborted) return
          if (groupServer.refuse && request.grouping.length > 0) {
            reject(new Error(GROUP_REFUSAL))
            return
          }
          resolve(groupAnswer(request))
        }
        if (server.hold) server.held.push(answer)
        else setTimeout(answer, SERVER_DELAY_MS)
      }),
    extraPlugins: [serverReset],
  })

const groupButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="city"] .column-group__button',
  )
const groupRows = (root: HTMLElement) =>
  bodyRows(root).filter(row => row.dataset.groupRow === 'true')
const groupRowOf = (root: HTMLElement, city: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id='group:${JSON.stringify([city])}']`,
  )
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
    title: 'Пользователь открыл список',
    hint: 'Сервер отдаёт сто тысяч строк блоками. Таблица держит только те, что рядом с экраном.',
    props: groupProps({}),
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = false
      await pollUntil(() => hasRow(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь сгруппировал по городу',
    hint: 'Группы по всем строкам знает только сервер, поэтому таблица попросила у него группы и вернулась к началу. Пока ответ в пути, на экране прежние строки в состоянии обновления данных, а кнопка группировки ждёт.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0 || groupRows(root).length > 0) return
      await groupByCity(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Каждая строка — город: рядом с названием число строк в нём, в колонках визитов и возраста — сумма и среднее, которые посчитал сервер.',
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
      title="Группировка на сервере"
      steps={GROUP_BY}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_BY[0]!.title, async () => {
      await stepDone(canvas)
      await expect(groupRows(canvas)).toHaveLength(0)
    })
    await step(GROUP_BY[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(groupButton(canvas)).toHaveAttribute('aria-busy', 'true')
    })
    await step(GROUP_BY[2]!.title, async () => {
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
    title: 'Список сгруппирован по городу',
    hint: 'Каждая строка — город с числом строк и агрегатами. Самих строк городов таблица ещё не загружала.',
    props: groupProps({ grouping: ['city'] }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!groupRowOf(root, 'Paris'), signal)
    }),
  },
  {
    title: 'Пользователь раскрыл город',
    hint: 'Таблица попросила у сервера строки только этого города. Число строк в нём уже известно, поэтому скелеты заняли всю высоту группы, и полоса прокрутки не прыгнет, когда строки придут.',
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (parisRowsShown(root) || server.held.length > 0) return
      await expandParis(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Строки города встали под ним с отступом уровня. Остальные приходят блоками по мере прокрутки, как у списка без группировки.',
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
      title="Строки группы с сервера"
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
    await step(EXPAND_GROUP[0]!.title, async () => {
      await stepDone(canvas)
      await expect(parisRequests()).toEqual([])
    })
    await step(EXPAND_GROUP[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(parisRequests()).toHaveLength(1)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
      // Скелеты — на все строки группы: пять городов, двадцать тысяч строк и шапка.
      await expect(
        canvas.querySelector('[aria-rowcount]')?.getAttribute('aria-rowcount'),
      ).toBe(String(5 + parisCount() + 1))
    })
    await step(EXPAND_GROUP[2]!.title, async () => {
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
const parisItems = () => allGroupItems().filter(item => item.city === 'Paris')
const parisCount = () => parisItems().length
const parisTotals = () => aggregate(parisItems())
/** Число строк группы рядом с её названием: «Paris (20,000)» в любой локали чисел. */
const PARIS_COUNT = /^Paris \(20\D?000\)$/
const cellText = (row: HTMLElement, columnId: string) =>
  row.querySelector(`[data-column-id="${columnId}"]`)?.textContent ?? ''

const TOTALS: readonly GuideStoryStep[] = [
  {
    title: 'Итог в футере',
    hint: 'Под списком — итог по всем ста тысячам строк: сумма визитов и средний возраст. Его посчитал сервер, загружены лишь строки рядом с экраном.',
    props: groupProps({ search: true }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => footerOf(root, 'visits') === allVisits(), signal)
    }),
  },
  {
    title: 'Пользователь ищет город',
    hint: 'Поиск выполняет сервер, поэтому таблица попросила у него новое начало списка вместе с новым итогом. Пока ответ в пути, на экране прежние строки и прежний итог в состоянии обновления данных.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0 || footerOf(root, 'visits') !== allVisits()) {
        return
      }
      await searchParis(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'В списке только строки этого города, а итог в футере посчитан по ним — по всей найденной выборке, а не по загруженным строкам.',
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
      title="Итог списка с сервера"
      steps={TOTALS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TOTALS[0]!.title, async () => {
      await stepDone(canvas)
      await expect(footerOf(canvas, 'visits')).toBe(allVisits())
    })
    await step(TOTALS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(searchField(canvas)!.value).toBe(TOTALS_QUERY)
      await expect(footerOf(canvas, 'visits')).toBe(allVisits())
    })
    await step(TOTALS[2]!.title, async () => {
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
    title: 'Пользователь открыл список',
    hint: 'Сервер отдаёт строки списка блоками, группировки нет.',
    props: groupProps({}),
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = true
      await pollUntil(() => hasRow(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь сгруппировал по городу',
    hint: 'Таблица попросила у сервера группы. Пока ответ в пути, на экране прежние строки в состоянии обновления данных, а кнопка группировки ждёт.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = true
      if (server.held.length > 0 || failureShown(root)) return
      await groupByCity(root, signal)
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Сервер не смог сгруппировать список. Таблица вернулась к прежнему виду без группировки, а плашка над строками называет причину и предлагает повторить.',
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
      title="Отказ в группировке"
      steps={GROUPING_REFUSED}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUPING_REFUSED[0]!.title, async () => {
      await stepDone(canvas)
      await expect(groupRows(canvas)).toHaveLength(0)
    })
    await step(GROUPING_REFUSED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(groupButton(canvas)).toHaveAttribute('aria-busy', 'true')
    })
    await step(GROUPING_REFUSED[2]!.title, async () => {
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

// --- ADR 0146: выделение и копирование ----------------------------------------------

const SELECTION_BLOCK = 100
const SMALL_TOTAL = 2000
const RANGE_TOTAL = 100_000
const LIMIT_TOTAL = 50_000
const RANGE_PAGES = 3
/** Мелкие блоки: три экрана вниз — уже за загруженными строками. */
const RANGE_BLOCK = 10
/** Блок середины списка: окно его не просит, первая попытка копирования падает. */
const REFUSED_BLOCK = 1000

/** Ячейка тела по месту строки в списке и колонке. */
const cellAt = (root: HTMLElement, index: number, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const selectedCellCount = (root: HTMLElement) =>
  root.querySelectorAll('[data-cell-selected="true"]').length
/** Выделенные ячейки незагруженных строк — скелеты внутри диапазона. */
const selectedPending = (root: HTMLElement) =>
  root.querySelectorAll('[data-pending-row] [data-cell-selected="true"]').length
const banner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')

/** Пользователь щёлкнул ячейку первой строки. */
const pressFirstCell = async (root: HTMLElement, signal: AbortSignal) => {
  if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
  await pollUntil(() => !!cellAt(root, 0, 'name'), signal)
  await nextFrame()
  pressCell(cellAt(root, 0, 'name')!)
  await pollUntil(() => isSelected(cellAt(root, 0, 'name')), signal)
}

/**
 * Пользователь выделил всё: щёлкнул первую ячейку, прокрутил в конец и щёлкнул последнюю
 * с Shift. Мышью — шаг идёт и в окне без фокуса, где клавиши до таблицы не доходят.
 */
const selectToEnd = async (
  root: HTMLElement,
  signal: AbortSignal,
  total = SMALL_TOTAL,
) => {
  await pressFirstCell(root, signal)
  scrollTo(root, 1)
  await pollUntil(() => !!cellAt(root, total - 1, 'visits'), signal)
  await nextFrame()
  pressCell(cellAt(root, total - 1, 'visits')!, { shiftKey: true })
  await pollUntil(() => isSelected(cellAt(root, total - 1, 'visits')), signal)
}

/** Копирование с клавиатуры — событие `copy` от строки тела, как Ctrl+C. */
const copyNow = (root: HTMLElement) => copyFrom(bodyRows(root)[0]!)

/**
 * Записи в буфер обмена — в тестах каталога: окно тестов писать в буфер не вправе, запись
 * подменяется, текст и таблица сохраняются для проверки.
 */
const clipboardWrites = () => {
  const written: { text: string; html?: string }[] = []
  spyOn(navigator.clipboard, 'write').mockImplementation(async items => {
    for (const item of items) {
      const text = await (await item.getType('text/plain')).text()
      const html = item.types.includes('text/html')
        ? await (await item.getType('text/html')).text()
        : undefined
      written.push({ text, html })
    }
  })
  spyOn(navigator.clipboard, 'writeText').mockImplementation(async text => {
    written.push({ text })
  })
  return written
}

const RANGE_SELECTION: readonly GuideStoryStep[] = [
  {
    title: 'Ячейка выделена',
    hint: 'Пользователь щёлкнул ячейку в начале списка. Она выделена и стала активной.',
    props: serverProps({
      total: RANGE_TOTAL,
      knownTotal: true,
      blockSize: RANGE_BLOCK,
      selection: true,
    }),
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      await pressFirstCell(root, signal)
    }),
  },
  {
    title: 'Диапазон протяжкой',
    hint: 'Пользователь протянул выделение мышью на три строки и три колонки. Диапазон залит, у него общий контур, начальная ячейка не залита.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
      await pollUntil(() => !!cellAt(root, 2, 'age'), signal)
      await nextFrame()
      dragCells(cellAt(root, 0, 'name')!, cellAt(root, 2, 'age')!)
      await pollUntil(() => selectedCellCount(root) === 9, signal)
    }),
  },
  {
    title: 'Диапазон на экраны вниз',
    hint: 'Пользователь трижды нажал Shift+PageDown. Диапазон вырос на три экрана, и таблица прокрутилась к его краю. Строки, которые теперь на экране, ещё в пути с сервера: их скелеты внутри диапазона залиты так же.',
    states: ['body.skeleton', 'body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (selectedPending(root) > 0) return
      if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
      await pollUntil(() => !!cellAt(root, 2, 'age'), signal)
      await nextFrame()
      if (selectedCellCount(root) !== 9) {
        dragCells(cellAt(root, 0, 'name')!, cellAt(root, 2, 'age')!)
      }
      server.hold = true
      cellAt(root, 0, 'name')!.focus({ preventScroll: true })
      for (let page = 0; page < RANGE_PAGES; page++) {
        press(document.activeElement as HTMLElement, 'PageDown', {
          shiftKey: true,
        })
      }
      await pollUntil(() => selectedPending(root) > 0, signal)
    }),
  },
  {
    title: 'Строки пришли',
    hint: 'Сервер ответил: строки встали на место скелетов, диапазон остался прежним.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      await pollUntil(
        () => skeletonRows(root) === 0 && selectedCellCount(root) > 9,
        signal,
      )
    }),
  },
]

/** ADR 0146, S1: диапазон мышью и клавишами через незагруженные строки. */
export const ServerRangeSelection: StoryObj<StoryProps> = {
  name: 'Select a range',
  parameters: { scenario: '0146/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Диапазон через незагруженные строки"
      steps={RANGE_SELECTION}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RANGE_SELECTION[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, 0, 'name'))).toBe(true)
    })
    await step(RANGE_SELECTION[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectedCellCount(canvas)).toBe(9)
      // Начальная ячейка — активная, без заливки.
      await expect(
        cellAt(canvas, 0, 'name')!.getAttribute('data-cell-focused'),
      ).toBe('true')
    })
    await step(RANGE_SELECTION[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
      await expect(selectedPending(canvas)).toBeGreaterThan(0)
    })
    await step(RANGE_SELECTION[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(skeletonRows(canvas)).toBe(0)
      await expect(selectedCellCount(canvas)).toBeGreaterThan(9)
      await settle()
    })
  },
}

/** Выделена вся таблица; копирование ещё не начато — догрузка ждёт ответа. */
const copyHeld = async (root: HTMLElement, signal: AbortSignal) => {
  if (!hasRow(root, SMALL_TOTAL - 1)) await selectToEnd(root, signal)
  server.hold = true
  copyNow(root)
  await pollUntil(() => server.held.length > 0, signal)
}

const COPY_LOADS: readonly GuideStoryStep[] = [
  {
    title: 'Выделена вся таблица',
    hint: 'Пользователь щёлкнул первую ячейку, прокрутил таблицу в конец и щёлкнул последнюю ячейку с зажатым Shift. Выделено всё, а загружены только строки начала и конца списка.',
    states: ['body.cellRange'],
    props: serverProps({
      total: SMALL_TOTAL,
      knownTotal: true,
      blockSize: SELECTION_BLOCK,
      selection: true,
    }),
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      await selectToEnd(root, signal)
    }),
  },
  {
    title: 'Копирование ждёт строк',
    hint: 'Пользователь нажал Ctrl+C. Таблица запросила у сервера строки выделения, которых у неё нет, и ждёт ответа. В консоли — запись о начале копирования.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0) return
      await copyHeld(root, signal)
    }),
  },
  {
    title: 'Выделение скопировано',
    hint: 'Сервер ответил. В буфер попали все две тысячи строк — таблицей и текстом через табуляцию, а в консоли появилась запись об успешном копировании.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0) await copyHeld(root, signal)
      server.hold = false
      release()
      await pollUntil(() => consoleText().includes('copyResolved'), signal)
    }),
  },
]

/** ADR 0146, S2: копирование диапазона с незагруженными строками — догрузка и буфер. */
export const ServerCopyLoadsRows: StoryObj<StoryProps> = {
  name: 'Copy loads the rows',
  parameters: { scenario: '0146/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Копирование с догрузкой"
      steps={COPY_LOADS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const written = clipboardWrites()
    await step(COPY_LOADS[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, SMALL_TOTAL - 1, 'visits'))).toBe(
        true,
      )
      // Загружены только начало и конец списка.
      await expect(
        server.starts.filter(start => start > 0 && start < SMALL_TOTAL - 100),
      ).toEqual([])
    })
    await step(COPY_LOADS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(server.held.length).toBeGreaterThan(0)
      await expect(consoleText()).toContain('copy')
      await expect(written).toEqual([])
    })
    await step(COPY_LOADS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(written).toHaveLength(1))
      await expect(written[0]!.text.split('\n')).toHaveLength(SMALL_TOTAL)
      await expect(written[0]!.text).toContain('\t')
      await expect(written[0]!.html).toContain('<table')
      await expect(consoleText()).toContain('copyResolved')
      await settle()
    })
  },
}

/** Пользователь выделил всю таблицу мышью. */
const selectAllCells = (root: HTMLElement, signal: AbortSignal) =>
  selectToEnd(root, signal, LIMIT_TOTAL)

const COPY_OVER_LIMIT: readonly GuideStoryStep[] = [
  {
    title: 'Выделена вся таблица',
    hint: 'Пользователь щёлкнул первую ячейку, прокрутил таблицу в конец и щёлкнул последнюю ячейку с зажатым Shift. Выделены все пятьдесят тысяч строк.',
    states: ['body.cellRange'],
    props: serverProps({
      total: LIMIT_TOTAL,
      knownTotal: true,
      blockSize: SELECTION_BLOCK,
      selection: true,
    }),
    enter: stepAction(async (root, { signal }) => {
      await selectAllCells(root, signal)
    }),
  },
  {
    title: 'Строк слишком много',
    hint: 'Пользователь нажал Ctrl+C. Строк больше, чем таблица кладёт в буфер, поэтому копирование не выполнено, а сервер запросов не получил. Плашка над таблицей называет предел и советует выгрузку.',
    states: ['body.cellRange', 'body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      if (banner(root)) return
      if (selectedCellCount(root) <= 1) await selectAllCells(root, signal)
      copyNow(root)
      await pollUntil(() => !!banner(root), signal)
    }),
  },
]

/** ADR 0146, S3: копирование больше предела строк — отказ с подсказкой о выгрузке. */
export const ServerCopyOverLimit: StoryObj<StoryProps> = {
  name: 'Copy over the limit',
  parameters: { scenario: '0146/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Копирование больше предела"
      steps={COPY_OVER_LIMIT}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(COPY_OVER_LIMIT[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, LIMIT_TOTAL - 1, 'visits'))).toBe(
        true,
      )
    })
    await step(COPY_OVER_LIMIT[1]!.title, async () => {
      const asked = server.starts.length
      await guideNext(canvas)
      await stepDone(canvas)
      const text = banner(canvas)!.textContent
      await expect(text).toContain(labels.serverActionFailedCopy)
      await expect(text).toContain(labels.copyTooManyRows(LIMIT_TOTAL, 10_000))
      await expect(server.starts.length).toBe(asked)
      await settle()
    })
  },
}

/** Копирование отказало: блок середины не пришёл. */
const copyRefused = async (root: HTMLElement, signal: AbortSignal) => {
  server.failed.clear()
  if (!hasRow(root, SMALL_TOTAL - 1)) await selectToEnd(root, signal)
  copyNow(root)
  await pollUntil(() => !!banner(root), signal)
}

const COPY_REFUSED: readonly GuideStoryStep[] = [
  {
    title: 'Выделена вся таблица',
    hint: 'Пользователь щёлкнул первую ячейку, прокрутил таблицу в конец и щёлкнул последнюю ячейку с зажатым Shift. Выделено всё, а загружены только строки начала и конца списка.',
    states: ['body.cellRange'],
    props: serverProps({
      total: SMALL_TOTAL,
      knownTotal: true,
      blockSize: SELECTION_BLOCK,
      failBlock: REFUSED_BLOCK,
      selection: true,
    }),
    enter: stepAction(async (root, { signal }) => {
      server.failed.clear()
      await selectToEnd(root, signal)
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь нажал Ctrl+C, а сервер не отдал часть недостающих строк. Буфер не изменился, плашка над таблицей называет причину и предлагает повторить.',
    states: ['body.cellRange', 'body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      if (banner(root)) return
      await copyRefused(root, signal)
    }),
  },
  {
    title: 'Повтор удался',
    hint: 'Пользователь нажал кнопку повтора на плашке. Сервер ответил, выделение скопировано, плашка закрылась, а в консоли появилась запись об успешном копировании.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (!banner(root)) {
        if (consoleText().includes('copyResolved')) return
        await copyRefused(root, signal)
      }
      clickByMouse(
        root.querySelector<HTMLElement>('[data-testid="load-error-retry"]')!,
      )
      await pollUntil(
        () => !banner(root) && consoleText().includes('copyResolved'),
        signal,
      )
    }),
  },
]

/** ADR 0146, S4: сервер отказал при догрузке строк для копирования — плашка и повтор. */
export const ServerCopyRefused: StoryObj<StoryProps> = {
  name: 'Copy refused by the server',
  parameters: { scenario: '0146/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказ сервера при копировании"
      steps={COPY_REFUSED}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const written = clipboardWrites()
    await step(COPY_REFUSED[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, SMALL_TOTAL - 1, 'visits'))).toBe(
        true,
      )
    })
    await step(COPY_REFUSED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const text = banner(canvas)!.textContent
      await expect(text).toContain(labels.serverActionFailedCopy)
      await expect(text).toContain(SERVER_FAILURE)
      await expect(written).toEqual([])
    })
    await step(COPY_REFUSED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(banner(canvas)).toBeNull()
      await until(() => expect(written).toHaveLength(1))
      await expect(written[0]!.text.split('\n')).toHaveLength(SMALL_TOTAL)
      await expect(consoleText()).toContain('copyResolved')
      await settle()
    })
  },
}

// --- ADR 0148: выбор группы целиком ------------------------------------------------

/** Группировка по городу с флажками выбора; `counts` — сервер присылает число строк групп. */
const groupSelectProps =
  ({ counts = true, exported = false } = {}): GuideStoryStep['props'] =>
  context => ({
    ...groupProps({ grouping: ['city'], counts })!(context),
    enableFooter: false,
    enableRowSelection: true,
    rowSelectionSelectedCount: true,
    ...(exported && {
      enableDataExport: true,
      dataExportServer: true,
      // Одна комбинация: кнопка выгружает выбранное сразу, без панели.
      dataExportAllow: { rows: ['selected'], columns: ['visible'] },
      onExport: (request: ExportRequest) =>
        new Promise<void>(resolve => {
          selectExport.request = request
          selectExport.finish = resolve
        }),
    }),
    extraPlugins: [serverReset, exportReset],
  })

const groupCheckbox = (root: HTMLElement, city: string) =>
  groupRowOf(root, city)?.querySelector<HTMLElement>('.row-select-checkbox') ??
  null
const isPartial = (element: Element | null) =>
  !!element?.hasAttribute('data-indeterminate')
/** Первая строка данных на экране — строка единственной раскрытой группы. */
const firstDataRow = (root: HTMLElement) =>
  bodyRows(root).find(
    row =>
      row.dataset.groupRow !== 'true' &&
      !!row.dataset.rowId &&
      !row.dataset.rowId.startsWith('group:'),
  )
const dataRowCheckbox = (root: HTMLElement) =>
  firstDataRow(root)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null

/** Пользователь отметил флажок города. */
const selectCity = async (
  root: HTMLElement,
  signal: AbortSignal,
  city = 'Paris',
) => {
  await pollUntil(() => !!groupCheckbox(root, city), signal)
  if (!isChecked(groupCheckbox(root, city))) groupCheckbox(root, city)!.click()
  await pollUntil(() => isChecked(groupCheckbox(root, city)), signal)
}

/** Пользователь раскрыл город и дождался его строк. */
const openCity = async (
  root: HTMLElement,
  signal: AbortSignal,
  city: string,
) => {
  await pollUntil(() => !!groupRowOf(root, city), signal)
  const toggle = groupRowOf(root, city)!.querySelector<HTMLElement>(
    '.row-expand-button',
  )!
  if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
  await pollUntil(() => !!dataRowCheckbox(root), signal)
}

/** Пользователь снял флажок первой строки раскрытого города. */
const uncheckFirstRow = async (root: HTMLElement, signal: AbortSignal) => {
  await selectCity(root, signal)
  await openCity(root, signal, 'Paris')
  if (isChecked(dataRowCheckbox(root))) dataRowCheckbox(root)!.click()
  await pollUntil(() => isPartial(groupCheckbox(root, 'Paris')), signal)
}

const GROUP_SELECTION: readonly GuideStoryStep[] = [
  {
    title: 'Список сгруппирован по городу',
    hint: 'Каждая строка — город с числом строк в нём. Самих строк городов таблица не загружала, у каждого города — свой флажок.',
    props: groupSelectProps({ exported: true }),
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = false
      await pollUntil(() => !!groupCheckbox(root, 'Paris'), signal)
    }),
  },
  {
    title: 'Пользователь выбрал город',
    hint: 'Флажок города выбрал все его строки, хотя ни одна не загружена: запросов к серверу не было. Нижняя панель считает строки города по числу, которое прислал сервер.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectCity(root, signal)
    }),
  },
  {
    title: 'Пользователь снял одну строку',
    hint: 'Строки города пришли уже выбранными. Снятая строка стала исключением внутри города, поэтому флажок города показывает частичный выбор, а счётчик уменьшился на одну.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await uncheckFirstRow(root, signal)
    }),
  },
  {
    title: 'Пользователь выгрузил выбранное',
    hint: 'Файл собирает сервер: приложение получило запрос «весь город, кроме одной строки» вместе с текущей выборкой. Пока сервер готовит файл, кнопка выгрузки ждёт.',
    enter: stepAction(async (root, { signal }) => {
      await uncheckFirstRow(root, signal)
      await pollUntil(() => !!exportButton(root), signal)
      if (!selectExport.request) exportButton(root)!.click()
      await pollUntil(
        () =>
          !!selectExport.request &&
          exportButton(root)!.getAttribute('aria-busy') === 'true',
        signal,
      )
    }),
  },
]

/** ADR 0148, S1: выбрать город целиком, снять одну строку и выгрузить выбранное. */
export const ServerGroupSelection: StoryObj<StoryProps> = {
  name: 'Select a group',
  parameters: { scenario: '0148/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор группы целиком"
      steps={GROUP_SELECTION}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const paris = parisItems().length
    await step(GROUP_SELECTION[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isChecked(groupCheckbox(canvas, 'Paris'))).toBe(false)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(GROUP_SELECTION[1]!.title, async () => {
      const parents = server.parents.length
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isChecked(groupCheckbox(canvas, 'Paris'))).toBe(true)
      await until(() =>
        expect(selectedCount(canvas)).toBe(labels.selectedRows(paris)),
      )
      await expect(server.parents.length).toBe(parents)
    })
    await step(GROUP_SELECTION[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isPartial(groupCheckbox(canvas, 'Paris'))).toBe(true)
      await expect(isChecked(dataRowCheckbox(canvas))).toBe(false)
      await until(() =>
        expect(selectedCount(canvas)).toBe(labels.selectedRows(paris - 1)),
      )
    })
    await step(GROUP_SELECTION[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectExport.request?.selection).toEqual({
        all: false,
        except: [],
        groups: [
          {
            keys: ['Paris'],
            all: true,
            except: [firstDataRow(canvas)!.dataset.rowId],
          },
        ],
      })
      await expect(selectExport.request?.query?.grouping).toEqual(['city'])
      await expect(exportButton(canvas)).toHaveAttribute('aria-busy', 'true')
    })
  },
}

/** Пользователь снял группировку по городу и дождался ответа. */
const ungroup = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!groupButton(root), signal)
  if (groupRows(root).length > 0) groupButton(root)!.click()
  await pollUntil(
    () => groupRows(root).length === 0 && hasRow(root, 0) && !refreshing(root),
    signal,
  )
}

const GROUP_SELECT_RESET: readonly GuideStoryStep[] = [
  {
    title: 'Список сгруппирован по городу',
    hint: 'Каждая строка — город с числом строк в нём и своим флажком. Пока ничего не выбрано.',
    props: groupSelectProps(),
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = false
      await pollUntil(() => !!groupCheckbox(root, 'Paris'), signal)
    }),
  },
  {
    title: 'Пользователь выбрал город',
    hint: 'Флажок города выбрал все его строки, а нижняя панель их посчитала.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectCity(root, signal)
    }),
  },
  {
    title: 'Пользователь убрал группировку',
    hint: 'Без группировки городов в списке нет, и выбор, сделанный по городам, потерял смысл — таблица его сняла. Сервер прислал строки без групп, ни одна не выбрана.',
    enter: stepAction(async (root, { signal }) => {
      await ungroup(root, signal)
    }),
  },
]

/** ADR 0148, S2: смена группировки снимает выбор. */
export const ServerGroupSelectReset: StoryObj<StoryProps> = {
  name: 'Regrouping clears the selection',
  parameters: { scenario: '0148/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор и смена группировки"
      steps={GROUP_SELECT_RESET}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_SELECT_RESET[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isChecked(groupCheckbox(canvas, 'Paris'))).toBe(false)
    })
    await step(GROUP_SELECT_RESET[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isChecked(groupCheckbox(canvas, 'Paris'))).toBe(true)
      await until(() => expect(selectedCount(canvas)).not.toBe(''))
    })
    await step(GROUP_SELECT_RESET[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(groupRows(canvas)).toHaveLength(0)
      await expect(isChecked(rowCheckbox(canvas, 0))).toBe(false)
      await until(() => expect(selectedCount(canvas)).toBe(''))
      await settle()
    })
  },
}

const GROUP_SELECT_COUNT: readonly GuideStoryStep[] = [
  {
    title: 'Сервер не знает размер групп',
    hint: 'Каждая строка — город, но числа строк в городах сервер не прислал. Флажки у городов есть и так.',
    props: groupSelectProps({ counts: false }),
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = false
      await pollUntil(() => !!groupCheckbox(root, 'Paris'), signal)
    }),
  },
  {
    title: 'Пользователь выбрал город',
    hint: 'Сколько строк в городе, таблица не знает, поэтому нижняя панель считает выбранные города, а не строки.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectCity(root, signal)
    }),
  },
  {
    title: 'Пользователь выбрал строку другого города',
    hint: 'Отдельно выбранная строка считается сама по себе: нижняя панель показывает и строки, и города.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectCity(root, signal)
      await openCity(root, signal, 'Berlin')
      if (!isChecked(dataRowCheckbox(root))) dataRowCheckbox(root)!.click()
      await pollUntil(() => isPartial(groupCheckbox(root, 'Berlin')), signal)
    }),
  },
]

/** ADR 0148, S3: без числа строк групп счётчик называет строки и группы. */
export const ServerGroupSelectCount: StoryObj<StoryProps> = {
  name: 'Count without group sizes',
  parameters: { scenario: '0148/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Счётчик без размера групп"
      steps={GROUP_SELECT_COUNT}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(GROUP_SELECT_COUNT[0]!.title, async () => {
      await stepDone(canvas)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(GROUP_SELECT_COUNT[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          labels.selectedRowsAndGroups(0, labels.selectedGroupsCount(1)),
        ),
      )
    })
    await step(GROUP_SELECT_COUNT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          labels.selectedRowsAndGroups(1, labels.selectedGroupsCount(1)),
        ),
      )
      await settle()
    })
  },
}

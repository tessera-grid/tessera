import { useMemo, useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import { useLatest } from '../util/useLatest'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  consoleText,
  firstRowText,
  guideNext,
  headCell,
  orderedRows,
  pollUntil,
  pressEscape,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { openPanel } from './__mocks__/filterGuide'
import { filteringColumns } from './__mocks__/filteringData'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import type { StoryText } from './__mocks__/storyText'
import { createConsoleLog } from './demos/consoleLog'
import {
  ACTION_SERVER_PAGE,
  ACTION_SERVER_REFUSAL,
  type ActionServerMode,
  createActionServer,
  initialActionQuery,
  queryActionServer,
} from './demos/serverActionsDemos'

/**
 * Серверные действия (ADR 0116): сортировка, страница, фильтр и поиск уходят серверу, таблица
 * ждёт ответа и откатывает клики при отказе. `Playground` — «сервер» с задержкой, его
 * отказ включает `serverRefuses`; S1 — ожидание, ответ, отказ и повтор.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server actions',
} satisfies Meta<StoryProps>

export default meta

/** Сортировка, страница и поиск таблицы идут на сервер. */
const SERVER_MODE = {
  columnsOverride: filteringColumns,
  dataMode: {
    sorting: 'server',
    filtering: 'server',
    search: 'server',
    pagination: 'server',
  },
  columnSortingMultiSort: false,
  paginationInitialPageSize: ACTION_SERVER_PAGE,
} satisfies Partial<StoryProps>

const SERVER_PLUGINS = {
  enableColumnSorting: true,
  enablePagination: true,
  enableColumnFiltering: true,
  enableQuickSearch: true,
} satisfies Partial<StoryProps>

const NOT_SERVER_ACTIONS = 'Rows and columns come from the story server'

interface ServerActionsPlaygroundArgs extends StoryProps {
  /** «Сервер» отказывает на каждый запрос. */
  serverRefuses?: boolean
}

const PLAYGROUND_DELAY_MS = 800

const ServerActionsSandbox = ({
  serverRefuses,
  ...args
}: ServerActionsPlaygroundArgs) => {
  const [consoleLog] = useState(createConsoleLog)
  const refuses = useLatest(serverRefuses)
  const [server] = useState(() =>
    createActionServer({
      delayMs: PLAYGROUND_DELAY_MS,
      mode: () => (refuses.current ? 'refuse' : 'answer'),
    }),
  )
  const [answer, setAnswer] = useState(() =>
    queryActionServer(initialActionQuery()),
  )
  const callbacks = useMemo(
    () =>
      server.callbacks({
        answer: (rows, total) => setAnswer({ rows, total }),
        log: text => consoleLog.log('server', text),
      }),
    [server, consoleLog],
  )
  return (
    <WithConsole log={consoleLog} args={args}>
      <StoryComponent
        {...normalizeArgs(args)}
        {...SERVER_MODE}
        {...callbacks}
        dataOverride={answer.rows}
        rowCount={answer.total}
      />
    </WithConsole>
  )
}

/** Сортировка, страница, фильтр и поиск на «сервере» с задержкой; отказ — аргументом. */
export const ServerActionsPlayground: StoryObj<ServerActionsPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(
    [
      'serverRefuses',
      'enableColumnSorting',
      'columnSortingRevertOnReject',
      'enablePagination',
      'paginationRevertOnReject',
      'enableColumnFiltering',
      'enableQuickSearch',
    ],
    { columnCount: NOT_SERVER_ACTIONS, dataCount: NOT_SERVER_ACTIONS },
  ),
  args: {
    // Сортировка, страница и поиск идут на «сервер» с задержкой. Включите serverRefuses —
    // сервер откажет: сортировка и страница вернутся, текст поиска останется.
    ...SERVER_PLUGINS,
    serverRefuses: false,
    height: '460',
    maxHeight: '460',
  },
  argTypes: {
    serverRefuses: {
      control: 'boolean',
      description:
        'The server refuses every request: the table reverts sorting and the page, and the search text stays',
    },
  },
  render: args => <ServerActionsSandbox {...args} />,
}

// --- S1 ------------------------------------------------------------------------------

const SERVER_DELAY_MS = 600
const SEARCH = 'Alice'

/** Как «сервер» гайда поступит со следующим запросом; задаёт шаг. */
const guide = {
  mode: 'answer' as ActionServerMode,
  /** Последний итог «сервера» — строка консоли. */
  lastReply: '',
  store: undefined as unknown,
}

const server = createActionServer({
  delayMs: SERVER_DELAY_MS,
  mode: () => guide.mode,
})

/** Новое открытие таблицы — новый запрос: прежний ответ ему не принадлежит. */
const serverReset: TesseraFeatureEntry = {
  id: 'serverActionsReset',
  setup: table => {
    // `setup` повторяется при смене аргументов плагинов, а обёртка таблицы новая на каждом
    // рендере: новое открытие узнаётся по хранилищу состояния.
    const store = (table as { store: unknown }).store
    if (guide.store === store) return
    guide.store = store
    guide.lastReply = ''
    server.reset()
  },
}

const sortButton = (root: HTMLElement) =>
  headCell(root, 'name')?.querySelector<HTMLElement>('.column-sort__button')
const ariaSort = (root: HTMLElement) =>
  headCell(root, 'name')?.getAttribute('aria-sort') ?? 'none'
const pageButton = (root: HTMLElement, action: 'next' | 'previous') =>
  root.querySelector<HTMLButtonElement>(
    `[data-testid="pagination"] [data-page-action="${action}"]`,
  )
const failed = (button: Element | null | undefined) =>
  button
    ?.querySelector<HTMLElement>('[data-failure-indicator]')
    ?.getAttribute('data-shown') === 'true'
/** Кнопка «назад» выключена — с тултипом она остаётся в фокусе через `aria-disabled`. */
const onFirstPage = (root: HTMLElement) =>
  pageButton(root, 'previous')?.getAttribute('aria-disabled') === 'true'
const refreshing = (root: HTMLElement) =>
  !!root.querySelector('.data-grid-theme[data-refreshing]')
const banner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
const searchField = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
const names = (root: HTMLElement) =>
  orderedRows(root).map(
    row =>
      row.querySelector('[data-column-id="name"]')?.textContent?.trim() ?? '',
  )

/** Первая строка первой страницы в порядке, что сейчас на заголовке имени. */
const firstSortedName = (root: HTMLElement) => {
  const direction = ariaSort(root)
  const sort =
    direction === 'none'
      ? undefined
      : { id: 'name', desc: direction === 'descending' }
  return queryActionServer({ ...initialActionQuery(), sort }).rows[0]!.name
}

/** Ввод в поле, как с клавиатуры: событие `input` с новым значением. */
const type = (input: HTMLInputElement | null, text: string) => {
  if (!input || input.value === text) return
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Пользователь сортирует по имени; «сервер» отвечает по режиму шага. */
const sortByName = (root: HTMLElement, signal: AbortSignal) =>
  pollUntil(() => {
    if (ariaSort(root) !== 'none' && !server.holding()) {
      return firstRowText(root, 'name') === firstSortedName(root)
    }
    if (server.holding()) server.release()
    else if (ariaSort(root) === 'none') sortButton(root)?.click()
    return false
  }, signal)

const searchRefused = () =>
  guide.lastReply.startsWith('refused') &&
  guide.lastReply.includes(`search "${SEARCH}"`)

const FILTER = 'Alice 1'
const filterPanel = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
const filterValue = () =>
  document.querySelector<HTMLInputElement>('[data-testid="filter-value"]')
/** Значок ошибки в открытой панели фильтра (ADR 0116, SA18). */
const filterFailed = () =>
  !!document.querySelector('[data-testid="filter-failure"]')
const refusedWith = (part: string) =>
  guide.lastReply.startsWith('refused') && guide.lastReply.includes(part)

/** Пользователь фильтрует колонку имён в её панели, «сервер» отказывает. */
const refuseFilter = async (root: HTMLElement, signal: AbortSignal) => {
  guide.mode = 'refuse'
  await openPanel(root, 'name', signal)
  await pollUntil(() => !!filterValue(), signal)
  type(filterValue(), FILTER)
  // Ввод гайда может идти по символам. Кнопка должна получить готовое условие.
  await pollUntil(() => filterValue()?.value === FILTER, signal)
  await pollUntil(() => {
    if (refusedWith('filter name=') && banner(root) && !refreshing(root))
      return filterFailed()
    if (!refreshing(root)) {
      // На сервере условие уходит кнопкой «Применить» (ADR 0154).
      document
        .querySelector<HTMLElement>('[data-testid="filter-apply"]')
        ?.click()
    }
    return false
  }, signal)
}

/** Пользователь ищет по имени, «сервер» отказывает. */
const refuseSearch = async (root: HTMLElement, signal: AbortSignal) => {
  guide.mode = 'refuse'
  await pollUntil(() => {
    type(searchField(root), SEARCH)
    return searchRefused() && !!banner(root) && !refreshing(root)
  }, signal)
}

const REFUSED: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Данные с сервера', en: 'Data from the server' },
    hint: {
      ru: 'Таблица не сортирует, не ищет и не листает строки сама: каждое такое действие пользователя уходит приложению запросом к серверу. Таблица показывает первую страницу из ответа.',
      en: 'The table does not sort, search, or page through rows on its own: each such user action goes to the app as a request to the server. The table shows the first page from the response.',
    },
    props: ({ app, log }) =>
      server.callbacks({
        answer: (rows, total) =>
          app.update(props => ({
            ...props,
            dataOverride: rows,
            rowCount: total,
          })),
        log: text => {
          guide.lastReply = text
          log.log('server', text)
        },
      }),
  },
  {
    title: { ru: 'Сортировка ждёт ответа', en: 'Sorting waits for a response' },
    hint: {
      ru: 'Пользователь отсортировал строки по имени, запрос ушёл серверу, ответа пока нет. Под шапкой идёт обновление данных; строки прежние, таблица доступна.',
      en: 'The user sorted rows by name, and the request went to the server; there is no response yet. A data refresh is in progress under the header; the rows are unchanged, and the table stays available.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      guide.mode = 'hold'
      await pollUntil(() => {
        if (server.holding()) return refreshing(root)
        if (ariaSort(root) === 'none') sortButton(root)?.click()
        return false
      }, signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Сервер прислал первую страницу в порядке по имени. Ожидание снято, строки упорядочены по имени.',
      en: 'The server sent the first page ordered by name. The wait is over, and the rows are ordered by name.',
    },
    enter: stepAction(async (root, { signal }) => {
      guide.mode = 'answer'
      await sortByName(root, signal)
      await pollUntil(() => !refreshing(root), signal)
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь открыл следующую страницу и, не дождавшись ответа, сменил направление сортировки. Сервер отказал. Таблица вернула сортировку и страницу к последнему ответу сервера, под шапкой — сообщение с причиной и повтором.',
      en: 'The user opened the next page and, without waiting for a response, changed the sort direction. The server refused. The table reverted sorting and the page to the last server response, and a message with the reason and a retry button appears under the header.',
    },
    states: ['body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      guide.mode = 'answer'
      await sortByName(root, signal)
      const answered = ariaSort(root)
      guide.mode = 'hold'
      await pollUntil(() => {
        if (server.holding()) return true
        pageButton(root, 'next')?.click()
        return false
      }, signal)
      sortButton(root)?.click()
      await pollUntil(() => ariaSort(root) !== answered, signal)
      guide.mode = 'refuse'
      server.release()
      await pollUntil(
        () =>
          !!banner(root) && ariaSort(root) === answered && onFirstPage(root),
        signal,
      )
    }),
  },
  {
    title: { ru: 'Поиск не удался', en: 'The search failed' },
    hint: {
      ru: 'Пользователь ввёл текст поиска, сервер снова отказал. Введённый текст остался в поле поиска, сообщение под шапкой называет причину и предлагает повторить запрос.',
      en: 'The user typed a search query, and the server refused again. The typed text stays in the search field, and the message under the header gives the reason and offers to retry.',
    },
    states: ['body.loadError'],
    enter: stepAction((root, { signal }) => refuseSearch(root, signal)),
  },
  {
    title: { ru: 'Повтор запроса', en: 'Retrying the request' },
    hint: {
      ru: 'Сервер снова отвечает, пользователь повторил запрос из сообщения. Тот же поиск ушёл серверу ещё раз: пришли найденные строки, сообщение скрыто.',
      en: 'The server is responding again, and the user retried the request from the message. The same search went to the server once more: the matching rows arrived, and the message is hidden.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (!searchRefused()) await refuseSearch(root, signal)
      guide.mode = 'answer'
      await pollUntil(() => {
        if (banner(root)) {
          root
            .querySelector<HTMLElement>('[data-testid="load-error-retry"]')
            ?.click()
          return false
        }
        return (
          !refreshing(root) &&
          !guide.lastReply.startsWith('refused') &&
          names(root).length > 0 &&
          names(root).every(name => name.includes(SEARCH))
        )
      }, signal)
    }),
  },
  {
    title: { ru: 'Фильтр не применился', en: 'The filter was not applied' },
    hint: {
      ru: 'Пользователь отфильтровал колонку по значению, сервер отказал. Условие осталось в панели фильтра, рядом с ним — значок ошибки, под шапкой — сообщение с причиной и повтором.',
      en: 'The user filtered a column by a value, and the server refused. The condition stays in the filter panel with an error icon next to it, and a message with the reason and a retry button appears under the header.',
    },
    states: ['body.loadError', 'overlay.filterText'],
    enter: stepAction((root, { signal }) => refuseFilter(root, signal)),
  },
  {
    title: { ru: 'Страница не открылась', en: 'The page did not open' },
    hint: {
      ru: 'Пользователь открыл следующую страницу, сервер снова отказал. Таблица осталась на прежней странице, сообщение под шапкой называет причину.',
      en: 'The user opened the next page, and the server refused again. The table stayed on the previous page, and the message under the header gives the reason.',
    },
    states: ['body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      if (!refusedWith('filter name=') && !refusedWith('page 2'))
        await refuseFilter(root, signal)
      await pollUntil(() => {
        if (!filterPanel()) return true
        pressEscape()
        return false
      }, signal)
      guide.mode = 'refuse'
      await pollUntil(() => {
        if (refusedWith('page 2') && banner(root) && !refreshing(root))
          return onFirstPage(root)
        // Одно нажатие: пока запрос в пути, пейджер уже на второй странице.
        if (!server.holding() && onFirstPage(root) && !refusedWith('page 2'))
          pageButton(root, 'next')?.click()
        return false
      }, signal)
    }),
  },
]

/** ADR 0116, S1: сервер ждёт, отвечает, отказывает; пользователь повторяет запрос. */
export const ServerActionsRefused: StoryObj<StoryProps> = {
  name: 'Refused by the server',
  parameters: {
    scenario: '0116/S1',
    requirements: ['SA17'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ сервера', en: 'Server refusal' }}
      steps={REFUSED}
      reset={() => {
        guide.mode = 'answer'
      }}
      args={guideArgs(
        {
          ...SERVER_MODE,
          ...SERVER_PLUGINS,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          dataOverride: queryActionServer(initialActionQuery()).rows,
          rowCount: queryActionServer(initialActionQuery()).total,
          extraPlugins: [serverReset],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const first = queryActionServer(initialActionQuery())
    await step(REFUSED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name),
      )
      await until(() => expect(onFirstPage(canvas)).toBe(true))
    })
    await step(REFUSED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(server.holding()).toBe(true))
      await until(() => expect(refreshing(canvas)).toBe(true))
      await until(() =>
        expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name),
      )
      await until(() => expect(consoleText()).toContain('onToggleColumnSort'))
    })
    await step(REFUSED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(server.holding()).toBe(false))
      await until(() => expect(refreshing(canvas)).toBe(false))
      await until(() =>
        expect(firstRowText(canvas, 'name')).toBe(firstSortedName(canvas)),
      )
      await until(() => expect(consoleText()).toContain('by name'))
    })
    await step(REFUSED[3]!.title.ru, async () => {
      const answered = ariaSort(canvas)
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(banner(canvas)).toHaveTextContent(ACTION_SERVER_REFUSAL),
      )
      // Откат: сортировка и страница — как в последнем ответе.
      await until(() => expect(ariaSort(canvas)).toBe(answered))
      await until(() => expect(onFirstPage(canvas)).toBe(true))
      await until(() => expect(failed(sortButton(canvas))).toBe(false))
      await until(() => expect(consoleText()).toContain('onPageChange'))
      await until(() =>
        expect(canvas.querySelector('[data-error-flash]')).toBeNull(),
      )
      await settle()
    })
    await step(REFUSED[4]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      // Черновик: текст поиска остался в поле.
      await until(() => expect(searchField(canvas)!.value).toBe(SEARCH))
      await until(() =>
        expect(banner(canvas)).toHaveTextContent(ACTION_SERVER_REFUSAL),
      )
      await until(() => expect(consoleText()).toContain('onSearchChange'))
      await until(() =>
        expect(canvas.querySelector('[data-error-flash]')).toBeNull(),
      )
      await settle()
    })
    await step(REFUSED[5]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(banner(canvas)).toBeNull())
      await until(() => expect(searchField(canvas)!.value).toBe(SEARCH))
      await until(() => expect(names(canvas).length).toBeGreaterThan(0))
      await until(() =>
        expect(names(canvas).every(name => name.includes(SEARCH))).toBe(true),
      )
      await until(() => expect(consoleText()).toContain(`search "${SEARCH}"`))
      await settle()
    })
    await step(REFUSED[6]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      // Черновик: условие осталось в панели, рядом — значок ошибки.
      await until(() => expect(filterValue()!.value).toBe(FILTER))
      await until(() => expect(filterFailed()).toBe(true))
      await until(() =>
        expect(banner(canvas)).toHaveTextContent(ACTION_SERVER_REFUSAL),
      )
      await until(() => expect(consoleText()).toContain('onFilterChange'))
      await settle()
    })
    await step(REFUSED[7]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(onFirstPage(canvas)).toBe(true))
      await until(() => expect(failed(pageButton(canvas, 'next'))).toBe(false))
      await until(() =>
        expect(banner(canvas)).toHaveTextContent(ACTION_SERVER_REFUSAL),
      )
      await settle()
    })
  },
}

// --- ADR 0153 S3, S6 -----------------------------------------------------------------

/** «Сервер» гайдов отмены: свой, чтобы отмена не путала запросы гайда отказа. */
const cancelGuide = {
  mode: 'answer' as ActionServerMode,
  store: undefined as unknown,
}

const cancelServer = createActionServer({
  delayMs: SERVER_DELAY_MS,
  mode: () => cancelGuide.mode,
})

const cancelReset: TesseraFeatureEntry = {
  id: 'serverActionsCancelReset',
  setup: table => {
    const store = (table as { store: unknown }).store
    if (cancelGuide.store === store) return
    cancelGuide.store = store
    cancelServer.reset()
  },
}

const pendingBanner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-banner"]')
const pendingCancel = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-cancel"]')

/** Первый шаг гайдов отмены: «сервер» отвечает в данные приложения и консоль. */
const cancelServerStep = (
  title: StoryText,
  hint: StoryText,
): GuideStoryStep => ({
  title,
  hint,
  props: ({ app, log }) =>
    cancelServer.callbacks({
      answer: (rows, total) =>
        app.update(props => ({
          ...props,
          dataOverride: rows,
          rowCount: total,
        })),
      log: text => log.log('server', text),
    }),
})

/** Гайды отмены открывают таблицу с «сервером», который отвечает. */
const answerCancel = () => {
  cancelGuide.mode = 'answer'
}

const cancelGuideArgs = {
  ...SERVER_MODE,
  ...SERVER_PLUGINS,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
  dataOverride: queryActionServer(initialActionQuery()).rows,
  rowCount: queryActionServer(initialActionQuery()).total,
  extraPlugins: [cancelReset],
} satisfies Partial<StoryProps>

/** Поиск ждёт ответа: запрос уходит, если ещё не ушёл. */
const searchHeld = (root: HTMLElement, signal: AbortSignal) => {
  cancelGuide.mode = 'hold'
  return pollUntil(() => {
    type(searchField(root), SEARCH)
    return cancelServer.holding() && refreshing(root)
  }, signal)
}

const CANCEL_SEARCH: readonly GuideStoryStep[] = [
  cancelServerStep(
    { ru: 'Поиск на сервере', en: 'Search on the server' },
    {
      ru: 'Каждый запрос из поля поиска уходит на сервер, ответ приходит не сразу.',
      en: 'Every query from the search field goes to the server, and the response takes a while.',
    },
  ),
  {
    title: { ru: 'Поиск идёт', en: 'The search is running' },
    hint: {
      ru: 'Пользователь ввёл запрос. Пока сервер ищет, под шапкой светится полоса обновления, прежние строки на месте.',
      en: 'The user typed a query. While the server is searching, a refresh bar glows under the header, and the previous rows stay in place.',
    },
    states: ['body.refreshing'],
    immediate: true,
    enter: stepAction((root, { signal }) => searchHeld(root, signal)),
  },
  {
    title: { ru: 'Поиск идёт долго', en: 'The search is taking a while' },
    hint: {
      ru: 'Сервер не ответил за секунду. Под шапкой появилась плашка о поиске с кнопкой отмены.',
      en: 'The server did not respond within a second. A banner about the search with a cancel button appeared under the header.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await searchHeld(root, signal)
      await pollUntil(() => !!pendingCancel(root), signal)
    }),
  },
  {
    title: { ru: 'Поиск отменён', en: 'The search was cancelled' },
    hint: {
      ru: 'Пользователь нажал отмену в плашке. Плашка и свечение ушли, в поле вернулся прежний запрос, строки те же.',
      en: 'The user pressed cancel in the banner. The banner and the glow are gone, the field shows the previous query again, and the rows are unchanged.',
    },
    enter: stepAction(async (root, { signal }) => {
      await searchHeld(root, signal)
      await pollUntil(() => !!pendingCancel(root), signal)
      pendingCancel(root)!.click()
      await pollUntil(
        () =>
          !pendingBanner(root) &&
          !refreshing(root) &&
          searchField(root)?.value === '',
        signal,
      )
    }),
  },
]

/** ADR 0153, S3: серверный поиск идёт долго — человек отменяет его в плашке. */
export const ServerActionsCancelSearch: StoryObj<StoryProps> = {
  name: 'Cancel a search',
  parameters: { scenario: '0153/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отмена поиска', en: 'Cancelling a search' }}
      steps={CANCEL_SEARCH}
      reset={answerCancel}
      args={guideArgs(cancelGuideArgs, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const first = queryActionServer(initialActionQuery())
    await step(CANCEL_SEARCH[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name)
    })
    await step(CANCEL_SEARCH[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(pendingBanner(canvas)).toBeNull()
      await expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name)
    })
    await step(CANCEL_SEARCH[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBanner(canvas)).toHaveTextContent(
        labels.pendingSearch,
      )
      await expect(pendingCancel(canvas)).toHaveTextContent(labels.cancel)
      await settle()
    })
    await step(CANCEL_SEARCH[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(searchField(canvas)!.value).toBe('')
      await expect(banner(canvas)).toBeNull()
      await expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name)
      await expect(consoleText()).toContain('cancelled')
      await settle()
    })
  },
}

/** Сортировка по имени ждёт ответа: запрос уходит, если ещё не ушёл. */
const sortHeld = (root: HTMLElement, signal: AbortSignal) => {
  cancelGuide.mode = 'hold'
  return pollUntil(() => {
    if (cancelServer.holding()) return refreshing(root)
    if (ariaSort(root) === 'none') sortButton(root)?.click()
    return false
  }, signal)
}

const CANCEL_SORT: readonly GuideStoryStep[] = [
  cancelServerStep(
    { ru: 'Сортировка на сервере', en: 'Sorting on the server' },
    {
      ru: 'Сервер сортирует строки, ответ приходит не сразу.',
      en: 'The server sorts the rows, and the response takes a while.',
    },
  ),
  {
    title: { ru: 'Сортировка ждёт', en: 'Sorting is waiting' },
    hint: {
      ru: 'Пользователь нажал кнопку сортировки колонки. Колонка уже отсортирована, а пока сервер сортирует строки, под шапкой светится полоса обновления.',
      en: 'The user pressed the column sort button. The column already shows as sorted, and while the server sorts the rows, a refresh bar glows under the header.',
    },
    states: ['body.refreshing'],
    immediate: true,
    enter: stepAction((root, { signal }) => sortHeld(root, signal)),
  },
  {
    title: { ru: 'Сортировка идёт долго', en: 'Sorting is taking a while' },
    hint: {
      ru: 'Сервер не ответил за секунду. Под шапкой появилась плашка о сортировке с кнопкой отмены.',
      en: 'The server did not respond within a second. A banner about sorting with a cancel button appeared under the header.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await sortHeld(root, signal)
      await pollUntil(() => !!pendingCancel(root), signal)
    }),
  },
  {
    title: { ru: 'Сортировка отменена', en: 'Sorting was cancelled' },
    hint: {
      ru: 'Пользователь нажал отмену в плашке. Колонка снова без сортировки, плашка и свечение ушли, плашки отказа нет.',
      en: 'The user pressed cancel in the banner. The column is unsorted again, the banner and the glow are gone, and there is no refusal banner.',
    },
    enter: stepAction(async (root, { signal }) => {
      await sortHeld(root, signal)
      await pollUntil(() => !!pendingCancel(root), signal)
      pendingCancel(root)!.click()
      await pollUntil(
        () =>
          ariaSort(root) === 'none' &&
          !pendingBanner(root) &&
          !refreshing(root),
        signal,
      )
    }),
  },
]

/** ADR 0153, S6: серверная сортировка ждёт — человек отменяет её в плашке под шапкой. */
export const ServerActionsCancelSort: StoryObj<StoryProps> = {
  name: 'Cancel sorting',
  parameters: { scenario: '0153/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отмена сортировки', en: 'Cancelling sorting' }}
      steps={CANCEL_SORT}
      reset={answerCancel}
      args={guideArgs(cancelGuideArgs, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const first = queryActionServer(initialActionQuery())
    await step(CANCEL_SORT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(ariaSort(canvas)).toBe('none')
    })
    await step(CANCEL_SORT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(ariaSort(canvas)).not.toBe('none')
      await expect(refreshing(canvas)).toBe(true)
      await expect(pendingBanner(canvas)).toBeNull()
    })
    await step(CANCEL_SORT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBanner(canvas)).toHaveTextContent(
        labels.pendingSorting,
      )
      await expect(pendingCancel(canvas)).toHaveTextContent(labels.cancel)
      await settle()
    })
    await step(CANCEL_SORT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(ariaSort(canvas)).toBe('none')
      await expect(banner(canvas)).toBeNull()
      await expect(failed(sortButton(canvas))).toBe(false)
      await expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name)
      await settle()
    })
  },
}

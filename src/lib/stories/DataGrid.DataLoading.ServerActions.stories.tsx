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
  pointAt,
  pollUntil,
  pressEscape,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
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

const NOT_SERVER_ACTIONS = 'Строки и колонки приходят с сервера истории'

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
        paginationRowCount={answer.total}
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
        'Сервер отказывает на каждый запрос: таблица откатывает сортировку и страницу, текст поиска остаётся',
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
const waits = (button: Element | null | undefined) =>
  button?.getAttribute('aria-busy') === 'true'
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
    if (ariaSort(root) !== 'none' && !waits(sortButton(root))) {
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
const filterButton = (root: HTMLElement) =>
  headCell(root, 'name')?.querySelector<HTMLElement>('.column-filter__button')
const filterPanel = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
const filterValue = () =>
  document.querySelector<HTMLInputElement>('[data-testid="filter-value"]')
/** Отметка отказа кнопки фильтра — точка ошибки (ADR 0116, SA18). */
const filterFailed = (root: HTMLElement) =>
  filterButton(root)
    ?.querySelector('[data-error-indicator]')
    ?.getAttribute('data-shown') === 'true'
const refusedWith = (part: string) =>
  guide.lastReply.startsWith('refused') && guide.lastReply.includes(part)

/** Пользователь фильтрует колонку имён в её панели, «сервер» отказывает. */
const refuseFilter = (root: HTMLElement, signal: AbortSignal) => {
  guide.mode = 'refuse'
  return pollUntil(() => {
    if (refusedWith('filter name=') && banner(root) && !refreshing(root))
      return filterFailed(root)
    if (!filterPanel()) filterButton(root)?.click()
    else {
      type(filterValue(), FILTER)
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
    title: 'Данные с сервера',
    hint: 'Таблица не сортирует, не ищет и не листает строки сама: каждое такое действие пользователя уходит приложению запросом к серверу. Таблица показывает первую страницу из ответа.',
    props: ({ app, log }) =>
      server.callbacks({
        answer: (rows, total) =>
          app.update(props => ({
            ...props,
            dataOverride: rows,
            paginationRowCount: total,
          })),
        log: text => {
          guide.lastReply = text
          log.log('server', text)
        },
      }),
    enter: () => {
      guide.mode = 'answer'
    },
  },
  {
    title: 'Сортировка ждёт ответа',
    hint: 'Пользователь отсортировал строки по имени, запрос ушёл серверу, ответа пока нет. Кнопка сортировки показывает ожидание, под шапкой идёт обновление данных; строки прежние, таблица доступна.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      guide.mode = 'hold'
      await pollUntil(() => {
        if (waits(sortButton(root))) return refreshing(root)
        if (ariaSort(root) === 'none') sortButton(root)?.click()
        return false
      }, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Сервер прислал первую страницу в порядке по имени. Ожидание снято, строки упорядочены по имени.',
    enter: stepAction(async (root, { signal }) => {
      guide.mode = 'answer'
      await sortByName(root, signal)
      await pollUntil(() => !refreshing(root), signal)
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь открыл следующую страницу и, не дождавшись ответа, сменил направление сортировки. Сервер отказал. Таблица вернула сортировку и страницу к последнему ответу сервера, кнопка сортировки отмечена отказом, под шапкой — сообщение с причиной и повтором.',
    states: ['body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      guide.mode = 'answer'
      await sortByName(root, signal)
      const answered = ariaSort(root)
      guide.mode = 'hold'
      await pollUntil(() => {
        if (waits(pageButton(root, 'next'))) return true
        if (!server.holding()) pageButton(root, 'next')?.click()
        return false
      }, signal)
      sortButton(root)?.click()
      await pollUntil(() => ariaSort(root) !== answered, signal)
      guide.mode = 'refuse'
      server.release()
      await pollUntil(
        () =>
          !!banner(root) &&
          ariaSort(root) === answered &&
          onFirstPage(root) &&
          failed(sortButton(root)),
        signal,
      )
    }),
  },
  {
    title: 'Поиск не удался',
    hint: 'Пользователь ввёл текст поиска, сервер снова отказал. Введённый текст остался в поле поиска, сообщение под шапкой называет причину и предлагает повторить запрос.',
    states: ['body.loadError'],
    enter: stepAction((root, { signal }) => refuseSearch(root, signal)),
  },
  {
    title: 'Повтор запроса',
    hint: 'Сервер снова отвечает, пользователь повторил запрос из сообщения. Тот же поиск ушёл серверу ещё раз: пришли найденные строки, сообщение скрыто.',
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
    title: 'Фильтр не применился',
    hint: 'Пользователь отфильтровал колонку по значению, сервер отказал. Условие осталось в панели фильтра, кнопка фильтра колонки отмечена отказом, под шапкой — сообщение с причиной и повтором.',
    states: ['body.loadError', 'overlay.filterText'],
    enter: stepAction((root, { signal }) => refuseFilter(root, signal)),
  },
  {
    title: 'Страница не открылась',
    hint: 'Пользователь открыл следующую страницу, сервер снова отказал. Таблица осталась на прежней странице, кнопка следующей страницы отмечена отказом, сообщение под шапкой называет причину.',
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
          return failed(pageButton(root, 'next')) && onFirstPage(root)
        if (!waits(pageButton(root, 'next')) && !refusedWith('page 2'))
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
      title="Отказ сервера"
      steps={REFUSED}
      args={guideArgs(
        {
          ...SERVER_MODE,
          ...SERVER_PLUGINS,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          dataOverride: queryActionServer(initialActionQuery()).rows,
          paginationRowCount: queryActionServer(initialActionQuery()).total,
          extraPlugins: [serverReset],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const first = queryActionServer(initialActionQuery())
    await step(REFUSED[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name)
      await expect(onFirstPage(canvas)).toBe(true)
    })
    await step(REFUSED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(waits(sortButton(canvas))).toBe(true)
      await expect(refreshing(canvas)).toBe(true)
      await expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name)
      await expect(consoleText()).toContain('onToggleColumnSort')
    })
    await step(REFUSED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(waits(sortButton(canvas))).toBe(false)
      await expect(refreshing(canvas)).toBe(false)
      await expect(firstRowText(canvas, 'name')).toBe(firstSortedName(canvas))
      await expect(consoleText()).toContain('by name')
    })
    await step(REFUSED[3]!.title, async () => {
      const answered = ariaSort(canvas)
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(banner(canvas)).toHaveTextContent(ACTION_SERVER_REFUSAL)
      // Откат: сортировка и страница — как в последнем ответе.
      await expect(ariaSort(canvas)).toBe(answered)
      await expect(onFirstPage(canvas)).toBe(true)
      await expect(failed(sortButton(canvas))).toBe(true)
      await expect(consoleText()).toContain('onPageChange')
      await until(() =>
        expect(canvas.querySelector('[data-error-flash]')).toBeNull(),
      )
      await settle()
    })
    await step(REFUSED[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      // Черновик: текст поиска остался в поле.
      await expect(searchField(canvas)!.value).toBe(SEARCH)
      await expect(banner(canvas)).toHaveTextContent(ACTION_SERVER_REFUSAL)
      await expect(consoleText()).toContain('onSearchChange')
      await until(() =>
        expect(canvas.querySelector('[data-error-flash]')).toBeNull(),
      )
      await settle()
    })
    await step(REFUSED[5]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(banner(canvas)).toBeNull()
      await expect(searchField(canvas)!.value).toBe(SEARCH)
      await expect(names(canvas).length).toBeGreaterThan(0)
      await expect(names(canvas).every(name => name.includes(SEARCH))).toBe(
        true,
      )
      await expect(consoleText()).toContain(`search "${SEARCH}"`)
      await settle()
    })
    await step(REFUSED[6]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      // Черновик: условие осталось в панели, кнопка фильтра отмечена отказом.
      await expect(filterValue()!.value).toBe(FILTER)
      await expect(filterFailed(canvas)).toBe(true)
      await expect(banner(canvas)).toHaveTextContent(ACTION_SERVER_REFUSAL)
      await expect(consoleText()).toContain('onFilterChange')
      await settle()
    })
    await step(REFUSED[7]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(onFirstPage(canvas)).toBe(true)
      await expect(failed(pageButton(canvas, 'next'))).toBe(true)
      await expect(banner(canvas)).toHaveTextContent(ACTION_SERVER_REFUSAL)
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

const SORT_BUTTON =
  '.data-grid__head-cell[data-column-id="name"] .column-sort__button'
const pendingBanner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-banner"]')
const pendingCancel = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-cancel"]')
const armed = (button: Element | null | undefined) =>
  !!button?.hasAttribute('data-cancel-armed')

/** Первый шаг гайдов отмены: «сервер» отвечает в данные приложения и консоль. */
const cancelServerStep = (title: string, hint: string): GuideStoryStep => ({
  title,
  hint,
  props: ({ app, log }) =>
    cancelServer.callbacks({
      answer: (rows, total) =>
        app.update(props => ({
          ...props,
          dataOverride: rows,
          paginationRowCount: total,
        })),
      log: text => log.log('server', text),
    }),
  enter: () => {
    cancelGuide.mode = 'answer'
  },
})

const cancelGuideArgs = {
  ...SERVER_MODE,
  ...SERVER_PLUGINS,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
  dataOverride: queryActionServer(initialActionQuery()).rows,
  paginationRowCount: queryActionServer(initialActionQuery()).total,
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
    'Поиск на сервере',
    'Каждый запрос из поля поиска уходит на сервер, ответ приходит не сразу.',
  ),
  {
    title: 'Поиск идёт',
    hint: 'Пользователь ввёл запрос. Пока сервер ищет, под шапкой светится полоса обновления, прежние строки на месте.',
    states: ['body.refreshing'],
    immediate: true,
    enter: stepAction((root, { signal }) => searchHeld(root, signal)),
  },
  {
    title: 'Поиск идёт долго',
    hint: 'Сервер не ответил за секунду. Под шапкой появилась плашка о поиске с кнопкой отмены.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await searchHeld(root, signal)
      await pollUntil(() => !!pendingCancel(root), signal)
    }),
  },
  {
    title: 'Поиск отменён',
    hint: 'Пользователь нажал отмену в плашке. Плашка и свечение ушли, в поле вернулся прежний запрос, строки те же.',
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
      title="Отмена поиска"
      steps={CANCEL_SEARCH}
      args={guideArgs(cancelGuideArgs, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const first = queryActionServer(initialActionQuery())
    await step(CANCEL_SEARCH[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name)
    })
    await step(CANCEL_SEARCH[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(refreshing(canvas)).toBe(true)
      await expect(pendingBanner(canvas)).toBeNull()
      await expect(firstRowText(canvas, 'name')).toBe(first.rows[0]!.name)
    })
    await step(CANCEL_SEARCH[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBanner(canvas)).toHaveTextContent(
        labels.pendingSearch,
      )
      await expect(pendingCancel(canvas)).toHaveTextContent(labels.cancel)
      await settle()
    })
    await step(CANCEL_SEARCH[3]!.title, async () => {
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
    if (waits(sortButton(root))) return refreshing(root)
    if (ariaSort(root) === 'none') sortButton(root)?.click()
    return false
  }, signal)
}

/** Занятая кнопка сортировки готова к отмене. */
const sortArmed = async (root: HTMLElement, signal: AbortSignal) => {
  await sortHeld(root, signal)
  await pollUntil(() => armed(sortButton(root)), signal)
}

const CANCEL_SORT: readonly GuideStoryStep[] = [
  cancelServerStep(
    'Сортировка на сервере',
    'Сервер сортирует строки, ответ приходит не сразу.',
  ),
  {
    title: 'Сортировка ждёт',
    hint: 'Пользователь нажал кнопку сортировки колонки. Кнопка показывает ожидание, под шапкой светится полоса обновления.',
    states: ['body.refreshing'],
    immediate: true,
    enter: stepAction((root, { signal }) => sortHeld(root, signal)),
  },
  {
    title: 'Кнопка предлагает отмену',
    hint: 'Пользователь навёл указатель на занятую кнопку. Появился знак остановки, подсказка предлагает отменить сортировку.',
    states: ['body.refreshing'],
    pseudo: { hover: SORT_BUTTON },
    enter: stepAction(async (root, { signal, onLeave }) => {
      await sortArmed(root, signal)
      onLeave(pointAt(sortButton(root)!))
    }),
  },
  {
    title: 'Сортировка отменена',
    hint: 'Пользователь нажал на кнопку. Колонка снова без сортировки, свечение ушло, плашки отказа нет.',
    enter: stepAction(async (root, { signal }) => {
      await sortArmed(root, signal)
      sortButton(root)!.click()
      await pollUntil(
        () =>
          ariaSort(root) === 'none' &&
          !waits(sortButton(root)) &&
          !refreshing(root),
        signal,
      )
    }),
  },
]

/** ADR 0153, S6: серверная сортировка ждёт — человек отменяет её кнопкой сортировки. */
export const ServerActionsCancelSort: StoryObj<StoryProps> = {
  name: 'Cancel sorting',
  parameters: { scenario: '0153/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отмена сортировки"
      steps={CANCEL_SORT}
      args={guideArgs(cancelGuideArgs, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const first = queryActionServer(initialActionQuery())
    await step(CANCEL_SORT[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(ariaSort(canvas)).toBe('none')
    })
    await step(CANCEL_SORT[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(waits(sortButton(canvas))).toBe(true)
      await expect(refreshing(canvas)).toBe(true)
    })
    await step(CANCEL_SORT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const button = sortButton(canvas)!
      await expect(armed(button)).toBe(true)
      await expect(
        button.getAttribute('aria-label')!.startsWith(labels.cancelAction('')),
      ).toBe(true)
    })
    await step(CANCEL_SORT[3]!.title, async () => {
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

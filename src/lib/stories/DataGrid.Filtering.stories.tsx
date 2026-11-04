import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  dateFilteringColumns,
  dateFilteringData,
  filteringColumns,
  filteringData,
  loadManagers,
  optionFilteringColumns,
  optionFilteringData,
} from './__mocks__/filteringData'
import {
  byTestId,
  consoleText,
  guideNext,
  headCell,
  orderedRows,
  pollUntil,
  repeat,
  pressEscape,
  settle,
  sleep,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import {
  calendar,
  checkOption,
  chooseOperator,
  closePanel,
  filterActive,
  filteredCount,
  openPanel,
  operatorValue,
  optionChecked,
  optionOf,
  panel,
  pickDay,
} from './__mocks__/filterGuide'
import { labelPattern, storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideApp,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { type ConsoleLog, describeEvent } from './demos/consoleLog'
import {
  OPTION_SERVER_DATA,
  OPTION_TOTAL,
  SERVER_DATA,
  SERVER_TOTAL,
  type ServerFilters,
  queryFiltering,
  queryOptions,
} from './demos/filteringDemos'

/**
 * Фильтрация (ADR 0045, ADR 0047, ADR 0048): фильтры колонок по типам — текст, число,
 * булево, дата, варианты; быстрый поиск. `Playground` — фильтры в покое и функции рядом;
 * гайды — текст, пустой результат, сервер, дерево, поиск без колонок, даты, варианты,
 * справочник; фильтры и поиск из формы приложения — ADR 0120.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Filtering',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
  columnsOverride: filteringColumns,
  dataOverride: filteringData,
  enableColumnFiltering: true,
  enableQuickSearch: true,
  columnFilteringFilteredCount: true,
  quickSearchFilteredCount: true,
}

/**
 * Фильтры колонок по типам, поиск и сводка фильтров; пагинация, выбор строк и выгрузка —
 * контролами: смена фильтра возвращает на первую страницу, выгрузка учитывает фильтры.
 */
export const FilteringPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableQuickSearch',
    'quickSearchDebounceMs',
    'quickSearchFilteredCount',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'timeZone',
    'enablePagination',
    'paginationInitialPageSize',
    'enableRowSelection',
    'rowSelectionSelectedCount',
    'enableDataExport',
  ]),
  args: GRID,
}

// --- Действия шагов ------------------------------------------------------------------

/** Ввод в поле — как набор пользователя: React слышит событие `input`. */
const type = (field: HTMLElement | null, text: string) => {
  const input = field as HTMLInputElement | null
  if (!input || input.value === text) return
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const cellsOf = (root: ParentNode, column: string) =>
  orderedRows(root as HTMLElement).map(
    row =>
      row.querySelector(`[data-column-id="${column}"]`)?.textContent?.trim() ??
      '',
  )
const allMatch = (root: ParentNode, column: string, needle: string) => {
  const cells = cellsOf(root, column)
  return (
    cells.length > 0 &&
    cells.every(cell => cell.toLowerCase().includes(needle.toLowerCase()))
  )
}
const busy = (root: HTMLElement) =>
  root.querySelector('.data-grid__container')?.getAttribute('aria-busy') ===
  'true'
/** Описание поля поиска — колонки, по которым он идёт (ADR 0053). */
const searchHint = () => {
  const describedBy = byTestId('quick-search')?.getAttribute('aria-describedby')
  return (
    (describedBy && document.getElementById(describedBy)?.textContent) ?? ''
  )
}

// --- ADR 0045 S1 ---------------------------------------------------------------------

const NAME = 'Bob'

/** Пользователь фильтрует колонку имён по тексту и закрывает панель. */
const filterByName = async (root: HTMLElement, signal: AbortSignal) => {
  if (!allMatch(root, 'name', NAME)) {
    await openPanel(root, 'name', signal)
    type(byTestId('filter-value'), NAME)
    await pollUntil(() => {
      if (allMatch(root, 'name', NAME) && !busy(root)) return true
      // На сервере условие уходит кнопкой «Применить» (ADR 0154).
      byTestId('filter-apply')?.click()
      return false
    }, signal)
  }
  await closePanel(signal)
}

const TEXT: readonly GuideStoryStep[] = [
  {
    title: 'Таблица без фильтров',
    hint: 'У колонок есть кнопки фильтра в заголовках, показаны все строки.',
  },
  {
    title: 'Пользователь открыл фильтр колонки',
    hint: 'Панель фильтра предлагает условие и значение.',
    states: ['overlay.filterText'],
    enter: stepAction((root, { signal }) => openPanel(root, 'name', signal)),
  },
  {
    title: 'Пользователь задал значение',
    hint: 'Таблица показывает только подходящие строки, нижняя панель называет число показанных из общего. Кнопка фильтра отмечена как включённая.',
    states: ['head.activeIndicator'],
    enter: stepAction((root, { signal }) => filterByName(root, signal)),
  },
]

/** ADR 0045, S1: пользователь фильтрует колонку по тексту. */
export const FilteringText: StoryObj<StoryProps> = {
  name: 'Text filter',
  parameters: { scenario: '0045/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтр по тексту"
      steps={TEXT}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(TEXT[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(
        headCell(canvas, 'name')?.querySelector('.column-filter__button'),
      ).not.toBeNull()
      await expect(byTestId('filtered-rows-count')).toBeNull()
    })
    await step(TEXT[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(byTestId('filter-operator')).not.toBeNull()
      await expect(byTestId('filter-value')).not.toBeNull()
      await settle()
    })
    await step(TEXT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const shown = filteringData.filter(row => row.name.includes(NAME)).length
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
      await expect(filteredCount()).toBe(
        labels.filteredRows(shown, filteringData.length),
      )
      await expect(filterActive(canvas, 'name')).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0045 S2 ---------------------------------------------------------------------

/** Пользователь вводит запрос в поле поиска. */
const search = async (
  root: HTMLElement,
  text: string,
  done: () => boolean,
  signal: AbortSignal,
) => {
  await pollUntil(() => !!byTestId('quick-search'), signal)
  type(byTestId('quick-search'), text)
  await pollUntil(done, signal)
}

const EMPTY: readonly GuideStoryStep[] = [
  {
    title: 'Пользователь ищет',
    hint: 'Пользователь ввёл запрос в поле поиска. Таблица показывает только строки с совпадениями.',
    enter: stepAction((root, { signal }) =>
      search(root, NAME, () => allMatch(root, 'name', NAME), signal),
    ),
  },
  {
    title: 'Ничего не найдено',
    hint: 'Запрос не совпал ни с одной строкой. На месте строк — заглушка с возможностью сбросить фильтры и поиск, заголовки колонок остаются.',
    enter: stepAction((root, { signal }) =>
      search(root, 'zzz', () => !!byTestId('filter-stub'), signal),
    ),
  },
]

/** ADR 0045, S2: пользователь ищет и ничего не находит. */
export const FilteringEmpty: StoryObj<StoryProps> = {
  name: 'Empty result',
  parameters: { scenario: '0045/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Ничего не найдено"
      steps={EMPTY}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EMPTY[0]!.title, async () => {
      await waitForRows(canvas)
      await stepDone(canvas)
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
    })
    await step(EMPTY[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(orderedRows(canvas)).toHaveLength(0)
      await expect(byTestId('filter-stub-reset')).not.toBeNull()
      await expect(headCell(canvas, 'name')).not.toBeNull()
      await settle()
    })
  },
}

// --- ADR 0045 S3 ---------------------------------------------------------------------

const SERVER_DELAY_MS = 600
const SEARCH = 'paris'

/** Запрос, который приложение отправило «серверу» последним. */
const request = {
  filters: [] as ServerFilters,
  search: '',
  columnIds: [] as string[],
  seq: 0,
  table: undefined as unknown,
}

/** «Сервер» отвечает с задержкой; пока отвечает — таблица обновляет данные. */
const refetch = (app: GuideApp, log: ConsoleLog) => {
  const seq = ++request.seq
  app.update(props => ({ ...props, loading: 'refresh' }))
  setTimeout(() => {
    if (seq !== request.seq) return
    const rows = queryFiltering(
      request.filters,
      request.search,
      request.columnIds,
    )
    log.log('server', `${rows.length} of ${SERVER_TOTAL} rows`)
    app.update(props => ({
      ...props,
      loading: false,
      dataOverride: rows,
      rowCount: rows.length,
    }))
  }, SERVER_DELAY_MS)
}

/** Новое открытие таблицы — новый запрос: прежний ответ ему не принадлежит. */
const serverReset: TesseraFeatureEntry = {
  id: 'filteringServerReset',
  setup: table => {
    // `setup` повторяется при смене аргументов плагинов, а обёртка таблицы новая на каждом
    // рендере: новое открытие узнаётся по хранилищу состояния.
    const store = (table as { store: unknown }).store
    if (request.table === store) return
    request.table = store
    request.filters = []
    request.search = ''
    request.columnIds = []
    request.seq += 1
  },
}

const serverAnswered = (root: HTMLElement) => !busy(root)

/** Пользователь скрывает колонку возраста в меню колонок. */
const hideAge = async (root: HTMLElement, signal: AbortSignal) => {
  const ageBox = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="column-visibility-menu"] [data-column-id="age"] [role="checkbox"]',
    )
  if (!headCell(root, 'age')) return
  await repeat(
    () => !!ageBox(),
    () =>
      root
        .querySelector<HTMLElement>('[data-testid="column-visibility-button"]')
        ?.click(),
    signal,
  )
  await repeat(
    () => !headCell(root, 'age'),
    () => ageBox()?.click(),
    signal,
  )
  await repeat(
    () => !document.querySelector('[data-testid="column-visibility-menu"]'),
    pressEscape,
    signal,
  )
}

const SERVER: readonly GuideStoryStep[] = [
  {
    title: 'Фильтрует сервер',
    hint: 'Таблица не фильтрует сама: условия уходят приложению, оно перезапрашивает данные у сервера.',
    props: ({ app, log }) => ({
      onFilterChange: (filters: ServerFilters) => {
        request.filters = filters
        refetch(app, log)
      },
      onSearchChange: (
        text: string,
        { columnIds }: { columnIds: string[] },
      ) => {
        request.search = text
        request.columnIds = columnIds
        refetch(app, log)
      },
    }),
  },
  {
    title: 'Пользователь отфильтровал по имени',
    hint: 'Запрос ушёл серверу, пока он отвечает, таблица в состоянии обновления данных. Пришли строки с этим именем, нижняя панель называет число из ответа сервера.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await filterByName(root, signal)
      await pollUntil(() => serverAnswered(root), signal)
    }),
  },
  {
    title: 'Пользователь добавил поиск',
    hint: 'Поиск ушёл серверу вместе со списком колонок, по которым он идёт. Пришли строки, подходящие под оба условия.',
    enter: stepAction(async (root, { signal }) => {
      await filterByName(root, signal)
      await search(
        root,
        SEARCH,
        () =>
          allMatch(root, 'city', SEARCH) &&
          allMatch(root, 'name', NAME) &&
          serverAnswered(root),
        signal,
      )
    }),
  },
  {
    title: 'Пользователь скрыл колонку',
    hint: 'Колонка ушла и из поиска: приложение повторило запрос с новым списком колонок, подсказка поля поиска его называет.',
    enter: stepAction(async (root, { signal }) => {
      await filterByName(root, signal)
      await search(
        root,
        SEARCH,
        () => allMatch(root, 'city', SEARCH) && serverAnswered(root),
        signal,
      )
      await hideAge(root, signal)
      await pollUntil(
        () => !request.columnIds.includes('age') && serverAnswered(root),
        signal,
      )
    }),
  },
]

/** ADR 0045, S3: фильтры и поиск идут на сервер. */
export const FilteringServer: StoryObj<StoryProps> = {
  name: 'Server',
  parameters: {
    scenario: '0045/S3',
    requirements: ['FL37', 'QS9'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Фильтры на сервере"
      steps={SERVER}
      args={guideArgs(
        {
          ...GRID,
          dataOverride: SERVER_DATA,
          enableColumnVisibility: true,
          dataMode: { filtering: 'server', search: 'server' },
          rowCount: SERVER_TOTAL,
          totalRowCount: SERVER_TOTAL,
          extraPlugins: [serverReset],
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const count = (searched: string, columnIds: string[]) =>
      queryFiltering(
        [{ id: 'name', value: { operator: 'contains', value: NAME } }],
        searched,
        columnIds,
      ).length
    await step(SERVER[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(orderedRows(canvas).length).toBeGreaterThan(0)
    })
    await step(SERVER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(consoleText()).toContain('onFilterChange')
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
      await expect(filteredCount()).toBe(
        labels.filteredRows(count('', []), SERVER_TOTAL),
      )
    })
    await step(SERVER[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const columns = ['name', 'city', 'age', 'visits']
      await expect(consoleText()).toContain('onSearchChange')
      await expect(filteredCount()).toBe(
        labels.filteredRows(count(SEARCH, columns), SERVER_TOTAL),
      )
      await expect(searchHint()).toBe(
        labels.searchColumnsHint(['Name', 'City', 'Age', 'Visits']),
      )
    })
    await step(SERVER[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(searchHint()).toBe(
        labels.searchColumnsHint(['Name', 'City', 'Visits']),
      )
      await settle()
    })
  },
}

// --- ADR 0169 S1 ---------------------------------------------------------------------

/** «Сервер» фильтрует колонки, а поиска не видит: искать по пришедшим строкам — таблице. */
const refetchFilters = (app: GuideApp, log: ConsoleLog) => {
  const seq = ++request.seq
  app.update(props => ({ ...props, loading: 'refresh' }))
  setTimeout(() => {
    if (seq !== request.seq) return
    const rows = queryFiltering(request.filters, '', [])
    log.log('server', `${rows.length} of ${SERVER_TOTAL} rows`)
    app.update(props => ({
      ...props,
      loading: false,
      dataOverride: rows,
      rowCount: rows.length,
    }))
  }, SERVER_DELAY_MS)
}

const searchedOnClient = (root: HTMLElement) =>
  allMatch(root, 'city', SEARCH) && serverAnswered(root)

const MIXED: readonly GuideStoryStep[] = [
  {
    title: 'Фильтры на сервере, поиск в таблице',
    hint: 'Условия фильтров колонок уходят приложению, оно перезапрашивает строки у сервера. Поиск таблица ведёт сама — по строкам, которые уже пришли.',
    props: ({ app, log }) => ({
      onFilterChange: (filters: ServerFilters) => {
        request.filters = filters
        refetchFilters(app, log)
      },
    }),
  },
  {
    title: 'Пользователь ищет',
    hint: 'Запроса к серверу нет: таблица сразу оставила строки с найденным текстом, нижняя панель называет, сколько их из всех строк сервера.',
    enter: stepAction(async (root, { signal }) => {
      await search(root, SEARCH, () => searchedOnClient(root), signal)
    }),
  },
  {
    title: 'Пользователь отфильтровал по имени',
    hint: 'Фильтр колонки ушёл серверу, пока он отвечает, таблица в состоянии обновления данных. Пришли строки с этим именем, и поиск сразу сузил их.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await search(root, SEARCH, () => searchedOnClient(root), signal)
      await filterByName(root, signal)
      await pollUntil(
        () => allMatch(root, 'name', NAME) && searchedOnClient(root),
        signal,
      )
    }),
  },
]

/** ADR 0169, S1: фильтры колонок идут на сервер, поиск — по загруженным строкам. */
export const FilteringServerFiltersClientSearch: StoryObj<StoryProps> = {
  name: 'Server filters, client search',
  parameters: { scenario: '0169/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтры на сервере, поиск в таблице"
      steps={MIXED}
      args={guideArgs(
        {
          ...GRID,
          dataOverride: SERVER_DATA,
          dataMode: { filtering: 'server' },
          rowCount: SERVER_TOTAL,
          totalRowCount: SERVER_TOTAL,
          extraPlugins: [serverReset],
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const columns = ['name', 'city', 'age', 'visits']
    const nameFilter = [
      { id: 'name', value: { operator: 'contains', value: NAME } },
    ]
    await step(MIXED[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(orderedRows(canvas).length).toBeGreaterThan(0)
    })
    await step(MIXED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(allMatch(canvas, 'city', SEARCH)).toBe(true)
      await expect(filteredCount()).toBe(
        labels.filteredRows(
          queryFiltering([], SEARCH, columns).length,
          SERVER_TOTAL,
        ),
      )
      await expect(consoleText()).not.toContain('onSearchChange')
    })
    await step(MIXED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(consoleText()).toContain('onFilterChange')
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
      await expect(filteredCount()).toBe(
        labels.filteredRows(
          queryFiltering(nameFilter as ServerFilters, SEARCH, columns).length,
          SERVER_TOTAL,
        ),
      )
      await settle()
    })
  },
}

// --- ADR 0045 S4 ---------------------------------------------------------------------

const CITY = 'Rome'

const TREE = [
  {
    id: 'item-id-0',
    name: 'Europe',
    city: '—',
    age: null,
    vip: null,
    visits: 0,
    isGroup: true,
    subRows: [
      {
        id: 'item-id-1',
        name: 'France',
        city: '—',
        age: null,
        vip: null,
        visits: 0,
        isGroup: true,
        subRows: [
          {
            id: 'item-id-2',
            name: 'Alice',
            city: 'Paris',
            age: 31,
            vip: true,
            visits: 4,
          },
          {
            id: 'item-id-3',
            name: 'Bob',
            city: 'Lyon',
            age: 45,
            vip: false,
            visits: 2,
          },
        ],
      },
      {
        id: 'item-id-4',
        name: 'Italy',
        city: '—',
        age: null,
        vip: null,
        visits: 0,
        isGroup: true,
        subRows: [
          {
            id: 'item-id-5',
            name: 'Carol',
            city: 'Rome',
            age: 27,
            vip: true,
            visits: 9,
          },
        ],
      },
    ],
  },
]

const TREE_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Дерево раскрыто',
    hint: 'Строки сгруппированы по регионам и странам.',
  },
  {
    title: 'Пользователь отфильтровал город',
    hint: 'Остались строки с этим городом и их предки. Ветки без совпадений скрыты целиком.',
    enter: stepAction(async (root, { signal }) => {
      if (!treeFiltered(root)) {
        await openPanel(root, 'city', signal)
        type(byTestId('filter-value'), CITY)
        await pollUntil(() => treeFiltered(root), signal)
      }
      await closePanel(signal)
    }),
  },
]

const treeIds = (root: HTMLElement) =>
  orderedRows(root).map(row => row.dataset.rowId)
const treeFiltered = (root: HTMLElement) =>
  treeIds(root).join() === 'item-id-0,item-id-4,item-id-5'

/** ADR 0045, S4: пользователь фильтрует дерево — предки найденных строк остаются. */
export const FilteringTree: StoryObj<StoryProps> = {
  name: 'Tree',
  parameters: { scenario: '0045/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтр дерева"
      steps={TREE_STEPS}
      args={guideArgs(
        {
          ...GRID,
          dataOverride: TREE,
          enableRowExpanding: true,
          rowExpandingMaxDepth: 5,
          initialExpanded: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TREE_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(treeIds(canvas)).toContain('item-id-1'))
    })
    await step(TREE_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(treeFiltered(canvas)).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0053 S1 ---------------------------------------------------------------------

const searchDisabled = () =>
  byTestId('quick-search')?.getAttribute('aria-disabled') === 'true' ||
  !!(byTestId('quick-search') as HTMLInputElement | null)?.disabled

const NO_COLUMNS: readonly GuideStoryStep[] = [
  {
    title: 'Таблица с поиском',
    hint: 'Поиск идёт по колонкам с текстом.',
  },
  {
    title: 'Приложение убрало колонки из поиска',
    hint: 'Ни одна колонка не участвует в поиске: поле поиска недоступно, причина — в его подсказке. Фильтры колонок при этом работают.',
    props: () => ({
      columnsOverride: [
        { ...filteringColumns[0], enableGlobalFilter: false },
        filteringColumns[3],
      ],
    }),
  },
]

/** ADR 0053, S1: искать негде — поле поиска недоступно, фильтры работают. */
export const QuickSearchNoColumns: StoryObj<StoryProps> = {
  name: 'Quick search — no searchable columns',
  parameters: { scenario: '0053/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Искать негде"
      steps={NO_COLUMNS}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NO_COLUMNS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(byTestId('quick-search')).not.toBeNull())
      await expect(searchDisabled()).toBe(false)
    })
    await step(NO_COLUMNS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(searchDisabled()).toBe(true))
      await expect(searchHint()).not.toBe('')
      await expect(
        headCell(canvas, 'name')?.querySelector('.column-filter__button'),
      ).not.toBeNull()
      await settle()
    })
  },
}

// --- ADR 0047 S1 ---------------------------------------------------------------------

const DATES = {
  ...GRID,
  columnsOverride: dateFilteringColumns,
  dataOverride: dateFilteringData,
  timeZone: 'UTC',
} satisfies Partial<StoryProps>

const createdFiltered = (root: HTMLElement) =>
  !!byTestId('filtered-rows-count') && filterActive(root, 'createdAt')
const birthFiltered = (root: HTMLElement) => filterActive(root, 'birthDate')

/** Пользователь выбирает день создания и закрывает панель. */
const filterCreated = async (root: HTMLElement, signal: AbortSignal) => {
  if (!createdFiltered(root)) {
    await openPanel(root, 'createdAt', signal)
    await pickDay('2026', 2, '2026-03-15', signal)
    await pollUntil(() => createdFiltered(root), signal)
  }
  await closePanel(signal)
}

const DATE_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Колонки с датами',
    hint: 'В таблице есть колонка с датой рождения и колонка с моментом создания со временем.',
  },
  {
    title: 'Пользователь открыл фильтр даты',
    hint: 'Панель предлагает условие и календарь для выбора дня.',
    states: ['overlay.filterDate'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'createdAt', signal)
      await pollUntil(() => !!calendar(), signal)
    }),
  },
  {
    title: 'Пользователь выбрал день',
    hint: 'Остались строки, созданные в этот день по часовому поясу таблицы.',
    enter: stepAction((root, { signal }) => filterCreated(root, signal)),
  },
  {
    title: 'Приложение сменило часовой пояс',
    hint: 'Тот же день в другом поясе — другие строки: часть ушла в соседний день.',
    props: () => ({ timeZone: 'Asia/Tokyo' }),
    enter: stepAction((root, { signal }) => filterCreated(root, signal)),
  },
  {
    title: 'Пользователь добавил условие на дату рождения',
    hint: 'Оба фильтра действуют вместе, нижняя панель называет число оставшихся строк.',
    enter: stepAction(async (root, { signal }) => {
      await filterCreated(root, signal)
      if (!birthFiltered(root)) {
        await openPanel(root, 'birthDate', signal)
        await chooseOperator('before', signal)
        await pickDay('1980', 2, '1980-03-01', signal)
        await pollUntil(() => birthFiltered(root), signal)
      }
      await closePanel(signal)
    }),
  },
]

/** ADR 0047, S1: пользователь фильтрует по датам — день, часовой пояс, второе условие. */
export const FilteringDates: StoryObj<StoryProps> = {
  name: 'Dates',
  parameters: {
    scenario: '0047/S1',
    requirements: ['DF21'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Фильтр по датам"
      steps={DATE_STEPS}
      args={guideArgs(DATES, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const total = dateFilteringData.length
    await step(DATE_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(headCell(canvas, 'birthDate')).not.toBeNull()
      await expect(headCell(canvas, 'createdAt')).not.toBeNull()
    })
    await step(DATE_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(calendar()).not.toBeNull()
      await expect(byTestId('filter-operator')).not.toBeNull()
      await settle()
    })
    await step(DATE_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toBe(labels.filteredRows(20, total))
    })
    await step(DATE_STEPS[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(filteredCount()).toBe(labels.filteredRows(14, total)),
      )
    })
    await step(DATE_STEPS[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toMatch(
        labelPattern(args.locale, n => labels.filteredRows(n, total), '[1-9]'),
      )
      await expect(createdFiltered(canvas) && birthFiltered(canvas)).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0048 S1 ---------------------------------------------------------------------

const OPTIONS = {
  ...GRID,
  columnsOverride: optionFilteringColumns,
  dataOverride: optionFilteringData,
} satisfies Partial<StoryProps>

const statusFiltered = (root: HTMLElement) =>
  cellsOf(root, 'status').length > 0 && filterActive(root, 'status')

/** Пользователь отмечает статус и закрывает панель. */
const filterStatus = async (root: HTMLElement, signal: AbortSignal) => {
  if (!statusFiltered(root)) {
    await openPanel(root, 'status', signal)
    await pollUntil(() => !!byTestId('filter-options'), signal)
    await checkOption('won', signal)
    await pollUntil(() => statusFiltered(root), signal)
  }
  await closePanel(signal)
}

const OPTION_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Колонки с вариантами',
    hint: 'Статус, метки и город принимают значения из списка.',
  },
  {
    title: 'Пользователь открыл фильтр статуса',
    hint: 'Панель — список вариантов с числом строк у каждого.',
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'status', signal)
      await pollUntil(() => !!byTestId('filter-options'), signal)
    }),
  },
  {
    title: 'Пользователь отметил вариант',
    hint: 'Остались строки с этим статусом.',
    enter: stepAction((root, { signal }) => filterStatus(root, signal)),
  },
  {
    title: 'Пользователь потребовал обе метки',
    hint: 'Условие меток — все отмеченные сразу. Остались строки с обеими метками, числа у вариантов учитывают фильтр статуса.',
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await filterStatus(root, signal)
      await openPanel(root, 'tags', signal)
      await pollUntil(() => !!byTestId('filter-options'), signal)
      await chooseOperator('allOf', signal)
      await checkOption('vip', signal)
      await checkOption('churn-risk', signal)
    }),
  },
]

/** ADR 0048, S1: пользователь отмечает варианты — счётчики учитывают другие фильтры. */
export const FilteringOptions: StoryObj<StoryProps> = {
  name: 'Select & multiselect',
  parameters: {
    scenario: '0048/S1',
    requirements: ['SF23'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Фильтр вариантов"
      steps={OPTION_STEPS}
      args={guideArgs(OPTIONS, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const total = optionFilteringData.length
    const count = (value: string) =>
      Number(
        optionOf(value)?.querySelector('[data-testid="filter-option-count"]')
          ?.textContent ?? NaN,
      )
    await step(OPTION_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(cellsOf(canvas, 'status').length).toBeGreaterThan(0)
    })
    await step(OPTION_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(count('won')).toBeGreaterThan(0)
      await settle()
    })
    await step(OPTION_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(new Set(cellsOf(canvas, 'status')).size).toBe(1)
      await expect(filteredCount()).toMatch(
        labelPattern(args.locale, n => labels.filteredRows(n, total)),
      )
    })
    await step(OPTION_STEPS[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const both = optionFilteringData.filter(
        row =>
          row.status === 'won' &&
          ['vip', 'churn-risk'].every(tag =>
            (row.tags as string[]).includes(tag),
          ),
      ).length
      await expect(both).toBeGreaterThan(0)
      await until(() =>
        expect(filteredCount()).toBe(labels.filteredRows(both, total)),
      )
      await expect(count('vip')).toBeLessThan(
        optionFilteringData.filter(row =>
          (row.tags as string[]).includes('vip'),
        ).length,
      )
      await settle()
    })
  },
}

// --- ADR 0048 S2 ---------------------------------------------------------------------

const LOOKUP_DELAY_MS = 400
const MANAGER = 'm0'

/** Колонки со справочником менеджеров на «сервере»: одни на журнал истории. */
const lookupColumns = new WeakMap<ConsoleLog, unknown[]>()
const lookupColumnsOf = (log: ConsoleLog) => {
  if (!lookupColumns.has(log))
    lookupColumns.set(
      log,
      optionFilteringColumns.map(column =>
        column.id === 'managerId'
          ? {
              ...column,
              dataType: 'select',
              loadOptions: (text: string, context: { signal: AbortSignal }) => {
                log.log('loadOptions', describeEvent({ search: text }))
                return loadManagers(text, context, LOOKUP_DELAY_MS)
              },
            }
          : column,
      ),
    )
  return lookupColumns.get(log)!
}

let lookupSeq = 0
/** Номер запроса, на который «сервер» уже ответил. */
let lookupAnswered = 0
const optionNames = () =>
  [
    ...document.querySelectorAll(
      '[data-testid="filter-panel"] [data-option-index]',
    ),
  ].map(item => item.textContent ?? '')
const managerFiltered = (root: HTMLElement) =>
  filterActive(root, 'managerId') && !busy(root)

/** Пользователь ищет менеджера в панели. */
const searchManager = async (root: HTMLElement, signal: AbortSignal) => {
  await openPanel(root, 'managerId', signal)
  await pollUntil(() => !!byTestId('filter-options-search'), signal)
  type(byTestId('filter-options-search'), 'alice')
  await pollUntil(
    () =>
      optionNames().length > 0 &&
      optionNames().every(name => name.startsWith('Alice')),
    signal,
  )
}

/** Пользователь выбирает менеджера, сервер отвечает. */
const filterManager = async (root: HTMLElement, signal: AbortSignal) => {
  if (!managerFiltered(root)) {
    await searchManager(root, signal)
    await checkOption(MANAGER, signal)
    await pollUntil(() => {
      if (managerFiltered(root)) return true
      byTestId('filter-apply')?.click()
      return false
    }, signal)
    await closePanel(signal)
    await pollUntil(
      () => lookupSeq > 0 && lookupAnswered === lookupSeq && !busy(root),
      signal,
    )
  }
  await closePanel(signal)
}

const LOOKUP: readonly GuideStoryStep[] = [
  {
    title: 'Справочник менеджеров на сервере',
    hint: 'Вариантов слишком много, панель загружает их с сервера.',
    props: ({ app, log }) => ({
      columnsOverride: lookupColumnsOf(log) as StoryProps['columnsOverride'],
      onFilterChange: (filters: ServerFilters) => {
        const seq = ++lookupSeq
        app.update(props => ({ ...props, loading: 'refresh' }))
        setTimeout(() => {
          if (seq !== lookupSeq) return
          const rows = queryOptions(filters)
          log.log('server', `${rows.length} of ${OPTION_TOTAL} rows`)
          lookupAnswered = seq
          app.update(props => ({
            ...props,
            loading: false,
            dataOverride: rows,
            rowCount: rows.length,
          }))
        }, LOOKUP_DELAY_MS)
      },
    }),
  },
  {
    title: 'Пользователь ищет менеджера',
    hint: 'Поиск в панели ушёл серверу, список сузился до найденных.',
    states: ['overlay.filterOptions'],
    enter: stepAction((root, { signal }) => searchManager(root, signal)),
  },
  {
    title: 'Пользователь выбрал менеджера',
    hint: 'Пользователь отметил менеджера и применил фильтр. Фильтр ушёл приложению, сервер вернул строки этого менеджера.',
    enter: stepAction((root, { signal }) => filterManager(root, signal)),
  },
  {
    title: 'Пользователь открыл сводку фильтров',
    hint: 'Менеджер в сводке назван по имени, а не по коду.',
    enter: stepAction(async (root, { signal }) => {
      await filterManager(root, signal)
      await repeat(
        () => !!byTestId('filter-summary'),
        () => byTestId('filter-summary-button')?.click(),
        signal,
      )
    }),
  },
]

/** ADR 0048, S2: справочник на сервере — поиск в панели, выбор, сводка по имени. */
export const FilteringLookupServer: StoryObj<StoryProps> = {
  name: 'Lookup (server)',
  parameters: {
    scenario: '0048/S2',
    requirements: ['SF24'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Справочник на сервере"
      steps={LOOKUP}
      args={guideArgs(
        {
          ...OPTIONS,
          // Ниже обычного: панель со списком встаёт под заголовком, а не над таблицей.
          containerHeight: '420',
          height: '320',
          maxHeight: '320',
          dataOverride: OPTION_SERVER_DATA,
          enableQuickSearch: false,
          dataMode: { filtering: 'server' },
          rowCount: OPTION_TOTAL,
          totalRowCount: OPTION_TOTAL,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(LOOKUP[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(headCell(canvas, 'managerId')).not.toBeNull()
    })
    await step(LOOKUP[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(consoleText()).toContain('loadOptions')
      await expect(consoleText()).toContain('search="alice"')
      await settle()
    })
    await step(LOOKUP[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(consoleText()).toContain('onFilterChange'))
      await expect(consoleText()).toMatch(/\d+ of 200 rows/)
    })
    await step(LOOKUP[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(byTestId('filter-summary')).toHaveTextContent(
        `${labels.filterAnyOf}: Alice Moss`,
      )
      await settle()
    })
  },
}

/** Таблица гайдов S3 и S8: свои колонки и данные в области фиксированной высоты. */
const FILTERING_GUIDE = {
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
  columnsOverride: filteringColumns,
  dataOverride: filteringData,
} satisfies Partial<StoryProps>

const searchedCity = filteringData[0]!.city as string

const EXTERNAL_FORM: readonly GuideStoryStep[] = [
  {
    title: 'Все строки',
    hint: 'Фильтрами и поиском управляет форма приложения над таблицей. В заголовках нет кнопок фильтра, в тулбаре нет поля поиска.',
    props: () => ({
      enableColumnFilteringModel: true,
      enableQuickSearchModel: true,
    }),
  },
  {
    title: `Приложение ищет «${searchedCity}»`,
    hint: 'Пользователь ввёл город в поле поиска приложения. Таблица показывает только строки с этим городом.',
    props: () => ({ quickSearchModelGlobalFilter: searchedCity }),
  },
  {
    title: 'Приложение фильтрует возраст старше 30',
    hint: 'Пользователь задал в форме приложения возраст старше 30. Таблица показывает строки, которые подходят и под поиск, и под фильтр.',
    props: () => ({
      columnFilteringModelColumnFilters: [
        { id: 'age', value: { operator: 'greaterThan', value: 30 } },
      ],
    }),
  },
]

/** ADR 0120, S3: приложение фильтрует и ищет из своей формы — модели без кнопок и поля. */
export const FilteringExternalForm: StoryObj<StoryProps> = {
  name: 'External form',
  parameters: {
    scenario: '0120/S3',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Фильтры и поиск из формы приложения"
      steps={EXTERNAL_FORM}
      args={guideArgs(FILTERING_GUIDE, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(EXTERNAL_FORM[0].title, async () => {
      await waitForRows(canvas)
      expect(canvas.querySelector('.column-filter__button')).toBeNull()
      expect(canvas.querySelector('[data-testid="quick-search"]')).toBeNull()
    })
    await step(EXTERNAL_FORM[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          cellsOf(canvas, 'city').every(city => city === searchedCity),
        ).toBe(true),
      )
    })
    await step(EXTERNAL_FORM[2].title, async () => {
      await guideNext(canvas)
      await until(() => {
        const ages = cellsOf(canvas, 'age').map(Number)
        expect(ages.length).toBeGreaterThan(0)
        expect(ages.every(age => age > 30)).toBe(true)
      })
      expect(cellsOf(canvas, 'city').every(city => city === searchedCity)).toBe(
        true,
      )
    })
    await settle()
  },
}

// --- ADR 0120, S8 --------------------------------------------------------------------

/** Сохранённый вид, как его прочитало приложение из адреса `?sort=-age&age>30&page=2`. */
const SAVED_VIEW = {
  columnSortingInitialSorting: [{ id: 'age', desc: true }],
  columnFilteringInitialColumnFilters: [
    { id: 'age', value: { operator: 'greaterThan', value: 30 } },
  ],
  paginationInitialPagination: { pageIndex: 1, pageSize: 5 },
} as Partial<StoryProps>

const rangeText = (root: ParentNode) =>
  root.querySelector('[data-testid="pagination-range"]')?.textContent ?? ''

const SAVED_VIEW_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Вид по умолчанию',
    hint: 'Таблица открыта без сохранённого вида. Строки идут в порядке данных, без фильтров, на первой странице.',
    props: () => ({
      enableColumnSorting: true,
      enableColumnFiltering: true,
      enablePagination: true,
    }),
  },
  {
    title: 'Открыта сохранённая ссылка',
    hint: 'Пользователь открыл ссылку с сохранённым видом, и приложение прочитало его из адреса страницы. Таблица открылась с сортировкой по убыванию возраста, с возрастом старше 30, на второй странице.',
    props: () => SAVED_VIEW,
    remount: true,
  },
  {
    title: 'Пользователь листает дальше',
    hint: 'Пользователь перешёл на следующую страницу пейджером таблицы. Дальше видом управляет таблица: сортировка и фильтр сохраняются, видна третья страница.',
    // Со второй страницы сохранённого вида — на третью.
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => /^(6|11)–/.test(rangeText(root)), signal)
      if (rangeText(root).startsWith('6–')) {
        root
          .querySelector<HTMLElement>(
            '[data-testid="pagination"] [data-page-action="next"]',
          )!
          .click()
      }
      await pollUntil(() => rangeText(root).startsWith('11–'), signal)
    }),
  },
]

/** ADR 0120, S8: приложение восстанавливает сохранённый вид из адреса аргументами плагинов. */
export const SavedViewRestore: StoryObj<StoryProps> = {
  name: 'Saved view',
  parameters: {
    scenario: '0120/S8',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Вид из адреса страницы"
      steps={SAVED_VIEW_STEPS}
      args={guideArgs(FILTERING_GUIDE, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const ages = () => cellsOf(canvas, 'age').map(Number)
    await step(SAVED_VIEW_STEPS[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(rangeText(canvas)).toMatch(/^1–/))
      expect(ages()).toEqual(
        filteringData.slice(0, ages().length).map(row => Number(row.age)),
      )
    })
    await step(SAVED_VIEW_STEPS[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(rangeText(canvas)).toMatch(/^6–10 /))
      const shown = ages()
      expect(shown.every(age => age > 30)).toBe(true)
      expect(shown.every((age, i) => i === 0 || shown[i - 1]! >= age)).toBe(
        true,
      )
    })
    await step(SAVED_VIEW_STEPS[2].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(rangeText(canvas)).toMatch(/^11–15 /)
      const shown = ages()
      expect(shown.every(age => age > 30)).toBe(true)
      expect(shown.every((age, i) => i === 0 || shown[i - 1]! >= age)).toBe(
        true,
      )
    })
    await settle()
  },
}

// --- ADR 0153 S7 ---------------------------------------------------------------------

const FILTER_BUTTON =
  '.data-grid__head-cell[data-column-id="name"] .column-filter__button'
const filterButtonOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(FILTER_BUTTON)
const refreshingGrid = (root: HTMLElement) =>
  !!root.querySelector('.data-grid-theme[data-refreshing]')
/** Запрос фильтра ждёт сервера: ожидание — свечение под шапкой (ADR 0177, §1). */
const filterWaits = refreshingGrid
const pendingBannerOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-banner"]')
const pendingCancelOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-cancel"]')

/**
 * «Сервер» гайда отмены фильтра: отвечает только тогда, когда его не отменили; запрос
 * учитывает `signal` (ADR 0153, §1). Гайд отменяет запрос, ответа он не ждёт.
 */
const heldFilter =
  (log: ConsoleLog) =>
  (filters: ServerFilters, { signal }: { signal: AbortSignal }) =>
    new Promise<void>((_resolve, reject) => {
      log.log('server', `filter ${JSON.stringify(filters)}`)
      signal.addEventListener(
        'abort',
        () => {
          log.log('server', 'cancelled')
          reject(signal.reason)
        },
        { once: true },
      )
    })

/** Фильтр по имени ждёт ответа сервера, панель закрыта, кнопка без фокуса. */
const filterHeld = async (root: HTMLElement, signal: AbortSignal) => {
  if (!filterWaits(root)) {
    await openPanel(root, 'name', signal)
    type(byTestId('filter-value'), NAME)
    await pollUntil(() => {
      if (filterWaits(root)) return true
      byTestId('filter-apply')?.click()
      return false
    }, signal)
  }
  await closePanel(signal)
}

/** Фильтр ждёт дольше порога: под шапкой плашка с кнопкой отмены. */
const filterLong = async (root: HTMLElement, signal: AbortSignal) => {
  await filterHeld(root, signal)
  await pollUntil(() => !!pendingCancelOf(root), signal)
}

const CANCEL_FILTER: readonly GuideStoryStep[] = [
  {
    title: 'Фильтр на сервере',
    hint: 'Условия фильтра колонки применяет сервер.',
    props: ({ log }) => ({ onFilterChange: heldFilter(log) }),
  },
  {
    title: 'Фильтр ждёт',
    hint: 'Пользователь задал условие в панели фильтра, применил его и закрыл панель. Пока сервер фильтрует строки, под шапкой светится полоса обновления.',
    states: ['body.refreshing'],
    immediate: true,
    enter: stepAction((root, { signal }) => filterHeld(root, signal)),
  },
  {
    title: 'Фильтр идёт долго',
    hint: 'Сервер не ответил за секунду. Под шапкой появилась плашка о фильтрации с кнопкой отмены.',
    states: ['body.refreshing'],
    enter: stepAction((root, { signal }) => filterLong(root, signal)),
  },
  {
    title: 'Фильтр отменён',
    hint: 'Пользователь нажал отмену в плашке. Условие снято, кнопка фильтра снова без отметки включённого фильтра, плашка и свечение ушли, строки прежние.',
    enter: stepAction(async (root, { signal }) => {
      await filterLong(root, signal)
      pendingCancelOf(root)!.click()
      await pollUntil(
        () =>
          !filterActive(root, 'name') &&
          !pendingBannerOf(root) &&
          !refreshingGrid(root),
        signal,
      )
    }),
  },
]

/** ADR 0153, S7: серверный фильтр колонки ждёт — человек отменяет его в плашке под шапкой. */
export const FilteringServerCancel: StoryObj<StoryProps> = {
  name: 'Cancel a server filter',
  parameters: { scenario: '0153/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отмена фильтра на сервере"
      steps={CANCEL_FILTER}
      args={guideArgs(
        {
          ...GRID,
          dataOverride: SERVER_DATA,
          dataMode: { filtering: 'server' },
          rowCount: SERVER_TOTAL,
          totalRowCount: SERVER_TOTAL,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    let firstName = ''
    await step(CANCEL_FILTER[0]!.title, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
      await expect(filterActive(canvas, 'name')).toBe(false)
    })
    await step(CANCEL_FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterWaits(canvas)).toBe(true)
      await expect(panel()).toBeNull()
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(CANCEL_FILTER[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBannerOf(canvas)).toHaveTextContent(
        labels.pendingFiltering,
      )
      await expect(pendingCancelOf(canvas)).toHaveTextContent(labels.cancel)
      await settle()
    })
    await step(CANCEL_FILTER[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterActive(canvas, 'name')).toBe(false)
      await expect(byTestId('load-error-banner')).toBeNull()
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
      await expect(consoleText()).toContain('cancelled')
      await settle()
    })
  },
}

// --- ADR 0154 S1 ---------------------------------------------------------------------

/** «Сервер» гайда: считает запросы и отвечает, когда шаг его отпустит. */
const applyServer = {
  requests: 0,
  release: undefined as (() => void) | undefined,
  table: undefined as unknown,
}

const applyServerReset: TesseraFeatureEntry = {
  id: 'filteringApplyReset',
  setup: table => {
    const store = (table as { store: unknown }).store
    if (applyServer.table === store) return
    applyServer.table = store
    applyServer.requests = 0
    applyServer.release = undefined
  },
}

const heldUntilRelease =
  (app: GuideApp, log: ConsoleLog) =>
  (filters: ServerFilters, { signal }: { signal: AbortSignal }) =>
    new Promise<void>((resolve, reject) => {
      applyServer.requests += 1
      log.log('server', `request ${applyServer.requests}`)
      applyServer.release = () => {
        const rows = queryFiltering(filters, '', [])
        log.log('server', `${rows.length} of ${SERVER_TOTAL} rows`)
        app.update(props => ({
          ...props,
          dataOverride: rows,
          rowCount: rows.length,
        }))
        resolve()
      }
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      })
    })

const applyButton = () => byTestId('filter-apply') as HTMLButtonElement | null
const applyEnabled = () => !!applyButton() && !applyButton()!.disabled
const filterValueText = () =>
  (byTestId('filter-value') as HTMLInputElement | null)?.value ?? ''

/** Панель фильтра имён открыта, имя набрано, запрос не ушёл. */
const nameTyped = (root: HTMLElement, signal: AbortSignal) =>
  pollUntil(() => {
    if (!panel()) filterButtonOf(root)?.click()
    else type(byTestId('filter-value'), NAME)
    return !!panel() && filterValueText() === NAME && applyEnabled()
  }, signal)

/** Панель фильтра имён открыта. */
const namePanelOpen = (root: HTMLElement, signal: AbortSignal) =>
  pollUntil(() => {
    if (!panel()) filterButtonOf(root)?.click()
    return !!panel()
  }, signal)

/** Условие применено кнопкой, ответ ещё в пути. */
const nameApplied = async (root: HTMLElement, signal: AbortSignal) => {
  if (!filterWaits(root)) await nameTyped(root, signal)
  await pollUntil(() => {
    if (filterWaits(root)) return true
    if (applyEnabled()) applyButton()!.click()
    return false
  }, signal)
}

const APPLY: readonly GuideStoryStep[] = [
  {
    title: 'Фильтр на сервере',
    hint: 'Условия фильтра колонки применяет сервер. В панели фильтра есть кнопка применения.',
    props: ({ app, log }) => ({ onFilterChange: heldUntilRelease(app, log) }),
  },
  {
    title: 'Условие набрано',
    hint: 'Пользователь открыл панель фильтра и ввёл имя. Запрос ещё не ушёл: строки прежние, кнопка применения доступна.',
    states: ['overlay.filterText'],
    enter: stepAction((root, { signal }) => nameTyped(root, signal)),
  },
  {
    title: 'Условие применено',
    hint: 'Пользователь нажал кнопку применения. Запрос ушёл серверу один раз, панель осталась открытой, под шапкой светится полоса обновления.',
    states: ['overlay.filterText', 'body.refreshing'],
    enter: stepAction((root, { signal }) => nameApplied(root, signal)),
  },
  {
    title: 'Сервер ответил',
    hint: 'Пришли строки с этим именем. Кнопка применения недоступна: условие уже действует.',
    states: ['overlay.filterText'],
    enter: stepAction(async (root, { signal }) => {
      if (!allMatch(root, 'name', NAME)) {
        await nameApplied(root, signal)
        applyServer.release?.()
      }
      await pollUntil(
        () => allMatch(root, 'name', NAME) && !filterWaits(root),
        signal,
      )
      // Нажатие мимо поповера («Далее» панели гайда) закрывает его — открываем снова.
      await namePanelOpen(root, signal)
    }),
  },
]

/** ADR 0154, S1: условие серверного фильтра уходит кнопкой применения — один запрос. */
export const FilteringServerApply: StoryObj<StoryProps> = {
  name: 'Apply a server filter',
  parameters: { scenario: '0154/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Применение фильтра на сервере"
      steps={APPLY}
      args={guideArgs(
        {
          ...GRID,
          dataOverride: SERVER_DATA,
          dataMode: { filtering: 'server' },
          rowCount: SERVER_TOTAL,
          totalRowCount: SERVER_TOTAL,
          extraPlugins: [applyServerReset],
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    let firstName = ''
    await step(APPLY[0]!.title, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
    })
    await step(APPLY[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterValueText()).toBe(NAME)
      await expect(applyButton()).toHaveTextContent(labels.filterApply)
      await expect(applyEnabled()).toBe(true)
      await expect(applyServer.requests).toBe(0)
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(APPLY[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterWaits(canvas)).toBe(true)
      await expect(panel()).not.toBeNull()
      await expect(applyServer.requests).toBe(1)
    })
    await step(APPLY[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
      await expect(applyEnabled()).toBe(false)
      await expect(applyServer.requests).toBe(1)
      await settle()
    })
  },
}

// --- ADR 0154 S2 ---------------------------------------------------------------------

/** Фильтр отменён в плашке под шапкой, панель закрыта. */
const filterCancelled = async (root: HTMLElement, signal: AbortSignal) => {
  if (filterActive(root, 'name') || filterWaits(root) || !panel()) {
    await filterLong(root, signal)
    pendingCancelOf(root)!.click()
  }
  await pollUntil(
    () =>
      !filterWaits(root) &&
      !filterActive(root, 'name') &&
      !pendingBannerOf(root),
    signal,
  )
}

/**
 * Панель открыта после отмены: набранное условие на месте. Гайд открыт сразу с этого шага —
 * черновика нет: путь «применить, отменить» проходится целиком.
 */
const draftShown = async (root: HTMLElement, signal: AbortSignal) => {
  if (filterWaits(root)) await filterCancelled(root, signal)
  await namePanelOpen(root, signal)
  await sleep(0)
  if (filterValueText() !== NAME) {
    await closePanel(signal)
    await filterCancelled(root, signal)
  }
  await pollUntil(() => {
    if (!panel()) filterButtonOf(root)?.click()
    return !!panel() && filterValueText() === NAME && applyEnabled()
  }, signal)
}

const REAPPLY: readonly GuideStoryStep[] = [
  {
    title: 'Фильтр на сервере',
    hint: 'Условия фильтра колонки применяет сервер, ответ приходит не сразу.',
    props: ({ log }) => ({ onFilterChange: heldFilter(log) }),
  },
  {
    title: 'Фильтр ждёт',
    hint: 'Пользователь задал условие, применил его и закрыл панель. Пока сервер фильтрует строки, под шапкой светится полоса обновления.',
    states: ['body.refreshing'],
    immediate: true,
    enter: stepAction((root, { signal }) => filterHeld(root, signal)),
  },
  {
    title: 'Фильтр отменён',
    hint: 'Сервер не ответил за секунду, и пользователь отменил фильтр в плашке под шапкой. Фильтр снят, строки прежние.',
    enter: stepAction((root, { signal }) => filterCancelled(root, signal)),
  },
  {
    title: 'Условие на месте',
    hint: 'Пользователь снова открыл панель. Набранное условие осталось, кнопка применения доступна.',
    states: ['overlay.filterText'],
    enter: stepAction((root, { signal }) => draftShown(root, signal)),
  },
  {
    title: 'Условие применено снова',
    hint: 'Пользователь нажал кнопку применения. Запрос ушёл серверу, под шапкой снова светится полоса обновления.',
    states: ['overlay.filterText', 'body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      if (!filterWaits(root)) await draftShown(root, signal)
      await pollUntil(() => {
        if (filterWaits(root)) return true
        if (applyEnabled()) applyButton()!.click()
        return false
      }, signal)
    }),
  },
]

/** ADR 0154, S2: отменённое условие осталось в панели — его применяют снова. */
export const FilteringServerReapply: StoryObj<StoryProps> = {
  name: 'Reapply after cancel',
  parameters: { scenario: '0154/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Повтор отменённого фильтра"
      steps={REAPPLY}
      args={guideArgs(
        {
          ...GRID,
          dataOverride: SERVER_DATA,
          dataMode: { filtering: 'server' },
          rowCount: SERVER_TOTAL,
          totalRowCount: SERVER_TOTAL,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let firstName = ''
    await step(REAPPLY[0]!.title, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
    })
    await step(REAPPLY[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterWaits(canvas)).toBe(true)
      await expect(panel()).toBeNull()
    })
    await step(REAPPLY[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterActive(canvas, 'name')).toBe(false)
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(REAPPLY[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterValueText()).toBe(NAME)
      await expect(applyEnabled()).toBe(true)
      await settle()
    })
    await step(REAPPLY[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterWaits(canvas)).toBe(true)
      await expect(panel()).not.toBeNull()
    })
  },
}

// --- ADR 0178 S1–S3 -----------------------------------------------------------------

/** «Сервер» гайдов черновиков: отвечает строками или отказывает — режим задаёт шаг. */
const draftServer = {
  mode: 'answer' as 'answer' | 'refuse',
  requests: 0,
  table: undefined as unknown,
}

const draftServerReset: TesseraFeatureEntry = {
  id: 'filterDraftReset',
  setup: table => {
    const store = (table as { store: unknown }).store
    if (draftServer.table === store) return
    draftServer.table = store
    draftServer.mode = 'answer'
    draftServer.requests = 0
  },
}

const draftAnswers =
  (app: GuideApp, log: ConsoleLog) => (filters: ServerFilters) => {
    draftServer.requests += 1
    log.log('server', `filter ${JSON.stringify(filters)}`)
    if (draftServer.mode === 'refuse') {
      log.log('server', 'refused')
      return Promise.reject(
        new Error('Filtering by name is unavailable right now'),
      )
    }
    const rows = queryFiltering(filters, '', [])
    log.log('server', `${rows.length} of ${SERVER_TOTAL} rows`)
    app.update(props => ({
      ...props,
      dataOverride: rows,
      rowCount: rows.length,
    }))
    return Promise.resolve()
  }

const DRAFT_GRID = {
  ...GRID,
  dataOverride: SERVER_DATA,
  dataMode: { filtering: 'server' },
  rowCount: SERVER_TOTAL,
  totalRowCount: SERVER_TOTAL,
  extraPlugins: [draftServerReset],
} satisfies Partial<StoryProps>

const filterButtonAt = (root: HTMLElement, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${column}"] .column-filter__button`,
  )
/** У колонки неприменённое условие: оранжевая точка на кнопке фильтра, фильтр не действует. */
const draftRing = (root: HTMLElement, column = 'name') =>
  filterButtonAt(root, column)?.getAttribute('data-draft') === 'true' &&
  !filterActive(root, column)
const loadBanner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')

/** Имя набрано, панель закрыта: на кнопке фильтра имён отметка неприменённого. */
const nameDrafted = async (root: HTMLElement, signal: AbortSignal) => {
  if (!draftRing(root)) await nameTyped(root, signal)
  await closePanel(signal)
  await pollUntil(() => draftRing(root), signal)
}

/** Условие колонки имён применено кнопкой панели, сервер ответил, панель закрыта. */
const nameFiltered = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => {
    if (filterActive(root, 'name') && !filterWaits(root)) return true
    if (!panel()) filterButtonAt(root, 'name')?.click()
    else if (applyEnabled()) applyButton()!.click()
    return false
  }, signal)
  await pollUntil(() => allMatch(root, 'name', NAME), signal)
  await closePanel(signal)
}

const FILTER_DRAFT: readonly GuideStoryStep[] = [
  {
    title: 'Фильтр на сервере',
    hint: 'Условия фильтра колонки применяет сервер: набранное условие уходит кнопкой применения.',
    props: ({ app, log }) => ({ onFilterChange: draftAnswers(app, log) }),
  },
  {
    title: 'Условие набрано',
    hint: 'Пользователь открыл панель фильтра имён и ввёл имя, но не применил его. Строки прежние.',
    states: ['overlay.filterText'],
    enter: stepAction((root, { signal }) => nameTyped(root, signal)),
  },
  {
    title: 'Панель закрыта',
    hint: 'Пользователь закрыл панель. Условие не действует, но не потеряно: кнопка фильтра колонки видна без наведения, на ней отметка неприменённого условия. Подсказка кнопки говорит, что условие не применено.',
    states: ['head.draft'],
    enter: stepAction((root, { signal }) => nameDrafted(root, signal)),
  },
  {
    title: 'Условие применено',
    hint: 'Пользователь открыл панель и применил условие. Сервер прислал строки с этим именем, отметка на кнопке сменилась отметкой действующего фильтра.',
    states: ['head.activeIndicator'],
    enter: stepAction(async (root, { signal }) => {
      if (!filterActive(root, 'name')) await nameDrafted(root, signal)
      await nameFiltered(root, signal)
    }),
  },
]

/** ADR 0178, S1: набранное и не применённое условие — оранжевая точка на кнопке фильтра колонки. */
export const FilterDraftClosedPanel: StoryObj<StoryProps> = {
  name: 'Unapplied condition',
  parameters: { scenario: '0178/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Неприменённое условие"
      steps={FILTER_DRAFT}
      args={guideArgs(DRAFT_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let firstName = ''
    await step(FILTER_DRAFT[0]!.title, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
    })
    await step(FILTER_DRAFT[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterValueText()).toBe(NAME)
      await expect(draftServer.requests).toBe(0)
    })
    await step(FILTER_DRAFT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(panel()).toBeNull()
      await expect(draftRing(canvas)).toBe(true)
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(FILTER_DRAFT[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterActive(canvas, 'name')).toBe(true)
      await expect(draftRing(canvas)).toBe(false)
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
      await settle()
    })
  },
}

/** Условие применено, сервер отказал: под шапкой сообщение, панель открыта. */
const nameRefused = async (root: HTMLElement, signal: AbortSignal) => {
  if (loadBanner(root)) return
  draftServer.mode = 'refuse'
  if (!panel() || filterValueText() !== NAME) await nameTyped(root, signal)
  await pollUntil(() => {
    if (loadBanner(root) && !filterWaits(root)) return true
    if (applyEnabled()) applyButton()!.click()
    return false
  }, signal)
}

/** Сообщение под шапкой и панель закрыты, на кнопке фильтра — отметка неприменённого. */
const refusalDismissed = async (root: HTMLElement, signal: AbortSignal) => {
  if (!draftRing(root) || loadBanner(root)) await nameRefused(root, signal)
  await closePanel(signal)
  await pollUntil(() => {
    const banner = loadBanner(root)
    if (!banner) return draftRing(root)
    banner
      .querySelector<HTMLElement>(
        'button:not([data-testid="load-error-retry"])',
      )
      ?.click()
    return false
  }, signal)
}

const REFUSED_DRAFT: readonly GuideStoryStep[] = [
  {
    title: 'Фильтр на сервере',
    hint: 'Условия фильтра колонки применяет сервер. Сейчас он отказывает в фильтре по имени.',
    props: ({ app, log }) => ({ onFilterChange: draftAnswers(app, log) }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь ввёл имя и применил условие, сервер отказал. Фильтр не действует: строки прежние, под шапкой — сообщение с причиной. Набранное условие осталось в панели.',
    states: ['body.loadError', 'overlay.filterText'],
    enter: stepAction((root, { signal }) => nameRefused(root, signal)),
  },
  {
    title: 'Сообщение закрыто',
    hint: 'Пользователь закрыл панель и сообщение под шапкой. Кнопка фильтра колонки видна без наведения, на ней отметка неприменённого условия: условие набрано, но сервер его не применил.',
    states: ['head.draft'],
    enter: stepAction((root, { signal }) => refusalDismissed(root, signal)),
  },
  {
    title: 'Условие применено',
    hint: 'Сервер снова отвечает. Пользователь открыл панель и применил то же условие: пришли строки с этим именем, отметка на кнопке сменилась отметкой действующего фильтра.',
    states: ['head.activeIndicator'],
    enter: stepAction(async (root, { signal }) => {
      if (!filterActive(root, 'name')) await refusalDismissed(root, signal)
      draftServer.mode = 'answer'
      await nameFiltered(root, signal)
    }),
  },
]

/** ADR 0178, S2: отказанное условие — черновик; после закрытия сообщения его видно на кнопке. */
export const FilterDraftAfterRefusal: StoryObj<StoryProps> = {
  name: 'Refused condition',
  parameters: { scenario: '0178/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказанное условие"
      steps={REFUSED_DRAFT}
      args={guideArgs(DRAFT_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let firstName = ''
    await step(REFUSED_DRAFT[0]!.title, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
    })
    await step(REFUSED_DRAFT[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(loadBanner(canvas)).not.toBeNull()
      await expect(filterActive(canvas, 'name')).toBe(false)
      await expect(filterValueText()).toBe(NAME)
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(REFUSED_DRAFT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(loadBanner(canvas)).toBeNull()
      await expect(panel()).toBeNull()
      await expect(draftRing(canvas)).toBe(true)
    })
    await step(REFUSED_DRAFT[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterActive(canvas, 'name')).toBe(true)
      await expect(draftRing(canvas)).toBe(false)
      await settle()
    })
  },
}

/** Условия из адреса страницы: имя и город. */
const URL_DRAFTS = [
  {
    kind: 'columnFilter',
    target: { column: 'name' },
    value: { operator: 'contains', value: NAME },
  },
  {
    kind: 'columnFilter',
    target: { column: 'city' },
    value: { operator: 'contains', value: CITY },
  },
]

const URL_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Адрес страницы',
    hint: 'Приложение хранит неприменённые условия фильтров в адресе страницы. Пользователь набрал два условия и обновил страницу. Строки пока все.',
    props: ({ app, log }) => ({
      onFilterChange: draftAnswers(app, log),
      onDraftsChange: (next: readonly unknown[]) => {
        log.log('app', `drafts in the address: ${next.length}`)
        app.update(props => ({ ...props, drafts: next as never }))
      },
    }),
  },
  {
    title: 'Условия восстановлены',
    hint: 'Приложение прочитало адрес и вернуло таблице оба условия — по имени и по городу. На кнопках фильтра этих колонок отметки неприменённого: условия набраны, но не действуют.',
    states: ['head.draft'],
    enter: stepAction((root, { signal }, app) => {
      app.update(props => ({ ...props, drafts: URL_DRAFTS }))
      return pollUntil(
        () => draftRing(root, 'name') && draftRing(root, 'city'),
        signal,
      )
    }),
  },
  {
    title: 'Условие на месте',
    hint: 'Пользователь открыл панель фильтра имён: в поле — условие из адреса, кнопка применения доступна.',
    states: ['overlay.filterText'],
    enter: stepAction(async (root, { signal }, app) => {
      if (!draftRing(root, 'name'))
        app.update(props => ({ ...props, drafts: URL_DRAFTS }))
      await pollUntil(() => draftRing(root, 'name'), signal)
      await namePanelOpen(root, signal)
      await pollUntil(
        () => filterValueText() === NAME && applyEnabled(),
        signal,
      )
    }),
  },
]

/** ADR 0178, S3: приложение возвращает таблице неприменённые условия из адреса страницы. */
export const DraftsFromUrl: StoryObj<StoryProps> = {
  name: 'Restore unapplied conditions',
  parameters: { scenario: '0178/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Условия из адреса страницы"
      steps={URL_STEPS}
      args={guideArgs({ ...DRAFT_GRID, drafts: [] }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(URL_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(draftRing(canvas, 'name')).toBe(false)
    })
    await step(URL_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(draftRing(canvas, 'name')).toBe(true)
      await expect(draftRing(canvas, 'city')).toBe(true)
    })
    await step(URL_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterValueText()).toBe(NAME)
      await expect(applyEnabled()).toBe(true)
      await expect(draftServer.requests).toBe(0)
      await settle()
    })
  },
}

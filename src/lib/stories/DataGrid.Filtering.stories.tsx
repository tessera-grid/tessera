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
import {
  openViewSettingsSection,
  viewSettingsPopover,
  viewSettingsSectionOpen,
} from './__mocks__/viewSettings'
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
import { filteringLabels } from '../shared/filtering/labels'
import { quickSearchLabels } from '../plugins/quickSearch/labels'
import { columnFilteringLabels } from '../plugins/columnFiltering/labels'

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
    title: { ru: 'Таблица без фильтров', en: 'The table without filters' },
    hint: {
      ru: 'У колонок есть кнопки фильтра в заголовках, показаны все строки.',
      en: 'Columns have filter buttons in their headers, and all rows are shown.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл фильтр колонки',
      en: 'The user opened a column filter',
    },
    hint: {
      ru: 'Панель фильтра предлагает условие и значение.',
      en: 'The filter panel offers a condition and a value.',
    },
    states: ['overlay.filterText'],
    enter: stepAction((root, { signal }) => openPanel(root, 'name', signal)),
  },
  {
    title: {
      ru: 'Пользователь задал значение',
      en: 'The user entered a value',
    },
    hint: {
      ru: 'Таблица показывает только подходящие строки, нижняя панель называет число показанных из общего. Кнопка фильтра отмечена как включённая.',
      en: 'The table shows only the matching rows, and the status bar shows how many are shown out of the total. The filter button is marked as on.',
    },
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
      title={{ ru: 'Фильтр по тексту', en: 'Text filter' }}
      steps={TEXT}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(TEXT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(
        headCell(canvas, 'name')?.querySelector('.column-filter__button'),
      ).not.toBeNull()
      await expect(byTestId('filtered-rows-count')).toBeNull()
    })
    await step(TEXT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(byTestId('filter-operator')).not.toBeNull()
      await expect(byTestId('filter-value')).not.toBeNull()
      await settle()
    })
    await step(TEXT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const shown = filteringData.filter(row => row.name.includes(NAME)).length
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
      await expect(filteredCount()).toBe(
        filteringLabels(labels).filteredRows(shown, filteringData.length),
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
    title: { ru: 'Все строки', en: 'All rows' },
    hint: {
      ru: 'Таблица показывает все строки. Поле поиска пустое.',
      en: 'The table shows all rows. The search field is empty.',
    },
  },
  {
    title: { ru: 'Пользователь ищет', en: 'The user searches' },
    hint: {
      ru: 'Пользователь ввёл запрос в поле поиска. Таблица показывает только строки с совпадениями.',
      en: 'The user typed a query into the search field. The table shows only rows with matches.',
    },
    enter: stepAction((root, { signal }) =>
      search(root, NAME, () => allMatch(root, 'name', NAME), signal),
    ),
  },
  {
    title: { ru: 'Ничего не найдено', en: 'Nothing found' },
    hint: {
      ru: 'Запрос не совпал ни с одной строкой. На месте строк — заглушка с возможностью сбросить фильтры и поиск, заголовки колонок остаются.',
      en: 'The query matched no rows. In place of the rows is a placeholder that lets the user reset the filters and search; the column headers stay.',
    },
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
      title={{ ru: 'Ничего не найдено', en: 'Nothing found' }}
      steps={EMPTY}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EMPTY[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(EMPTY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await stepDone(canvas)
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
    })
    await step(EMPTY[2]!.title.ru, async () => {
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

/** Пользователь скрывает колонку возраста в разделе «Колонки» «Настроек вида». */
const hideAge = async (root: HTMLElement, signal: AbortSignal) => {
  const ageBox = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="column-visibility-menu"] [data-column-id="age"] [role="checkbox"]',
    )
  if (!headCell(root, 'age')) return
  await repeat(
    () => !!ageBox(),
    () => openViewSettingsSection(root, 'columns'),
    signal,
  )
  await repeat(
    () => !headCell(root, 'age'),
    () => ageBox()?.click(),
    signal,
  )
  await repeat(() => !viewSettingsPopover(), pressEscape, signal)
}

const SERVER: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Фильтрует сервер', en: 'The server filters' },
    hint: {
      ru: 'Таблица не фильтрует сама: условия уходят приложению, оно перезапрашивает данные у сервера.',
      en: 'The table does not filter by itself: the conditions go to the app, and the app requests the data from the server again.',
    },
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
    title: {
      ru: 'Пользователь отфильтровал по имени',
      en: 'The user filtered by name',
    },
    hint: {
      ru: 'Запрос ушёл серверу, пока он отвечает, таблица в состоянии обновления данных. Пришли строки с этим именем, нижняя панель называет число из ответа сервера.',
      en: "The request went to the server; while the server responds, the table is refreshing its data. Rows with that name arrived, and the status bar shows the number from the server's response.",
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await filterByName(root, signal)
      await pollUntil(() => serverAnswered(root), signal)
    }),
  },
  {
    title: { ru: 'Пользователь добавил поиск', en: 'The user added a search' },
    hint: {
      ru: 'Поиск ушёл серверу вместе со списком колонок, по которым он идёт. Пришли строки, подходящие под оба условия.',
      en: 'The search went to the server along with the list of columns it covers. Rows matching both conditions arrived.',
    },
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
    title: { ru: 'Пользователь скрыл колонку', en: 'The user hid a column' },
    hint: {
      ru: 'Колонка ушла и из поиска: приложение повторило запрос с новым списком колонок, подсказка поля поиска его называет.',
      en: "The column dropped out of the search too: the app repeated the request with the new list of columns, and the search field's tooltip names them.",
    },
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
      title={{ ru: 'Фильтры на сервере', en: 'Filters on the server' }}
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
    await step(SERVER[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(orderedRows(canvas).length).toBeGreaterThan(0)
    })
    await step(SERVER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(consoleText()).toContain('onFilterChange')
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
      await expect(filteredCount()).toBe(
        filteringLabels(labels).filteredRows(count('', []), SERVER_TOTAL),
      )
    })
    await step(SERVER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const columns = ['name', 'city', 'age', 'visits']
      await expect(consoleText()).toContain('onSearchChange')
      await expect(filteredCount()).toBe(
        filteringLabels(labels).filteredRows(
          count(SEARCH, columns),
          SERVER_TOTAL,
        ),
      )
      await expect(searchHint()).toBe(
        quickSearchLabels(labels).searchColumnsHint([
          'Name',
          'City',
          'Age',
          'Visits',
        ]),
      )
    })
    await step(SERVER[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(searchHint()).toBe(
        quickSearchLabels(labels).searchColumnsHint(['Name', 'City', 'Visits']),
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
    title: {
      ru: 'Фильтры на сервере, поиск в таблице',
      en: 'Filters on the server, search in the table',
    },
    hint: {
      ru: 'Условия фильтров колонок уходят приложению, оно перезапрашивает строки у сервера. Поиск таблица ведёт сама — по строкам, которые уже пришли.',
      en: 'Column filter conditions go to the app, and the app requests the rows from the server again. The table runs the search itself, over the rows that have already arrived.',
    },
    props: ({ app, log }) => ({
      onFilterChange: (filters: ServerFilters) => {
        request.filters = filters
        refetchFilters(app, log)
      },
    }),
  },
  {
    title: { ru: 'Пользователь ищет', en: 'The user searches' },
    hint: {
      ru: 'Запроса к серверу нет: таблица сразу оставила строки с найденным текстом, нижняя панель называет, сколько их из всех строк сервера.',
      en: 'There is no request to the server: the table immediately kept only the rows containing the text, and the status bar shows how many of them there are out of all rows on the server.',
    },
    enter: stepAction(async (root, { signal }) => {
      await search(root, SEARCH, () => searchedOnClient(root), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отфильтровал по имени',
      en: 'The user filtered by name',
    },
    hint: {
      ru: 'Фильтр колонки ушёл серверу, пока он отвечает, таблица в состоянии обновления данных. Пришли строки с этим именем, и поиск сразу сузил их.',
      en: 'The column filter went to the server; while the server responds, the table is refreshing its data. Rows with that name arrived, and the search narrowed them down right away.',
    },
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
      title={{
        ru: 'Фильтры на сервере, поиск в таблице',
        en: 'Filters on the server, search in the table',
      }}
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
    await step(MIXED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(orderedRows(canvas).length).toBeGreaterThan(0)
    })
    await step(MIXED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(allMatch(canvas, 'city', SEARCH)).toBe(true)
      await expect(filteredCount()).toBe(
        filteringLabels(labels).filteredRows(
          queryFiltering([], SEARCH, columns).length,
          SERVER_TOTAL,
        ),
      )
      await expect(consoleText()).not.toContain('onSearchChange')
    })
    await step(MIXED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(consoleText()).toContain('onFilterChange')
      await expect(allMatch(canvas, 'name', NAME)).toBe(true)
      await expect(filteredCount()).toBe(
        filteringLabels(labels).filteredRows(
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
    title: { ru: 'Дерево раскрыто', en: 'The tree is expanded' },
    hint: {
      ru: 'Строки сгруппированы по регионам и странам.',
      en: 'Rows are grouped by region and country.',
    },
  },
  {
    title: {
      ru: 'Пользователь отфильтровал город',
      en: 'The user filtered by city',
    },
    hint: {
      ru: 'Остались строки с этим городом и их предки. Ветки без совпадений скрыты целиком.',
      en: 'Rows with that city and their ancestors remain. Branches without matches are hidden entirely.',
    },
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
      title={{ ru: 'Фильтр дерева', en: 'Tree filter' }}
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
    await step(TREE_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(treeIds(canvas)).toContain('item-id-1'))
    })
    await step(TREE_STEPS[1]!.title.ru, async () => {
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
    title: { ru: 'Таблица с поиском', en: 'A table with search' },
    hint: {
      ru: 'Поиск идёт по колонкам с текстом.',
      en: 'The search covers text columns.',
    },
  },
  {
    title: {
      ru: 'Приложение убрало колонки из поиска',
      en: 'The app removed columns from the search',
    },
    hint: {
      ru: 'Ни одна колонка не участвует в поиске: поле поиска недоступно, причина — в его подсказке. Фильтры колонок при этом работают.',
      en: 'No column takes part in the search: the search field is unavailable, and its tooltip gives the reason. Column filters still work.',
    },
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
      title={{ ru: 'Искать негде', en: 'Nowhere to search' }}
      steps={NO_COLUMNS}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NO_COLUMNS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(byTestId('quick-search')).not.toBeNull())
      await expect(searchDisabled()).toBe(false)
    })
    await step(NO_COLUMNS[1]!.title.ru, async () => {
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
    title: { ru: 'Колонки с датами', en: 'Date columns' },
    hint: {
      ru: 'В таблице есть колонка с датой рождения и колонка с моментом создания со временем.',
      en: 'The table has a birth date column and a creation date column that includes the time.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл фильтр даты',
      en: 'The user opened a date filter',
    },
    hint: {
      ru: 'Панель предлагает условие и календарь для выбора дня.',
      en: 'The panel offers a condition and a calendar for picking a day.',
    },
    states: ['overlay.filterDate'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'createdAt', signal)
      await pollUntil(() => !!calendar(), signal)
    }),
  },
  {
    title: { ru: 'Пользователь выбрал день', en: 'The user picked a day' },
    hint: {
      ru: 'Остались строки, созданные в этот день по часовому поясу таблицы.',
      en: "Rows created on that day in the table's time zone remain.",
    },
    enter: stepAction((root, { signal }) => filterCreated(root, signal)),
  },
  {
    title: {
      ru: 'Приложение сменило часовой пояс',
      en: 'The app changed the time zone',
    },
    hint: {
      ru: 'Тот же день в другом поясе — другие строки: часть ушла в соседний день.',
      en: 'The same day in another time zone covers different rows: some of them moved to the neighboring day.',
    },
    props: () => ({ timeZone: 'Asia/Tokyo' }),
    enter: stepAction((root, { signal }) => filterCreated(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь добавил условие на дату рождения',
      en: 'The user added a birth date condition',
    },
    hint: {
      ru: 'Оба фильтра действуют вместе, нижняя панель называет число оставшихся строк.',
      en: 'Both filters work together, and the status bar shows the number of remaining rows.',
    },
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
      title={{ ru: 'Фильтр по датам', en: 'Date filter' }}
      steps={DATE_STEPS}
      args={guideArgs(DATES, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const total = dateFilteringData.length
    await step(DATE_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(headCell(canvas, 'birthDate')).not.toBeNull()
      await expect(headCell(canvas, 'createdAt')).not.toBeNull()
    })
    await step(DATE_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(calendar()).not.toBeNull()
      await expect(byTestId('filter-operator')).not.toBeNull()
      await settle()
    })
    await step(DATE_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toBe(
        filteringLabels(labels).filteredRows(20, total),
      )
    })
    await step(DATE_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(filteredCount()).toBe(
          filteringLabels(labels).filteredRows(14, total),
        ),
      )
    })
    await step(DATE_STEPS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toMatch(
        labelPattern(
          args.locale,
          n => filteringLabels(labels).filteredRows(n, total),
          '[1-9]',
        ),
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
    title: { ru: 'Колонки с вариантами', en: 'Columns with options' },
    hint: {
      ru: 'Статус, метки и город принимают значения из списка.',
      en: 'Status, tags, and city take values from a list.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл фильтр статуса',
      en: 'The user opened the status filter',
    },
    hint: {
      ru: 'Панель — список вариантов с числом строк у каждого.',
      en: 'The panel is a list of options with a row count next to each.',
    },
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'status', signal)
      await pollUntil(() => !!byTestId('filter-options'), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отметил вариант',
      en: 'The user checked an option',
    },
    hint: {
      ru: 'Остались строки с этим статусом.',
      en: 'Rows with that status remain.',
    },
    enter: stepAction((root, { signal }) => filterStatus(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь потребовал обе метки',
      en: 'The user required both tags',
    },
    hint: {
      ru: 'Условие меток — все отмеченные сразу. Остались строки с обеими метками, числа у вариантов учитывают фильтр статуса.',
      en: 'The tags condition requires all checked tags at once. Rows with both tags remain, and the option counts take the status filter into account.',
    },
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
      title={{ ru: 'Фильтр вариантов', en: 'Options filter' }}
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
    await step(OPTION_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(cellsOf(canvas, 'status').length).toBeGreaterThan(0)
    })
    await step(OPTION_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(count('won')).toBeGreaterThan(0)
      await settle()
    })
    await step(OPTION_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(new Set(cellsOf(canvas, 'status')).size).toBe(1)
      await expect(filteredCount()).toMatch(
        labelPattern(args.locale, n =>
          filteringLabels(labels).filteredRows(n, total),
        ),
      )
    })
    await step(OPTION_STEPS[3]!.title.ru, async () => {
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
        expect(filteredCount()).toBe(
          filteringLabels(labels).filteredRows(both, total),
        ),
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
    title: {
      ru: 'Справочник менеджеров на сервере',
      en: 'A manager lookup on the server',
    },
    hint: {
      ru: 'Вариантов слишком много, панель загружает их с сервера.',
      en: 'There are too many options, so the panel loads them from the server.',
    },
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
    title: {
      ru: 'Пользователь ищет менеджера',
      en: 'The user searches for a manager',
    },
    hint: {
      ru: 'Поиск в панели ушёл серверу, список сузился до найденных.',
      en: 'The search in the panel went to the server, and the list narrowed down to the results.',
    },
    states: ['overlay.filterOptions'],
    enter: stepAction((root, { signal }) => searchManager(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь выбрал менеджера',
      en: 'The user chose a manager',
    },
    hint: {
      ru: 'Пользователь отметил менеджера и применил фильтр. Фильтр ушёл приложению, сервер вернул строки этого менеджера.',
      en: "The user checked a manager and applied the filter. The filter went to the app, and the server returned that manager's rows.",
    },
    enter: stepAction((root, { signal }) => filterManager(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь открыл фильтры в «Настройках вида»',
      en: 'The user opened filters in the view settings',
    },
    hint: {
      ru: 'Менеджер в разделе фильтров назван по имени, а не по коду.',
      en: 'The filters section names the manager by name, not by code.',
    },
    enter: stepAction(async (root, { signal }) => {
      await filterManager(root, signal)
      await repeat(
        () => !!viewSettingsSectionOpen('filter'),
        () => openViewSettingsSection(root, 'filter'),
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
      title={{ ru: 'Справочник на сервере', en: 'A lookup on the server' }}
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
    await step(LOOKUP[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(headCell(canvas, 'managerId')).not.toBeNull()
    })
    await step(LOOKUP[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(consoleText()).toContain('loadOptions')
      await expect(consoleText()).toContain('search="alice"')
      await settle()
    })
    await step(LOOKUP[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(consoleText()).toContain('onFilterChange'))
      await expect(consoleText()).toMatch(/\d+ of 200 rows/)
    })
    await step(LOOKUP[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(viewSettingsSectionOpen('filter')).toHaveTextContent(
        `${columnFilteringLabels(labels).filterAnyOf}: Alice Moss`,
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
    title: { ru: 'Все строки', en: 'All rows' },
    hint: {
      ru: 'Фильтрами и поиском управляет форма приложения над таблицей. В заголовках нет кнопок фильтра, в тулбаре нет поля поиска.',
      en: "The app's form above the table controls filtering and search. The headers have no filter buttons, and the toolbar has no search field.",
    },
    props: () => ({
      enableColumnFilteringModel: true,
      enableQuickSearchModel: true,
    }),
  },
  {
    title: {
      ru: `Приложение ищет «${searchedCity}»`,
      en: `The app searches for “${searchedCity}”`,
    },
    hint: {
      ru: 'Пользователь ввёл город в поле поиска приложения. Таблица показывает только строки с этим городом.',
      en: "The user typed a city into the app's search field. The table shows only rows with that city.",
    },
    props: () => ({ quickSearchModelGlobalFilter: searchedCity }),
  },
  {
    title: {
      ru: 'Приложение фильтрует возраст старше 30',
      en: 'The app filters for age over 30',
    },
    hint: {
      ru: 'Пользователь задал в форме приложения возраст старше 30. Таблица показывает строки, которые подходят и под поиск, и под фильтр.',
      en: "The user set age over 30 in the app's form. The table shows rows that match both the search and the filter.",
    },
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
      title={{
        ru: 'Фильтры и поиск из формы приложения',
        en: "Filters and search from the app's form",
      }}
      steps={EXTERNAL_FORM}
      args={guideArgs(FILTERING_GUIDE, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(EXTERNAL_FORM[0].title.ru, async () => {
      await waitForRows(canvas)
      expect(canvas.querySelector('.column-filter__button')).toBeNull()
      expect(canvas.querySelector('[data-testid="quick-search"]')).toBeNull()
    })
    await step(EXTERNAL_FORM[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          cellsOf(canvas, 'city').every(city => city === searchedCity),
        ).toBe(true),
      )
    })
    await step(EXTERNAL_FORM[2].title.ru, async () => {
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
    title: { ru: 'Вид по умолчанию', en: 'The default view' },
    hint: {
      ru: 'Таблица открыта без сохранённого вида. Строки идут в порядке данных, без фильтров, на первой странице.',
      en: 'The table is open without a saved view. Rows are in data order, without filters, on the first page.',
    },
    props: () => ({
      enableColumnSorting: true,
      enableColumnFiltering: true,
      enablePagination: true,
    }),
  },
  {
    title: { ru: 'Открыта сохранённая ссылка', en: 'A saved link is open' },
    hint: {
      ru: 'Пользователь открыл ссылку с сохранённым видом, и приложение прочитало его из адреса страницы. Таблица открылась с сортировкой по убыванию возраста, с возрастом старше 30, на второй странице.',
      en: 'The user opened a link with a saved view, and the app read it from the page address. The table opened sorted by age descending, with age over 30, on the second page.',
    },
    props: () => SAVED_VIEW,
    remount: true,
  },
  {
    title: { ru: 'Пользователь листает дальше', en: 'The user pages forward' },
    hint: {
      ru: 'Пользователь перешёл на следующую страницу пейджером таблицы. Дальше видом управляет таблица: сортировка и фильтр сохраняются, видна третья страница.',
      en: "The user went to the next page with the table's pager. From here the table controls the view: sorting and the filter stay, and the third page is shown.",
    },
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
      title={{
        ru: 'Вид из адреса страницы',
        en: 'A view from the page address',
      }}
      steps={SAVED_VIEW_STEPS}
      args={guideArgs(FILTERING_GUIDE, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const ages = () => cellsOf(canvas, 'age').map(Number)
    await step(SAVED_VIEW_STEPS[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(rangeText(canvas)).toMatch(/^1–/))
      expect(ages()).toEqual(
        filteringData.slice(0, ages().length).map(row => Number(row.age)),
      )
    })
    await step(SAVED_VIEW_STEPS[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rangeText(canvas)).toMatch(/^6–10 /))
      const shown = ages()
      expect(shown.every(age => age > 30)).toBe(true)
      expect(shown.every((age, i) => i === 0 || shown[i - 1]! >= age)).toBe(
        true,
      )
    })
    await step(SAVED_VIEW_STEPS[2].title.ru, async () => {
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
    title: { ru: 'Фильтр на сервере', en: 'Filtering on the server' },
    hint: {
      ru: 'Условия фильтра колонки применяет сервер.',
      en: 'The server applies the column filter conditions.',
    },
    props: ({ log }) => ({ onFilterChange: heldFilter(log) }),
  },
  {
    title: { ru: 'Фильтр ждёт', en: 'The filter is waiting' },
    hint: {
      ru: 'Пользователь задал условие в панели фильтра, применил его и закрыл панель. Пока сервер фильтрует строки, под шапкой светится полоса обновления.',
      en: 'The user set a condition in the filter panel, applied it, and closed the panel. While the server filters the rows, a refresh bar glows below the header.',
    },
    states: ['body.refreshing'],
    immediate: true,
    enter: stepAction((root, { signal }) => filterHeld(root, signal)),
  },
  {
    title: { ru: 'Фильтр идёт долго', en: 'The filter is taking a while' },
    hint: {
      ru: 'Сервер не ответил за секунду. Под шапкой появилась плашка о фильтрации с кнопкой отмены.',
      en: 'The server did not respond within a second. A banner about the filtering, with a cancel button, appeared below the header.',
    },
    states: ['body.refreshing'],
    enter: stepAction((root, { signal }) => filterLong(root, signal)),
  },
  {
    title: { ru: 'Фильтр отменён', en: 'The filter is canceled' },
    hint: {
      ru: 'Пользователь нажал отмену в плашке. Условие снято, кнопка фильтра снова без отметки включённого фильтра, плашка и свечение ушли, строки прежние.',
      en: 'The user pressed cancel in the banner. The condition is removed, the filter button no longer has the active filter mark, the banner and the glow are gone, and the rows are as before.',
    },
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
      title={{
        ru: 'Отмена фильтра на сервере',
        en: 'Canceling a server filter',
      }}
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
    await step(CANCEL_FILTER[0]!.title.ru, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
      await expect(filterActive(canvas, 'name')).toBe(false)
    })
    await step(CANCEL_FILTER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterWaits(canvas)).toBe(true)
      await expect(panel()).toBeNull()
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(CANCEL_FILTER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBannerOf(canvas)).toHaveTextContent(
        labels.pendingFiltering,
      )
      await expect(pendingCancelOf(canvas)).toHaveTextContent(labels.cancel)
      await settle()
    })
    await step(CANCEL_FILTER[3]!.title.ru, async () => {
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
    title: { ru: 'Фильтр на сервере', en: 'Filtering on the server' },
    hint: {
      ru: 'Условия фильтра колонки применяет сервер. В панели фильтра есть кнопка применения.',
      en: 'The server applies the column filter conditions. The filter panel has an apply button.',
    },
    props: ({ app, log }) => ({ onFilterChange: heldUntilRelease(app, log) }),
  },
  {
    title: { ru: 'Условие набрано', en: 'The condition is entered' },
    hint: {
      ru: 'Пользователь открыл панель фильтра и ввёл имя. Запрос ещё не ушёл: строки прежние, кнопка применения доступна.',
      en: 'The user opened the filter panel and typed a name. The request has not gone out yet: the rows are as before, and the apply button is available.',
    },
    states: ['overlay.filterText'],
    enter: stepAction((root, { signal }) => nameTyped(root, signal)),
  },
  {
    title: { ru: 'Условие применено', en: 'The condition is applied' },
    hint: {
      ru: 'Пользователь нажал кнопку применения. Запрос ушёл серверу один раз, панель осталась открытой, под шапкой светится полоса обновления.',
      en: 'The user pressed the apply button. The request went to the server once, the panel stayed open, and a refresh bar glows below the header.',
    },
    states: ['overlay.filterText', 'body.refreshing'],
    enter: stepAction((root, { signal }) => nameApplied(root, signal)),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Пришли строки с этим именем. Кнопка применения недоступна: условие уже действует.',
      en: 'Rows with that name arrived. The apply button is unavailable: the condition is already in effect.',
    },
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
      title={{
        ru: 'Применение фильтра на сервере',
        en: 'Applying a server filter',
      }}
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
    await step(APPLY[0]!.title.ru, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
    })
    await step(APPLY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterValueText()).toBe(NAME)
      await expect(applyButton()).toHaveTextContent(
        columnFilteringLabels(labels).filterApply,
      )
      await expect(applyEnabled()).toBe(true)
      await expect(applyServer.requests).toBe(0)
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(APPLY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterWaits(canvas)).toBe(true)
      await expect(panel()).not.toBeNull()
      await expect(applyServer.requests).toBe(1)
    })
    await step(APPLY[3]!.title.ru, async () => {
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
    title: { ru: 'Фильтр на сервере', en: 'Filtering on the server' },
    hint: {
      ru: 'Условия фильтра колонки применяет сервер, ответ приходит не сразу.',
      en: 'The server applies the column filter conditions, and the response does not come right away.',
    },
    props: ({ log }) => ({ onFilterChange: heldFilter(log) }),
  },
  {
    title: { ru: 'Фильтр ждёт', en: 'The filter is waiting' },
    hint: {
      ru: 'Пользователь задал условие, применил его и закрыл панель. Пока сервер фильтрует строки, под шапкой светится полоса обновления.',
      en: 'The user set a condition, applied it, and closed the panel. While the server filters the rows, a refresh bar glows below the header.',
    },
    states: ['body.refreshing'],
    immediate: true,
    enter: stepAction((root, { signal }) => filterHeld(root, signal)),
  },
  {
    title: { ru: 'Фильтр отменён', en: 'The filter is canceled' },
    hint: {
      ru: 'Сервер не ответил за секунду, и пользователь отменил фильтр в плашке под шапкой. Фильтр снят, строки прежние.',
      en: 'The server did not respond within a second, and the user canceled the filter in the banner below the header. The filter is removed, and the rows are as before.',
    },
    enter: stepAction((root, { signal }) => filterCancelled(root, signal)),
  },
  {
    title: { ru: 'Условие на месте', en: 'The condition is still there' },
    hint: {
      ru: 'Пользователь снова открыл панель. Набранное условие осталось, кнопка применения доступна.',
      en: 'The user opened the panel again. The entered condition is still there, and the apply button is available.',
    },
    states: ['overlay.filterText'],
    enter: stepAction((root, { signal }) => draftShown(root, signal)),
  },
  {
    title: {
      ru: 'Условие применено снова',
      en: 'The condition is applied again',
    },
    hint: {
      ru: 'Пользователь нажал кнопку применения. Запрос ушёл серверу, под шапкой снова светится полоса обновления.',
      en: 'The user pressed the apply button. The request went to the server, and a refresh bar glows below the header again.',
    },
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
      title={{
        ru: 'Повтор отменённого фильтра',
        en: 'Repeating a canceled filter',
      }}
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
    await step(REAPPLY[0]!.title.ru, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
    })
    await step(REAPPLY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterWaits(canvas)).toBe(true)
      await expect(panel()).toBeNull()
    })
    await step(REAPPLY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterActive(canvas, 'name')).toBe(false)
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(REAPPLY[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterValueText()).toBe(NAME)
      await expect(applyEnabled()).toBe(true)
      await settle()
    })
    await step(REAPPLY[4]!.title.ru, async () => {
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
    title: { ru: 'Фильтр на сервере', en: 'Filtering on the server' },
    hint: {
      ru: 'Условия фильтра колонки применяет сервер: набранное условие уходит кнопкой применения.',
      en: 'The server applies the column filter conditions: an entered condition is sent with the apply button.',
    },
    props: ({ app, log }) => ({ onFilterChange: draftAnswers(app, log) }),
  },
  {
    title: { ru: 'Условие набрано', en: 'The condition is entered' },
    hint: {
      ru: 'Пользователь открыл панель фильтра имён и ввёл имя, но не применил его. Строки прежние.',
      en: 'The user opened the name filter panel and typed a name but did not apply it. The rows are as before.',
    },
    states: ['overlay.filterText'],
    enter: stepAction((root, { signal }) => nameTyped(root, signal)),
  },
  {
    title: { ru: 'Панель закрыта', en: 'The panel is closed' },
    hint: {
      ru: 'Пользователь закрыл панель. Условие не действует, но не потеряно: кнопка фильтра колонки видна без наведения, на ней отметка неприменённого условия. Подсказка кнопки говорит, что условие не применено.',
      en: "The user closed the panel. The condition is not in effect, but it is not lost: the column's filter button is visible without hovering and has a mark for an unapplied condition. The button's tooltip says the condition is not applied.",
    },
    states: ['head.draft'],
    enter: stepAction((root, { signal }) => nameDrafted(root, signal)),
  },
  {
    title: { ru: 'Условие применено', en: 'The condition is applied' },
    hint: {
      ru: 'Пользователь открыл панель и применил условие. Сервер прислал строки с этим именем, отметка на кнопке сменилась отметкой действующего фильтра.',
      en: 'The user opened the panel and applied the condition. The server sent rows with that name, and the mark on the button changed to the active filter mark.',
    },
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
      title={{ ru: 'Неприменённое условие', en: 'An unapplied condition' }}
      steps={FILTER_DRAFT}
      args={guideArgs(DRAFT_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let firstName = ''
    await step(FILTER_DRAFT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
    })
    await step(FILTER_DRAFT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterValueText()).toBe(NAME)
      await expect(draftServer.requests).toBe(0)
    })
    await step(FILTER_DRAFT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(panel()).toBeNull()
      await expect(draftRing(canvas)).toBe(true)
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(FILTER_DRAFT[3]!.title.ru, async () => {
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
    title: { ru: 'Фильтр на сервере', en: 'Filtering on the server' },
    hint: {
      ru: 'Условия фильтра колонки применяет сервер. Сейчас он отказывает в фильтре по имени.',
      en: 'The server applies the column filter conditions. Right now it refuses to filter by name.',
    },
    props: ({ app, log }) => ({ onFilterChange: draftAnswers(app, log) }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь ввёл имя и применил условие, сервер отказал. Фильтр не действует: строки прежние, под шапкой — сообщение с причиной. Набранное условие осталось в панели.',
      en: 'The user typed a name and applied the condition, and the server refused. The filter is not in effect: the rows are as before, and below the header there is a message with the reason. The entered condition stayed in the panel.',
    },
    states: ['body.loadError', 'overlay.filterText'],
    enter: stepAction((root, { signal }) => nameRefused(root, signal)),
  },
  {
    title: { ru: 'Сообщение закрыто', en: 'The message is closed' },
    hint: {
      ru: 'Пользователь закрыл панель и сообщение под шапкой. Кнопка фильтра колонки видна без наведения, на ней отметка неприменённого условия: условие набрано, но сервер его не применил.',
      en: "The user closed the panel and the message below the header. The column's filter button is visible without hovering and has a mark for an unapplied condition: the condition is entered, but the server did not apply it.",
    },
    states: ['head.draft'],
    enter: stepAction((root, { signal }) => refusalDismissed(root, signal)),
  },
  {
    title: { ru: 'Условие применено', en: 'The condition is applied' },
    hint: {
      ru: 'Сервер снова отвечает. Пользователь открыл панель и применил то же условие: пришли строки с этим именем, отметка на кнопке сменилась отметкой действующего фильтра.',
      en: 'The server responds again. The user opened the panel and applied the same condition: rows with that name arrived, and the mark on the button changed to the active filter mark.',
    },
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
      title={{ ru: 'Отказанное условие', en: 'A refused condition' }}
      steps={REFUSED_DRAFT}
      args={guideArgs(DRAFT_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let firstName = ''
    await step(REFUSED_DRAFT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      firstName = cellsOf(canvas, 'name')[0]!
    })
    await step(REFUSED_DRAFT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(loadBanner(canvas)).not.toBeNull()
      await expect(filterActive(canvas, 'name')).toBe(false)
      await expect(filterValueText()).toBe(NAME)
      await expect(cellsOf(canvas, 'name')[0]).toBe(firstName)
    })
    await step(REFUSED_DRAFT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(loadBanner(canvas)).toBeNull()
      await expect(panel()).toBeNull()
      await expect(draftRing(canvas)).toBe(true)
    })
    await step(REFUSED_DRAFT[3]!.title.ru, async () => {
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
    title: { ru: 'Адрес страницы', en: 'The page address' },
    hint: {
      ru: 'Приложение хранит неприменённые условия фильтров в адресе страницы. Пользователь набрал два условия и обновил страницу. Строки пока все.',
      en: 'The app keeps unapplied filter conditions in the page address. The user entered two conditions and reloaded the page. All rows are shown for now.',
    },
    props: ({ app, log }) => ({
      onFilterChange: draftAnswers(app, log),
      onDraftsChange: (next: readonly unknown[]) => {
        log.log('app', `drafts in the address: ${next.length}`)
        app.update(props => ({ ...props, drafts: next as never }))
      },
    }),
  },
  {
    title: { ru: 'Условия восстановлены', en: 'The conditions are restored' },
    hint: {
      ru: 'Приложение прочитало адрес и вернуло таблице оба условия — по имени и по городу. На кнопках фильтра этих колонок отметки неприменённого: условия набраны, но не действуют.',
      en: 'The app read the address and gave both conditions back to the table: by name and by city. The filter buttons of these columns have the unapplied condition mark: the conditions are entered but not in effect.',
    },
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
    title: { ru: 'Условие на месте', en: 'The condition is still there' },
    hint: {
      ru: 'Пользователь открыл панель фильтра имён: в поле — условие из адреса, кнопка применения доступна.',
      en: 'The user opened the name filter panel: the field holds the condition from the address, and the apply button is available.',
    },
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
      title={{
        ru: 'Условия из адреса страницы',
        en: 'Conditions from the page address',
      }}
      steps={URL_STEPS}
      args={guideArgs({ ...DRAFT_GRID, drafts: [] }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(URL_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(draftRing(canvas, 'name')).toBe(false)
    })
    await step(URL_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(draftRing(canvas, 'name')).toBe(true)
      await expect(draftRing(canvas, 'city')).toBe(true)
    })
    await step(URL_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterValueText()).toBe(NAME)
      await expect(applyEnabled()).toBe(true)
      await expect(draftServer.requests).toBe(0)
      await settle()
    })
  },
}

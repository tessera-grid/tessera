import { ru } from '@daypicker/react/locale/ru'
import { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  dateFilteringColumns,
  dateFilteringData,
  filteringColumns,
  filteringData,
  makeFilteringData,
  optionFilteringColumns,
  optionFilteringData,
} from './__mocks__/filteringData'
import { StoryComponent } from './DataGridStory'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  FilteringLookupServerDemo,
  FilteringServerDemo,
} from './demos/filteringDemos'
import { argsUpdater, vrStates } from './__mocks__/catalog'
import {
  byTestId,
  callbackLog,
  expectPopupInCanvas,
  firstRowText,
  guideNext,
  headCell,
  openPopup,
  settle,
  until,
  updateArgs,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

interface FilteringServerArgs extends StoryProps {
  serverDelayMs?: number
}

interface FilteringDatesArgs extends StoryProps {
  /** Пояс фильтра; `'browser'` — без `timeZone`, пояс браузера. */
  timeZone?: string
  dateLocale?: 'en-US' | 'ru'
}

/**
 * Фильтрация (ADR 0045, ADR 0047, ADR 0048): фильтры колонок по типам — текст, число,
 * булево, дата, варианты (select, multiselect, справочник); быстрый поиск; сочетания с деревом, пагинацией, выбором, экспортом; пустой
 * результат; сервер; поиск без колонок для поиска; фильтры и поиск из формы приложения (ADR 0120).
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

export const Filtering: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: showControls([
    'enableQuickSearch',
    'quickSearchDebounceMs',
    'quickSearchFilteredCount',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'columnFilteringTimeZone',
  ]),
  args: {
    ...GRID,
    // Воронка в заголовке открывает панель: «Name» и «City» — текст, «Age» — число
    // (с «между»), «VIP» — булево с «Пусто». У «Visits» фильтра нет. Слева в тулбаре
    // поиск и сразу за ним сводка «Фильтры» со сбросом (ADR 0051); иконка «i» у поиска
    // называет колонки, по которым он идёт (ADR 0053); внизу — «Показано N из M».
    // Включите enableHeaderActionMenu — фильтр уйдёт пунктом в кебаб.
  },
}

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

export const FilteringTree: StoryObj<StoryProps> = {
  name: 'Tree',
  parameters: showControls([
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
    'enableQuickSearch',
    'quickSearchDebounceMs',
    'quickSearchFilteredCount',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'columnFilteringTimeZone',
  ]),
  args: {
    ...GRID,
    dataOverride: TREE,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 5,
    initialExpanded: true,
    // Фильтр «City» = «Rome»: родители Europe и Italy остаются видимыми, потому что
    // подходит их потомок; France отсеяна целиком.
  },
}

export const FilteringCombined: StoryObj<StoryProps> = {
  name: 'With pagination, selection and export',
  parameters: showControls([
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enableRowDragging',
    'rowDraggingExpandDelay',
    'rowDraggingRevertOnReject',
    'enableQuickSearch',
    'quickSearchDebounceMs',
    'quickSearchFilteredCount',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'columnFilteringTimeZone',
    'enablePagination',
    'paginationInitialPageSize',
    'paginationPageSizes',
    'paginationRevertOnReject',
    'enableDataExport',
    'dataExportAllow',
    'dataExportFilename',
  ]),
  args: {
    ...GRID,
    dataOverride: makeFilteringData(200),
    enablePagination: true,
    paginationInitialPageSize: 25,
    enableRowSelection: true,
    rowSelectionSelectedCount: true,
    enableDataExport: true,
    enableRowDragging: true,
    // Смена фильтра возвращает на первую страницу. Выберите строки и сузьте фильтр —
    // счётчик внизу назовёт скрытые фильтром. Ручки перетаскивания исчезают, пока
    // фильтр активен. Экспорт «С учётом фильтров» выгружает отфильтрованное.
  },
}

export const QuickSearchNoColumns: StoryObj<StoryProps> = {
  name: 'Quick search — no searchable columns',
  parameters: showControls([
    'enableQuickSearch',
    'quickSearchDebounceMs',
    'quickSearchFilteredCount',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'columnFilteringTimeZone',
  ]),
  args: {
    ...GRID,
    // Искать негде (ADR 0053): «VIP» — булево, у «Name» поиск снят
    // (`enableGlobalFilter: false`). Поле недоступно, причина — в его описании и в
    // тултипе иконки; фильтры колонок при этом работают.
    columnsOverride: [
      { ...filteringColumns[0], enableGlobalFilter: false },
      filteringColumns[3],
    ],
  },
}

export const FilteringEmpty: StoryObj<StoryProps> = {
  name: 'Empty result',
  parameters: showControls([
    'enableQuickSearch',
    'quickSearchDebounceMs',
    'quickSearchFilteredCount',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'columnFilteringTimeZone',
  ]),
  args: {
    ...GRID,
    // Наберите в поиске «zzz»: над пустым телом — «No rows match the filters» и сброс
    // фильтров и поиска; шапка с воронками остаётся. Свою заглушку задаёт filterStub.
  },
}

export const FilteringServer: StoryObj<FilteringServerArgs> = {
  name: 'Server',
  args: {
    ...GRID,
    serverDelayMs: 600,
    enableColumnVisibility: true,
    // Грид не фильтрует сам: фильтры и поиск уходят в onFilterChange / onSearchChange
    // (журнал справа), «сервер» отвечает с задержкой, пока идёт загрузка — полоса
    // прогресса. «Показано N из M» — из ответа сервера. Поиск передаёт колонки
    // (`columnIds` в журнале, ADR 0053): скройте колонку в меню «Колонки» — запрос
    // уйдёт повторно с новым набором.
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
  },
  render: args => <FilteringServerDemo {...normalizeArgs(args)} />,
  // Дымовой сценарий (ADR 0045, FL37; ADR 0053, QS9): фильтр и поиск уходят колбэками
  // после дебаунса, данные перезапрашиваются, «показано N из M» — из ответа; скрытие
  // колонки повторяет поиск с новым набором колонок.
  parameters: {
    requirements: ['FL37', 'QS9'],
    ...showControls([
      'enableColumnVisibility',
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
      'serverDelayMs',
    ]),
  },
  play: async ({ canvasElement }) => {
    const firstName = () => firstRowText(canvasElement, 'name')
    await openFilter(canvasElement, 'name')
    await userEvent.type(byTestId('filter-value')!, 'bob')
    await closeFilter()

    await until(() => expect(callbackLog()).toContain('onFilterChange'))
    expect(callbackLog()).toContain('"value":"bob"')
    await until(() => expect(callbackLog()).toContain('server'))
    await until(() => expect(firstName()).toBe('Bob 1'))
    expect(filteredCount()).toBe('Showing 29 of 200')

    await userEvent.type(byTestId('quick-search')!, 'paris')
    await until(() => expect(callbackLog()).toContain('onSearchChange'))
    expect(callbackLog()).toContain('search="paris"')
    // Bob — каждая 7-я строка, Paris — каждая 5-я: оба — каждая 35-я.
    await until(() => expect(filteredCount()).toBe('Showing 6 of 200'))
    expect(firstName()).toBe('Bob 15')
    expect(callbackLog()).toContain('columnIds="name,city,age,visits"')
    expect(searchHint()).toBe('Search in columns: Name, City, Age, Visits')

    // Скрытая колонка уходит из поиска: запрос повторяется с новым набором.
    await openPopup(() => byTestId('column-visibility-button'))
    await userEvent.click(
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-menu"] [data-column-id="age"] [role="checkbox"]',
      )!,
    )
    await userEvent.keyboard('{Escape}')
    await until(() =>
      expect(callbackLog()).toContain('columnIds="name,city,visits"'),
    )
    expect(searchHint()).toBe('Search in columns: Name, City, Visits')
    await settle()
  },
}

export const FilteringDates: StoryObj<FilteringDatesArgs> = {
  name: 'Dates',
  args: {
    ...GRID,
    columnsOverride: dateFilteringColumns,
    dataOverride: dateFilteringData,
    timeZone: 'UTC',
    dateLocale: 'en-US',
    // «Birth date» — календарный день, «Created» — момент со временем. В панели —
    // условия, пресеты («Period») и календарь. Смените timeZone при фильтре «On
    // Mar 15, 2026» по «Created»: строки у границы суток уходят в соседний день.
    // dateLocale переводит календарь и даты в сводке.
  },
  argTypes: {
    timeZone: {
      control: { type: 'select' },
      options: [
        'browser',
        'UTC',
        'Europe/London',
        'Europe/Moscow',
        'America/New_York',
        'Asia/Tokyo',
      ],
    },
    dateLocale: { control: { type: 'inline-radio' }, options: ['en-US', 'ru'] },
  },
  // Дымовой сценарий (ADR 0047, DF21): дни date и datetime, условие и смена timeZone
  // меняют выборку и «показано N из M».
  parameters: {
    requirements: ['DF21'],
    ...showControls([
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
      'timeZone',
      'dateLocale',
    ]),
  },
  play: async ({ canvasElement, id }) => {
    const calendar = async (column: string) => {
      await openFilter(canvasElement, column)
      await until(() => expect(byTestId('filter-calendar')).not.toBeNull())
    }
    const selects = () =>
      byTestId('filter-calendar')!.querySelectorAll<HTMLSelectElement>('select')
    const pickDay = async (year: string, day: string) => {
      await userEvent.selectOptions(selects()[1]!, year)
      // Месяцы — номера с нуля: март.
      await userEvent.selectOptions(selects()[0]!, '2')
      await userEvent.click(
        document.querySelector(`[data-day="${day}"] button`)!,
      )
    }

    // datetime: 15 марта по UTC — все 20 строк этого дня.
    await calendar('createdAt')
    await pickDay('2026', '2026-03-15')
    await until(() => expect(filteredCount()).toBe('Showing 20 of 60'))
    await closeFilter()

    // В Токио строки после 15:00 UTC уходят на 16-е.
    await updateArgs(id, { timeZone: 'Asia/Tokyo' })
    await until(() => expect(filteredCount()).toBe('Showing 14 of 60'))

    // date: «до 1 марта 1980» вдобавок к фильтру дат создания.
    await calendar('birthDate')
    await userEvent.click(
      document.querySelector<HTMLElement>(
        '[data-testid="filter-panel"] [data-testid="filter-operator"]',
      )!,
    )
    const before = () =>
      document.querySelector<HTMLElement>('[data-operator="before"]')
    await until(() => expect(before()).not.toBeNull())
    await userEvent.click(before()!)
    await pickDay('1980', '1980-03-01')
    await until(() => expect(filteredCount()).toMatch(/^Showing [1-9] of 60$/))
    await closeFilter()
    await settle()
  },
  // Без хуков Storybook: `play` меняет пояс, и в каталоге историю перерисовывает React.
  render: function Render({ timeZone, dateLocale, ...args }, { id }) {
    return (
      <StoryComponent
        {...normalizeArgs(args)}
        updateArgs={argsUpdater(id)}
        columnFilteringTimeZone={timeZone === 'browser' ? undefined : timeZone}
        columnFilteringDateLocale={dateLocale === 'ru' ? ru : undefined}
      />
    )
  },
}

export const FilteringOptions: StoryObj<StoryProps> = {
  name: 'Select & multiselect',
  args: {
    ...GRID,
    columnsOverride: optionFilteringColumns,
    dataOverride: optionFilteringData,
    // «Status» — select, «Tags» — multiselect («содержит все»), «City» — варианты из
    // данных, «Manager» — справочник: поиск в панели идёт через loadOptions. У
    // вариантов — счётчики строк с учётом остальных фильтров. Ячейки показывают
    // подписи, поиск и экспорт — тоже.
  },
  // Дымовой сценарий (ADR 0048, SF23): галочки, «содержит все» и фасетные счётчики
  // меняют выборку и «показано N из M».
  parameters: {
    requirements: ['SF23'],
    ...showControls([
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
    ]),
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    expect(firstRowText(canvasElement, 'status')).toBe('Lead')

    await openOptions(canvasElement, 'status')
    await userEvent.click(checkboxOf('won'))
    await until(() => expect(filteredCount()).toMatch(/^Showing \d+ of 60$/))
    const afterStatus = filteredCount()
    await closeFilter()

    await openOptions(canvasElement, 'tags')
    const vip = Number(
      optionOf('vip')!.querySelector('[data-testid="filter-option-count"]')!
        .textContent,
    )
    expect(vip).toBeGreaterThan(0)
    expect(vip).toBeLessThan(30)
    await userEvent.click(
      document.querySelector<HTMLElement>(
        '[data-testid="filter-panel"] [data-testid="filter-operator"]',
      )!,
    )
    const allOf = () =>
      document.querySelector<HTMLElement>('[data-operator="allOf"]')
    await until(() => expect(allOf()).not.toBeNull())
    await userEvent.click(allOf()!)
    await userEvent.click(checkboxOf('vip'))
    await userEvent.click(checkboxOf('partner'))
    await until(() => expect(filteredCount()).not.toBe(afterStatus))
    expect(filteredCount()).toMatch(/^Showing \d+ of 60$/)
    await settle()
  },
}

export const FilteringLookupServer: StoryObj<FilteringServerArgs> = {
  name: 'Lookup (server)',
  args: {
    ...GRID,
    serverDelayMs: 400,
    // Справочник менеджеров на «сервере»: поиск в панели «Manager» пишет вызовы
    // loadOptions в журнал, прошлый запрос отменяется. Выбор уходит в onFilterChange,
    // сводка «Фильтры» называет менеджеров по имени.
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
  },
  render: args => <FilteringLookupServerDemo {...normalizeArgs(args)} />,
  // Дымовой сценарий (ADR 0048, SF24): поиск в панели зовёт loadOptions, выбор уходит в
  // onFilterChange, сводка показывает подписи.
  parameters: {
    requirements: ['SF24'],
    ...showControls([
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
      'serverDelayMs',
    ]),
  },
  play: async ({ canvasElement }) => {
    await openOptions(canvasElement, 'managerId')
    await until(() => expect(callbackLog()).toContain('loadOptions'))
    await userEvent.type(byTestId('filter-options-search')!, 'alice')
    await until(() => expect(callbackLog()).toContain('search="alice"'))
    // Справочник сузился до найденных: в списке только Alice.
    const names = () =>
      [
        ...document.querySelectorAll(
          '[data-testid="filter-panel"] [data-option-index]',
        ),
      ].map(item => item.textContent ?? '')
    await until(() =>
      expect(
        names().length > 0 && names().every(name => name.startsWith('Alice')),
      ).toBe(true),
    )
    await userEvent.click(checkboxOf('m0'))
    await until(() => expect(callbackLog()).toContain('onFilterChange'))
    expect(callbackLog()).toContain('"value":["m0"]')
    await until(() => expect(callbackLog()).toMatch(/server\s+\d+ of 200 rows/))
    await closeFilter()

    await until(() => expect(byTestId('filter-summary-button')).not.toBeNull())
    await userEvent.click(byTestId('filter-summary-button')!)
    await until(() =>
      expect(byTestId('filter-summary')).toHaveTextContent(
        'Any of: Alice Moss',
      ),
    )
    await settle()
  },
}

/** Открывает панель фильтра колонки: наведение раскрывает кнопку и грузит модуль. */
async function openFilter(canvas: HTMLElement, column: string) {
  await waitForRows(canvas)
  const head = headCell(canvas, column)
  await userEvent.hover(head)
  const panel = await openPopup(() =>
    headCell(canvas, column).querySelector<HTMLElement>(
      '.column-filter__button',
    ),
  )
  expectPopupInCanvas(canvas, panel)
}

/** Открывает панель фильтра вариантов и ждёт список. */
async function openOptions(canvas: HTMLElement, column: string) {
  await openFilter(canvas, column)
  await until(() => expect(byTestId('filter-options')).not.toBeNull())
}

async function closeFilter() {
  await userEvent.keyboard('{Escape}')
  await until(() => expect(byTestId('filter-panel')).toBeNull())
}

function filteredCount() {
  return byTestId('filtered-rows-count')?.textContent ?? null
}

/** Описание поля поиска — колонки, по которым он идёт (ADR 0053). */
function searchHint() {
  const describedBy = byTestId('quick-search')?.getAttribute('aria-describedby')
  return (
    (describedBy && document.getElementById(describedBy)?.textContent) ?? ''
  )
}

function optionOf(value: string) {
  return document.querySelector<HTMLElement>(
    `[data-testid="filter-panel"] [data-option-index][data-value="${value}"]`,
  )
}

function checkboxOf(value: string) {
  return optionOf(value)!.querySelector<HTMLElement>('[role="checkbox"]')!
}

/** Открытая панель текстового фильтра (ADR 0093, VR6). */
export const FilteringStateText: StoryObj<StoryProps> = {
  name: 'State: text filter',
  parameters: {
    ...vrStates('overlay.filterText'),
    ...showControls([
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
    ]),
  },
  args: GRID,
  play: ({ canvasElement }) => openFilter(canvasElement, 'name'),
}

/** Открытая панель фильтра даты с календарём (ADR 0093, VR6). */
export const FilteringStateDate: StoryObj<FilteringDatesArgs> = {
  ...FilteringDates,
  name: 'State: date filter',
  parameters: {
    ...vrStates('overlay.filterDate'),
    ...showControls([
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
      'timeZone',
      'dateLocale',
    ]),
  },
  play: ({ canvasElement }) => openFilter(canvasElement, 'createdAt'),
}

/** Открытая панель фильтра вариантов (ADR 0093, VR6). */
export const FilteringStateOptions: StoryObj<StoryProps> = {
  ...FilteringOptions,
  name: 'State: options filter',
  parameters: {
    ...vrStates('overlay.filterOptions'),
    ...showControls([
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
    ]),
  },
  play: ({ canvasElement }) => openFilter(canvasElement, 'status'),
}

// --- ADR 0120, S3 --------------------------------------------------------------------

const searchedCity = filteringData[0]!.city as string

const cellsOf = (root: ParentNode, column: string) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      `.data-grid__body-row [data-column-id="${column}"]`,
    ),
  ].map(cell => cell.textContent?.trim() ?? '')

const EXTERNAL_FORM: readonly GuideStoryStep[] = [
  {
    title: 'Все строки',
    hint: 'Плагины columnFilteringModel и quickSearchModel без интерфейса: в заголовках нет кнопок фильтра, в тулбаре нет поля поиска.',
    props: () => ({
      enableColumnFilteringModel: true,
      enableQuickSearchModel: true,
    }),
  },
  {
    title: `Приложение ищет «${searchedCity}»`,
    hint: 'Поле поиска приложения задаёт срез globalFilter аргументом модели — остались строки с этим городом.',
    props: () => ({ quickSearchModelGlobalFilter: searchedCity }),
  },
  {
    title: 'И фильтрует возраст старше 30',
    hint: 'Форма приложения задаёт фильтр колонки срезом columnFilters — условия поиска и фильтра объединяются через И.',
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
    ...showControls([
      'enableColumnFilteringModel',
      'columnFilteringModelTimeZone',
      'enableQuickSearchModel',
    ]),
  },
  args: {
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
    columnsOverride: filteringColumns,
    dataOverride: filteringData,
  },
  render: args => (
    <GuideStory
      title="Фильтры и поиск из формы приложения"
      steps={EXTERNAL_FORM}
      args={normalizeArgs(args)}
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

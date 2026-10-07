import { ru } from '@daypicker/react/locale/ru'
import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

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
 * результат; сервер; поиск без колонок для поиска.
 */

const meta = {
  ...dataGridMeta,
  title: 'Tessera/DataGrid/Filtering',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
  columnsOverride: filteringColumns,
  dataOverride: filteringData,
  enableColumnFiltering: true,
  enableQuickSearch: true,
  columnFilteringOptions: { filteredCount: true },
  quickSearchOptions: { filteredCount: true },
}

export const Filtering: StoryObj<StoryProps> = {
  name: 'Filtering',
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
  name: 'Filtering — tree',
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
  name: 'Filtering — with pagination, selection and export',
  args: {
    ...GRID,
    dataOverride: makeFilteringData(200),
    enablePagination: true,
    paginationPageSize: 25,
    enableRowSelection: true,
    showSelectedCount: true,
    enableExport: true,
    enableRowDragging: true,
    // Смена фильтра возвращает на первую страницу. Выберите строки и сузьте фильтр —
    // счётчик внизу назовёт скрытые фильтром. Ручки перетаскивания исчезают, пока
    // фильтр активен. Экспорт «С учётом фильтров» выгружает отфильтрованное.
  },
}

export const QuickSearchNoColumns: StoryObj<StoryProps> = {
  name: 'Quick search — no searchable columns',
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
  name: 'Filtering — empty result',
  args: {
    ...GRID,
    // Наберите в поиске «zzz»: над пустым телом — «No rows match the filters» и сброс
    // фильтров и поиска; шапка с воронками остаётся. Свою заглушку задаёт filterStub.
  },
}

export const FilteringServer: StoryObj<FilteringServerArgs> = {
  name: 'Filtering — server',
  args: {
    ...GRID,
    serverDelayMs: 600,
    // Грид не фильтрует сам: фильтры и поиск уходят в onFilterChange / onSearchChange
    // (журнал справа), «сервер» отвечает с задержкой, пока идёт загрузка — полоса
    // прогресса. «Показано N из M» — из ответа сервера. Поиск передаёт колонки
    // (`columnIds` в журнале, ADR 0053): включите enableColumnVisibility и скройте
    // колонку — запрос уйдёт повторно с новым набором.
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
  },
  render: args => <FilteringServerDemo {...normalizeArgs(args)} />,
}

export const FilteringDates: StoryObj<FilteringDatesArgs> = {
  name: 'Filtering — dates',
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
  render: function Render({ timeZone, dateLocale, ...args }) {
    const [, updateArgs] = useArgs()
    return (
      <StoryComponent
        {...normalizeArgs(args)}
        updateArgs={updateArgs}
        columnFilteringOptions={{
          ...args.columnFilteringOptions,
          timeZone: timeZone === 'browser' ? undefined : timeZone,
          dateLocale: dateLocale === 'ru' ? ru : undefined,
        }}
      />
    )
  },
}

export const FilteringOptions: StoryObj<StoryProps> = {
  name: 'Filtering — select & multiselect',
  args: {
    ...GRID,
    columnsOverride: optionFilteringColumns,
    dataOverride: optionFilteringData,
    // «Status» — select, «Tags» — multiselect («содержит все»), «City» — варианты из
    // данных, «Manager» — справочник: поиск в панели идёт через loadOptions. У
    // вариантов — счётчики строк с учётом остальных фильтров. Ячейки показывают
    // подписи, поиск и экспорт — тоже.
  },
}

export const FilteringLookupServer: StoryObj<FilteringServerArgs> = {
  name: 'Filtering — lookup (server)',
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
}

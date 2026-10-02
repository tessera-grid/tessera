import { Meta, StoryObj } from '@storybook/react'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  filteringColumns,
  filteringData,
  makeFilteringData,
} from './__mocks__/filteringData'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { FilteringServerDemo } from './demos/filteringDemos'

interface FilteringServerArgs extends StoryProps {
  serverDelayMs?: number
}

/**
 * Фильтрация (ADR 0045): фильтры колонок по типам — текст, число, булево; быстрый
 * поиск; сочетания с деревом, пагинацией, выбором, экспортом; пустой результат; сервер.
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
  enableToolbar: true,
  columnFilteringOptions: { filteredCount: true },
  quickSearchOptions: { filteredCount: true },
}

export const Filtering: StoryObj<StoryProps> = {
  name: 'Filtering',
  args: {
    ...GRID,
    // Воронка в заголовке открывает панель: «Name» и «City» — текст, «Age» — число
    // (с «между»), «VIP» — булево с «Пусто». У «Visits» фильтра нет. Поиск слева в
    // тулбаре, справа — сводка «Фильтры» со сбросом; внизу — «Показано N из M».
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
    dataMode: 'hierarchy',
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
    // прогресса. «Показано N из M» — из ответа сервера.
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
  },
  render: args => <FilteringServerDemo {...normalizeArgs(args)} />,
}

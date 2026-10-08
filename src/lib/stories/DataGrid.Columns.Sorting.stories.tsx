import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  optionFilteringColumns,
  optionFilteringData,
} from './__mocks__/filteringData'

/** Сортировка колонок (ADR 0012, ADR 0063): одна и несколько колонок, без снятия, по подписи вариантов. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Sorting',
} satisfies Meta<StoryProps>

export default meta

export const ColumnSorting: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableColumnSorting: true,
    // Sized to overflow vertically so the row-ordering requirements (CS12–CS13)
    // have enough rendered rows to prove the sort order against.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnSortingNotRemovable: StoryObj<StoryProps> = {
  name: 'Not removable',
  args: {
    enableColumnSorting: true,
    enableSortingRemoval: false,
  },
}

export const ColumnMultiSorting: StoryObj<StoryProps> = {
  name: 'Multi-sort',
  args: {
    enableColumnSorting: true,
    enableMultiSort: true,
    // Shift+клик по нескольким заголовкам добавляет столбцы к сортировке; у
    // каждого отсортированного столбца в шапке виден порядковый бейдж приоритета.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnSortingOptionLabels: StoryObj<StoryProps> = {
  name: 'Option labels',
  args: {
    enableColumnSorting: true,
    columnsOverride: optionFilteringColumns,
    dataOverride: optionFilteringData,
    // «Status» сортируется в порядке вариантов, «Tags» — поэлементно, «Manager» — по
    // имени из справочника, а не по id. С группировкой в том же порядке идут группы.
  },
}

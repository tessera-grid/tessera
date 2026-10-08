import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Вложенная шапка (ADR 0049): группы заголовков, листья разной глубины. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Header groups',
} satisfies Meta<StoryProps>

export default meta

export const HeaderGroups: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    headerNesting: 'nested',
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}

export const HeaderGroupsShallowLeaves: StoryObj<StoryProps> = {
  name: 'Shallow leaves',
  args: {
    // Листья разной глубины без групп-прокладок: Country, Visits и служебные
    // колонки растянуты до низа шапки (ADR 0049). Кебаб растянутого листа — тот же,
    // что в плоской шапке. Мок вложенный — колонка раскрытия видна.
    dataNesting: 'nested',
    headerNesting: 'nested',
    enableRowSelection: true,
    enableRowExpanding: true,
    enableRowActions: true,
    enableColumnPinning: true,
    enableColumnVisibility: true,
    enableHeaderActionMenu: true,
    enableKeyboardNavigation: true,
    dataCount: 40,
    containerHeight: 500,
    height: 400,
    maxHeight: 400,
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}

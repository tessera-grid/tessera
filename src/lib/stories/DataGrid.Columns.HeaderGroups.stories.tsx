import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Вложенная шапка (ADR 0049): группы заголовков, листья разной глубины. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Header groups',
} satisfies Meta<StoryProps>

export default meta

export const HeaderGroups: StoryObj<StoryProps> = {
  name: 'Default',
  args: {
    headerNesting: 'nested',
  },
  parameters: {
    ...vrStates('head.nested'),
    ...showControls(['headerNesting'], {
      columnCount: 'колонки задаёт вложенная шапка',
    }),
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
    containerHeight: '500',
    height: '400',
    maxHeight: '400',
  },
  parameters: showControls(
    [
      'headerNesting',
      'dataNesting',
      'enableColumnPinning',
      'columnPinningLeafPinning',
      'enableColumnVisibility',
      'enableHeaderActionMenu',
      'headerActionMenuMode',
      'headerActionMenuThreshold',
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'enableTreeLines',
      'enableRowActions',
      'rowActionsWidth',
      'rowActionsCollapsedWidth',
      'rowActionsColumn',
      'enableKeyboardNavigation',
    ],
    { columnCount: 'колонки задаёт вложенная шапка' },
  ),
}

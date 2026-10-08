import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { filteringColumns, filteringData } from './__mocks__/filteringData'

/** Меню заголовка (ADR 0024) и индикатор включённого действия (ADR 0062). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Header menu',
} satisfies Meta<StoryProps>

export default meta

// Индикатор включённого действия (ADR 0062): отсортируйте, отфильтруйте или закрепите
// колонку — на её кнопке появится точка; скройте колонку — на «Колонках» число скрытых.
const activeIndicatorArgs: Partial<StoryProps> = {
  columnsOverride: filteringColumns,
  dataOverride: filteringData,
  enableColumnSorting: true,
  enableColumnFiltering: true,
  enableColumnPinning: true,
  enableColumnVisibility: true,
  containerHeight: 460,
  height: 400,
  maxHeight: 400,
}

export const HeaderActionMenu: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    // Три действия в правом слоте (пин + сортировка + группировка) — дескрипторы;
    // достигают порога 3 → весь набор схлопывается в один кебаб (⋮), меню делится
    // на подгруппы. Свич `enableColumnResizing` включает управление шириной: его
    // resize-грип рисуется на кромке, но в порог схлопывания не входит
    // (`countsAsHeaderAction: false`), поэтому кебаб от него не «толстеет».
    enableHeaderActionMenu: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enableGrouping: true,
    enableColumnResizing: true,
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ActiveActionIndicator: StoryObj<StoryProps> = {
  name: 'Active indicator',
  args: activeIndicatorArgs,
}

// То же, но кнопки свёрнуты в кебаб: включённое действие видно точкой на кебабе, а
// сам кебаб остаётся на виду без наведения. Shift+клик по сортировке — номер
// приоритета вместо точки.
export const ActiveActionIndicatorInMenu: StoryObj<StoryProps> = {
  name: 'Active indicator — in menu',
  args: {
    ...activeIndicatorArgs,
    enableHeaderActionMenu: true,
    headerActionMenuOptions: { mode: 'always' },
  },
}

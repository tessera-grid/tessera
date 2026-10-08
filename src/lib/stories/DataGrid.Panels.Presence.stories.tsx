import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Включение панелей (ADR 0046): тулбар и нижняя панель по слотам плагинов; флаги `enableToolbar` / `enableStatusBar`. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Presence',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  columnCount: 8,
  dataCount: 120,
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
}

export const PanelsFromPlugins: StoryObj<StoryProps> = {
  name: 'From plugins',
  args: {
    ...GRID,
    // Флагов нет: тулбар вызывают «Колонки» и «Экспорт», нижнюю панель — пагинация
    // и счётчик выбора. Переключите enableToolbar / enableStatusBar в off — панель
    // уйдёт (columnVisibility станет инертен), в on — останется и без плагинов.
    enableColumnVisibility: true,
    enableExport: true,
    enablePagination: true,
    enableRowSelection: true,
    showSelectedCount: true,
  },
}

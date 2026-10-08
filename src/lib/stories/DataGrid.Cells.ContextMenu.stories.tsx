import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Контекстное меню (ADR 0030). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Context menu',
} satisfies Meta<StoryProps>

export default meta

export const ContextMenu: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    // Контекстное меню по правому клику; cellSelection контрибьютит «Копировать».
    enableContextMenu: true,
    enableCellSelection: true,
    columnCount: 8,
    dataCount: 40,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

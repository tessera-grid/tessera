import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/**
 * Касания (ADR 0086): грид в окне телефона со всеми целями под палец. Откройте в
 * мобильном окне (Viewport) или с телефона: кнопки шапки видны, касание ячейки
 * показывает её кнопки, долгое нажатие открывает контекстное меню, грип и ручки тянутся.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Touch',
} satisfies Meta<StoryProps>

export default meta

export const Touch: StoryObj<StoryProps> = {
  name: 'Basic',
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  args: {
    enableColumnSorting: true,
    enableColumnSizing: true,
    enableColumnDragging: true,
    enableRowDragging: true,
    enableRowSelection: true,
    enableCellEditing: true,
    enableContextMenu: true,
    enableCellSelection: true,
    columnCount: 8,
    dataCount: 60,
    containerWidth: 360,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

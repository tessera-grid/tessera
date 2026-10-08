import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Перетаскивание строк (ADR 0006). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Dragging',
} satisfies Meta<StoryProps>

export default meta

export const RowDragging: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableRowDragging: true,
    // Sized to overflow on both axes so the play's auto-scroll steps (D12–D14)
    // have real vertical + horizontal scroll to exercise.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Ширина и порядок колонок (ADR 0013, ADR 0006, ADR 0052): протяжка, перетаскивание, под вложенной шапкой. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Resizing & dragging',
} satisfies Meta<StoryProps>

export default meta

export const ColumnResizing: StoryObj<StoryProps> = {
  name: 'Resizing',
  args: {
    enableColumnResizing: true,
    // Несколько строк, чтобы требование синхронизации ширины шапки и тела
    // (CR8) имело отрисованные body-ячейки для сверки.
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnDragging: StoryObj<StoryProps> = {
  name: 'Dragging',
  args: {
    enableColumnDragging: true,
    // Sized to overflow on both axes so the auto-scroll requirements (D26–D28)
    // have real horizontal scroll distance and a vertical axis to stay off.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

/**
 * Перетаскивание под вложенной шапкой (ADR 0052): лист — среди соседей своей группы,
 * группа — среди соседей уровня целиком. Включите `enableColumnPinning`, чтобы
 * увидеть, что закреплённые узлы не двигаются.
 */
export const HeaderGroupsDragging: StoryObj<StoryProps> = {
  name: 'Dragging under header groups',
  args: {
    headerNesting: 'nested',
    enableColumnDragging: true,
    enableRowDragging: true,
    dataCount: 40,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}

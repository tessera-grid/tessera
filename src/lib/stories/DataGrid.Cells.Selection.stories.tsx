import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Выделение ячеек (ADR 0029). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Selection',
} satisfies Meta<StoryProps>

export default meta

export const CellSelection: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableCellSelection: true,
    // Умеренный грид (обе оси в окне): клик выделяет ячейку, shift-клик/drag —
    // прямоугольный диапазон, ctrl/cmd-клик — мульти-диапазон, Ctrl/Cmd+C копирует
    // выделение в буфер (TSV + HTML). См. ADR 0029.
    columnCount: 8,
    dataCount: 40,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

export const CellSelectionPredicate: StoryObj<StoryProps> = {
  name: 'Predicate',
  args: {
    ...CellSelection.args,
    // `canSelectCell` запрещает выделять колонку Age: клик по ней не выделяет, а
    // диапазон через неё её пропускает. Функцию в панели не задать — контрол скрыт.
    cellSelectionOptions: {
      // Публичный тип ячейки предиката не несёт `column.id` — приводим к живой форме.
      canSelectCell: cell =>
        (cell.column as unknown as { id: string }).id !== 'age',
    },
  },
  argTypes: { cellSelectionOptions: { control: false } },
}

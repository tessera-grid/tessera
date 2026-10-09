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

/**
 * Асинхронные пункты контекстного меню (ADR 0078): Share проверяет доступность при
 * открытии — по номеру строки уже поделились (галочка), запрещено (замок), проверка
 * упала (нажатие проверяет заново) или доступно; Recalculate идёт долго и отклоняется
 * на каждой 3-й строке — ожидание и ошибка видны при следующем открытии той же ячейки.
 */
export const ContextMenuAsync: StoryObj<StoryProps> = {
  name: 'Async items',
  args: {
    enableContextMenu: true,
    enableCellSelection: true,
    actionsDemo: 'async',
    columnCount: 8,
    dataCount: 40,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Действия строки (ADR 0025): кнопки, без действий, меню строки. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Actions',
} satisfies Meta<StoryProps>

export default meta

export const RowActions: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableRowActions: true,
  },
}

/**
 * Плагин действий без единого действия: колонки действий нет (ADR 0050). Включите
 * `rowActionsDemo`, чтобы действия появились вместе с колонкой.
 */
export const RowActionsWithoutActions: StoryObj<StoryProps> = {
  name: 'No actions',
  args: {
    enableRowActions: true,
    rowActionsDemo: false,
  },
}

export const RowActionMenu: StoryObj<StoryProps> = {
  name: 'Action menu',
  args: {
    // Демо-производитель даёт три действия строки (Edit / Duplicate / Delete) как
    // дескрипторы. Свич `enableRowActionMenu` (порог 2) схлопывает их в overflow-
    // кебаб (⋮) в колонке действий; выключенным — три row-кнопки инлайн (ревил по
    // hover строки). Колонка действий появляется по `enableRowActions`.
    enableRowActions: true,
    enableRowActionMenu: true,
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

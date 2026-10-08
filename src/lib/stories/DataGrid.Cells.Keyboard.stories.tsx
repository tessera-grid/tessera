import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Клавиатурная навигация (ADR 0021). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Keyboard',
} satisfies Meta<StoryProps>

export default meta

export const KeyboardNavigation: StoryObj<StoryProps> = {
  name: 'Navigation',
  args: {
    // Стрелки/Home/End/PageUp-Down двигают активную ячейку (roving tabindex), в т.ч.
    // по заголовку и сервисным колонкам; с cellSelection стрелка схлопывает
    // выделение, Shift+стрелка расширяет диапазон. Space — выбор строки, Enter на
    // заголовке — сортировка, Enter/F2 — правка (age/visits/gender) или вход в
    // виджеты ячейки, Escape — обратно, Tab — выход из грида, Shift+F10 — меню.
    // Много строк/колонок — чтобы переход за окно виртуализации доводил ячейку в
    // вид. См. ADR 0021.
    enableKeyboardNavigation: true,
    enableCellSelection: true,
    enableRowSelection: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enableCellEditing: true,
    enableContextMenu: true,
    columnCount: 40,
    dataCount: 500,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

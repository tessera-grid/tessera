import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Истории ячеек: редактирование, контекстное меню, выделение, клавиатура. */
const meta = {
  ...dataGridMeta,
  title: 'Tessera/DataGrid/Cells',
} satisfies Meta<StoryProps>

export default meta

export const CellEditing: StoryObj<StoryProps> = {
  name: 'Cell Editing',
  args: {
    enableCellEditing: true,
    // Немного колонок/строк без виртуализации: кнопка редактирования появляется в
    // правом слоте по hover, а редактируемость гейтит канредактируемые колонки
    // (age/visits/gender — CELL_EDITABLE_COLUMNS). Коммит по Enter пишет значение
    // в мок-данные и сразу виден в ячейке.
    columnCount: 6,
    dataCount: 10,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'dataCount'],
    },
  },
}

export const ContextMenu: StoryObj<StoryProps> = {
  name: 'Context Menu',
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

export const CellSelection: StoryObj<StoryProps> = {
  name: 'Cell Selection',
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

export const KeyboardNavigation: StoryObj<StoryProps> = {
  name: 'Keyboard Navigation',
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

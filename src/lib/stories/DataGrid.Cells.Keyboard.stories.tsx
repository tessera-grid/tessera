import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { expect, waitFor, userEvent } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import { bodyCell, settle, waitForRows } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Клавиатурная навигация (ADR 0021). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Keyboard',
} satisfies Meta<StoryProps>

export default meta

export const KeyboardNavigation: StoryObj<StoryProps> = {
  name: 'Navigation',
  parameters: showControls([
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
    'enableColumnPinning',
    'columnPinningLeafPinning',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enableCellEditing',
    'enableCellSelection',
    'cellSelectionRangeSelection',
    'cellSelectionDragSelection',
    'cellSelectionMultiRange',
    'enableContextMenu',
    'enableKeyboardNavigation',
  ]),
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
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}

/** Активная ячейка с кольцом фокуса (ADR 0093, VR4): клавиатурная модальность. */
export const KeyboardStateFocusedCell: StoryObj<StoryProps> = {
  name: 'State: focused cell',
  parameters: {
    ...vrStates('body.focus'),
    ...showControls([
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableKeyboardNavigation',
    ]),
  },
  args: {
    enableKeyboardNavigation: true,
    enableRowSelection: true,
    dataCount: 20,
    columnCount: 8,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    bodyCell(canvasElement, 'item-id-1', 'firstName').focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(bodyCell(canvasElement, 'item-id-2', 'firstName')).toHaveAttribute(
        'data-kn-active',
        'true',
      ),
    )
    await settle()
  },
}

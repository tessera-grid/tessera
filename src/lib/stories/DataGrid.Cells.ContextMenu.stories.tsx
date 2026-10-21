import { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import {
  bodyCell,
  expectPopupInCanvas,
  settle,
  sleep,
  waitForPopup,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Контекстное меню (ADR 0030). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Context menu',
} satisfies Meta<StoryProps>

export default meta

export const ContextMenu: StoryObj<StoryProps> = {
  name: 'Default',
  parameters: showControls([
    'enableCellSelection',
    'cellSelectionRangeSelection',
    'cellSelectionDragSelection',
    'cellSelectionMultiRange',
    'enableContextMenu',
  ]),
  args: {
    // Контекстное меню по правому клику; cellSelection контрибьютит «Копировать».
    enableContextMenu: true,
    enableCellSelection: true,
    columnCount: 8,
    dataCount: 40,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
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
  parameters: showControls([
    'enableCellSelection',
    'cellSelectionRangeSelection',
    'cellSelectionDragSelection',
    'cellSelectionMultiRange',
    'enableContextMenu',
  ]),
  args: {
    enableContextMenu: true,
    enableCellSelection: true,
    actionsDemo: 'async',
    columnCount: 8,
    dataCount: 40,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}

/** Открытое контекстное меню ячейки (ADR 0093, VR6). */
export const ContextMenuStateOpen: StoryObj<StoryProps> = {
  name: 'State: open',
  parameters: {
    ...vrStates('overlay.contextMenu'),
    ...showControls([
      'enableCellSelection',
      'cellSelectionRangeSelection',
      'cellSelectionDragSelection',
      'cellSelectionMultiRange',
      'enableContextMenu',
    ]),
  },
  args: {
    enableContextMenu: true,
    enableCellSelection: true,
    columnCount: 8,
    dataCount: 20,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const cell = bodyCell(canvasElement, 'item-id-1', 'firstName')
    await userEvent.hover(cell)
    await sleep(500)
    // Меню встаёт у точки нажатия: без координат событие пришло бы из угла окна.
    const box = cell.getBoundingClientRect()
    const clientX = box.left + box.width / 2
    const clientY = box.top + box.height / 2
    await userEvent.pointer({
      keys: '[MouseRight]',
      target: cell,
      coords: { clientX, clientY },
    })
    const menu = await waitForPopup('menu')
    await settle()
    expectPopupInCanvas(canvasElement, menu)
    const { left, top } = menu.getBoundingClientRect()
    expect(Math.abs(left - clientX) + Math.abs(top - clientY)).toBeLessThan(24)
  },
}

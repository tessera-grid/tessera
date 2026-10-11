import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { expect } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import { rowAt, settle, until, waitForRows } from './__mocks__/catalogPlay'

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
    // диапазон через неё её пропускает. Служебные колонки закрыты всегда, предикат
    // только сужает. Функцию в панели не задать — контрол скрыт.
    cellSelectionOptions: {
      canSelectCell: cell => cell.column.id !== 'age',
    },
  },
  argTypes: { cellSelectionOptions: { control: false } },
}

/** Выделенный диапазон ячеек (ADR 0093, VR4): нажатие и нажатие с Shift. */
export const CellSelectionStateRange: StoryObj<StoryProps> = {
  name: 'State: cell range',
  parameters: vrStates('body.cellRange'),
  args: {
    enableCellSelection: true,
    columnCount: 6,
    dataCount: 20,
    containerHeight: 460,
    height: 360,
    maxHeight: 360,
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const cell = (row: number, column: number) =>
      rowAt(canvasElement, row).querySelectorAll<HTMLElement>(
        '.data-grid__body-cell',
      )[column]!
    const press = (target: HTMLElement, shiftKey = false) => {
      const init = { bubbles: true, cancelable: true, button: 0, shiftKey }
      target.dispatchEvent(new MouseEvent('mousedown', init))
      target.dispatchEvent(new MouseEvent('mouseup', init))
    }
    press(cell(2, 1))
    press(cell(4, 3), true)
    await until(() =>
      expect(
        canvasElement.querySelectorAll('[data-cell-selected="true"]'),
      ).toHaveLength(9),
    )
    await settle()
  },
}

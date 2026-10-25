import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Касания (ADR 0086): таблица в окне телефона со всеми целями под палец. Таблица узнаёт
 * касания по экрану без наведения и с грубым указателем и по событиям пальца: окно
 * Storybook меняет только размер — проверяйте в режиме устройства DevTools браузера
 * или с телефона.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Touch',
} satisfies Meta<StoryProps>

export default meta

const NOT_TOUCH = 'На касания не влияет'

/** Плагины с целями под палец: кнопки шапки и ячеек, грип, ручки, флажки, меню. */
export const TouchPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'enableColumnSorting',
      'enableColumnSizing',
      'enableColumnDragging',
      'enableRowSelection',
      'enableRowDragging',
      'enableCellEditing',
      'enableCellSelection',
      'enableContextMenu',
      'containerWidth',
    ],
    {
      containerHeight: NOT_TOUCH,
      maxHeight: NOT_TOUCH,
      defaultColumn: NOT_TOUCH,
    },
  ),
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  args: {
    enableColumnSorting: true,
    enableColumnSizing: true,
    enableColumnDragging: true,
    enableRowDragging: true,
    enableRowSelection: true,
    enableCellEditing: true,
    enableContextMenu: true,
    enableCellSelection: true,
    columnCount: 8,
    dataCount: 60,
    containerWidth: 360,
    // Строк больше, чем помещается: таблица прокручивается пальцем внутри себя.
    height: '460',
  },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

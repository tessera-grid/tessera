import { Meta, StoryObj } from '@storybook/react'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { HighlightDemo } from './demos/highlightDemos'

/**
 * Публичная подсветка (ADR 0080): «Delete» в строке подсвечивает её красным, пока
 * удаление не подтверждено; поиск отмечает совпадения; кнопки — вспышка ячейки и
 * блик колонки. Включите выбор строк, закрепление или выделение ячеек в Controls,
 * чтобы увидеть подсветку поверх этих состояний.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Highlight',
} satisfies Meta<StoryProps>

export default meta

export const RowHighlight: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableRowActions: true,
    // Действия строки — только «Delete» демо-плагина.
    actionsDemo: 'none',
    enableFooter: true,
    containerHeight: 460,
    height: 360,
    maxHeight: 360,
  },
  render: function Render(args) {
    return <HighlightDemo {...args} />
  },
}

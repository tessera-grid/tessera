import type { TesseraFeatureEntry } from '../core/features'
import { Meta, StoryObj } from '@storybook/react'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { HighlightDemo } from './demos/highlightDemos'
import { expect, waitFor } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import { settle, waitForRows } from './__mocks__/catalogPlay'

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

/** Подсветки строки, ячейки и колонки — один раз, как только появились строки. */
const highlightsDemo: TesseraFeatureEntry = {
  id: 'highlightsDemo',
  setup: table => {
    const t = table as {
      getCoreRowModel: () => { rows: unknown[] }
      highlight: (target: object, options?: object) => unknown
    }
    let frame = 0
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.highlight({ row: 'item-id-1' }, { tone: 'info' })
      t.highlight({ row: 'item-id-3' }, { tone: 'danger' })
      t.highlight(
        { cell: { row: 'item-id-5', column: 'firstName' } },
        { tone: 'success' },
      )
      t.highlight({ column: 'age' }, { tone: 'warning' })
    }
    apply()
    return () => cancelAnimationFrame(frame)
  },
}

/** Подсвеченные строка, ячейка и колонка (ADR 0093, VR4). */
export const HighlightStateLit: StoryObj<StoryProps> = {
  name: 'State: highlights',
  parameters: vrStates('body.highlight'),
  args: {
    extraPlugins: [highlightsDemo],
    dataCount: 12,
    containerHeight: 460,
    height: 360,
    maxHeight: 360,
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-highlight]')).not.toBeNull(),
    )
    await settle()
  },
}

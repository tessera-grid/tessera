import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { overflowColumns, overflowData } from './__mocks__/overflowColumns'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Тултип у обрезанного текста (ADR 0075). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Overflow tooltip',
} satisfies Meta<StoryProps>

export default meta

export const OverflowTooltip: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: showControls(['enableFooter']),
  args: {
    // Узкие колонки с длинным текстом: наведение на обрезанный текст шапки, тела или
    // футера показывает полный. Выключите enableOverflowTooltip, чтобы сравнить.
    columnsOverride: overflowColumns,
    dataOverride: overflowData,
    enableFooter: true,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}

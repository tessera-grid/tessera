import { Meta, StoryObj } from '@storybook/react'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { ScrollToRowDemo } from './demos/scrollToRowDemos'
import { expect, screen, userEvent } from 'storybook/test'
import { bodyRow, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'

/**
 * Прокрутка к строке (ADR 0104): `table.scrollToRow` из панели демо — id строки,
 * выравнивание, колонка, раскрытие предков, плавность. Включите пагинацию в Controls,
 * чтобы увидеть переключение страницы.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Scroll to row',
} satisfies Meta<StoryProps>

export default meta

export const ScrollToRowBasic: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableRowExpanding: true,
    rowExpandingMaxDepth: 3,
    enableFooter: true,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  render: function Render(args) {
    return <ScrollToRowDemo {...normalizeArgs(args)} />
  },
  // Дымовой сценарий (ADR 0104, SV12): строка с другого края, внук свёрнутой строки с
  // раскрытием предков и отказ для несуществующей.
  parameters: {
    requirements: ['SV12'],
    ...showControls(
      [
        'enableFooter',
        'enableRowExpanding',
        'rowExpandingMaxDepth',
        'rowExpandingColumn',
        'rowExpandingTreeLines',
      ],
      { dataCount: 'данные подаёт демо' },
    ),
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    await userEvent.click(screen.getByRole('button', { name: /Демо/ }))
    const id = screen.getByRole('textbox', { name: 'Id строки' })
    const scroll = () =>
      userEvent.click(screen.getByRole('button', { name: 'Прокрутить' }))
    const status = () =>
      screen.queryByTestId('scroll-result')?.textContent ?? ''

    await scroll()
    await until(() => expect(status()).toBe('Строка item-id-250 на месте'))
    expect(bodyRow(canvasElement, 'item-id-250')).not.toBeNull()

    await userEvent.clear(id)
    await userEvent.type(id, 'item-id-90-0-0')
    await scroll()
    await until(() => expect(status()).toBe('Строка item-id-90-0-0 на месте'))
    expect(bodyRow(canvasElement, 'item-id-90-0-0')).not.toBeNull()

    await userEvent.clear(id)
    await userEvent.type(id, 'missing')
    await scroll()
    await until(() => expect(status()).toBe('Строку missing показать нельзя'))
    await settle()
  },
}

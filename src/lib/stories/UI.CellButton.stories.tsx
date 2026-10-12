import { Meta, StoryObj } from '@storybook/react'
import { fn } from 'storybook/test'

import { CellButton } from '../grid/Actions/CellButton'
import { useIcons } from '../ui/icons'
import { UiCanvas } from './__mocks__/UiCanvas'

/**
 * Кнопка в ячейке для своих слотов: тултип и доступное имя из `title`. С
 * `showOnHover` проявляется при наведении на ячейку — наведите на рамку.
 * Вид, размер и состояния — база `UI/IconButton` (ADR 0098); здесь — только свои.
 */
const CellButtonDemo = (
  props: Omit<Parameters<typeof CellButton>[0], 'icon'>,
) => {
  const { edit: Edit } = useIcons()
  return (
    <UiCanvas host="cell" caption="42" width={200}>
      <CellButton {...props} icon={<Edit width={16} height={16} />} />
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/CellButton',
  component: CellButtonDemo,
  args: {
    title: 'Edit cell',
    showOnHover: true,
    disabled: false,
    showTooltipWhenDisabled: false,
    onClick: fn(),
  },
} satisfies Meta<typeof CellButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const CellButtonBasic: Story = { name: 'Basic' }

export const CellButtonAlwaysVisible: Story = {
  name: 'Always visible',
  args: { showOnHover: false },
}

export const CellButtonDisabled: Story = {
  name: 'Disabled',
  args: { showOnHover: false, disabled: true, showTooltipWhenDisabled: true },
}

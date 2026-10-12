import { Toolbar } from '@base-ui/react/toolbar'
import { Meta, StoryObj } from '@storybook/react'
import { fn } from 'storybook/test'

import { ToolbarButton } from '../ui/ToolbarButton'
import { useIcons } from '../ui/icons'
import { UiCanvas } from './__mocks__/UiCanvas'

/**
 * Кнопка тулбара (ADR 0035): иконка с тултипом; живёт внутри `Toolbar.Root`. Активное
 * состояние — точка; ожидание и вспышка ошибки — ADR 0055.
 * Вид, размер и состояния — база `UI/IconButton` (ADR 0098); здесь — только свои.
 */
const ToolbarButtonDemo = (
  props: Omit<Parameters<typeof ToolbarButton>[0], 'icon'>,
) => {
  const { columns: Columns } = useIcons()
  return (
    <UiCanvas>
      <Toolbar.Root>
        <ToolbarButton {...props} icon={<Columns width={16} height={16} />} />
      </Toolbar.Root>
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/ToolbarButton',
  component: ToolbarButtonDemo,
  argTypes: { errorFlash: { table: { disable: true } } },
  args: {
    label: 'Columns',
    active: false,
    disabled: false,
    pending: false,
    onClick: fn(),
  },
} satisfies Meta<typeof ToolbarButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const ToolbarButtonBasic: Story = { name: 'Basic' }

export const ToolbarButtonActive: Story = {
  name: 'Active',
  args: { active: true, label: 'Columns, 2 hidden' },
}

export const ToolbarButtonPending: Story = {
  name: 'Pending',
  args: { pending: true },
}

export const ToolbarButtonDisabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
}

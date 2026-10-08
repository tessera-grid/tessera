import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { ExpandButton } from '../plugins/rowExpanding/ExpandButton'
import { UiCanvas } from './__mocks__/UiCanvas'

/**
 * Тоггл раскрытия строки (ADR 0015): шеврон поворачивается; ожидание подгрузки —
 * блик по контуру, отказ — вспышка (ADR 0055). Увеличьте errorFlash — контур
 * вспыхнет снова.
 */
const meta = {
  title: 'Tessera/UI/ExpandButton',
  component: ExpandButton,
  args: {
    expanded: false,
    pending: false,
    errorFlash: 0,
    disabled: false,
    onClick: () => {},
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas>
        <ExpandButton
          {...args}
          onClick={() => updateArgs({ expanded: !args.expanded })}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof ExpandButton>

export default meta

type Story = StoryObj<typeof meta>

export const ExpandButtonBasic: Story = { name: 'Basic' }

export const ExpandButtonExpanded: Story = {
  name: 'Expanded',
  args: { expanded: true },
}

export const ExpandButtonPending: Story = {
  name: 'Pending',
  args: { pending: true },
}

export const ExpandButtonDisabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
}

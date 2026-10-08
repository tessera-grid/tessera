import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { SelectCheckbox } from '../ui/SelectCheckbox/SelectCheckbox'
import { UiCanvas } from './__mocks__/UiCanvas'

/** Чекбокс выбора строки (ADR 0014): выбран, частично (дети выбраны не все), недоступен. */
const meta = {
  title: 'Tessera/UI/SelectCheckbox',
  component: SelectCheckbox,
  args: {
    selected: false,
    indeterminate: false,
    disabled: false,
    label: 'Select row',
    onClick: () => {},
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas>
        <SelectCheckbox
          {...args}
          onClick={(_, checked) =>
            updateArgs({ selected: checked, indeterminate: false })
          }
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof SelectCheckbox>

export default meta

type Story = StoryObj<typeof meta>

export const SelectCheckboxBasic: Story = { name: 'Basic' }

export const SelectCheckboxSelected: Story = {
  name: 'Selected',
  args: { selected: true },
}

export const SelectCheckboxIndeterminate: Story = {
  name: 'Indeterminate',
  args: { indeterminate: true },
}

export const SelectCheckboxDisabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
}

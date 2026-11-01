import { Meta, StoryObj } from '@storybook/react'

import { CheckMark } from '../ui/CheckMark/CheckMark'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/** Значок булева значения (ADR 0172): вид флажка выбора, который нельзя нажать. */
const meta = {
  title: 'Tessera/UI/CheckMark',
  component: CheckMark,
  args: { checked: true, label: 'Yes' },
  render: args => (
    <UiCanvas>
      <CheckMark {...args} />
    </UiCanvas>
  ),
} satisfies Meta<typeof CheckMark>

export default meta

type Story = StoryObj<typeof meta>

export const CheckMarkPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('checked', 'label'),
}

export const CheckMarkUnchecked: Story = {
  name: 'Unchecked',
  parameters: noControls(),
  args: { checked: false, label: 'No' },
}

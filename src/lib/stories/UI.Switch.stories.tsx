import { Meta, StoryObj } from '@storybook/react'

import { Switch } from '../ui/Switch'
import { UiCanvas } from './__mocks__/UiCanvas'

/** Переключатель на Base UI в теме грида (ADR 0017): включён, выключен, недоступен. */
const meta = {
  title: 'Tessera/UI/Switch',
  component: Switch,
  args: { 'aria-label': 'Dense rows', defaultChecked: false, disabled: false },
  render: args => (
    <UiCanvas>
      <Switch {...args} />
    </UiCanvas>
  ),
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const SwitchBasic: Story = { name: 'Basic' }

export const SwitchChecked: Story = {
  name: 'Checked',
  args: { defaultChecked: true },
}

export const SwitchDisabled: Story = {
  name: 'Disabled',
  args: { defaultChecked: true, disabled: true },
}

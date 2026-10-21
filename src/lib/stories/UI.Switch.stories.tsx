import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { Switch } from '../ui/Switch'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/** Переключатель на Base UI в теме грида (ADR 0017): включён, выключен, недоступен. */
const meta = {
  title: 'Tessera/UI/Switch',
  tags: ['done'],
  component: Switch,
  args: { 'aria-label': 'Dense rows', checked: false, disabled: false },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas>
        <Switch
          {...args}
          onCheckedChange={checked => updateArgs({ checked })}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const SwitchDefault: Story = {
  name: 'Default',
  parameters: defaultControls('checked', 'disabled'),
}

export const SwitchChecked: Story = {
  name: 'Checked',
  parameters: noControls(),
  args: { checked: true },
}

export const SwitchDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { checked: true, disabled: true },
}

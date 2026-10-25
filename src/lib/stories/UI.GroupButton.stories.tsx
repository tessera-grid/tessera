import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { GroupButton } from '../plugins/rowGrouping/GroupButton'
import {
  DERIVED_BUTTON_ARGS,
  DERIVED_BUTTON_ARG_TYPES,
  DERIVED_BUTTON_CONTROLS,
  DISABLED_ARGS,
} from './__mocks__/derivedButton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка группировки по колонке (ADR 0016, ADR 0128): скрыта до наведения на заголовок,
 * клик переключает «сгруппировано»; `revealOnHover`, ожидание, отказ и выключение — из
 * контролов.
 */
const meta = {
  title: 'Tessera/UI/GroupButton',
  component: GroupButton,
  argTypes: DERIVED_BUTTON_ARG_TYPES,
  args: { ...DERIVED_BUTTON_ARGS, grouped: false, revealOnHover: true },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas host="head" caption="City" width={200}>
        <GroupButton
          {...args}
          onClick={event => {
            args.onClick?.(event)
            updateArgs({ grouped: !args.grouped })
          }}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof GroupButton>

export default meta

type Story = StoryObj<typeof meta>

export const GroupButtonPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'grouped',
    'revealOnHover',
    ...DERIVED_BUTTON_CONTROLS,
  ),
}

export const GroupButtonGrouped: Story = {
  name: 'Grouped',
  parameters: noControls(),
  args: { grouped: true },
}

export const GroupButtonAlwaysVisible: Story = {
  name: 'Always visible',
  parameters: noControls(),
  args: { revealOnHover: false },
}

export const GroupButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const GroupButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { ...DISABLED_ARGS, revealOnHover: false },
}

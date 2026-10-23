import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { PinButton } from '../plugins/columnPinning/PinButton'
import {
  DERIVED_BUTTON_ARGS,
  DERIVED_BUTTON_ARG_TYPES,
  DERIVED_BUTTON_CONTROLS,
  DISABLED_ARGS,
} from './__mocks__/derivedButton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка закрепления колонки (ADR 0011, ADR 0128): скрыта до наведения на заголовок,
 * клик переключает «закреплена»; `revealOnHover`, ожидание, отказ и выключение — из
 * контролов.
 */
const meta = {
  title: 'Tessera/UI/PinButton',
  tags: ['done'],
  component: PinButton,
  argTypes: DERIVED_BUTTON_ARG_TYPES,
  args: { ...DERIVED_BUTTON_ARGS, pinned: false, revealOnHover: true },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas host="head" caption="Name" width={200}>
        <PinButton
          {...args}
          onClick={event => {
            args.onClick?.(event)
            updateArgs({ pinned: !args.pinned })
          }}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof PinButton>

export default meta

type Story = StoryObj<typeof meta>

export const PinButtonPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'pinned',
    'revealOnHover',
    ...DERIVED_BUTTON_CONTROLS,
  ),
}

export const PinButtonPinned: Story = {
  name: 'Pinned',
  parameters: noControls(),
  args: { pinned: true },
}

export const PinButtonAlwaysVisible: Story = {
  name: 'Always visible',
  parameters: noControls(),
  args: { revealOnHover: false },
}

export const PinButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const PinButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { ...DISABLED_ARGS, revealOnHover: false },
}

import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { ExpandButton } from '../plugins/rowExpanding/ExpandButton'
import {
  DERIVED_BUTTON_ARGS,
  DERIVED_BUTTON_ARG_TYPES,
  DERIVED_BUTTON_CONTROLS,
  DISABLED_ARGS,
} from './__mocks__/derivedButton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Тоггл раскрытия строки в ячейке (ADR 0015, ADR 0128): клик поворачивает шеврон;
 * ожидание, отказ и выключение — из контролов.
 */
const meta = {
  title: 'Tessera/UI/ExpandButton',
  tags: ['done'],
  component: ExpandButton,
  argTypes: DERIVED_BUTTON_ARG_TYPES,
  args: { ...DERIVED_BUTTON_ARGS, expanded: false },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas host="cell" column="Group" caption="Group A" width={200}>
        <ExpandButton
          {...args}
          onClick={event => {
            args.onClick?.(event)
            updateArgs({ expanded: !args.expanded })
          }}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof ExpandButton>

export default meta

type Story = StoryObj<typeof meta>

export const ExpandButtonPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('expanded', ...DERIVED_BUTTON_CONTROLS),
}

export const ExpandButtonExpanded: Story = {
  name: 'Expanded',
  parameters: noControls(),
  args: { expanded: true },
}

export const ExpandButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const ExpandButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { ...DISABLED_ARGS, expanded: false },
}

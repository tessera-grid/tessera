import { Toolbar } from '@base-ui/react/toolbar'
import { Meta, StoryObj } from '@storybook/react'

import { ToolbarButton } from '../ui/ToolbarButton'
import { useIcons } from '../ui/icons'
import {
  DERIVED_BUTTON_ARGS,
  DERIVED_BUTTON_ARG_TYPES,
  DERIVED_BUTTON_CONTROLS,
  ACTIVE_ARG_TYPES,
  DISABLED_ARGS,
} from './__mocks__/derivedButton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка верхнего тулбара (ADR 0035, ADR 0128): иконка с тултипом внутри `Toolbar.Root`;
 * включённая — бабл: точка или число `count` (ADR 0129); ожидание, отказ и выключение — из контролов.
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
  tags: ['done'],
  component: ToolbarButtonDemo,
  argTypes: { ...DERIVED_BUTTON_ARG_TYPES, ...ACTIVE_ARG_TYPES },
  args: { ...DERIVED_BUTTON_ARGS, label: 'Columns', active: false, count: 0 },
} satisfies Meta<typeof ToolbarButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const ToolbarButtonPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'label',
    'active',
    'count',
    ...DERIVED_BUTTON_CONTROLS,
  ),
}

export const ToolbarButtonActive: Story = {
  name: 'Active',
  parameters: noControls(),
  args: { active: true, count: 2, label: 'Columns, 2 hidden' },
}

export const ToolbarButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const ToolbarButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: DISABLED_ARGS,
}

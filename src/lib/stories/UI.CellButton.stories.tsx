import { Meta, StoryObj } from '@storybook/react'

import { CellButton } from '../grid/Actions/CellButton'
import { useIcons } from '../ui/icons'
import {
  DERIVED_BUTTON_ARGS,
  DERIVED_BUTTON_ARG_TYPES,
  DERIVED_BUTTON_CONTROLS,
  ACTIVE_ARGS,
  ACTIVE_ARG_TYPES,
  DISABLED_ARGS,
} from './__mocks__/derivedButton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка в ячейке для своих слотов (ADR 0128): скрыта до наведения на ячейку — наведите
 * на неё; `revealOnHover`, `active`, ожидание, отказ и выключение — из контролов.
 */
const CellButtonDemo = (
  props: Omit<Parameters<typeof CellButton>[0], 'icon'>,
) => {
  const { edit: Edit } = useIcons()
  return (
    <UiCanvas host="cell" column="Age" caption="42" width={200}>
      <CellButton {...props} icon={<Edit width={16} height={16} />} />
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/CellButton',
  tags: ['done'],
  component: CellButtonDemo,
  argTypes: { ...DERIVED_BUTTON_ARG_TYPES, ...ACTIVE_ARG_TYPES },
  args: {
    ...DERIVED_BUTTON_ARGS,
    label: 'Edit cell',
    revealOnHover: true,
    ...ACTIVE_ARGS,
  },
} satisfies Meta<typeof CellButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const CellButtonDefault: Story = {
  name: 'Default',
  parameters: defaultControls(
    'label',
    'revealOnHover',
    'active',
    'count',
    'indicator',
    ...DERIVED_BUTTON_CONTROLS,
  ),
}

// Включённое действие: цвет и точка, видна без наведения.
export const CellButtonActive: Story = {
  name: 'Active',
  parameters: noControls(),
  args: { active: true },
}

export const CellButtonAlwaysVisible: Story = {
  name: 'Always visible',
  parameters: noControls(),
  args: { revealOnHover: false },
}

export const CellButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const CellButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { ...DISABLED_ARGS, revealOnHover: false },
}

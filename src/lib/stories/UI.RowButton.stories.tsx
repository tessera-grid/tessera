import { Meta, StoryObj } from '@storybook/react'

import { RowButton } from '../grid/Actions/RowButton'
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
 * Кнопка действия строки — чип поверх контента (ADR 0017, ADR 0128): скрыта до
 * наведения на строку — наведите на неё; `revealOnHover`, `active`, ожидание, отказ и выключение
 * — из контролов.
 */
const RowButtonDemo = (
  props: Omit<Parameters<typeof RowButton>[0], 'icon'>,
) => {
  const { menu: Menu } = useIcons()
  return (
    <UiCanvas
      host="row"
      column="Name · City · Age"
      caption="Alice 0 · Berlin · 34"
      width={320}
    >
      <RowButton {...props} icon={<Menu width={16} height={16} />} />
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/RowButton',
  tags: ['done'],
  component: RowButtonDemo,
  argTypes: { ...DERIVED_BUTTON_ARG_TYPES, ...ACTIVE_ARG_TYPES },
  args: {
    ...DERIVED_BUTTON_ARGS,
    label: 'Row options',
    revealOnHover: true,
    ...ACTIVE_ARGS,
  },
} satisfies Meta<typeof RowButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const RowButtonPlayground: Story = {
  name: 'Playground',
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
export const RowButtonActive: Story = {
  name: 'Active',
  parameters: noControls(),
  args: { active: true },
}

export const RowButtonAlwaysVisible: Story = {
  name: 'Always visible',
  parameters: noControls(),
  args: { revealOnHover: false },
}

export const RowButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const RowButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { ...DISABLED_ARGS, revealOnHover: false },
}

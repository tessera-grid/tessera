import { Meta, StoryObj } from '@storybook/react'
import { fn } from 'storybook/test'

import { RowButton } from '../grid/Actions/RowButton'
import { useIcons } from '../ui/icons'
import { UiCanvas } from './__mocks__/UiCanvas'

/**
 * Кнопка действия строки — непрозрачный чип поверх контента (ADR 0017). Без
 * `isVisible` проявляется при наведении на строку — наведите на рамку.
 * Вид, размер и состояния — база `UI/IconButton`, вариант `overlay` (ADR 0098); здесь — только свои.
 */
const RowButtonDemo = (
  props: Omit<Parameters<typeof RowButton>[0], 'icon'>,
) => {
  const { menu: Menu } = useIcons()
  return (
    <UiCanvas host="row" caption="Alice 0 · Berlin · 34" width={320}>
      <RowButton {...props} icon={<Menu width={16} height={16} />} />
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/RowButton',
  component: RowButtonDemo,
  args: {
    title: 'Row options',
    isVisible: false,
    disabled: false,
    showTooltipWhenDisabled: false,
    onClick: fn(),
  },
} satisfies Meta<typeof RowButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const RowButtonBasic: Story = { name: 'Basic' }

export const RowButtonVisible: Story = {
  name: 'Always visible',
  args: { isVisible: true },
}

export const RowButtonDisabled: Story = {
  name: 'Disabled',
  args: { isVisible: true, disabled: true, showTooltipWhenDisabled: true },
}

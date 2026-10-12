import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { PinButton } from '../plugins/columnPinning/PinButton'
import { UiCanvas } from './__mocks__/UiCanvas'

/**
 * Кнопка закрепления колонки (ADR 0011): клик переключает «закреплена». В рамке
 * заголовка проявляется при наведении, включённая видна всегда.
 * Вид, размер и состояния — база `UI/IconButton` (ADR 0098); здесь — только свои.
 */
const meta = {
  title: 'Tessera/UI/PinButton',
  component: PinButton,
  args: { isPinned: false, disabled: false, onClick: () => {} },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas host="head" caption="Name" width={200}>
        <PinButton
          {...args}
          onClick={() => updateArgs({ isPinned: !args.isPinned })}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof PinButton>

export default meta

type Story = StoryObj<typeof meta>

export const PinButtonBasic: Story = { name: 'Basic' }

export const PinButtonPinned: Story = {
  name: 'Pinned',
  args: { isPinned: true },
}

export const PinButtonDisabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
}

import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { GroupButton } from '../plugins/rowGrouping/GroupButton'
import { UiCanvas } from './__mocks__/UiCanvas'

/**
 * Кнопка группировки по колонке (ADR 0016): клик переключает «сгруппировано». В
 * рамке заголовка проявляется при наведении, включённая видна всегда.
 * Вид, размер и состояния — база `UI/IconButton` (ADR 0098); здесь — только свои.
 */
const meta = {
  title: 'Tessera/UI/GroupButton',
  component: GroupButton,
  args: { isGrouped: false, disabled: false, onClick: () => {} },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas host="head" caption="City" width={200}>
        <GroupButton
          {...args}
          onClick={() => updateArgs({ isGrouped: !args.isGrouped })}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof GroupButton>

export default meta

type Story = StoryObj<typeof meta>

export const GroupButtonBasic: Story = { name: 'Basic' }

export const GroupButtonGrouped: Story = {
  name: 'Grouped',
  args: { isGrouped: true },
}

export const GroupButtonDisabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
}

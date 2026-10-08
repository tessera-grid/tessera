import type { SortDirection } from '@tanstack/react-table'
import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { SortButton } from '../plugins/columnSorting/SortButton'
import { UiCanvas } from './__mocks__/UiCanvas'

type Operation = SortDirection | false

const NEXT: Record<string, Operation> = {
  false: 'asc',
  asc: 'desc',
  desc: false,
}

/**
 * Кнопка сортировки колонки (ADR 0012): иконка направления, тултип следующего шага,
 * номер приоритета при мультисортировке (ADR 0062). Клик идёт по кругу
 * нет → по возрастанию → по убыванию. В рамке заголовка проявляется при наведении,
 * включённая видна всегда.
 */
const meta = {
  title: 'Tessera/UI/SortButton',
  component: SortButton,
  args: {
    operation: false,
    nextOperation: 'asc',
    disabled: false,
    onClick: () => {},
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas host="head" caption="Name" width={200}>
        <SortButton
          {...args}
          onClick={() => {
            const operation = args.nextOperation
            updateArgs({ operation, nextOperation: NEXT[String(operation)] })
          }}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof SortButton>

export default meta

type Story = StoryObj<typeof meta>

export const SortButtonBasic: Story = { name: 'Basic' }

export const SortButtonDescending: Story = {
  name: 'Descending',
  args: { operation: 'desc', nextOperation: false },
}

export const SortButtonPriority: Story = {
  name: 'Multi-sort priority',
  args: {
    operation: 'asc',
    nextOperation: 'desc',
    sortIndex: 1,
    sortCount: 3,
  },
}

export const SortButtonDisabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
}

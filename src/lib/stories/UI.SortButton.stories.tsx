import type { SortDirection } from '@tanstack/react-table'
import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { SortButton } from '../plugins/columnSorting/SortButton'
import {
  DERIVED_BUTTON_ARGS,
  DERIVED_BUTTON_ARG_TYPES,
  DERIVED_BUTTON_CONTROLS,
  DISABLED_ARGS,
} from './__mocks__/derivedButton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

type Operation = SortDirection | false

const NEXT: Record<string, Operation> = {
  false: 'asc',
  asc: 'desc',
  desc: false,
}

/**
 * Кнопка сортировки колонки (ADR 0012, ADR 0128): скрыта до наведения на заголовок, клик
 * идёт по кругу нет → по возрастанию → по убыванию; номер приоритета — «Multi-sort»;
 * `revealOnHover`, ожидание, отказ и выключение — из контролов.
 */
const meta = {
  title: 'Tessera/UI/SortButton',
  tags: ['done'],
  component: SortButton,
  argTypes: {
    ...DERIVED_BUTTON_ARG_TYPES,
    operation: {
      control: { type: 'inline-radio', labels: { false: 'none' } },
      options: [false, 'asc', 'desc'],
    },
  },
  args: {
    ...DERIVED_BUTTON_ARGS,
    operation: false,
    nextOperation: 'asc',
    revealOnHover: true,
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas host="head" caption="Name" width={200}>
        <SortButton
          {...args}
          nextOperation={NEXT[String(args.operation)]!}
          onClick={event => {
            args.onClick?.(event)
            updateArgs({ operation: NEXT[String(args.operation)] })
          }}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<typeof SortButton>

export default meta

type Story = StoryObj<typeof meta>

export const SortButtonDefault: Story = {
  name: 'Default',
  parameters: defaultControls(
    'operation',
    'sortIndex',
    'sortCount',
    'revealOnHover',
    ...DERIVED_BUTTON_CONTROLS,
  ),
}

export const SortButtonSorted: Story = {
  name: 'Sorted',
  parameters: noControls(),
  args: { operation: 'desc', nextOperation: false },
}

export const SortButtonPriority: Story = {
  name: 'Multi-sort priority',
  parameters: noControls(),
  args: {
    operation: 'asc',
    nextOperation: 'desc',
    sortIndex: 1,
    sortCount: 3,
  },
}

export const SortButtonAlwaysVisible: Story = {
  name: 'Always visible',
  parameters: noControls(),
  args: { revealOnHover: false },
}

export const SortButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const SortButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { ...DISABLED_ARGS, revealOnHover: false },
}

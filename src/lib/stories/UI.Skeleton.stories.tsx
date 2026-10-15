import { Meta, StoryObj } from '@storybook/react'

import { Skeleton } from '../ui/Skeleton'
import { UiCanvas } from './__mocks__/UiCanvas'

/**
 * Плейсхолдер загрузки (ADR 0017, ADR 0060): размеры — токены скелета по роли, волна —
 * бегущий блик. Контролы — ширина, высота и анимация.
 */
const meta = {
  title: 'Tessera/UI/Skeleton',
  component: Skeleton,
  args: {
    width: 160,
    height: 'var(--tsr-comp-skeleton-cell-height)',
    animation: 'wave',
  },
  argTypes: {
    width: { control: 'text' },
    height: { control: 'text' },
    animation: { control: 'inline-radio', options: ['wave', false] },
  },
  render: args => (
    <UiCanvas>
      <Skeleton {...args} />
    </UiCanvas>
  ),
} satisfies Meta<typeof Skeleton>

export default meta

type Story = StoryObj<typeof meta>

export const SkeletonBasic: Story = { name: 'Basic' }

export const SkeletonStatic: Story = {
  name: 'Static',
  args: { animation: false },
}

/** Роли скелетов грида: полоска ячейки, квадрат контрола, текст панели, строка меню. */
export const SkeletonRoles: Story = {
  name: 'Roles',
  render: args => (
    <UiCanvas>
      <div style={{ display: 'grid', gap: 12, width: 240 }}>
        <Skeleton {...args} width="70%" />
        <Skeleton
          {...args}
          width="var(--tsr-comp-skeleton-control-size)"
          height="var(--tsr-comp-skeleton-control-size)"
        />
        <Skeleton
          {...args}
          width={96}
          height="var(--tsr-comp-skeleton-text-height)"
        />
        <Skeleton
          {...args}
          width="100%"
          height="var(--tsr-comp-skeleton-menu-height)"
        />
      </div>
    </UiCanvas>
  ),
}

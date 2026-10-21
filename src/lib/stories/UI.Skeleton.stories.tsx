import { Meta, StoryObj } from '@storybook/react'

import { Skeleton } from '../ui/Skeleton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Плейсхолдер загрузки (ADR 0017, ADR 0060): размеры — токены скелета по роли, волна —
 * бегущий блик; без волны (`animation: false`) — скелет быстрой прокрутки и хвоста ленты.
 * Контролы — ширина, высота и анимация.
 */
const meta = {
  title: 'Tessera/UI/Skeleton',
  tags: ['done'],
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

export const SkeletonDefault: Story = {
  name: 'Default',
  parameters: defaultControls('width', 'height', 'animation'),
}

/** Роли скелетов грида: полоска ячейки, квадрат контрола, текст панели, строка меню. */
export const SkeletonRoles: Story = {
  name: 'Roles',
  parameters: noControls(),
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

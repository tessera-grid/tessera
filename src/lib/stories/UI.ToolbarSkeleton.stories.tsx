import type { ReactNode } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { ToolbarSkeleton } from '../ui/ToolbarButton/ToolbarSkeleton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Скелет контрола тулбара до прихода данных или колонок (ADR 0122): место — как у контрола; у
 * кнопки виден квадрат иконки, у поля поиска — поле целиком. Вид контрола — в панели.
 */
interface ToolbarSkeletonStoryArgs {
  kind: 'button' | 'field'
}

/** Тулбар грида: высота и поля — его токены. */
const Toolbar = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--tsr-comp-toolbar-gap)',
      boxSizing: 'border-box',
      width: 480,
      height: 'var(--tsr-comp-toolbar-height)',
      padding: '0 var(--tsr-comp-toolbar-padding-x)',
      background: 'var(--tsr-comp-toolbar-bg)',
      border:
        'var(--tsr-comp-frame-border-width) solid var(--tsr-comp-frame-border-color)',
      borderRadius: 'var(--tsr-comp-frame-radius)',
    }}
  >
    {children}
  </div>
)

const meta = {
  title: 'Tessera/UI/ToolbarSkeleton',
  args: { kind: 'button' },
  argTypes: {
    kind: {
      control: 'inline-radio',
      options: ['button', 'field'],
      description: 'Skeleton of a button or the search field',
    },
  },
  render: ({ kind }) => (
    <UiCanvas>
      <Toolbar>
        <ToolbarSkeleton kind={kind} />
      </Toolbar>
    </UiCanvas>
  ),
} satisfies Meta<ToolbarSkeletonStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const ToolbarSkeletonPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('kind'),
}

/** Тулбар до прихода данных: поле поиска и три кнопки. */
export const ToolbarSkeletonToolbar: Story = {
  name: 'Toolbar before data',
  parameters: noControls(),
  render: () => (
    <UiCanvas>
      <Toolbar>
        <ToolbarSkeleton kind="field" />
        <span style={{ flex: 1 }} />
        <ToolbarSkeleton />
        <ToolbarSkeleton />
        <ToolbarSkeleton />
      </Toolbar>
    </UiCanvas>
  ),
}

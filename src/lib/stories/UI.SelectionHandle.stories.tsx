import { Meta, StoryObj } from '@storybook/react'

import { SelectionHandle } from '../ui/SelectionHandle'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Маркер угла выделения (ADR 0198): метка в центре зоны нажатия 24×24, центр — в углу
 * выделенного диапазона. Квадрат — для мыши, круг — для пальца; вид — в панели.
 */
interface SelectionHandleStoryArgs {
  shape: 'square' | 'circle'
}

/** Выделенный диапазон: заливка и кромка выделения на токенах темы. */
const RANGE = { width: 160, height: 72 }

const meta = {
  title: 'Tessera/UI/SelectionHandle',
  args: { shape: 'square' },
  argTypes: {
    shape: {
      control: 'inline-radio',
      options: ['square', 'circle'],
      description: 'Квадрат — маркер мыши, круг — маркер пальца',
    },
  },
  render: ({ shape }) => (
    <UiCanvas>
      <div style={{ position: 'relative', padding: 24 }}>
        <div
          style={{
            ...RANGE,
            boxSizing: 'border-box',
            background: 'var(--tsr-comp-cell-selected-bg)',
            border: '1px solid var(--tsr-comp-cell-selected-border-color)',
          }}
        />
        <SelectionHandle
          shape={shape}
          style={{ left: 24 + RANGE.width, top: 24 + RANGE.height }}
        />
      </div>
    </UiCanvas>
  ),
} satisfies Meta<SelectionHandleStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const SelectionHandlePlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('shape'),
}

/** Маркер пальца: круг в углу диапазона. */
export const SelectionHandleCircle: Story = {
  name: 'Circle',
  parameters: noControls(),
  args: { shape: 'circle' },
}

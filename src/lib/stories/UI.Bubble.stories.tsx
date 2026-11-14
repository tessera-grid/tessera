import { Meta, StoryObj } from '@storybook/react'

import { Bubble } from '../ui/Bubble'
import { UiCanvas } from './__mocks__/UiCanvas'
import { VariantGrid } from './__mocks__/VariantGrid'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Бабл (ADR 0062, ADR 0129): точка или счётчик тоном состояния. Один на всю таблицу — у кнопок
 * с включённым состоянием, в журнале и пульте, у призрака перетаскиваемой строки с ветками.
 * Размер, тон и число — в панели.
 */
interface BubbleStoryArgs {
  size: 'sm' | 'dot'
  tone: 'accent' | 'active' | 'draft' | 'error'
  value: number
}

const TONES = ['accent', 'active', 'draft', 'error'] as const

const meta = {
  title: 'Tessera/UI/Bubble',
  args: { size: 'sm', tone: 'accent', value: 3 },
  argTypes: {
    size: {
      control: 'inline-radio',
      options: ['sm', 'dot'],
      description: 'Counter or dot',
    },
    tone: {
      control: 'inline-radio',
      options: TONES,
      description: 'State tone',
    },
    value: {
      control: { type: 'number', min: 0, max: 999 },
      description: 'Counter value',
    },
  },
  render: ({ size, tone, value }) => (
    <UiCanvas>
      <Bubble size={size} tone={tone}>
        {size === 'sm' ? value : undefined}
      </Bubble>
    </UiCanvas>
  ),
} satisfies Meta<BubbleStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const BubblePlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('size', 'tone', 'value'),
}

/** Каждый тон точкой, коротким и длинным числом. */
export const BubbleTones: Story = {
  name: 'Tones',
  parameters: noControls(),
  render: () => (
    <UiCanvas>
      <VariantGrid
        columns={['Dot', 'Short count', 'Long count']}
        rows={TONES.map(tone => ({
          label: tone,
          cells: [
            <Bubble key="dot" size="dot" tone={tone} />,
            <Bubble key="few" tone={tone}>
              3
            </Bubble>,
            <Bubble key="many" tone={tone}>
              128
            </Bubble>,
          ],
        }))}
      />
    </UiCanvas>
  ),
}

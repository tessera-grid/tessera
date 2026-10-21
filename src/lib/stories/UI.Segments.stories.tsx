import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { Segments } from '../ui/Segments'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Сегменты (ADR 0074): выбор одного из немногих коротких вариантов. Стрелки переводят
 * выбор, недоступный сегмент пропускается; длинная подпись обрезается с многоточием.
 */
const meta = {
  title: 'Tessera/UI/Segments',
  tags: ['done'],
  component: Segments,
  args: {
    value: 'csv',
    options: [
      { value: 'csv', label: 'CSV' },
      { value: 'xlsx', label: 'Excel' },
    ],
    disabled: false,
    'aria-label': 'Format',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <UiCanvas>
        <div style={{ width: 240 }}>
          <Segments {...args} onValueChange={value => updateArgs({ value })} />
        </div>
      </UiCanvas>
    )
  },
} satisfies Meta<typeof Segments>

export default meta

type Story = StoryObj<typeof meta>

export const SegmentsDefault: Story = {
  name: 'Default',
  parameters: defaultControls('options', 'disabled'),
}

export const SegmentsThree: Story = {
  name: 'With disabled option',
  parameters: noControls(),
  args: {
    options: [
      { value: 'csv', label: 'CSV' },
      { value: 'json', label: 'JSON', disabled: true },
      { value: 'xlsx', label: 'Excel' },
    ],
  },
}

export const SegmentsLongLabel: Story = {
  name: 'Long label',
  parameters: noControls(),
  args: {
    options: [
      { value: 'csv', label: 'CSV' },
      { value: 'xlsx', label: 'Excel workbook with typed cells' },
    ],
  },
}

export const SegmentsDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { disabled: true },
}

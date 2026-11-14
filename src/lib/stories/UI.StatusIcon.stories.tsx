import { Meta, StoryObj } from '@storybook/react'
import { CircleAlert, Info } from 'lucide-react'

import { StatusIcon } from '../ui/StatusIcon/StatusIcon'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Значок состояния кита (ADR 0183, PK16): фокусируемый значок, причина — его имя и тултип.
 * Причина и тон — в панели.
 */
interface StatusIconStoryArgs {
  reason: string
  tone: 'error' | 'neutral'
}

const meta = {
  title: 'Tessera/UI/StatusIcon',
  args: { reason: 'The server refused the filter: timeout', tone: 'error' },
  argTypes: {
    reason: {
      control: 'text',
      description: 'Reason: accessible name and tooltip',
    },
    tone: {
      control: 'inline-radio',
      options: ['error', 'neutral'],
      description: 'Icon tone',
    },
  },
  render: ({ reason, tone }) => (
    <UiCanvas>
      <StatusIcon
        reason={reason}
        tone={tone}
        icon={
          tone === 'error' ? (
            <CircleAlert width={16} height={16} aria-hidden />
          ) : (
            <Info width={16} height={16} aria-hidden />
          )
        }
      />
    </UiCanvas>
  ),
} satisfies Meta<StatusIconStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const StatusIconPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('reason', 'tone'),
}

export const StatusIconNeutral: Story = {
  name: 'Neutral',
  parameters: noControls(),
  args: { reason: 'Applies to the visible columns', tone: 'neutral' },
}

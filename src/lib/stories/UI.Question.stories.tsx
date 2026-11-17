import { Meta, StoryObj } from '@storybook/react'

import { Question } from '../ui/Question'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Вопрос перед действием (ADR 0223, LM2; ADR 0227, §6): плашка с текстом вопроса, галочкой и
 * крестиком. Опасная кнопка — та, чьё действие теряет данные. Текст и тон — в панели.
 */
interface QuestionStoryArgs {
  title: string
  confirmLabel: string
  declineLabel: string
  danger: 'confirm' | 'decline'
}

const meta = {
  title: 'Tessera/UI/Question',
  args: {
    title: 'Discard 12 changes?',
    confirmLabel: 'Discard',
    declineLabel: 'Keep changes',
    danger: 'confirm',
  },
  argTypes: {
    title: { control: 'text', description: 'Question text' },
    confirmLabel: {
      control: 'text',
      description: 'Check mark button: accessible name and tooltip',
    },
    declineLabel: {
      control: 'text',
      description: 'Cross button: accessible name and tooltip',
    },
    danger: {
      control: 'inline-radio',
      options: ['confirm', 'decline'],
      description: 'Which answer loses data: it gets the danger tone',
    },
  },
  render: args => (
    <UiCanvas>
      <Question {...args} onConfirm={() => {}} onDecline={() => {}} />
    </UiCanvas>
  ),
} satisfies Meta<QuestionStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const QuestionPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'title',
    'confirmLabel',
    'declineLabel',
    'danger',
  ),
}

/** Отказ теряет вставляемое: крестик — в тоне опасного действия. */
export const QuestionDeclineLoses: Story = {
  name: 'Decline loses data',
  parameters: noControls(),
  args: {
    title: 'Change 3 cells?',
    confirmLabel: 'Change',
    declineLabel: 'Cancel',
    danger: 'decline',
  },
}

import { Meta, StoryObj } from '@storybook/react'
import { CircleAlert, RotateCw } from 'lucide-react'

import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Плашка (ADR 0096, §9): иконка, заголовок, описание одной строкой, действие и закрытие.
 * В гриде — отказ обновления данных под шапкой; длинное описание обрезается многоточием
 * и показывается в тултипе. Аргументы `shown`, `action`, `dismissible` — в панели.
 */
interface AlertStoryArgs {
  shown: boolean
  title: string
  description?: string
  action: boolean
  dismissible: boolean
}

const meta = {
  title: 'Tessera/UI/Alert',
  args: {
    shown: true,
    title: "Couldn't refresh the data",
    description: 'Server responded 503',
    action: true,
    dismissible: true,
  },
  argTypes: {
    shown: { control: 'boolean' },
    title: { control: 'text' },
    description: { control: 'text' },
    action: { control: 'boolean', description: 'Кнопка «Retry»' },
    dismissible: { control: 'boolean', description: 'Кнопка закрытия' },
  },
  parameters: { requirements: ['LE19'] },
  render: ({ shown, title, description, action, dismissible }) => (
    <UiCanvas width={420}>
      <Alert
        shown={shown}
        icon={<CircleAlert width={16} height={16} />}
        title={title}
        description={description || undefined}
        action={
          action ? (
            <Button icon={<RotateCw width={16} height={16} />}>Retry</Button>
          ) : undefined
        }
        dismiss={
          dismissible ? { label: 'Dismiss', onClick: () => {} } : undefined
        }
      />
    </UiCanvas>
  ),
} satisfies Meta<AlertStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const AlertPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'shown',
    'title',
    'description',
    'action',
    'dismissible',
  ),
}

export const AlertTitleOnly: Story = {
  name: 'Title only',
  parameters: noControls(),
  args: { description: '', action: false, dismissible: false },
}

export const AlertLongDescription: Story = {
  name: 'Long description',
  parameters: noControls(),
  args: {
    description: `Gateway timeout ${'while aggregating orders '.repeat(6)}`,
  },
}

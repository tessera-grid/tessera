import { Meta, StoryObj } from '@storybook/react'
import { CircleAlert, RotateCw } from 'lucide-react'

import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Плашка (ADR 0096, §9): иконка, заголовок, описание одной строкой, действие и закрытие.
 * В гриде — отказ обновления данных под шапкой; длинное описание обрезается многоточием
 * и показывается в тултипе. Иконка, описание, действие и закрытие — в панели.
 */
interface AlertStoryArgs {
  shown: boolean
  icon: boolean
  /** Пусто — заголовок отказа обновления из словаря таблицы. */
  title?: string
  description?: string
  action: boolean
  dismissible: boolean
}

const StoryAlert = ({
  shown,
  icon,
  title,
  description,
  action,
  dismissible,
}: AlertStoryArgs) => {
  const labels = useStoryLabels()
  return (
    <Alert
      shown={shown}
      icon={icon ? <CircleAlert width={16} height={16} /> : undefined}
      title={title || labels.loadErrorTitle}
      description={description || undefined}
      action={
        action ? (
          <Button icon={<RotateCw width={16} height={16} />}>
            {labels.loadRetry}
          </Button>
        ) : undefined
      }
      dismiss={
        dismissible
          ? { label: labels.loadErrorDismiss, onClick: () => {} }
          : undefined
      }
    />
  )
}

const meta = {
  title: 'Tessera/UI/Alert',
  args: {
    shown: true,
    icon: true,
    description: 'Server responded 503',
    action: true,
    dismissible: true,
  },
  argTypes: {
    shown: { control: 'boolean' },
    icon: { control: 'boolean', description: 'Icon on the left' },
    title: { control: 'text' },
    description: { control: 'text' },
    action: { control: 'boolean', description: 'Retry button' },
    dismissible: { control: 'boolean', description: 'Close button' },
  },
  parameters: { requirements: ['LE19'] },
  render: args => (
    <UiCanvas width={420}>
      <StoryAlert {...args} />
    </UiCanvas>
  ),
} satisfies Meta<AlertStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const AlertPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'shown',
    'icon',
    'title',
    'description',
    'action',
    'dismissible',
  ),
}

/** Каждое сочетание частей плашки — одна под другой. */
const VARIANTS: [string, Partial<AlertStoryArgs>][] = [
  ['All parts', {}],
  ['Without icon', { icon: false }],
  ['Without description', { description: '' }],
  ['Action only', { dismissible: false }],
  ['Dismiss only', { action: false }],
  ['No buttons', { action: false, dismissible: false }],
  [
    'Title only',
    { icon: false, description: '', action: false, dismissible: false },
  ],
]

export const AlertVariants: Story = {
  name: 'Variants',
  parameters: noControls(),
  render: args => (
    <UiCanvas width={420}>
      <div style={{ display: 'grid', gap: 12 }}>
        {VARIANTS.map(([label, change]) => (
          <StoryAlert key={label} {...args} title={label} {...change} />
        ))}
      </div>
    </UiCanvas>
  ),
}

export const AlertLongDescription: Story = {
  name: 'Long description',
  parameters: noControls(),
  args: {
    description: `Gateway timeout ${'while aggregating orders '.repeat(6)}`,
  },
}

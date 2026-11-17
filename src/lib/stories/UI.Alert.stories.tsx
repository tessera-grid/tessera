import { useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'
import { CircleAlert, RotateCw } from 'lucide-react'

import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels, useStoryText } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Плашка (ADR 0096, §9): иконка, заголовок, описание одной строкой, действие и закрытие.
 * В гриде — отказ обновления данных под шапкой; длинное описание обрезается многоточием
 * и показывается в тултипе. Иконка, описание, действие и закрытие — в панели; тоны успеха и
 * нейтральный и самостоятельный уход (ADR 0227) — `tone` и `hideAfter`.
 */
interface AlertStoryArgs {
  shown: boolean
  icon: boolean
  /** Пусто — заголовок отказа обновления из словаря таблицы. */
  title?: string
  description?: string
  action: boolean
  dismissible: boolean
  tone?: 'success' | 'neutral'
  /** Пусто — плашка не уходит сама. */
  hideAfter?: number
}

const SAVED = { ru: 'Сохранено 3 изменения', en: 'Saved 3 changes' }
const PARTLY = { ru: 'Сохранено 2 из 3', en: 'Saved 2 of 3' }
const SHOW_AGAIN = { ru: 'Показать снова', en: 'Show again' }

const StoryAlert = ({
  shown,
  icon,
  title,
  description,
  action,
  dismissible,
  tone,
  hideAfter,
  onHide,
}: AlertStoryArgs & { onHide?: () => void }) => {
  const labels = useStoryLabels()
  return (
    <Alert
      shown={shown}
      tone={tone}
      hideAfter={hideAfter}
      onHide={onHide}
      icon={icon && !tone ? <CircleAlert width={16} height={16} /> : undefined}
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
    tone: {
      control: 'inline-radio',
      options: ['none', 'success', 'neutral'],
      mapping: { none: undefined },
      description:
        'Tone: success or neutral — its own icon in the tone color; none — the error color',
    },
    hideAfter: {
      control: 'number',
      description:
        'Milliseconds until the alert hides by itself; empty — stays',
    },
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
    'tone',
    'hideAfter',
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

const SuccessAlert = (args: AlertStoryArgs) => {
  const text = useStoryText()
  return <StoryAlert {...args} title={text(SAVED)} />
}

export const AlertSuccess: Story = {
  name: 'Success tone',
  parameters: noControls(),
  args: { tone: 'success', description: '', action: false },
  render: args => (
    <UiCanvas width={420}>
      <SuccessAlert {...args} />
    </UiCanvas>
  ),
}

/** Итог без провала, но и не полный успех: сохранена часть правок. */
const NeutralAlert = (args: AlertStoryArgs) => {
  const text = useStoryText()
  return <StoryAlert {...args} title={text(PARTLY)} />
}

export const AlertNeutral: Story = {
  name: 'Neutral tone',
  parameters: noControls(),
  args: { tone: 'neutral', description: '' },
  render: args => (
    <UiCanvas width={420}>
      <NeutralAlert {...args} />
    </UiCanvas>
  ),
}

/** Плашка уходит сама через 3 с; под указателем и с фокусом внутри — ждёт. */
const SelfHidingAlert = (args: AlertStoryArgs) => {
  const text = useStoryText()
  const [shown, setShown] = useState(true)
  return (
    <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
      <Button disabled={shown} onClick={() => setShown(true)}>
        {text(SHOW_AGAIN)}
      </Button>
      <StoryAlert
        {...args}
        shown={shown}
        title={text(SAVED)}
        onHide={() => setShown(false)}
      />
    </div>
  )
}

export const AlertHidesByItself: Story = {
  name: 'Hides by itself',
  parameters: {
    ...noControls(),
    chromatic: { disableSnapshot: true },
    vrSkipReason:
      'the alert leaves by itself after three seconds: a snapshot catches it shown or gone',
  },
  args: { tone: 'success', description: '', action: false, hideAfter: 3000 },
  render: args => (
    <UiCanvas width={420}>
      <SelfHidingAlert {...args} />
    </UiCanvas>
  ),
}

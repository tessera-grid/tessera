import { Meta, StoryObj } from '@storybook/react'

import { Button } from '../ui/Button'
import { EmptyStateIllustration } from '../ui/icons/EmptyStateIllustration'
import { Stub } from '../ui/Stub'
import { UiCanvas } from './__mocks__/UiCanvas'

/**
 * Заглушка (ADR 0123, ES11): иллюстрация, заголовок, описание и действие по центру. В
 * гриде ею рисуются заглушки пустой таблицы; приложение собирает ею свои для `stubs`.
 * Аргументы `illustration`, `description`, `action` — в панели.
 */
interface StubStoryArgs {
  title: string
  description?: string
  illustration: boolean
  action: boolean
}

const meta = {
  title: 'Tessera/UI/Stub',
  args: {
    title: 'No data',
    description: '',
    illustration: true,
    action: false,
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    illustration: { control: 'boolean', description: 'Иллюстрация' },
    action: { control: 'boolean', description: 'Кнопка действия' },
  },
  render: ({ title, description, illustration, action }) => (
    <UiCanvas width={420}>
      <Stub
        media={
          illustration ? (
            <EmptyStateIllustration width={160} height={160} />
          ) : undefined
        }
        title={title}
        description={description || undefined}
        action={action ? <Button>Show all</Button> : undefined}
      />
    </UiCanvas>
  ),
} satisfies Meta<StubStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const StubBasic: Story = { name: 'Illustration and title' }

export const StubWithAction: Story = {
  name: 'With action',
  args: { title: 'All columns are hidden', action: true },
}

export const StubLongDescription: Story = {
  name: 'Long description',
  args: {
    title: "Couldn't load the data",
    illustration: false,
    description: `Gateway timeout ${'while aggregating orders '.repeat(6)}`,
  },
}

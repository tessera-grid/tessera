import { Meta, StoryObj } from '@storybook/react'

import { Button } from '../ui/Button'
import { EmptyStateIllustration } from '../ui/icons/EmptyStateIllustration'
import { Stub } from '../ui/Stub'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Заглушка (ADR 0123, ES11) в пустом теле грида под шапкой: иллюстрация, заголовок, описание
 * и действие по центру; приложение собирает ею свои для `stubs`. Аргументы `illustration`,
 * `description`, `action` — в панели.
 */
interface StubStoryArgs {
  title: string
  description?: string
  illustration: boolean
  action: boolean
}

const meta = {
  title: 'Tessera/UI/Stub',
  tags: ['done'],
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
    <UiCanvas host="body" column="Name · City · Age" width={480}>
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

export const StubPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('title', 'description', 'illustration', 'action'),
}

export const StubWithAction: Story = {
  name: 'With action',
  parameters: noControls(),
  args: { title: 'All columns are hidden', action: true },
}

export const StubLongDescription: Story = {
  name: 'Long description',
  parameters: noControls(),
  args: {
    title: "Couldn't load the data",
    description: `Gateway timeout ${'while aggregating orders '.repeat(6)}`,
  },
}

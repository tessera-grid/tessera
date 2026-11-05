import { Meta, StoryObj } from '@storybook/react'

import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'
import { Button } from '../ui/Button'
import { EmptyStateIllustration } from '../ui/icons/EmptyStateIllustration'
import { Stub } from '../ui/Stub'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Заглушка (ADR 0123, ES11) в пустом теле грида под шапкой: иллюстрация, заголовок, описание
 * и действие по центру; приложение собирает ею свои для `stubs`. Аргументы `illustration`,
 * `description`, `action` — в панели.
 */
interface StubStoryArgs {
  /** Пусто — заголовок из словаря таблицы по `stub`. */
  title?: string
  /** Заголовок из словаря: нет данных, все колонки скрыты или отказ загрузки. */
  stub?: 'noData' | 'hidden' | 'loadFailed'
  description?: string
  illustration: boolean
  action: boolean
}

const meta = {
  title: 'Tessera/UI/Stub',
  args: {
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
  render: function Render({
    title,
    stub = 'noData',
    description,
    illustration,
    action,
  }) {
    const labels = useStoryLabels()
    const visibility = columnVisibilityLabels(labels)
    const titles = {
      noData: labels.noData,
      hidden: visibility.columnsHiddenTitle,
      loadFailed: labels.loadFailedTitle,
    }
    return (
      <UiCanvas host="body" column="Name · City · Age" width={480}>
        <Stub
          media={
            illustration ? (
              <EmptyStateIllustration width={160} height={160} />
            ) : undefined
          }
          title={title || titles[stub]}
          description={description || undefined}
          action={
            action ? <Button>{visibility.showAllColumns}</Button> : undefined
          }
        />
      </UiCanvas>
    )
  },
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
  args: { stub: 'hidden', action: true },
}

export const StubLongDescription: Story = {
  name: 'Long description',
  parameters: noControls(),
  args: {
    stub: 'loadFailed',
    description: `Gateway timeout ${'while aggregating orders '.repeat(6)}`,
  },
}

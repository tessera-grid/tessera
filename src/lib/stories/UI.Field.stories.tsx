import { useId } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { columnFilteringLabels } from '../plugins/columnFiltering/labels'
import { Field, FieldError } from '../ui/Field/Field'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Поле ввода кита (ADR 0183, PK5): рамка, кольцо фокуса, ошибка с текстом под полем. Значение,
 * подсказка и ошибка — в панели.
 */
interface FieldStoryArgs {
  value: string
  /** Не задана — «Значение» из словаря таблицы. */
  placeholder?: string
  error: string
  disabled: boolean
}

const FieldStory = ({
  value,
  placeholder,
  error,
  disabled,
}: FieldStoryArgs) => {
  const errorId = useId()
  const valueLabel = columnFilteringLabels(useStoryLabels()).filterValue
  return (
    <UiCanvas>
      <div style={{ display: 'grid', gap: 4, width: 240 }}>
        <Field
          aria-label={valueLabel}
          defaultValue={value}
          placeholder={placeholder ?? valueLabel}
          disabled={disabled}
          invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Field',
  args: { value: '', error: '', disabled: false },
  argTypes: {
    value: { control: 'text', description: 'Значение' },
    placeholder: {
      control: 'text',
      description: 'Подсказка в пустом поле; не задана — «Значение» из словаря',
    },
    error: { control: 'text', description: 'Текст ошибки; пусто — без ошибки' },
    disabled: { control: 'boolean', description: 'Выключено' },
  },
  render: args => <FieldStory {...args} />,
} satisfies Meta<FieldStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const FieldPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('value', 'placeholder', 'error', 'disabled'),
}

export const FieldInvalid: Story = {
  name: 'Invalid',
  parameters: noControls(),
  args: { value: '12,5x' },
  render: function Render(args) {
    const error = cellEditingLabels(useStoryLabels()).editInvalidNumber
    return <FieldStory {...args} error={error} />
  },
}

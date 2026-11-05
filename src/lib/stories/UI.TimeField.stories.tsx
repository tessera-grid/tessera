import { useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { TimeField } from '../ui/Calendar/TimeField'
import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { calendarLabels } from '../shared/calendar/labels'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryGridLocale, useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Поле времени кита (ADR 0183, PK20): часы и минуты сегментами — стрелки меняют сегмент, цифры
 * вводятся с клавиатуры, Backspace очищает; кнопка часов открывает список. Формат 12 или 24 часа
 * — из языка. Значение, язык и шаг минут — в панели.
 */
interface TimeFieldStoryArgs {
  value: string
  /** Пусто — язык таблицы из тулбара. */
  language?: 'en-US' | 'ru' | 'de'
  step: number
}

const TimeFieldStory = ({ value, language, step }: TimeFieldStoryArgs) => {
  const [time, setTime] = useState(value)
  const labels = useStoryLabels()
  const calendar = calendarLabels(labels)
  const gridLocale = useStoryGridLocale()
  return (
    <UiCanvas>
      <div style={{ width: 240 }}>
        <TimeField
          label={cellEditingLabels(labels).time}
          labels={{
            hours: calendar.timeHours,
            minutes: calendar.timeMinutes,
            dayPeriod: calendar.timeDayPeriod,
            chooseTime: calendar.chooseTime,
          }}
          locale={language ?? gridLocale}
          step={step}
          value={time}
          onChange={setTime}
          testId="story-time"
        />
      </div>
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/TimeField',
  args: { value: '09:30', step: 1 },
  argTypes: {
    value: {
      control: 'text',
      description: 'Время HH:mm; пусто — без значения',
    },
    language: {
      control: 'inline-radio',
      options: ['en-US', 'ru', 'de'],
      description: 'Язык формата: 12 или 24 часа; пусто — язык таблицы',
    },
    step: {
      control: { type: 'number', min: 1, max: 30 },
      description: 'Шаг минут у стрелок и в списке',
    },
  },
  render: args => (
    <TimeFieldStory key={`${args.value}-${args.language}`} {...args} />
  ),
} satisfies Meta<TimeFieldStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const TimeFieldPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('value', 'language', 'step'),
}

/** 24 часа — по языку таблицы. */
export const TimeField24: Story = {
  name: '24-hour',
  parameters: noControls(),
  args: { value: '18:45', language: 'ru' },
}

/** Пустое поле: сегменты-подсказки. */
export const TimeFieldEmpty: Story = {
  name: 'Empty',
  parameters: noControls(),
  args: { value: '' },
}

/** Шаг 15 минут: стрелки и список идут по четверти часа. */
export const TimeFieldStep: Story = {
  name: 'Step 15 minutes',
  parameters: noControls(),
  args: { value: '10:15', step: 15 },
}

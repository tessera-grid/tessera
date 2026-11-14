import { useState } from 'react'

import { Popover } from '@base-ui/react/popover'
import { Meta, StoryObj } from '@storybook/react'

import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { calendarLabels } from '../shared/calendar/labels'
import { Button } from '../ui/Button'
import { Calendar, TimeField } from '../ui/Calendar/Calendar'
import { PopupFooter } from '../ui/Popup/PopupPanel'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import {
  useStoryDateLocale,
  useStoryGridLocale,
  useStoryLabels,
} from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Календарь кита (ADR 0183, PK7) — в поповере, как в таблице: под ячейкой даты в правке и в
 * панели фильтра дат. День или диапазон, месяц и год списками, поле времени и «Очистить
 * значение» внизу. Режим и поле времени — в панели.
 */
interface CalendarStoryArgs {
  mode: 'single' | 'range'
  time: boolean
}

const CalendarStory = ({ mode, time }: CalendarStoryArgs) => {
  const [day, setDay] = useState<string | null>('2026-03-12')
  const [range, setRange] = useState<[string | null, string | null]>([
    '2026-03-09',
    '2026-03-17',
  ])
  const [clock, setClock] = useState('09:30')
  const labels = useStoryLabels()
  const calendar = calendarLabels(labels)
  const editing = cellEditingLabels(labels)
  const dateLocale = useStoryDateLocale()
  const gridLocale = useStoryGridLocale()
  const LABELS = {
    previousMonth: calendar.previousMonth,
    nextMonth: calendar.nextMonth,
  }
  const TIME_LABELS = {
    hours: calendar.timeHours,
    minutes: calendar.timeMinutes,
    dayPeriod: calendar.timeDayPeriod,
    chooseTime: calendar.chooseTime,
  }
  return (
    <PopupCanvas height={440}>
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="start" />}
          popup={
            <Popover.Popup
              aria-label="Date"
              initialFocus={false}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--tsr-comp-popup-padding)',
              }}
            />
          }
        >
          {mode === 'range' ? (
            <Calendar
              labels={LABELS}
              mode="range"
              locale={dateLocale}
              from={range[0]}
              to={range[1]}
              onRange={(from, to) => setRange([from, to])}
              testId="story-calendar"
            />
          ) : (
            <Calendar
              labels={LABELS}
              mode="single"
              locale={dateLocale}
              day={day}
              onDay={setDay}
              testId="story-calendar"
            />
          )}
          {time && (
            <TimeField
              label={editing.time}
              labels={TIME_LABELS}
              locale={gridLocale}
              value={clock}
              onChange={setClock}
              testId="story-time"
            />
          )}
          {/* Как у редактора даты: зазор поповера и это поле — двойное поле до кнопки. */}
          <PopupFooter
            style={{ paddingBlockStart: 'var(--tsr-comp-popup-padding)' }}
          >
            <Button variant="ghost" onClick={() => setDay(null)}>
              {editing.editClear}
            </Button>
          </PopupFooter>
        </PopupSurface>
      </Popover.Portal>
    </PopupCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Calendar',
  args: { mode: 'single', time: false },
  argTypes: {
    mode: {
      control: 'inline-radio',
      options: ['single', 'range'],
      description: 'A day or a range',
    },
    time: { control: 'boolean', description: 'Time field' },
  },
  render: args => <CalendarStory {...args} />,
} satisfies Meta<CalendarStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const CalendarPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('mode', 'time'),
}

export const CalendarRange: Story = {
  name: 'Range with time',
  parameters: noControls(),
  args: { mode: 'range', time: true },
}

/** Подписи `calendar` (ADR 0182, §8): ключи словаря таблицы `calendar.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface CalendarLabels {
  /** Date filter (ADR 0047): conditions, presets, time field, month paging */
  previousMonth: string
  nextMonth: string
  /** Time field (ADR 0183, PK20): hour, minute and AM/PM segments, the list button */
  timeHours: string
  timeMinutes: string
  timeDayPeriod: string
  chooseTime: string
}

export const calendarLabels = defineLabels<CalendarLabels>()(
  'calendar',
  {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    timeHours: 'Hours',
    timeMinutes: 'Minutes',
    timeDayPeriod: 'AM or PM',
    chooseTime: 'Choose time',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    calendar: typeof calendarLabels
  }
}

/** Подписи поля времени кита (ADR 0183, PK20) из словаря таблицы. */
export const timeFieldLabels = (
  labels: Parameters<typeof calendarLabels>[0],
) => {
  const own = calendarLabels(labels)
  return {
    hours: own.timeHours,
    minutes: own.timeMinutes,
    dayPeriod: own.timeDayPeriod,
    chooseTime: own.chooseTime,
  }
}

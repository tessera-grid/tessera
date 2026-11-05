/** Подписи `calendar` (ADR 0182, §8): ключи словаря таблицы `calendar.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface CalendarLabels {
  /** Фильтр дат (ADR 0047): условия, пресеты, поле времени, листание месяцев */
  previousMonth: string
  nextMonth: string
  /** Поле времени (ADR 0183, PK20): сегменты часов, минут и половины суток, кнопка списка */
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

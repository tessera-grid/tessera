/** Подписи `calendar` (ADR 0182, §8): ключи словаря таблицы `calendar.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface CalendarLabels {
  /** Фильтр дат (ADR 0047): условия, пресеты, поле времени, листание месяцев */
  previousMonth: string
  nextMonth: string
}

export const calendarLabels = defineLabels<CalendarLabels>()(
  'calendar',
  {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    calendar: typeof calendarLabels
  }
}

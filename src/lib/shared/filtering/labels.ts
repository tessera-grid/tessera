/** Подписи `filtering` (ADR 0182, §8): ключи словаря таблицы `filtering.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface FilteringLabels {
  /** Короткие формы счётчиков в узкой нижней панели (ADR 0083, TX6); не обрезаются */
  filteredRowsShort: (shown: number, total: number) => string
  /** Заглушка пустого результата фильтрации */
  noRowsMatchFilters: string
  /** Сброс всех фильтров (сводка, заглушка пустого результата) */
  resetFilters: string
  /** «Показано N из M» в нижней панели */
  filteredRows: (shown: number, total: number) => string
}

export const filteringLabels = defineLabels<FilteringLabels>()(
  'filtering',
  {
    filteredRowsShort: '{shown} / {total}',
    noRowsMatchFilters: 'No rows match the filters',
    resetFilters: 'Reset filters',
    filteredRows: 'Showing {shown} of {total}',
  },
  {
    filteredRowsShort: ['shown', 'total'],
    filteredRows: ['shown', 'total'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    filtering: typeof filteringLabels
  }
}

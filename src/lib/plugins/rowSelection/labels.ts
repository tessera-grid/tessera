/** Подписи `rowSelection` (ADR 0182, §8): ключи словаря таблицы `rowSelection.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowSelectionLabels {
  /** Доступное имя чекбокса выбора строки */
  selectRow: string
  /** Доступное имя чекбокса выбора всех строк */
  selectAll: string
  /** Доступное имя флажка строки-группы: выбрать группу целиком (ADR 0148) */
  selectGroup: string
  /** Короткие формы счётчиков в узкой нижней панели (ADR 0083, TX6); не обрезаются */
  selectedRowsShort: (count: number) => string
  selectedRowsHiddenShort: (count: number) => string
  /** Счётчик выбранных строк в нижней панели (`rowSelection({ selectedCount })`) */
  selectedRows: (count: number) => string
  /** Добавка к счётчику выбранных: выбранные строки, скрытые фильтром (ADR 0045) */
  selectedRowsHidden: (count: number) => string
  /** Действие: выбрать все строки страницы */
  actionToggleAllPageRows: string
}

export const rowSelectionLabels = defineLabels<RowSelectionLabels>()(
  'rowSelection',
  {
    selectRow: 'Select row',
    selectAll: 'Select all rows',
    selectGroup: 'Select group',
    selectedRows: '{count} rows selected',
    selectedRows_one: '{count} row selected',
    selectedRowsHidden: '{count} hidden by filters',
    selectedRowsShort: '{count} selected',
    selectedRowsHiddenShort: '{count} hidden',
    actionToggleAllPageRows: 'Select all on the page',
  },
  {
    selectedRowsShort: ['count'],
    selectedRowsHiddenShort: ['count'],
    selectedRows: ['count'],
    selectedRowsHidden: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowSelection: typeof rowSelectionLabels
  }
}

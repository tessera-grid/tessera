/**
 * Запись плагина rowSelection на `definePlugin` (ADR 0014, ADR 0120): интерфейс выбора
 * строк — колонка флажков, Space, счётчик в нижней панели и колбэки пользователя. Модель —
 * `rowSelectionModel`, плагин её включает и передаёт ей `subRows` и срез.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import {
  rowSelectionModel,
  rowSelectionModelFeatures,
  type RowSelectionModelOptions,
} from '../rowSelectionModel/registry'
import { toggleRowKeyboardAction } from './keyboardActions'
import { SelectedRowsCount } from './SelectedRowsCount'
import {
  COLUMN_SELECTION_ID,
  getRowSelectionColumn,
} from './rowSelectionColumn'
import { HeadSelectionComponent } from './HeadSelectionComponent'
import { RowSelectionComponent } from './RowSelectionComponent'
import { isGroupingActive } from '../rowSelectionModel/selectionHelpers'
import type { RowSelectionHooks, SelectAllScope } from './types'

export interface RowSelectionOptions extends Omit<
  RowSelectionModelOptions,
  'enabled'
> {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Счётчик выбранных строк в нижней панели (ADR 0038); по умолчанию выключен. */
  selectedCount?: boolean
  /** Что выбирает флажок шапки (ADR 0179); по умолчанию `'filtered'`. */
  selectAll?: SelectAllScope
  /**
   * Бизнес-колбэки плагина, задаются прямо в аргументах фабрики. Читаются живо через
   * `table.getHooks()`. Частичный набор дополняется no-op дефолтами (`resolveHooks`).
   */
  onSelectRow?: RowSelectionHooks['onSelectRow']
  onSelectAllRows?: RowSelectionHooks['onSelectAllRows']
  isAllRowsSelected?: RowSelectionHooks['isAllRowsSelected']
}

// TOptions (RowSelectionOptions) задаётся ОДИН раз дженериком; `o` в полях выводится.
export const rowSelection = definePlugin<RowSelectionOptions>()({
  id: 'rowSelection',
  model: {
    plugin: rowSelectionModel,
    keys: [
      'subRows',
      'rowSelection',
      'onRowSelectionChange',
      'initialRowSelection',
    ],
  },
  features: rowSelectionModelFeatures,
  hooks: o => ({
    onSelectRow: o.onSelectRow,
    onSelectAllRows: o.onSelectAllRows,
    isAllRowsSelected: o.isAllRowsSelected, // undefined-ключи отбросит definePlugin
  }),
  options: o => ({ rowSelectionSelectAll: o.selectAll ?? 'filtered' }),
  keyboardActions: [toggleRowKeyboardAction],
  // Opt-in: у гридов с выбором строк нижняя панель не появляется сама.
  slots: o =>
    o.selectedCount
      ? [
          {
            id: 'selectedRowsCount',
            slot: 'statusBarSlot',
            align: 'start',
            component: SelectedRowsCount,
          },
        ]
      : [],
  diagnose: table => (isGroupingActive(table) ? 'grouping' : undefined),
  column: {
    id: COLUMN_SELECTION_ID,
    cell: RowSelectionComponent,
    header: HeadSelectionComponent,
    make: getRowSelectionColumn,
    side: 'leading',
    order: 1,
    pin: { side: 'start', when: 'with-user' },
    controlSized: true,
  },
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    rowSelectionPlugin: {
      rowSelectionSelectAll?: SelectAllScope
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Запись плагина rowSelection на `definePlugin` (ADR 0014, ADR 0120): интерфейс выбора
 * строк — колонка флажков, Space, счётчик в нижней панели и колбэки пользователя. Модель —
 * `rowSelectionModel`, плагин её включает и передаёт ей `subRows` и срез.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'

import { isPaginationActive } from '../../core/dataMode'
import { definePlugin } from '../../core/definePlugin'
import {
  serverRowModelReason,
  warnPluginInert,
} from '../../core/pluginDiagnostics'
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
import type { RowSelectionHooks, SelectAllScope } from './types'
import { rowSelectionLabels } from './labels'

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
}

// TOptions (RowSelectionOptions) задаётся ОДИН раз дженериком; `o` в полях выводится.
export const rowSelection = definePlugin<RowSelectionOptions>()({
  id: 'rowSelection',
  labels: [rowSelectionLabels],
  actions: {
    toggleRow: labels => rowSelectionLabels(labels).selectRow,
    toggleGroup: labels => rowSelectionLabels(labels).selectGroup,
    toggleAllRows: labels => rowSelectionLabels(labels).selectAll,
    toggleAllPageRows: labels =>
      rowSelectionLabels(labels).actionToggleAllPageRows,
    selectPageResolved: labels =>
      rowSelectionLabels(labels).actionToggleAllPageRows,
    selectPageRejected: labels =>
      rowSelectionLabels(labels).actionToggleAllPageRows,
    selectPageCancelled: labels =>
      rowSelectionLabels(labels).actionToggleAllPageRows,
    'rowSelection.toggle': labels => rowSelectionLabels(labels).selectRow,
  },
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
    onSelectAllRows: o.onSelectAllRows, // undefined-ключи отбросит definePlugin
  }),
  options: o => ({ rowSelectionSelectAll: o.selectAll ?? 'filtered' }),
  // Охват серверной модели строк без пагинации — весь итог выборки (ADR 0179, §4; ADR 0188).
  setup: o => table => {
    if (
      o.selectAll === 'currentPage' &&
      serverRowModelReason(table) &&
      !isPaginationActive(table)
    ) {
      warnPluginInert(
        table,
        'rowSelection',
        'serverRowModel',
        `selectAll: 'currentPage' acts as 'all' with the server row model without pagination`,
      )
    }
  },
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
  diagnose: () => undefined,
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

/**
 * Запись плагина rowSelection на `definePlugin` (ADR 0014, ADR 0120): интерфейс выбора
 * строк — колонка флажков, Space, счётчик в нижней панели и колбэки пользователя. Модель —
 * `rowSelectionModel`, плагин её включает и передаёт ей `subRows` и срез.
 */
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
import type { RowSelectionHooks } from './types'

export interface RowSelectionOptions extends Omit<
  RowSelectionModelOptions,
  'enabled'
> {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Счётчик выбранных строк в нижней панели (ADR 0038); по умолчанию выключен. */
  selectedCount?: boolean
  /**
   * Бизнес-колбэки плагина, задаются прямо в аргументах фабрики. Читаются живо через
   * `table.getHooks()`. Частичный набор дополняется no-op дефолтами (`resolveHooks`).
   */
  onSelectRow?: RowSelectionHooks['onSelectRow']
  onSelectAllRowsOnPage?: RowSelectionHooks['onSelectAllRowsOnPage']
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
    onSelectAllRowsOnPage: o.onSelectAllRowsOnPage,
    isAllRowsSelected: o.isAllRowsSelected, // undefined-ключи отбросит definePlugin
  }),
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
  },
})

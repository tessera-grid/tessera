/**
 * Запись плагина rowSelection на `definePlugin`.
 * Поведение даёт встроенный `rowSelectionFeature` (row-модель не нужна).
 *  - гейт группировки — через функциональный `enableRowSelection` (влияет
 *    и на агрегаты getIsAll/SomePageRowsSelected);
 *  - `enableRowRangeSelection: false` — гасим shift-range (клик по чекбоксу не должен
 *    диапазонно выделять).
 */
import { rowSelectionFeature } from '@tanstack/react-table'

import type { Row } from '../../types'
import { definePlugin } from '../../core/definePlugin'
import { warnPluginInert } from '../../core/pluginDiagnostics'
import { toggleRowKeyboardAction } from './keyboardActions'
import { SelectedRowsCount } from './SelectedRowsCount'
import {
  COLUMN_SELECTION_ID,
  getRowSelectionColumn,
} from './rowSelectionColumn'
import { HeadSelectionComponent } from './HeadSelectionComponent'
import { RowSelectionComponent } from './RowSelectionComponent'
import { isGroupingActive } from './selectionHelpers'
import type { RowSelectionHooks } from './types'

export interface RowSelectionOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить выбор дочерних строк (каскад на поддерево). */
  subRows?: boolean
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

/**
 * Выбор недоступен при АКТИВНОЙ группировке: сгруппированная модель
 * производна, выбором владеет rowGrouping. Функциональный `enableRowSelection`
 * согласует и агрегаты (getIsAllPageRowsSelected и т.п.).
 */
const enableRowSelection = (row: Row<any, any>): boolean => {
  if (!isGroupingActive(row.table)) {
    return true
  }
  warnPluginInert(row.table, 'rowSelection', 'grouping')
  return false
}

// TOptions (RowSelectionOptions) задаётся ОДИН раз дженериком; `o` в полях выводится.
export const rowSelection = definePlugin<RowSelectionOptions>()({
  id: 'rowSelection',
  features: { rowSelectionFeature },
  options: o => ({
    // При disabled — жёстко false (иначе present-but-disabled фича активна:
    // v9 фиксирует набор фич на маунте, гейт рантайм-тоггла — опцией).
    enableRowSelection: o.enabled === false ? false : enableRowSelection,
    enableSubRowSelection: o.subRows ?? false,
    enableRowRangeSelection: false,
  }),
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

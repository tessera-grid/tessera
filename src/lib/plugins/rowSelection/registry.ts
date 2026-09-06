import { PluginOptions, RegistryEntry, ServiceColumn } from '../types'
import {
  COLUMN_SELECTION_ID,
  getRowSelectionColumn,
} from './rowSelectionColumn'
import { rowSelectionPlugin } from './rowSelectionPlugin'
import type { RowSelectionPlugin } from './types'

export interface RowSelectionOptions extends PluginOptions {
  /** Разрешить выбор дочерних строк (каскад на поддерево). */
  subRows?: boolean
}

export const rowSelection = (
  opts: RowSelectionOptions = {},
): RegistryEntry<RowSelectionPlugin> => ({
  id: 'rowSelection',
  enabled: opts.enabled,
  // Фича вешает renderComponent на шапку и ячейки сервисной колонки (чекбоксы) и
  // добавляет table.getCanSomeRowsSelect. Сервисная колонка сама рендерера не
  // несёт, поэтому держим фичу в _features всегда: иначе при live-включении
  // колонка выбора появляется пустой (createHeader/createCell не отработали на
  // маунте). Пока опция выключена, сервисной колонки нет и хуки инертны.
  keepFeatureWhenDisabled: true,
  feature: rowSelectionPlugin,
  column: {
    id: COLUMN_SELECTION_ID,
    make: getRowSelectionColumn as ServiceColumn['make'],
    side: 'leading',
    order: 1,
    pin: { side: 'left', when: 'with-user' },
  },
  options: {
    enableRowSelection: true,
    enableSubRowSelection: opts.subRows ?? false,
  },
})

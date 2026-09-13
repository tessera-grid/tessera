/**
 * Фаза B/C — рантайм always-on фичи `commonFeature` (v9-порт commonPlugin).
 * Тип-контракт и declaration merging — в [commonFeature.types.ts].
 *
 * Отличия от v8-версии (осознанно):
 *  - методы объектов ставятся на ОБЩИЙ прототип (`assign*Prototype`) и работают
 *    через переданный первым аргументом объект, а не через замыкание (v9-идиома);
 *  - флаги групп заголовков — через `initHeaderGroupInstanceData` (для HeaderGroup
 *    в v9 нет prototype-хука), а не монки-патчем `getHeaderGroups`;
 *  - `render`→`columnDef` НЕ портируется: в v9 рендер идёт через `FlexRender`.
 */
import { assignPrototypeAPIs, assignTableAPIs, functionalUpdate } from '@tanstack/table-v9'

import {
  ROW_ACTIONS_COLUMN_ID,
  checkIsActionColumn,
} from '../../lib/core/createColumns/actionColumnParams'
import type { ColumnSizingState, TableFeature, Updater } from '../types'
import type { CommonOptions } from './commonFeature.types'
import { DEFAULT_SKELETON_OPTIONS } from './skeletonOptions'

// Побочка импорта типов: подключает declaration merging из commonFeature.types.
export type { CommonOptions } from './commonFeature.types'

export const commonFeature: TableFeature = {
  getDefaultTableOptions: () => ({
    skeletonOptions: DEFAULT_SKELETON_OPTIONS,
  }),

  constructTableAPIs: table => {
    const options = () => table.options as unknown as CommonOptions

    assignTableAPIs('commonFeature', table, {
      table_getHooks: { fn: () => options().hooks },
      table_getRenderSlots: { fn: () => options().slots },
      table_getSlotActions: { fn: () => options().slotActions },
      table_getIsAnyColumnResizing: {
        fn: () =>
          // getAllLeafColumns — ядровый метод (не зависит от columnVisibilityFeature).
          table.getAllLeafColumns().some(column => {
            // getIsResizing существует только при columnResizingFeature — гардим.
            const resizable = column as { getIsResizing?: () => boolean }
            return typeof resizable.getIsResizing === 'function'
              ? resizable.getIsResizing()
              : false
          }),
      },
      table_setColumnAutoSizing: {
        fn: (updater: Updater<ColumnSizingState>) =>
          options().onColumnAutoSizingChange?.(old =>
            functionalUpdate(updater, old),
          ),
      },
    })
  },

  assignColumnPrototype: (prototype, table) => {
    assignPrototypeAPIs('commonFeature', prototype, table, {
      column_getIsActionsColumn: {
        fn: (column: { id: string }) => checkIsActionColumn(column.id),
      },
      column_getIsRowActionsColumn: {
        fn: (column: { id: string }) => column.id.includes(ROW_ACTIONS_COLUMN_ID),
      },
    })
  },

  assignHeaderPrototype: (prototype, table) => {
    assignPrototypeAPIs('commonFeature', prototype, table, {
      header_getIsFirstHeader: {
        fn: (header: {
          id: string
          headerGroup: { headers: { id: string }[] }
        }) => header.headerGroup.headers[0]?.id === header.id,
      },
      header_getIsLastHeader: {
        fn: (header: {
          id: string
          headerGroup: { headers: { id: string }[] }
        }) => header.headerGroup.headers.at(-1)?.id === header.id,
      },
      header_getIsFullHeightHeader: {
        fn: (header: {
          column: { columnDef: { rowSpan?: number } }
          table: { getHeaderGroups: () => unknown[] }
        }) =>
          header.column.columnDef.rowSpan === header.table.getHeaderGroups().length,
      },
    })
  },

  assignRowPrototype: (prototype, table) => {
    assignPrototypeAPIs('commonFeature', prototype, table, {
      row_getIsFirstRow: {
        fn: (row: {
          id: string
          table: { getRowModel: () => { rows: { id: string }[] } }
        }) => row.table.getRowModel().rows[0]?.id === row.id,
      },
      row_getIsLastRow: {
        fn: (row: {
          id: string
          table: { getRowModel: () => { rows: { id: string }[] } }
        }) => row.table.getRowModel().rows.at(-1)?.id === row.id,
      },
      row_getIsLastSubRow: {
        fn: (row: {
          id: string
          parentId?: string | null
          getParentRow?: () => { subRows: { id: string }[] } | undefined
        }) => {
          if (row.parentId == null) {
            return false
          }
          const parent = row.getParentRow?.()
          return row.id === parent?.subRows.at(-1)?.id
        },
      },
    })
  },

  initHeaderGroupInstanceData: headerGroup => {
    // В v9 у header group нет back-ref `.table` (только id/depth/headers) — берём
    // таблицу через первый заголовок группы (у Header ссылка на table есть).
    const group = headerGroup as unknown as {
      id: string
      headers: { table: { getHeaderGroups: () => { id: string }[] } }[]
      getIsFirstGroup: () => boolean
      getIsLastGroup: () => boolean
    }
    const groups = () => group.headers[0]?.table.getHeaderGroups() ?? []
    group.getIsFirstGroup = () => groups()[0]?.id === group.id
    group.getIsLastGroup = () => groups().at(-1)?.id === group.id
  },
}

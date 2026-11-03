/**
 * Рантайм always-on фичи `commonFeature`. Тип-контракт и declaration merging —
 * в [commonFeature.types.ts].
 *
 * Ключевые идиомы:
 *  - методы объектов ставятся на ОБЩИЙ прототип (`assign*Prototype`) и работают
 *    через переданный первым аргументом объект;
 *  - флаги групп заголовков — через `initHeaderGroupInstanceData` (для HeaderGroup
 *    нет prototype-хука);
 *  - рендер идёт через `FlexRender`.
 */
import {
  assignPrototypeAPIs,
  assignTableAPIs,
  functionalUpdate,
} from '@tanstack/react-table'

import { serviceColumnOf } from './createColumns'
import type { ColumnSizingState, TableFeature, Updater } from '../types'
import type { CommonOptions } from './commonFeature.types'
import { announce } from './announcer'
import { createActionReporter } from './debugActions'
import { formatDataTypeValue } from './dataTypeFormat'
import { resolveDataType } from './dataTypes'
import {
  createPluginErrorRegistry,
  resolvePluginDiagnostics,
} from './pluginDiagnostics'
import { createClientRowSource, rowSourceOf } from './rowSource'
import { DEFAULT_SKELETON_OPTIONS } from './skeletonOptions'

// Побочка импорта типов: подключает declaration merging из commonFeature.types.
export type { CommonOptions } from './commonFeature.types'

/** Опции `commonFeature`: они есть у таблицы при любом наборе фич (ADR 0164). */
export const commonOptionsOf = (table: unknown): CommonOptions =>
  (table as { options: CommonOptions }).options

interface DefaultCellProps {
  table: object
  column: { id: string; columnDef: object }
  row?: { original: unknown }
  getValue: () => unknown
  renderValue: () => unknown
}

/** Ячейка по умолчанию; грид узнаёт её, чтобы нарисовать значок булева (ADR 0172, DT6). */
export const defaultCell = (props: DefaultCellProps) =>
  formatDataTypeValue(
    props.table as never,
    props.column,
    // Колонка без типа показывает запасное значение таблицы, как стоковая ячейка.
    resolveDataType(props.table as never, props.column)
      ? props.getValue()
      : props.renderValue(),
    props.row?.original,
  ) || null

export const commonFeature: TableFeature = {
  getDefaultTableOptions: () => ({
    skeletonOptions: DEFAULT_SKELETON_OPTIONS,
  }),

  // Ячейка по умолчанию — текст по типу колонки (ADR 0172), у вариантов — подпись
  // (ADR 0048, SF15). Свой `cell` колонки её перекрывает.
  getDefaultColumnDef: () => ({ cell: defaultCell }),

  constructTableAPIs: table => {
    const options = () => commonOptionsOf(table)
    const pluginErrors = createPluginErrorRegistry(table)
    const rowSource = createClientRowSource(table)

    assignTableAPIs('commonFeature', table, {
      table_getHooks: { fn: () => options().hooks },
      table_getRowSource: {
        fn: () => {
          const source = options().getRowSource?.(table) ?? rowSource
          return options().rowSourceLayer?.(source, table) ?? source
        },
      },
      table_getRenderSlots: { fn: () => options().slots },
      table_getSlotActions: { fn: () => options().slotActions },
      table_getContextMenuActions: { fn: () => options().contextMenuActions },
      table_getKeyboardActions: { fn: () => options().keyboardActions },
      table_getPluginDiagnostics: {
        fn: () =>
          resolvePluginDiagnostics(
            options().pluginDiagnostics ?? [],
            table,
            pluginErrors,
          ),
      },
      table_reportPluginError: {
        fn: (pluginId: string, error: unknown) =>
          pluginErrors.report(pluginId, error),
      },
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
      table_reportAction: {
        fn: createActionReporter(() => options().onDebugAction),
      },
      table_announce: {
        fn: (message: string) => announce(table, message),
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
        fn: (column: { columnDef: object }) =>
          serviceColumnOf(column.columnDef) !== undefined,
      },
      column_getServiceColumn: {
        fn: (column: { columnDef: object }) =>
          serviceColumnOf(column.columnDef),
      },
      column_getDataType: {
        fn: (column: { id: string; columnDef: object }) =>
          resolveDataType(table as never, column),
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
          rowSpan: number
          table: { getHeaderGroups: () => unknown[] }
        }) => header.rowSpan === header.table.getHeaderGroups().length,
      },
    })
  },

  assignRowPrototype: (prototype, table) => {
    assignPrototypeAPIs('commonFeature', prototype, table, {
      row_getIsFirstRow: {
        fn: (row: { id: string; table: unknown }) =>
          rowSourceOf<{ id: string }>(row.table).at(0)?.id === row.id,
      },
      row_getIsLastRow: {
        fn: (row: { id: string; table: unknown }) => {
          const source = rowSourceOf<{ id: string }>(row.table)
          return source.at(source.count() - 1)?.id === row.id
        },
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
          // Серверная модель: детей массивом нет — место строки в ветке (ADR 0159).
          const source = rowSourceOf<{ id: string }>(
            (row as { table?: unknown }).table,
          )
          if (source.treeAria) {
            const aria = source.treeAria(source.indexOf(row.id))
            return !!aria && aria.posInSet === aria.setSize
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

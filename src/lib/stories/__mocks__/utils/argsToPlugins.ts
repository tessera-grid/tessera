import type { Row } from '@tanstack/react-table'

import {
  columnDragging,
  columnPinning,
  columnSizing,
  columnSorting,
  type RegistryEntry,
  rowActions,
  rowDragging,
  rowExpanding,
  rowGrouping,
  rowSelection,
} from '../../../plugins'
import { RowActionsOptions } from '../../../plugins/rowActions'
import { rowDeleteActionPlugin } from '../plugins/rowDeleteAction/rowDeleteActionPlugin'

// Слой демо/тестов: композирует presence-based plugins из boolean-тумблеров
// Storybook через настоящие фабрики. Тумблер → `enabled` фабрики; ядро само
// отсеивает отключённые. Так Storybook сохраняет тумблеры, а истории/тесты гоняют
// реальный API (ADR 0010). Маппер живёт здесь (демо), не в ядре.

export interface FeatureToggles {
  enableRowSelection?: boolean
  enableSubRowSelection?: boolean
  enableRowExpanding?: boolean
  enableRowDragging?: boolean
  enableColumnSorting?: boolean
  enableSortingRemoval?: boolean
  serverColumnSorting?: boolean
  enableColumnPinning?: boolean
  enableColumnResizing?: boolean
  enableColumnDragging?: boolean
  enableGrouping?: boolean
  enableRowActions?: boolean
  rowActionsOptions?: RowActionsOptions
}

export const argsToPlugins = (o: FeatureToggles): RegistryEntry[] => {
  // rowExpanding в историях раскрывает узлы дерева (isGroup) и сгруппированные
  // строки TanStack — предикат кладём в опции фабрики.
  const expanding = rowExpanding({ enabled: !!o.enableRowExpanding })
  const rowExpandingEntry: RegistryEntry = {
    ...expanding,
    options: {
      ...expanding.options,
      enableRowExpanding: (row: Row<any>) =>
        row.getIsGrouped() || !!row.original?.isGroup,
    },
  }

  return [
    rowSelection({
      enabled: !!o.enableRowSelection,
      subRows: o.enableSubRowSelection,
    }),
    rowExpandingEntry,
    rowDragging({ enabled: !!o.enableRowDragging }),
    columnPinning({ enabled: !!o.enableColumnPinning }),
    columnSizing({ enabled: !!o.enableColumnResizing }),
    columnSorting({
      enabled: !!o.enableColumnSorting,
      removal: o.enableSortingRemoval,
      server: o.serverColumnSorting,
    }),
    columnDragging({ enabled: !!o.enableColumnDragging }),
    rowGrouping({ enabled: !!o.enableGrouping }),
    rowActions({
      enabled: !!o.enableRowActions,
      width: o.rowActionsOptions?.width,
    }),
    // Демо-плагин внешнего действия (удаление строки) — сырая фича в записи.
    { id: 'rowDeleteAction', feature: rowDeleteActionPlugin },
  ]
}

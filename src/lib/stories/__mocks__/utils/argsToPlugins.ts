import type { Row } from '@tanstack/react-table'

import {
  cellEditing,
  columnDragging,
  columnPinning,
  columnSizing,
  columnSorting,
  headerActionMenu,
  rowActionMenu,
  rowActions,
  rowDragging,
  rowExpanding,
  rowGrouping,
  rowSelection,
  type ColumnMultiSortOptions,
} from '../../../../lib/plugins'
import type { TesseraFeatureEntry } from '../../../../lib/core/features'
import type { RowActionsOptions } from '../../../../lib/plugins/rowActions/rowActionsColumn'

type RegistryEntry = TesseraFeatureEntry
import { rowActionsDemo } from '../plugins/rowActionsDemo/rowActionsDemo'

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
  /** Мультисортировка (по умолчанию включена штатным жестом Shift+клик). */
  enableMultiSort?: boolean
  /** Тонкая настройка мультисорта (`max` / `removal` / `event`) для тестов/историй. */
  multiSortOptions?: ColumnMultiSortOptions
  enableColumnPinning?: boolean
  /** PoC (ADR 0011): под вложенной шапкой пиннить отдельные листья (reorder-out). */
  enableLeafPinning?: boolean
  enableColumnResizing?: boolean
  enableColumnDragging?: boolean
  enableGrouping?: boolean
  enableRowActions?: boolean
  rowActionsOptions?: RowActionsOptions
  /** Схлопывать кнопки заголовка в кебаб-меню (по умолчанию порог 3). */
  enableHeaderActionMenu?: boolean
  /** Схлопывать действия строки в кебаб-меню (по умолчанию порог 2). */
  enableRowActionMenu?: boolean
  /** Инлайн-редактирование ячейки (кнопка в правом слоте по hover). */
  enableCellEditing?: boolean
}

export const argsToPlugins = (o: FeatureToggles): RegistryEntry[] => {
  // rowExpanding в историях раскрывает узлы дерева (isGroup) и сгруппированные
  // строки TanStack — предикат кладём в опции фабрики.
  const expanding = rowExpanding({ enabled: !!o.enableRowExpanding })
  const rowExpandingEntry: RegistryEntry = {
    ...expanding,
    options: {
      ...expanding.options,
      enableRowExpanding: (row: Row<any, any>) =>
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
    columnPinning({
      enabled: !!o.enableColumnPinning,
      leafPinning: o.enableLeafPinning,
    }),
    columnSizing({ enabled: !!o.enableColumnResizing }),
    columnSorting({
      enabled: !!o.enableColumnSorting,
      removal: o.enableSortingRemoval,
      server: o.serverColumnSorting,
      // Объектная форма (если задана) имеет приоритет; иначе — булев тумблер
      // (undefined → дефолт фабрики: мультисорт включён жестом Shift).
      multiSort: o.multiSortOptions ?? o.enableMultiSort,
    }),
    columnDragging({ enabled: !!o.enableColumnDragging }),
    rowGrouping({ enabled: !!o.enableGrouping }),
    rowActions({
      enabled: !!o.enableRowActions,
      width: o.rowActionsOptions?.width,
    }),
    headerActionMenu({ enabled: !!o.enableHeaderActionMenu }),
    rowActionMenu({ enabled: !!o.enableRowActionMenu }),
    // Фича/слот/локальный state включаются тумблером; бизнес-хуки (canEdit/
    // onCellEdit) демо кладёт в hook-слайс записи `demoHooks` (StoryComponent),
    // как и для остальных плагинов.
    cellEditing({ enabled: !!o.enableCellEditing }),
    // Демо-производитель действий строки как единые дескрипторы (`RowAction`):
    // инлайн — ряд row-кнопок, при `rowActionMenu` схлопываются в overflow-кебаб.
    {
      id: 'rowActionsDemo',
      slotActions: rowActionsDemo,
    },
  ]
}

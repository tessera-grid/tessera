import {
  cellEditing,
  cellSelection,
  contextMenu,
  keyboardNavigation,
  columnDragging,
  columnFiltering,
  columnPinning,
  columnSizing,
  columnSorting,
  columnVisibility,
  dataExport,
  headerActionMenu,
  pagination,
  quickSearch,
  rowActionMenu,
  rowActions,
  rowDragging,
  rowExpanding,
  rowGrouping,
  rowSelection,
  type CellEditingOptions,
  type CellSelectionOptions,
  type ColumnFilteringOptions,
  type ColumnDraggingOptions,
  type ColumnMultiSortOptions,
  type ColumnSizingOptions,
  type ExportOptions,
  type QuickSearchOptions,
  type RowActionsPluginOptions,
  type RowDraggingOptions,
  type RowExpandingOptions,
} from '../../../../lib/plugins'
import type { TesseraFeatureEntry } from '../../../../lib/core/features'
import type { RowActionsOptions } from '../../../../lib/plugins/rowActions/rowActionsColumn'

type RegistryEntry = TesseraFeatureEntry
import { rowActionsDemo } from '../plugins/rowActionsDemo/rowActionsDemo'
import {
  asyncContextActionsDemo,
  asyncRowActionsDemo,
} from '../plugins/asyncActionsDemo/asyncActionsDemo'

// Слой демо/тестов: композирует presence-based plugins из boolean-тумблеров
// Storybook через настоящие фабрики. Тумблер → `enabled` фабрики; ядро само
// отсеивает отключённые. Так Storybook сохраняет тумблеры, а истории/тесты гоняют
// реальный API. Маппер живёт здесь (демо), не в ядре.

export interface FeatureToggles {
  enableRowSelection?: boolean
  enableSubRowSelection?: boolean
  /** Счётчик выбранных строк в нижней панели (ADR 0038). */
  showSelectedCount?: boolean
  enableRowExpanding?: boolean
  enableRowDragging?: boolean
  enableColumnSorting?: boolean
  enableSortingRemoval?: boolean
  serverColumnSorting?: boolean
  /** Мультисортировка (по умолчанию включена штатным жестом Shift+клик). */
  enableMultiSort?: boolean
  /** Тонкая настройка мультисорта (`max` / `event`) для тестов/историй. */
  multiSortOptions?: ColumnMultiSortOptions
  enableColumnPinning?: boolean
  /** Под вложенной шапкой пиннить отдельные листья (reorder-out). */
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
  /** Выделение диапазона ячеек мышью + копирование (Ctrl/Cmd+C). */
  enableCellSelection?: boolean
  /** Контекстное меню по правому клику (пункты контрибьютят плагины). */
  enableContextMenu?: boolean
  /** Клавиатурная навигация по ячейкам (role=grid, roving tabindex, стрелки). */
  enableKeyboardNavigation?: boolean
  /** Кнопка «Колонки» в тулбаре: скрытие и показ колонок. */
  enableColumnVisibility?: boolean
  /** Фильтры колонок: кнопка в заголовке колонки с `filter` (ADR 0045). */
  enableColumnFiltering?: boolean
  /** Тонкая настройка фильтров колонок (ADR 0045). */
  columnFilteringOptions?: Omit<ColumnFilteringOptions, 'enabled'>
  /** Быстрый поиск в тулбаре (ADR 0045). */
  enableQuickSearch?: boolean
  /** Тонкая настройка быстрого поиска (ADR 0045). */
  quickSearchOptions?: Omit<QuickSearchOptions, 'enabled'>
  /** Кнопка «Экспорт» в тулбаре (ADR 0044). */
  enableExport?: boolean
  /** Тонкая настройка экспорта: пресеты, серверный режим, колбэки (ADR 0044). */
  exportOptions?: Omit<ExportOptions, 'enabled'>
  /** Серверная пагинация: `data` — текущая страница, итог — `paginationRowCount`. */
  paginationServer?: boolean
  /** Всего строк на сервере (нужен при `paginationServer`). */
  paginationRowCount?: number
  /** Пагинация в нижней панели (ADR 0038). */
  enablePagination?: boolean
  /** Размер страницы пагинации (по умолчанию 25). */
  paginationPageSize?: number
  /** Варианты размера страницы пагинации (по умолчанию 10/25/50/100). */
  paginationPageSizes?: number[] | false
  /** Тонкая настройка кебаба заголовка (`mode` / `threshold`). */
  headerActionMenuOptions?: { mode?: 'auto' | 'always'; threshold?: number }
  /** Тонкая настройка кебаба строки (`mode` / `threshold`). */
  rowActionMenuOptions?: { mode?: 'auto' | 'always'; threshold?: number }
  /** Флаги выделения ячеек (`rangeSelection` / `dragSelection` / `multiRange`). */
  cellSelectionOptions?: {
    rangeSelection?: boolean
    dragSelection?: boolean
    multiRange?: boolean
    canSelectCell?: CellSelectionOptions['canSelectCell']
  }
  /** Предел глубины раскрытия (`rowExpanding({ maxDepth })`). */
  rowExpandingMaxDepth?: number
  /** Режим колонки раскрытия (ADR 0050): `'always'` — видна и без раскрываемых строк. */
  rowExpandingColumn?: RowExpandingOptions['column']
  /** Ленивые дети (ADR 0054): `rowExpanding({ hasChildren, loadChildren })`. */
  rowExpandingHasChildren?: RowExpandingOptions['hasChildren']
  rowExpandingLoadChildren?: RowExpandingOptions['loadChildren']
  /** Линии дерева (`rowExpanding({ treeLines })`, ADR 0058). */
  rowExpandingTreeLines?: boolean
  /** Режим колонки действий (ADR 0050). */
  /** `false` — демо-действий строки нет (колонка действий без надобности, ADR 0050). */
  rowActionsDemo?: boolean
  /** Демо асинхронных действий строки и контекстного меню (ADR 0078). */
  asyncActionsDemo?: boolean
  rowActionsColumn?: RowActionsPluginOptions['column']
  /** Предикат правки аргументом плагина (`cellEditing({ canEdit })`). */
  cellEditingCanEdit?: CellEditingOptions['canEdit']
  /** Разрешение перетаскивания строк при включённом плагине (`rowDragging({ enable })`). */
  rowDraggingEnable?: boolean
  // Бизнес-колбэки сессий аргументами фабрик — чтобы визуальные тесты наблюдали
  // их вызовы. В обычных историях не задаются.
  onColumnResizeEnd?: ColumnSizingOptions['onColumnResizeEnd']
  onColumnResizeCancel?: ColumnSizingOptions['onColumnResizeCancel']
  onColumnDragEnd?: ColumnDraggingOptions['onColumnDragEnd']
  onColumnDragCancel?: ColumnDraggingOptions['onColumnDragCancel']
  onRowDragEnd?: RowDraggingOptions['onRowDragEnd']
  onRowDragCancel?: RowDraggingOptions['onRowDragCancel']
  onCellEdit?: CellEditingOptions['onCellEdit']
  onEditCancel?: CellEditingOptions['onEditCancel']
  onConflict?: CellEditingOptions['onConflict']
}

export const argsToPlugins = (o: FeatureToggles) => {
  return [
    rowSelection({
      enabled: !!o.enableRowSelection,
      subRows: o.enableSubRowSelection,
      selectedCount: o.showSelectedCount,
    }),
    rowExpanding({
      enabled: !!o.enableRowExpanding,
      maxDepth: o.rowExpandingMaxDepth,
      column: o.rowExpandingColumn,
      hasChildren: o.rowExpandingHasChildren,
      loadChildren: o.rowExpandingLoadChildren,
      treeLines: o.rowExpandingTreeLines,
    }),
    rowDragging({
      enabled: !!o.enableRowDragging,
      enable: o.rowDraggingEnable,
      onRowDragEnd: o.onRowDragEnd,
      onRowDragCancel: o.onRowDragCancel,
    }),
    columnPinning({
      enabled: !!o.enableColumnPinning,
      leafPinning: o.enableLeafPinning,
    }),
    columnSizing({
      enabled: !!o.enableColumnResizing,
      onColumnResizeEnd: o.onColumnResizeEnd,
      onColumnResizeCancel: o.onColumnResizeCancel,
    }),
    columnSorting({
      enabled: !!o.enableColumnSorting,
      removal: o.enableSortingRemoval,
      server: o.serverColumnSorting,
      // Тумблер выключает мультисорт и при заданной объектной форме.
      multiSort:
        o.enableMultiSort === false ? false : (o.multiSortOptions ?? true),
    }),
    columnDragging({
      enabled: !!o.enableColumnDragging,
      onColumnDragEnd: o.onColumnDragEnd,
      onColumnDragCancel: o.onColumnDragCancel,
    }),
    rowGrouping({ enabled: !!o.enableGrouping }),
    rowActions({
      enabled: !!o.enableRowActions,
      width: o.rowActionsOptions?.width,
      collapsedWidth: o.rowActionsOptions?.collapsedWidth,
      column: o.rowActionsColumn,
    }),
    headerActionMenu({
      enabled: !!o.enableHeaderActionMenu,
      ...o.headerActionMenuOptions,
    }),
    rowActionMenu({
      enabled: !!o.enableRowActionMenu,
      ...o.rowActionMenuOptions,
    }),
    // Фича/слот/локальный state включаются тумблером; бизнес-хуки (canEdit/
    // onCellEdit) демо кладёт в hook-слайс записи `demoHooks` (StoryComponent),
    // как и для остальных плагинов.
    cellEditing({
      enabled: !!o.enableCellEditing,
      canEdit: o.cellEditingCanEdit,
      onCellEdit: o.onCellEdit,
      onEditCancel: o.onEditCancel,
      onConflict: o.onConflict,
    }),
    cellSelection({
      enabled: !!o.enableCellSelection,
      ...o.cellSelectionOptions,
    }),
    contextMenu({ enabled: !!o.enableContextMenu }),
    keyboardNavigation({ enabled: !!o.enableKeyboardNavigation }),
    columnVisibility({ enabled: !!o.enableColumnVisibility }),
    columnFiltering({
      enabled: !!o.enableColumnFiltering,
      ...o.columnFilteringOptions,
    }),
    quickSearch({ enabled: !!o.enableQuickSearch, ...o.quickSearchOptions }),
    dataExport({ enabled: !!o.enableExport, ...o.exportOptions }),
    pagination({
      enabled: !!o.enablePagination,
      initialPageSize: o.paginationPageSize,
      pageSizes: o.paginationPageSizes,
      server: o.paginationServer,
      rowCount: o.paginationRowCount,
    }),
    // Демо-производитель действий строки как единые дескрипторы (`RowAction`):
    // инлайн — ряд row-кнопок, при `rowActionMenu` схлопываются в overflow-кебаб.
    {
      id: 'rowActionsDemo',
      enabled: o.rowActionsDemo !== false,
      slotActions: rowActionsDemo,
    },
    // Асинхронные действия (ADR 0078): проверка доступности и долгое действие.
    {
      id: 'asyncActionsDemo',
      enabled: !!o.asyncActionsDemo,
      slotActions: asyncRowActionsDemo,
      contextMenuActions: asyncContextActionsDemo,
    },
  ] as const
}

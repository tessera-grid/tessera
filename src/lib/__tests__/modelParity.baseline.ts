/**
 * База паритета клиентской и серверной моделей строк (ADR 0187): что каждый публичный аргумент фабрик
 * `/plugins` делает в обеих моделях. Новый аргумент — запись здесь: `same` или различие с ADR.
 */
import type { BehaviourDifference, ParityBase } from './modelParity.check'

export const MODEL_PARITY: ParityBase = {
  rowSelection: {
    same: [
      'enabled',
      'selectedCount',
      'onSelectRow',
      'onSelectAllRows',
      'subRows',
    ],
    differs: {
      selectAll: {
        reason:
          "`'currentPage'` в SSRM без пагинации действует как весь итог, строки страницы догружаются",
        adr: 188,
      },
      rowSelection: {
        reason:
          'В SSRM срез хранит и «всё, кроме» с узлами групп и веток: всех строк у клиента нет',
        adr: 148,
      },
      onRowSelectionChange: {
        reason:
          'В SSRM срез хранит и «всё, кроме» с узлами групп и веток: всех строк у клиента нет',
        adr: 148,
      },
      initialRowSelection: {
        reason:
          'В SSRM срез хранит и «всё, кроме» с узлами групп и веток: всех строк у клиента нет',
        adr: 148,
      },
    },
  },
  rowSelectionModel: {
    same: ['enabled', 'subRows'],
    differs: {
      rowSelection: {
        reason:
          'В SSRM срез хранит и «всё, кроме» с узлами групп и веток: всех строк у клиента нет',
        adr: 148,
      },
      onRowSelectionChange: {
        reason:
          'В SSRM срез хранит и «всё, кроме» с узлами групп и веток: всех строк у клиента нет',
        adr: 148,
      },
      initialRowSelection: {
        reason:
          'В SSRM срез хранит и «всё, кроме» с узлами групп и веток: всех строк у клиента нет',
        adr: 148,
      },
    },
  },
  rowExpanding: {
    same: [
      'enabled',
      'maxDepth',
      'column',
      'expandAll',
      'stickyRows',
      'onExpandRow',
      'hasChildren',
      'expanded',
      'onExpandedChange',
      'initialExpanded',
    ],
    differs: {
      loadChildren: {
        reason: 'В SSRM детей загружает `getRows` с `parentId`',
        adr: 138,
      },
    },
  },
  rowExpandingModel: {
    same: ['enabled', 'expanded', 'onExpandedChange', 'initialExpanded'],
  },
  treeLines: {
    same: ['enabled'],
  },
  rowDragging: {
    same: [
      'enabled',
      'canDragRow',
      'expandDelay',
      'onRowDragEnd',
      'revertOnReject',
      'onRowDragCancel',
    ],
    differs: {
      onRowOrderChange: {
        reason: 'В SSRM порядок живёт в кэше: перенос пишет транзакция строк',
        adr: 159,
      },
    },
  },
  rowGrouping: {
    same: [
      'enabled',
      'stickyRows',
      'groupRowCount',
      'grouping',
      'onGroupingChange',
      'initialGrouping',
    ],
  },
  rowGroupingModel: {
    inertOnServer: {
      reason:
        'Группирует сервер: модель группировки в SSRM не строится, кнопку и срез ведёт `rowGrouping`',
      adr: 144,
    },
  },
  rowActions: {
    same: ['enabled', 'width', 'collapsedWidth', 'column'],
  },
  cellEditing: {
    same: [
      'enabled',
      'canEditCell',
      'onCellEdit',
      'onEditCancel',
      'saveMode',
      'onCommitEdits',
      'onConflict',
      'editor',
      'searchDebounceMs',
      'validate',
      'editing',
      'onEditingChange',
      'initialEditing',
    ],
  },
  cellErrors: {
    same: ['enabled', 'getCellError'],
  },
  cellSelection: {
    same: [
      'enabled',
      'rangeSelection',
      'dragSelection',
      'multiRange',
      'canSelectCell',
      'handle',
      'maxCopyRows',
      'cellSelection',
      'onCellSelectionChange',
      'initialCellSelection',
    ],
  },
  cellSelectionModel: {
    same: [
      'enabled',
      'canSelectCell',
      'cellSelection',
      'onCellSelectionChange',
      'initialCellSelection',
    ],
  },
  contextMenu: {
    same: ['enabled'],
  },
  columnSorting: {
    same: [
      'enabled',
      'removal',
      'revertOnReject',
      'multiSort',
      'onToggleColumnSort',
      'sorting',
      'onSortingChange',
      'initialSorting',
    ],
  },
  columnSortingModel: {
    same: [
      'enabled',
      'multiSort',
      'sorting',
      'onSortingChange',
      'initialSorting',
    ],
  },
  columnPinning: {
    same: ['enabled', 'leafPinning', 'onTogglePin'],
  },
  columnSizing: {
    same: ['enabled', 'onColumnResizeEnd', 'onColumnResizeCancel'],
  },
  columnDragging: {
    same: [
      'enabled',
      'onColumnDragEnd',
      'revertOnReject',
      'onColumnDragCancel',
    ],
  },
  columnVisibility: {
    same: ['enabled', 'onToggleColumnVisibility'],
  },
  headerActionMenu: {
    same: ['enabled', 'mode', 'threshold', 'slots'],
  },
  rowActionMenu: {
    same: ['enabled', 'mode', 'threshold'],
  },
  pagination: {
    same: [
      'enabled',
      'pageSizes',
      'pageNumbers',
      'revertOnReject',
      'onPageChange',
      'pagination',
      'initialPageSize',
      'onPaginationChange',
      'initialPagination',
    ],
  },
  paginationModel: {
    same: [
      'enabled',
      'initialPageSize',
      'pagination',
      'onPaginationChange',
      'initialPagination',
    ],
  },
  infiniteScroll: {
    inertOnServer: {
      reason: 'Строки по окну уже грузит серверная модель, лента ей не нужна',
      adr: 138,
    },
  },
  backToTop: {
    same: ['enabled', 'threshold', 'horizontalThreshold', 'axes'],
  },
  columnTotals: {
    same: ['enabled'],
  },
  failureLog: {
    same: ['enabled'],
  },
  unsavedChanges: {
    same: ['enabled'],
  },
  serverRowModel: {
    onlyOnServer: {
      reason: 'Сама серверная модель строк: в клиентском режиме её нет',
      adr: 138,
    },
  },
  columnFiltering: {
    same: [
      'enabled',
      'debounceMs',
      'filteredCount',
      'onFilterChange',
      'columnFilters',
      'onColumnFiltersChange',
      'initialColumnFilters',
    ],
  },
  columnFilteringModel: {
    same: [
      'enabled',
      'columnFilters',
      'onColumnFiltersChange',
      'initialColumnFilters',
    ],
  },
  quickSearch: {
    same: [
      'enabled',
      'debounceMs',
      'filteredCount',
      'onSearchChange',
      'globalFilter',
      'onGlobalFilterChange',
      'initialGlobalFilter',
    ],
  },
  quickSearchModel: {
    same: [
      'enabled',
      'globalFilter',
      'onGlobalFilterChange',
      'initialGlobalFilter',
    ],
  },
  dataExport: {
    same: [
      'enabled',
      'formats',
      'allow',
      'presets',
      'filename',
      'formatValue',
      'onExport',
      'onExported',
    ],
    differs: {
      maxLoadedRows: {
        reason: 'Предел загрузки строк есть только у серверной модели',
        adr: 190,
      },
    },
  },
  dataExportModel: {
    same: [
      'enabled',
      'formats',
      'allow',
      'presets',
      'filename',
      'formatValue',
      'onExport',
      'onExported',
    ],
    differs: {
      maxLoadedRows: {
        reason: 'Предел загрузки строк есть только у серверной модели',
        adr: 190,
      },
    },
  },
}

/** Различия поведения без своего аргумента. */
export const BEHAVIOUR_DIFFERENCES: readonly BehaviourDifference[] = [
  {
    name: 'nestFromHandleMenu',
    reason:
      'Вложение в SSRM — в любую сестру-ветку на любой глубине, на клиенте — только с корня',
    adr: 189,
  },
  {
    name: 'exportWithoutServerFlag',
    reason:
      'Без серверной выгрузки в SSRM доступны только `page` и `view` до предела строк',
    adr: 190,
  },
  {
    name: 'optionFilterWithoutOptions',
    reason:
      'Варианты фильтра без `options` собираются из данных только на клиенте',
    adr: 48,
  },
  {
    name: 'rowMotionOnSortAndSearch',
    reason:
      'В SSRM смена выборки заменяет окно: строки едут только при смене списка транзакцией',
    adr: 157,
  },
  {
    name: 'hiddenByFilterCount',
    reason: 'Счётчик «скрыто фильтром» считает строки клиента, в SSRM их нет',
    adr: 45,
  },
  {
    name: 'totalsAutoAndFunctions',
    reason:
      "Агрегаты `'auto'` и функции считают строки, в SSRM итог присылает сервер",
    adr: 184,
  },
  {
    name: 'reorderInsideGroup',
    reason:
      'Перестановка внутри группы есть только в SSRM: на клиенте порядок задают данные',
    adr: 186,
  },
  {
    name: 'moveToGroupMenu',
    reason:
      'Раздел «В группу» меню ручки только на клиенте: в SSRM известны не все группы',
    adr: 186,
  },
  {
    name: 'selectionOnRegroup',
    reason:
      'Смена группировки сбрасывает выбор в SSRM и сохраняет на клиенте: срез из id данных',
    adr: 185,
  },
  {
    name: 'groupCheckboxWithSelfSubRows',
    reason:
      "При `subRows: 'self'` флажка группы нет на клиенте, в SSRM он есть всегда",
    adr: 185,
  },
  {
    name: 'draftOfRowGoneOnRefetch',
    reason:
      'Строку, исчезнувшую при перезапросе, SSRM не отличает от незагруженной: черновик остаётся',
    adr: 178,
  },
]

import {
  backToTop,
  columnTotals,
  failureLog,
  unsavedChanges,
  cellEditing,
  cellErrors,
  valueChangeFlash,
  cellSelection,
  cellSelectionModel,
  contextMenu,
  columnDragging,
  columnFiltering,
  columnFilteringModel,
  columnPinning,
  columnSizing,
  columnSorting,
  columnSortingModel,
  columnVisibility,
  dataExport,
  dataExportModel,
  headerActionMenu,
  infiniteScroll,
  serverRowModel,
  pagination,
  paginationModel,
  quickSearch,
  quickSearchModel,
  rowActionMenu,
  rowActions,
  rowDragging,
  rowExpanding,
  rowGrouping,
  rowGroupingModel,
  rowSelection,
  rowSelectionModel,
  rowExpandingModel,
  treeLines,
  textWrap,
} from '../../../../lib/plugins'

import { rangeHandleArg } from './dataGridControls'
import { rowActionsDemo } from '../plugins/rowActionsDemo/rowActionsDemo'
import {
  asyncContextActionsDemo,
  asyncHeaderActionsDemo,
  asyncRowActionsDemo,
} from '../plugins/asyncActionsDemo/asyncActionsDemo'
import type { CoreOptions } from '../../../core/commonFeature.types'
import {
  nestedContextActionsDemo,
  nestedRowActionsDemo,
} from '../plugins/nestedActionsDemo/nestedActionsDemo'

// Слой демо/тестов: композирует presence-based plugins из аргументов Storybook через
// настоящие фабрики (ADR 0106): тумблер `enable<Фабрика>` → `enabled`, подопции
// `<фабрика><Опция>` → аргументы фабрики, колбэки `on*` — под именами API. Маппер
// живёт здесь (демо), не в ядре.

/** Фабрики в порядке записей грида. */
const FACTORIES = {
  rowSelection,
  rowSelectionModel,
  rowExpanding,
  rowExpandingModel,
  treeLines,
  textWrap,
  rowDragging,
  columnPinning,
  columnSizing,
  columnSorting,
  columnSortingModel,
  columnDragging,
  rowGrouping,
  rowGroupingModel,
  rowActions,
  headerActionMenu,
  rowActionMenu,
  cellEditing,
  cellErrors,
  valueChangeFlash,
  cellSelection,
  cellSelectionModel,
  contextMenu,
  columnVisibility,
  columnFiltering,
  columnFilteringModel,
  quickSearch,
  quickSearchModel,
  dataExport,
  dataExportModel,
  pagination,
  paginationModel,
  infiniteScroll,
  serverRowModel,
  backToTop,
  columnTotals,
  failureLog,
  unsavedChanges,
}

const FACTORY_NAMES = Object.keys(FACTORIES)

type Factories = typeof FACTORIES
type FactoryName = keyof Factories
type OptionsOf<F extends FactoryName> = NonNullable<Parameters<Factories[F]>[0]>
type Callback = `on${string}`

/**
 * Колбэки фабрик, которые наблюдают истории и тесты, — аргументами под своими именами.
 * Остальные бизнес-хуки демо передаёт аргументами `<фабрика><Колбэк>` (StoryComponent).
 */
const CALLBACKS = {
  rowDragging: ['onRowDragEnd', 'onRowDragCancel', 'onRowOrderChange'],
  rowExpanding: ['onExpandedChange'],
  rowExpandingModel: ['onExpandedChange'],
  rowSelection: ['onRowSelectionChange'],
  rowSelectionModel: ['onRowSelectionChange'],
  rowGrouping: ['onGroupingChange'],
  rowGroupingModel: ['onGroupingChange'],
  columnSizing: ['onColumnResizeEnd', 'onColumnResizeCancel'],
  columnDragging: ['onColumnDragEnd', 'onColumnDragCancel'],
  cellEditing: ['onCellEdit', 'onEditCancel', 'onConflict', 'onCommitEdits'],
  columnFiltering: ['onFilterChange'],
  quickSearch: ['onSearchChange'],
  dataExport: ['onExport', 'onExported'],
  infiniteScroll: ['onLoadMore'],
} as const satisfies {
  [F in FactoryName]?: readonly (keyof OptionsOf<F> & Callback)[]
}
type CallbackOwner = keyof typeof CALLBACKS

type UnionToIntersection<U> = (
  U extends unknown ? (value: U) => void : never
) extends (value: infer I) => void
  ? I
  : never

type Toggles = {
  [F in FactoryName as `enable${Capitalize<F>}`]?: boolean
}
type SubOptions = UnionToIntersection<
  {
    [F in FactoryName]: {
      [
        K in Exclude<
          keyof OptionsOf<F> & string,
          'enabled' | Callback
        > as `${F}${Capitalize<K>}`
      ]?: OptionsOf<F>[K]
    }
  }[FactoryName]
>
type Callbacks = UnionToIntersection<
  {
    [F in CallbackOwner]: {
      [
        K in (typeof CALLBACKS)[F][number] & keyof OptionsOf<F>
      ]?: OptionsOf<F>[K]
    }
  }[CallbackOwner]
>

export type FeatureToggles = Toggles &
  SubOptions &
  Callbacks & {
    /**
     * Набор демо-действий строки и контекстного меню — один за раз: `basic` (по
     * умолчанию), `async` (ADR 0078), `nested` (ADR 0079), `none` — без действий.
     * Задаёт история: каждый набор — свой сценарий, в панели Controls его нет.
     */
    actionsDemo?: 'basic' | 'async' | 'nested' | 'none'
  }

/** Тумблеры стендов тестов: плагины и навигация — опция ядра (ADR 0170, §1). */
export type GridToggles = FeatureToggles &
  Pick<CoreOptions, 'enableKeyboardNavigation'>

/** Действия асинхронного демо строки и колонки — одни на все рендеры. */
const ASYNC_SLOT_ACTIONS = [...asyncRowActionsDemo, ...asyncHeaderActionsDemo()]

const capitalize = (name: string) => name[0]!.toUpperCase() + name.slice(1)

/** Аргументы фабрики из аргументов истории: тумблер, подопции по префиксу, колбэки. */
const argsOf = <F extends FactoryName>(
  toggles: FeatureToggles,
  name: F,
): OptionsOf<F> => {
  const source = toggles as Record<string, unknown>
  const args: Record<string, unknown> = {
    enabled: !!source[`enable${capitalize(name)}`],
  }
  // Подопции `rowExpandingModel<Опция>` не принадлежат `rowExpanding`: имя фабрики — префикс другого.
  const longer = FACTORY_NAMES.filter(
    other => other.length > name.length && other.startsWith(name),
  )
  for (const [key, value] of Object.entries(source)) {
    const next = key[name.length]
    if (longer.some(other => key.startsWith(other))) continue
    if (key.startsWith(name) && next !== undefined && /[A-Z]/.test(next)) {
      args[next.toLowerCase() + key.slice(name.length + 1)] = value
    }
  }
  const callbacks: readonly string[] =
    (CALLBACKS as Partial<Record<FactoryName, readonly string[]>>)[name] ?? []
  for (const key of callbacks) {
    args[key] = source[key]
  }
  return args as OptionsOf<F>
}

export const argsToPlugins = (o: FeatureToggles) => {
  return [
    rowSelection(argsOf(o, 'rowSelection')),
    rowSelectionModel(argsOf(o, 'rowSelectionModel')),
    rowExpanding(argsOf(o, 'rowExpanding')),
    rowExpandingModel(argsOf(o, 'rowExpandingModel')),
    treeLines(argsOf(o, 'treeLines')),
    textWrap(argsOf(o, 'textWrap')),
    rowDragging(argsOf(o, 'rowDragging')),
    columnPinning(argsOf(o, 'columnPinning')),
    columnSizing(argsOf(o, 'columnSizing')),
    columnSorting(argsOf(o, 'columnSorting')),
    columnSortingModel(argsOf(o, 'columnSortingModel')),
    columnDragging(argsOf(o, 'columnDragging')),
    rowGrouping(argsOf(o, 'rowGrouping')),
    rowGroupingModel(argsOf(o, 'rowGroupingModel')),
    rowActions(argsOf(o, 'rowActions')),
    headerActionMenu(argsOf(o, 'headerActionMenu')),
    rowActionMenu(argsOf(o, 'rowActionMenu')),
    cellEditing(argsOf(o, 'cellEditing')),
    cellErrors(argsOf(o, 'cellErrors')),
    valueChangeFlash(argsOf(o, 'valueChangeFlash')),
    cellSelection({
      ...argsOf(o, 'cellSelection'),
      handle: rangeHandleArg(o.cellSelectionHandle),
    }),
    cellSelectionModel(argsOf(o, 'cellSelectionModel')),
    contextMenu(argsOf(o, 'contextMenu')),
    columnVisibility(argsOf(o, 'columnVisibility')),
    columnFiltering(argsOf(o, 'columnFiltering')),
    columnFilteringModel(argsOf(o, 'columnFilteringModel')),
    quickSearch(argsOf(o, 'quickSearch')),
    quickSearchModel(argsOf(o, 'quickSearchModel')),
    dataExport(argsOf(o, 'dataExport')),
    dataExportModel(argsOf(o, 'dataExportModel')),
    pagination(argsOf(o, 'pagination')),
    paginationModel(argsOf(o, 'paginationModel')),
    infiniteScroll(argsOf(o, 'infiniteScroll')),
    serverRowModel(argsOf(o, 'serverRowModel')),
    backToTop(argsOf(o, 'backToTop')),
    columnTotals(argsOf(o, 'columnTotals')),
    failureLog(argsOf(o, 'failureLog')),
    unsavedChanges(argsOf(o, 'unsavedChanges')),
    // Демо-производитель действий строки как единые дескрипторы (`RowAction`):
    // инлайн — ряд row-кнопок, при `rowActionMenu` схлопываются в overflow-кебаб.
    {
      id: 'rowActionsDemo',
      enabled: (o.actionsDemo ?? 'basic') === 'basic',
      slotActions: rowActionsDemo,
    },
    // Асинхронные действия (ADR 0078): проверка доступности и долгое действие.
    {
      id: 'asyncActionsDemo',
      enabled: o.actionsDemo === 'async',
      slotActions: ASYNC_SLOT_ACTIONS,
      contextMenuActions: asyncContextActionsDemo,
    },
    // Вложенные разделы меню (ADR 0079).
    {
      id: 'nestedActionsDemo',
      enabled: o.actionsDemo === 'nested',
      slotActions: nestedRowActionsDemo,
      contextMenuActions: nestedContextActionsDemo,
    },
  ] as const
}

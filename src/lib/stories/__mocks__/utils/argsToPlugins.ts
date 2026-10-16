import {
  backToTop,
  cellEditing,
  cellSelection,
  contextMenu,
  keyboardNavigation,
  columnDragging,
  columnFiltering,
  columnPinning,
  columnSizing,
  columnSorting,
  columnSortingModel,
  columnVisibility,
  dataExport,
  headerActionMenu,
  infiniteScroll,
  pagination,
  quickSearch,
  rowActionMenu,
  rowActions,
  rowDragging,
  rowExpanding,
  rowGrouping,
  rowSelection,
  rowExpandingModel,
  treeLines,
} from '../../../../lib/plugins'

import { rowActionsDemo } from '../plugins/rowActionsDemo/rowActionsDemo'
import {
  asyncContextActionsDemo,
  asyncRowActionsDemo,
} from '../plugins/asyncActionsDemo/asyncActionsDemo'
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
  rowExpanding,
  rowExpandingModel,
  treeLines,
  rowDragging,
  columnPinning,
  columnSizing,
  columnSorting,
  columnSortingModel,
  columnDragging,
  rowGrouping,
  rowActions,
  headerActionMenu,
  rowActionMenu,
  cellEditing,
  cellSelection,
  contextMenu,
  keyboardNavigation,
  columnVisibility,
  columnFiltering,
  quickSearch,
  dataExport,
  pagination,
  infiniteScroll,
  backToTop,
}

const FACTORY_NAMES = Object.keys(FACTORIES)

type Factories = typeof FACTORIES
type FactoryName = keyof Factories
type OptionsOf<F extends FactoryName> = NonNullable<Parameters<Factories[F]>[0]>
type Callback = `on${string}`

/**
 * Колбэки фабрик, которые наблюдают истории и тесты. Остальные бизнес-хуки демо
 * кладёт в hook-слайс записи `demoHooks` (StoryComponent).
 */
const CALLBACKS = {
  rowDragging: ['onRowDragEnd', 'onRowDragCancel'],
  columnSizing: ['onColumnResizeEnd', 'onColumnResizeCancel'],
  columnDragging: ['onColumnDragEnd', 'onColumnDragCancel'],
  cellEditing: ['onCellEdit', 'onEditCancel', 'onConflict'],
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
    rowExpanding(argsOf(o, 'rowExpanding')),
    rowExpandingModel(argsOf(o, 'rowExpandingModel')),
    treeLines(argsOf(o, 'treeLines')),
    rowDragging(argsOf(o, 'rowDragging')),
    columnPinning(argsOf(o, 'columnPinning')),
    columnSizing(argsOf(o, 'columnSizing')),
    columnSorting(argsOf(o, 'columnSorting')),
    columnSortingModel(argsOf(o, 'columnSortingModel')),
    columnDragging(argsOf(o, 'columnDragging')),
    rowGrouping(argsOf(o, 'rowGrouping')),
    rowActions(argsOf(o, 'rowActions')),
    headerActionMenu(argsOf(o, 'headerActionMenu')),
    rowActionMenu(argsOf(o, 'rowActionMenu')),
    cellEditing(argsOf(o, 'cellEditing')),
    cellSelection(argsOf(o, 'cellSelection')),
    contextMenu(argsOf(o, 'contextMenu')),
    keyboardNavigation(argsOf(o, 'keyboardNavigation')),
    columnVisibility(argsOf(o, 'columnVisibility')),
    columnFiltering(argsOf(o, 'columnFiltering')),
    quickSearch(argsOf(o, 'quickSearch')),
    dataExport(argsOf(o, 'dataExport')),
    pagination(argsOf(o, 'pagination')),
    infiniteScroll(argsOf(o, 'infiniteScroll')),
    backToTop(argsOf(o, 'backToTop')),
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
      slotActions: asyncRowActionsDemo,
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

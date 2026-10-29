/**
 * Машинерия действий слота: сборка (`createEmptySlotActions`/
 * `registerSlotActionInto`) и чистые резолверы раскладки (`resolveActionLayout`)
 * и пунктов меню (`resolveMenuItems`).
 */
import type { TableLabels } from '../../core/localization'
import type {
  HeaderMenuItem,
  MenuAction,
  SlotAction,
  SlotActions,
  SlotMenuConfig,
} from './types'
import { readSyncDisabled } from './actionStatus'

export * from './actionStatus'
export * from './menuSections'
export {
  actionStatusFeature,
  type ActionStatus,
  type ActionStatusEntry,
} from './actionStatusFeature'

export type {
  SlotName,
  HeaderActionSlot,
  MenuAction,
  SlotAction,
  HeaderAction,
  RowAction,
  HeaderMenuItem,
  SlotActions,
  SlotMenuConfig,
  SlotActionMenu,
  ActionMenuDeclaration,
  ContextMenuAction,
  ContextMenuContext,
  CellSelectionSummary,
  ActionPanelControls,
  DisabledResult,
  DisabledState,
  MenuSection,
} from './types'

const noop = () => {}

/** Начинает загрузку содержимого панели действия; ошибку загрузки глотает. */
export const preloadActionPanel = (action: SlotAction, ctx: unknown) => {
  void action.preload?.(ctx).catch(noop)
}

/** Пустой набор действий по всем слотам — база для реактивной свёртки плагинов. */
export const createEmptySlotActions = (): SlotActions => ({
  leftHeaderSlot: [],
  rightHeaderSlot: [],
  leftCellSlot: [],
  rightCellSlot: [],
  actionRowSlot: [],
})

/**
 * Регистрирует действие в переданный `SlotActions` (чистая операция).
 * Дедуплицирует по `id` в пределах слота; вставляет по `order` или в конец.
 */
export const registerSlotActionInto = (
  actions: SlotActions,
  action: SlotAction,
) => {
  const current = actions[action.slot]

  const existingIndex = current.findIndex(entry => entry.id === action.id)

  if (existingIndex !== -1) {
    current[existingIndex] = action

    return
  }

  if (action.order === undefined || action.order === 'last') {
    current.push(action)
  } else {
    current.splice(action.order, 0, action)
  }
}

export interface ResolveActionLayoutParams {
  /** Дескрипторы действий этого слота. */
  actions: SlotAction[]
  /** Число опаковых слот-компонентов (не умеют в кебаб, но учтены в пороге). */
  opaqueCount: number
  /** Конфиг кебаба ЭТОГО слота; `undefined` — кебаб выключен. */
  config: SlotMenuConfig | undefined
  /** Контекст слота (заголовок/ячейка) — прозрачно передаётся в признаки. */
  ctx: unknown
  /**
   * Сколько кнопок помещается в ряд (ADR 0111): лишние сворачиваемые уходят в кебаб
   * с конца. `undefined` — ширина не ограничивает.
   */
  capacity?: number
  /**
   * Id включённых действий для раскладки (ADR 0156): они уходят в кебаб последними.
   * `undefined` — по `active(ctx)` действия.
   */
  active?: ReadonlySet<string>
}

export interface ActionLayout {
  /** Схлопнут ли слот в кебаб. */
  collapsed: boolean
  /** Действия инлайн иконками-кнопками. */
  inline: SlotAction[]
  /** Действия строками меню кебаба. */
  menu: SlotAction[]
}

const sortByOrder = <A extends { order?: number | 'last' }>(
  actions: A[],
): A[] => {
  const toRank = (order: A['order']): number =>
    typeof order === 'number' ? order : Number.POSITIVE_INFINITY

  return actions
    .map((action, index) => ({ action, index }))
    .sort(
      (a, b) =>
        toRank(a.action.order) - toRank(b.action.order) || a.index - b.index,
    )
    .map(entry => entry.action)
}

/**
 * Применимые действия меню в контексте, отсортированные по `order`. Общий резолвер
 * для поверхностей без схлопывания (контекстное меню, ADR 0030): фильтр `visible` +
 * порядок. `resolveActionLayout` — для слотов с кебабом.
 */
export const resolveVisibleActions = <TCtx, A extends MenuAction<TCtx>>(
  actions: A[],
  ctx: TCtx,
): A[] => sortByOrder(actions.filter(action => action.visible?.(ctx) !== false))

/**
 * Сколько кнопок шириной `button` с зазором `gap` помещается в `width`, если
 * `reserve` занято отступами и наименьшей подписью (ADR 0111).
 */
export const buttonCapacity = ({
  width,
  reserve,
  button,
  gap,
}: {
  width: number
  reserve: number
  button: number
  gap: number
}): number => Math.max(0, Math.floor((width - reserve + gap) / (button + gap)))

/**
 * Чистое решение раскладки действий слота. Порог уводит в кебаб невключённые
 * сворачиваемые (`mode: 'always'` — все), вместимость ряда (`capacity`) — ещё и не
 * поместившиеся: сначала невключённые, затем включённые, с конца по `order`; кебаб
 * занимает одно место (ADR 0156). Опаковые компоненты кебаб схлопнуть не может (учтены
 * в пороге и в ряду).
 */
export const resolveActionLayout = ({
  actions,
  opaqueCount,
  config,
  ctx,
  capacity,
  active,
}: ResolveActionLayoutParams): ActionLayout => {
  const applicable = sortByOrder(
    actions.filter(action => action.visible?.(ctx) !== false),
  )
  // `placement: 'menu'` не бывает инлайн (ADR 0035, AM22–AM23); кебаб, который оно
  // вызывает, сам занимает место в ряду и считается в пороге как одна кнопка.
  const menuOnly = applicable.filter(action => action.placement === 'menu')
  const regular = applicable.filter(action => action.placement !== 'menu')

  if (!config) {
    return { collapsed: false, inline: regular, menu: [] }
  }

  const isActive = (action: SlotAction) =>
    active ? active.has(action.id) : action.active?.(ctx) === true
  const total = regular.length + opaqueCount + (menuOnly.length > 0 ? 1 : 0)
  const all = regular.filter(action => action.collapsible !== false)
  const collapsible =
    config.mode === 'always'
      ? all
      : overflowOf(
          regular,
          total >= config.threshold
            ? all.filter(action => !isActive(action))
            : [],
          opaqueCount,
          menuOnly.length > 0,
          capacity,
          isActive,
        )

  if (collapsible.length === 0 && menuOnly.length === 0) {
    return { collapsed: false, inline: regular, menu: [] }
  }

  const inMenu = new Set([...collapsible, ...menuOnly])
  return {
    collapsed: true,
    inline: regular.filter(action => !inMenu.has(action)),
    menu: applicable.filter(action => inMenu.has(action)),
  }
}

/**
 * Свёрнутые порогом (`folded`) и сворачиваемые, которым нет места в ряду из
 * `capacity` кнопок: сначала невключённые, затем включённые, с конца по `order`;
 * появившийся кебаб занимает одно место.
 */
const overflowOf = (
  regular: SlotAction[],
  folded: SlotAction[],
  opaqueCount: number,
  hasMenu: boolean,
  capacity: number | undefined,
  isActive: (action: SlotAction) => boolean,
): SlotAction[] => {
  const left = regular.filter(action => !folded.includes(action))
  const withMenu = hasMenu || folded.length > 0
  if (
    capacity === undefined ||
    left.length + opaqueCount + (withMenu ? 1 : 0) <= capacity
  ) {
    return folded
  }
  const collapsible = left.filter(action => action.collapsible !== false)
  const fixed = left.length - collapsible.length + opaqueCount + 1
  const extra = collapsible.length - Math.max(0, capacity - fixed)
  const byEviction = [
    ...collapsible.filter(action => !isActive(action)).reverse(),
    ...collapsible.filter(isActive).reverse(),
  ]
  return [...folded, ...byEviction.slice(0, extra)]
}

/** Сколько применимых действий включено (`active`) — знак на кебабе (ADR 0062). */
export const countActiveActions = (
  actions: MenuAction[],
  context: unknown,
): number =>
  actions.filter(
    action =>
      action.visible?.(context) !== false && action.active?.(context) === true,
  ).length

/**
 * Пункты подгруппы одного действия для меню: либо разворот `menuItems`, либо одна
 * строка из полей дескриптора. Чистая: поля уже вычислены с учётом `ctx`/`labels`.
 */
export const resolveMenuItems = (
  action: MenuAction,
  context: unknown,
  labels: TableLabels,
): HeaderMenuItem[] => {
  if (action.menuItems) {
    return action.menuItems(context, labels)
  }

  return [
    {
      id: action.id,
      label: action.label(context, labels),
      icon: action.icon(context),
      onSelect: () => action.onSelect(context),
      disabled: readSyncDisabled(action, context) !== false,
      active: action.active?.(context) ?? false,
    },
  ]
}

/** Подгруппа меню для правила разделителей: сколько пунктов и есть ли подпись. */
export interface MenuGroupShape {
  items: number
  labeled: boolean
}

/**
 * Разделитель перед подгруппой (ADR 0024): только если она или предыдущая составная —
 * несколько пунктов или подпись. Подряд идущие одиночные действия — один список.
 */
export const menuDividers = (groups: MenuGroupShape[]): boolean[] => {
  const compound = (group: MenuGroupShape) => group.items > 1 || group.labeled
  return groups.map(
    (group, index) =>
      index > 0 && (compound(group) || compound(groups[index - 1]!)),
  )
}

/** Подгруппы меню действий: пункты, подпись и разделитель перед каждой. */
export const menuGroups = <A extends MenuAction>(
  actions: A[],
  context: unknown,
  labels: TableLabels,
) => {
  const groups = actions.map(action => ({
    action,
    items: resolveMenuItems(action, context, labels),
    groupLabel: action.menuGroupLabel?.(labels),
  }))
  const divided = menuDividers(
    groups.map(group => ({
      items: group.items.length,
      labeled: !!group.groupLabel,
    })),
  )
  return groups.map((group, index) => ({ ...group, divided: divided[index]! }))
}

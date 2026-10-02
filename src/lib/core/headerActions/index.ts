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
} from './types'

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
 * Чистое решение раскладки действий слота (all-or-nothing). Применимые действия
 * либо все инлайн, либо схлопнутые в кебаб. Опаковые компоненты кебаб схлопнуть
 * не может (учтены лишь в счётчике порога). Контекст-агностична.
 */
export const resolveActionLayout = ({
  actions,
  opaqueCount,
  config,
  ctx,
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

  const total = regular.length + opaqueCount + (menuOnly.length > 0 ? 1 : 0)
  const shouldCollapse = config.mode === 'always' || total >= config.threshold
  const collapsible = shouldCollapse
    ? regular.filter(action => action.collapsible !== false)
    : []

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
      disabled: action.disabled?.(context) ?? false,
      active: action.active?.(context) ?? false,
    },
  ]
}

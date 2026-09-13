/**
 * Фаза C — порт машинерии действий слота: сборка (`createEmptySlotActions`/
 * `registerSlotActionInto`) и чистые резолверы раскладки (`resolveActionLayout`)
 * и пунктов меню (`resolveMenuItems`). Логика идентична v8-версии
 * ([src/lib/core/headerActions]) — здесь только типы стали v9-контекстными.
 */
import type { TableLabels } from '../../../lib/core/localization'
import type {
  HeaderMenuItem,
  SlotAction,
  SlotActions,
  SlotMenuConfig,
} from './types'

export type {
  SlotName,
  HeaderActionSlot,
  SlotAction,
  HeaderAction,
  RowAction,
  HeaderMenuItem,
  SlotActions,
  SlotMenuConfig,
  SlotActionMenu,
  ActionMenuDeclaration,
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

const sortByOrder = (actions: SlotAction[]): SlotAction[] => {
  const toRank = (order: SlotAction['order']): number =>
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

  if (!config) {
    return { collapsed: false, inline: applicable, menu: [] }
  }

  const total = applicable.length + opaqueCount
  const shouldCollapse = config.mode === 'always' || total >= config.threshold

  if (!shouldCollapse) {
    return { collapsed: false, inline: applicable, menu: [] }
  }

  const menu = applicable.filter(action => action.collapsible !== false)
  const inline = applicable.filter(action => action.collapsible === false)

  if (menu.length === 0) {
    return { collapsed: false, inline: applicable, menu: [] }
  }

  return { collapsed: true, inline, menu }
}

/**
 * Пункты подгруппы одного действия для меню: либо разворот `menuItems`, либо одна
 * строка из полей дескриптора. Чистая: поля уже вычислены с учётом `ctx`/`labels`.
 */
export const resolveMenuItems = (
  action: SlotAction,
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

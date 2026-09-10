import { SlotAction, SlotMenuConfig } from './types'

export interface ResolveActionLayoutParams {
  /** Дескрипторы действий этого слота. */
  actions: SlotAction[]
  /**
   * Число опаковых слот-компонентов (императивные/ещё не мигрированные плагины) в
   * этом слоте. Они не умеют уезжать в кебаб, но учитываются в пороге, т.к.
   * занимают место в ряду кнопок.
   */
  opaqueCount: number
  /** Конфиг кебаба ЭТОГО слота; `undefined` — кебаб для слота выключен. */
  config: SlotMenuConfig | undefined
  /** Контекст слота (заголовок/ячейка) — прозрачно передаётся в признаки действия. */
  ctx: unknown
}

export interface ActionLayout {
  /** Схлопнут ли слот в кебаб. */
  collapsed: boolean
  /** Действия, отрисованные инлайн иконками-кнопками. */
  inline: SlotAction[]
  /** Действия, отрисованные строками меню кебаба. */
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
 * (`visible(ctx) !== false`) либо все инлайн, либо схлопнутые — в кебаб. Опаковые
 * компоненты кебаб схлопнуть не может, поэтому они всегда остаются инлайн (учтены
 * лишь в счётчике порога через `opaqueCount`). Контекст-агностична: одинаково
 * работает для заголовков и строк/ячеек.
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

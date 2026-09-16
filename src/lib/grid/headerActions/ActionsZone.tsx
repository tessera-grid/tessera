/**
 * Cutover (grid) — v9-порт ActionsZone: единая зона отрисовки действий слота.
 * Сводит опаковые слот-компоненты и дескрипторы, спрашивает у ядра решение о
 * схлопывании (resolveActionLayout) и рисует инлайн-кнопки + (при схлопывании)
 * триггер кебаба.
 *
 * Отличия от v8:
 *  - реактивность: подписка на состояние через useTableState (в v8 — на ключи
 *    subscribe дескрипторов, которых в v9 нет). Пока подписка широкая (весь state)
 *    — TODO(Phase D): сузить до срезов, читаемых дескрипторами слота;
 *  - Base UI кебаб-попап (ActionMenu/ActionInlineMenu из menuItems) портируется на
 *    cutover в браузере; здесь при collapsed рисуется триггер-заглушка кебаба.
 */
import { Fragment, type ReactNode, memo } from 'react'

import { RenderSlot } from '../../core/renderSlots'
import type { RegisterSlotParams } from '../../core/createSlots'
import { resolveActionLayout, type SlotAction, type SlotName } from '../../core/headerActions'
import { useTableState } from '../../core/reactivity'
import { ActionButton } from './ActionButton'
import { ActionInlineMenu, ActionMenu } from './ActionMenu.lazy'

interface ActionsZoneProps {
  slot: SlotName
  opaqueSlot?: RegisterSlotParams<any>[]
  context: { table: any } & Record<string, any>
}

type OrderRank = number | 'last' | undefined
interface ZoneItem {
  rank: OrderRank
  key: string
  node: ReactNode
}

const toRank = (rank: OrderRank): number =>
  typeof rank === 'number' ? rank : Number.POSITIVE_INFINITY
const byRank = (a: ZoneItem, b: ZoneItem): number => toRank(a.rank) - toRank(b.rank)

export const ActionsZone = memo(({ slot, opaqueSlot, context }: ActionsZoneProps) => {
  const { table } = context

  // Реактивность: перечитываем при любой смене состояния (TODO Phase D: сузить).
  useTableState(table, state => state)

  const descriptors: SlotAction[] = table.getSlotActions()?.[slot] ?? []
  const opaque = opaqueSlot ?? []
  const opaqueCount = opaque.filter(entry => entry.countsAsHeaderAction !== false).length

  const { collapsed, inline, menu } = resolveActionLayout({
    actions: descriptors,
    opaqueCount,
    config: table.options.actionMenu?.[slot],
    ctx: context,
  })

  const variant = slot === 'actionRowSlot' ? 'row' : 'cell'

  const opaqueItems: ZoneItem[] = opaque.map(entry => ({
    rank: entry.order,
    key: `opaque-${entry.id}`,
    node: <RenderSlot slot={[entry]} context={context} />,
  }))

  // Инлайн-действие с inlineAsMenu(ctx) подаётся мини-меню (поповер) вместо кнопки-
  // тумблера — когда клик неоднозначен (напр. закрепление при обеих сторонах).
  const inlineItems: ZoneItem[] = inline.map(action => ({
    rank: action.order,
    key: `action-${action.id}`,
    node: action.inlineAsMenu?.(context) ? (
      <ActionInlineMenu action={action} context={context} variant={variant} />
    ) : (
      <ActionButton action={action} context={context} variant={variant} />
    ),
  }))

  const orderedInline = [...opaqueItems, ...inlineItems].sort(byRank)

  return (
    <>
      {orderedInline.map(item => (
        <Fragment key={item.key}>{item.node}</Fragment>
      ))}
      {collapsed && menu.length > 0 && (
        <ActionMenu actions={menu} context={context} variant={variant} />
      )}
    </>
  )
})

ActionsZone.displayName = 'ActionsZone'

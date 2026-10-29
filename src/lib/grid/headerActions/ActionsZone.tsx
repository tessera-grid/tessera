/**
 * ActionsZone: единая зона отрисовки действий слота. Сводит опаковые
 * слот-компоненты и дескрипторы, спрашивает у ядра решение о схлопывании
 * (resolveActionLayout) и рисует инлайн-кнопки + (при схлопывании) триггер кебаба.
 * Реактивность — подписка на ключ вида зоны (`zoneViewKey`): смена состояния, не
 * меняющая её кнопки и кебаб, зону не перерисовывает (ADR 0099, PF5).
 */
import { Fragment, type ReactNode, memo, useContext } from 'react'

import { RenderSlot } from '../../core/renderSlots'
import type { RegisterSlotParams } from '../../core/createSlots'
import {
  resolveActionLayout,
  type SlotAction,
  type SlotName,
} from '../../core/headerActions'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { ActionButton } from './ActionButton'
import { ActionInlineMenu, ActionMenu, ActionPanel } from './ActionMenu.lazy'
import { HeaderMetricsContext, headerCapacityOf } from './headerCapacity'
import { ActionsHostContext, useHeldActive } from './useHeldActive'
import { zoneViewKey } from './zoneViewKey'

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
const byRank = (a: ZoneItem, b: ZoneItem): number =>
  toRank(a.rank) - toRank(b.rank)

export const ActionsZone = memo(
  ({ slot, opaqueSlot, context }: ActionsZoneProps) => {
    const { table } = context
    const labels = useLocalization()

    const descriptors: SlotAction[] = table.getSlotActions()?.[slot] ?? []
    const opaque = opaqueSlot ?? []
    const opaqueCount = opaque.filter(
      entry => entry.countsAsHeaderAction !== false,
    ).length

    // Кнопки справа в заголовке не шире колонки (ADR 0111).
    const metrics = useContext(HeaderMetricsContext)
    const capacityOf = () =>
      slot === 'rightHeaderSlot'
        ? headerCapacityOf(context.header, metrics)
        : undefined

    // Включённые уходят в кебаб последними; смену включённости ряд принимает, когда
    // заголовок не тронут (ADR 0156).
    const liveActive = useTableState(table, () =>
      descriptors
        .filter(action => action.active?.(context) === true)
        .map(action => action.id)
        .sort()
        .join(','),
    )
    const heldActive = useHeldActive(liveActive, useContext(ActionsHostContext))
    const active = new Set(heldActive ? heldActive.split(',') : [])

    useTableState(table, () =>
      zoneViewKey({
        actions: descriptors,
        opaqueCount,
        config: table.options.actionMenu?.[slot],
        ctx: context,
        labels,
        capacity: capacityOf(),
        active,
      }),
    )

    const { collapsed, inline, menu } = resolveActionLayout({
      actions: descriptors,
      opaqueCount,
      config: table.options.actionMenu?.[slot],
      ctx: context,
      capacity: capacityOf(),
      active,
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
      node: action.panel ? (
        <ActionPanel action={action} context={context} variant={variant} />
      ) : action.inlineAsMenu?.(context) || action.submenu ? (
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
  },
)

ActionsZone.displayName = 'ActionsZone'

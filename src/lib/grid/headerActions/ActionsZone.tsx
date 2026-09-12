import { Fragment, ReactNode, memo } from 'react'

import { Table } from '@tanstack/react-table'

import { RegisterSlotParams } from '../../core/createSlots'
import {
  SlotAction,
  SlotName,
  resolveActionLayout,
} from '../../core/headerActions'
import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { ActionButton } from './ActionButton'
import { ActionInlineMenu } from './ActionInlineMenu'
import { ActionMenu } from './ActionMenu'

interface ActionsZoneProps {
  slot: SlotName
  /** Опаковые слот-компоненты этого слота (императивные/немигрированные плагины). */
  opaqueSlot?: RegisterSlotParams<any>[]
  /** Контекст слота (заголовок/ячейка) — несёт `table` и прокидывается в действия. */
  context: { table: Table<any> } & Record<string, any>
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

const renderOpaque = (
  entry: RegisterSlotParams<any>,
  context: any,
): ReactNode => {
  const Component = entry.component

  if (Component) {
    return <Component {...context} />
  }

  return typeof entry.render === 'function'
    ? entry.render(context)
    : entry.render
}

/**
 * Зона действий слота: единая точка отрисовки кнопок в слоте (шапка/ячейка/строка
 * действий). Сводит опаковые слот-компоненты и декларативные действия-дескрипторы,
 * спрашивает у ядра решение о схлопывании (`resolveActionLayout`) и рисует либо всё
 * инлайн, либо кебаб-меню + оставшиеся инлайн-кнопки. Опаковые компоненты кебаб
 * схлопнуть не может — они всегда инлайн (учтены лишь в пороге). Порядок инлайн-
 * элементов — общий по `order`, поэтому смена подачи не перетасовывает кнопки.
 * Контекст-агностична: одинаково работает для заголовков и строк/ячеек.
 */
export const ActionsZone = memo(
  ({ slot, opaqueSlot, context }: ActionsZoneProps) => {
    const descriptors: SlotAction[] = context.table.getSlotActions()[slot]

    // Подписка включает и конфиг кебаба этого слота (`actionMenu[slot]`), а не
    // только ключи действий: при live-переключении плагина-меню меняется лишь
    // опция таблицы, и без этого зона не перечитала бы решение о схлопывании до
    // полной перерисовки. Читаем конфиг ВНУТРИ снапшота — берём актуальные опции.
    useSubscribeStore(() => {
      const current = context.table.options.actionMenu?.[slot]

      return [
        !!current,
        current?.mode,
        current?.threshold,
        ...descriptors.flatMap(action => action.subscribe?.(context) ?? []),
      ]
    })

    const opaque = opaqueSlot ?? []

    // Аффордансы (resize-грип) помечены `countsAsHeaderAction: false` — рисуются
    // инлайн, но не занимают место в счётчике порога, чтобы не вызывать ложное
    // схлопывание «кнопок ещё нет, а порог достигнут грипом».
    const opaqueCount = opaque.filter(
      entry => entry.countsAsHeaderAction !== false,
    ).length

    const { collapsed, inline, menu } = resolveActionLayout({
      actions: descriptors,
      opaqueCount,
      config: context.table.options.actionMenu?.[slot],
      ctx: context,
    })

    const opaqueItems: ZoneItem[] = opaque.map(entry => ({
      rank: entry.order,
      key: `opaque-${entry.id}`,
      node: renderOpaque(entry, context),
    }))

    // Действия строки (`actionRowSlot`) ревилятся по hover СТРОКИ (`row__button`),
    // остальные — по hover ячейки/заголовка (`cell__button`).
    const variant = slot === 'actionRowSlot' ? 'row' : 'cell'

    // Инлайн-действие с `inlineAsMenu(ctx)` подаётся мини-меню (поповер) вместо
    // кнопки-тумблера — когда клик неоднозначен и нужен выбор варианта (напр.
    // закрепление при обеих доступных сторонах). Иначе — обычная кнопка.
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
  },
)

ActionsZone.displayName = 'ActionsZone'

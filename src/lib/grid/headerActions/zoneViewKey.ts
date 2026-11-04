/**
 * Ключ вида зоны действий (ADR 0099, PF5): раскладка и всё, что рисуют её кнопки и
 * кебаб, — строкой. Зона подписана на ключ, а не на всё состояние: смена, которая не
 * меняет вид, зону не перерисовывает. Открытое меню подписано на состояние само.
 */
import { isValidElement } from 'react'

import type { TableLabels } from '../../core/localization'
import {
  readSyncDisabled,
  resolveActionLayout,
  type SlotAction,
  type SlotMenuConfig,
} from '../../core/headerActions'
import { menuActionLabel } from '../../core/actions'

/** Номер типа компонента: два разных компонента с одним именем различаются. */
const typeIds = new WeakMap<object, number>()
let lastTypeId = 0

const typeKey = (type: unknown) => {
  if (typeof type === 'string') return type
  if (type === null || (typeof type !== 'object' && typeof type !== 'function'))
    return String(type)
  let id = typeIds.get(type)
  if (id === undefined) {
    id = ++lastTypeId
    typeIds.set(type, id)
  }
  return `#${id}`
}

/** Вид значения без функций: элементы React — тип, ключ и пропсы. */
const viewOf = (value: unknown, depth = 0): unknown => {
  if (depth > 12) return '…'
  if (value === undefined || typeof value === 'function') return null
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(item => viewOf(item, depth + 1))
  if (isValidElement(value)) {
    return [typeKey(value.type), value.key, viewOf(value.props, depth + 1)]
  }
  return Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    viewOf(item, depth + 1),
  ])
}

/** Инлайн-кнопка: всё, что она рисует. */
const inlineView = (action: SlotAction, ctx: unknown, labels: TableLabels) => {
  if (action.visible?.(ctx) === false) return [action.id, false]
  return [
    action.id,
    action.active?.(ctx) ?? null,
    menuActionLabel(action, ctx, labels),
    action.ariaLabel?.(ctx, labels) ?? null,
    action.hint?.(ctx, labels) ?? null,
    action.className?.(ctx) ?? null,
    action.inlineAsMenu?.(ctx) ?? null,
    viewOf(readSyncDisabled(action, ctx)),
    viewOf(action.icon(ctx)),
    action.count?.(ctx) ?? null,
    viewOf(action.menuItems?.(ctx, labels)),
  ]
}

/**
 * Пункт свёрнутого кебаба: на кнопке видны только включённые действия и их имена.
 * Блокировку пункта не спрашиваем — асинхронная проверка начинается с первого вызова
 * `disabled` (ADR 0078), а пункты открытого меню перечитывает само меню.
 */
const menuView = (action: SlotAction, ctx: unknown, labels: TableLabels) =>
  action.visible?.(ctx) === false
    ? [action.id, false]
    : [
        action.id,
        action.active?.(ctx) ?? null,
        menuActionLabel(action, ctx, labels),
      ]

export const zoneViewKey = ({
  actions,
  opaqueCount,
  config,
  ctx,
  labels,
  capacity,
  active,
}: {
  actions: SlotAction[]
  opaqueCount: number
  config: SlotMenuConfig | undefined
  ctx: unknown
  labels: TableLabels
  capacity?: number
  active?: ReadonlySet<string>
}) => {
  const { collapsed, inline, menu } = resolveActionLayout({
    actions,
    opaqueCount,
    config,
    ctx: ctx as never,
    capacity,
    active,
  })
  return JSON.stringify([
    collapsed,
    inline.map(action => inlineView(action, ctx, labels)),
    menu.map(action => menuView(action, ctx, labels)),
  ])
}

/**
 * Отмена идущего действия (ADR 0039, §5; ADR 0040, §1): пользователем (Escape),
 * запретом на лету или исчезновением цели. Причина доходит до колбэка отмены
 * плагина.
 */

import { readPluginHooks } from './definePlugin/channels'

/** Why a session ended without a result (ADR 0040, §1). */
export type SessionCancelReason = 'cancel' | 'revoke' | 'unavailable'

type HooksTable = { getHooks: () => unknown; atoms: object }

const sessionHooks = new WeakMap<object, Map<string, unknown>>()

/**
 * Запомнить хуки плагина на начало сессии: выключенный посреди неё плагин свой
 * слайс уже не отдаёт, а отмена с `revoke` должна дойти до приложения.
 */
export const holdSessionHooks = (table: HooksTable, scope: string) => {
  const held = sessionHooks.get(table.atoms) ?? new Map<string, unknown>()
  held.set(scope, readPluginHooks(table, scope))
  sessionHooks.set(table.atoms, held)
}

/** Хуки, запомненные на начало сессии, — и забыть их: сессия кончилась. */
export const releaseSessionHooks = <THooks>(
  table: HooksTable,
  scope: string,
): THooks => {
  const held = sessionHooks.get(table.atoms)
  const hooks = held?.get(scope)
  held?.delete(scope)
  return (hooks ?? readPluginHooks(table, scope)) as THooks
}

let pendingDragCancel: SessionCancelReason | null = null

/**
 * Перетаскивание dnd-kit: указательные сенсоры отменяют его по Escape на document,
 * `onDragCancel` зовётся синхронно — причина читается в нём через `takeDragCancelReason`.
 */
export const cancelDragLikeEscape = (reason: SessionCancelReason) => {
  pendingDragCancel = reason
  try {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
      }),
    )
  } finally {
    pendingDragCancel = null
  }
}

/** Причина отмены перетаскивания: настоящий Escape пользователя — `cancel`. */
export const takeDragCancelReason = (): SessionCancelReason =>
  pendingDragCancel ?? 'cancel'

/** Метка события отмены ресайза; значение — причина. */
const RESIZE_CANCEL = Symbol('tessera.resizeCancel')

/** Причина, если событие конца ресайза — отмена; иначе `undefined`. */
export const resizeCancelReason = (
  event: unknown,
): SessionCancelReason | undefined =>
  (event as Record<symbol, SessionCancelReason> | undefined)?.[RESIZE_CANCEL]

interface ResizeTable {
  atoms: {
    columnResizing?: {
      get: () =>
        | {
            columnSizingStart?: [string, number][]
            startOffset?: number | null
          }
        | undefined
    }
  }
  setColumnSizing: (
    updater: (old: Record<string, number>) => Record<string, number>,
  ) => void
}

/**
 * Ресайз колонки: завершить протяжку помеченным событием (TanStack снимает свои
 * слушатели документа) и вернуть ширины, с которых она началась.
 */
export const cancelColumnResize = (
  table: unknown,
  reason: SessionCancelReason,
) => {
  const t = table as ResizeTable
  const info = t.atoms.columnResizing?.get()
  const start = info?.columnSizingStart ?? []
  // clientX — точка начала протяжки: TanStack завершает её с нулевым смещением.
  const events = [
    new MouseEvent('mouseup', {
      bubbles: true,
      clientX: info?.startOffset ?? 0,
    }),
    new Event('touchend', { bubbles: true }),
  ]
  for (const event of events) {
    Object.defineProperty(event, RESIZE_CANCEL, { value: reason })
    document.dispatchEvent(event)
  }
  if (start.length) {
    t.setColumnSizing(old => ({ ...old, ...Object.fromEntries(start) }))
  }
}

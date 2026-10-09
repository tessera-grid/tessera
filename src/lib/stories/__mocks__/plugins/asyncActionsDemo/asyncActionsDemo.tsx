import { Archive, RefreshCw, Share2, Trash2 } from 'lucide-react'

import type {
  ContextMenuAction,
  DisabledResult,
  RowAction,
} from '../../../../../lib/core/headerActions'

// Демо асинхронных действий (ADR 0078): доступность решает «сервер», действие идёт
// долго и иногда отклоняется. Итог зависит от номера строки — видно все состояния.

export const ASYNC_DEMO_DELAY_MS = 1200

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

const indexOf = (ctx: { row: { index: number } }) => ctx.row.index

/**
 * Ответ «сервера» о доступности по номеру строки: 0 — уже сделано, 1 — нет прав,
 * 2 — проверка падает в первый раз (повторная разрешает), 3 — доступно.
 */
const availability = (done: string, forbidden: string) => {
  const failedOnce = new Set<number>()
  return async (
    ctx: { row: { index: number } },
    signal: AbortSignal,
  ): Promise<DisabledResult> => {
    await wait(ASYNC_DEMO_DELAY_MS, signal)
    const index = indexOf(ctx)
    switch (index % 4) {
      case 0:
        return { kind: 'done', reason: done }
      case 1:
        return { kind: 'forbidden', reason: forbidden }
      case 2:
        if (!failedOnce.has(index)) {
          failedOnce.add(index)
          throw new Error('Permission service is down')
        }
        return false
      default:
        return false
    }
  }
}

export const asyncRowActionsDemo: RowAction[] = [
  {
    id: 'asyncArchive',
    slot: 'actionRowSlot',
    order: 0,
    icon: () => <Archive width={16} height={16} />,
    label: () => 'Archive',
    disabled: availability('Already archived', "You can't archive this row"),
    onSelect: () => wait(ASYNC_DEMO_DELAY_MS),
  },
  {
    id: 'asyncDelete',
    slot: 'actionRowSlot',
    order: 1,
    icon: () => <Trash2 width={16} height={16} />,
    label: () => 'Delete',
    // Каждая 3-я строка заблокирована другим пользователем — удаление отклоняется.
    onSelect: async ctx => {
      await wait(ASYNC_DEMO_DELAY_MS)
      if (indexOf(ctx) % 3 === 0) {
        throw new Error('Row is locked by another user')
      }
    },
  },
]

export const asyncContextActionsDemo: ContextMenuAction[] = [
  {
    id: 'asyncRecalculate',
    icon: () => <RefreshCw width={16} height={16} />,
    label: () => 'Recalculate',
    onSelect: async ctx => {
      await wait(ASYNC_DEMO_DELAY_MS)
      if (indexOf(ctx) % 3 === 0) throw new Error('Formula service timed out')
    },
  },
  {
    id: 'asyncShare',
    icon: () => <Share2 width={16} height={16} />,
    label: () => 'Share',
    disabled: availability('Already shared', 'Sharing is off for this row'),
    onSelect: () => {},
  },
]

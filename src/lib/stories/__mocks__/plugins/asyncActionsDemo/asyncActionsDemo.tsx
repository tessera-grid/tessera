import { Archive, DatabaseZap, RefreshCw, Share2, Trash2 } from 'lucide-react'

import type {
  ContextMenuAction,
  DisabledResult,
  HeaderAction,
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
    onSelect: (_ctx, _event, context) =>
      wait(ASYNC_DEMO_DELAY_MS, context?.signal),
  },
  {
    id: 'asyncDelete',
    slot: 'actionRowSlot',
    order: 1,
    icon: () => <Trash2 width={16} height={16} />,
    label: () => 'Delete',
    tone: 'danger',
    // Каждая 3-я строка заблокирована другим пользователем — удаление отклоняется.
    onSelect: async (ctx, _event, context) => {
      await wait(ASYNC_DEMO_DELAY_MS, context?.signal)
      if (indexOf(ctx) % 3 === 0) {
        throw new Error('Row is locked by another user')
      }
    },
  },
]

/**
 * «Сервер» демо-действия колонки: отвечает через `ASYNC_DEMO_DELAY_MS` или, пока
 * придержан, ждёт `release` — так гайд держит ожидание на виду, пока его смотрят.
 * Проверки доступности и выполнение придерживаются отдельно.
 */
export const createDemoServer = () => {
  const channel = () => {
    let held = false
    const waiting = new Set<() => void>()
    return {
      hold: () => {
        held = true
      },
      release: () => {
        held = false
        waiting.forEach(resolve => resolve())
        waiting.clear()
      },
      answer: (signal?: AbortSignal) =>
        held
          ? new Promise<void>((resolve, reject) => {
              waiting.add(resolve)
              signal?.addEventListener('abort', () => {
                waiting.delete(resolve)
                reject(signal.reason)
              })
            })
          : wait(ASYNC_DEMO_DELAY_MS, signal),
    }
  }
  return { checks: channel(), runs: channel() }
}

export type DemoServer = ReturnType<typeof createDemoServer>

/**
 * Действие колонки — построить индекс на сервере (ADR 0078): Country уже с индексом,
 * вычисляемую Total индексировать нельзя, построение по Last Name сервер отклоняет.
 */
export const asyncHeaderActionsDemo = (
  server: DemoServer = createDemoServer(),
): HeaderAction[] => [
  {
    id: 'asyncBuildIndex',
    slot: 'rightHeaderSlot',
    placement: 'menu',
    icon: () => <DatabaseZap width={16} height={16} />,
    label: () => 'Build index',
    disabled: async (ctx, signal): Promise<DisabledResult> => {
      await server.checks.answer(signal)
      switch (ctx.column.id) {
        case 'country':
          return { kind: 'done', reason: 'The column is already indexed' }
        case 'total':
          return {
            kind: 'forbidden',
            reason: "Computed columns can't be indexed",
          }
        default:
          return false
      }
    },
    onSelect: async (ctx, _event, context) => {
      await server.runs.answer(context?.signal)
      if (ctx.column.id === 'lastName') {
        throw new Error('Index build timed out')
      }
    },
  },
]

export const asyncContextActionsDemo: ContextMenuAction[] = [
  {
    id: 'asyncRecalculate',
    icon: () => <RefreshCw width={16} height={16} />,
    label: () => 'Recalculate',
    onSelect: async (ctx, _event, context) => {
      await wait(ASYNC_DEMO_DELAY_MS, context?.signal)
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

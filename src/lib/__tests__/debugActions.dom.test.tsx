// @vitest-environment happy-dom
/**
 * Канал действий грида (ADR 0125, AL6): серверное действие — запрос, ответ, отказ с
 * откатом и замена новым запросом, итоги — с `cause`.
 * Запуск: npx vitest run --config vitest.node.config.ts debugActions
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import type { DebugAction } from '../core/debugActions'
import { useCreateTable } from '../core/useCreateTable'
import { columnSorting } from '../plugins/columnSorting'
import { sortHeaderAction } from '../plugins/columnSorting/sortHeaderAction'
import { changePageByUser } from '../plugins/pagination/model'
import { pagination } from '../plugins/pagination'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [{ id: 'name', accessorKey: 'name' }]
const data = Array.from({ length: 25 }, (_, index) => ({
  id: String(index),
  name: `Name ${index}`,
}))

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

let captured: any
const replies: Deferred[] = []
const actions: DebugAction[] = []

const Host = () => {
  const reply = () => {
    const next = deferred()
    replies.push(next)
    return next.promise
  }
  captured = useCreateTable({
    columns: columns as never,
    data,
    dataMode: { sorting: 'server', pagination: 'server' },
    onDebugAction: action => actions.push(action),
    plugins: [
      columnSorting({ onToggleColumnSort: reply }),
      pagination({
        rowCount: 1000,
        initialPageSize: 25,
        onPageChange: reply,
      }),
    ],
  })
  return null
}

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
  replies.length = 0
  actions.length = 0
})

const mount = () => {
  const root = createRoot(document.createElement('div'))
  act(() => root.render(<Host />))
  unmount = () => act(() => root.unmount())
}

const sort = () =>
  act(() =>
    sortHeaderAction.onSelect(
      { column: captured.getColumn('name'), table: captured } as never,
      { shiftKey: false } as never,
    ),
  )

const server = () =>
  actions
    .filter(action => action.action.startsWith('server'))
    .map(({ id, plugin, action, cause, detail }) => ({
      id,
      plugin,
      action,
      cause,
      detail,
    }))

describe('канал действий: серверные действия (ADR 0125)', () => {
  it('AL6: ядро сообщает серверное действие — запрос, ответ, отказ с откатом и замену новым запросом, итоги с cause', async () => {
    mount()
    sort()
    const first = server()[0]!
    expect(first).toMatchObject({
      plugin: 'columnSorting',
      action: 'serverRequest',
      detail: { kind: 'sorting' },
    })
    // Новый запрос до ответа заменяет прежний.
    sort()
    const [, replaced, second] = server()
    expect(replaced).toMatchObject({
      action: 'serverReplaced',
      cause: first.id,
    })
    expect(second).toMatchObject({ action: 'serverRequest' })
    await act(async () => replies[1]!.resolve())
    expect(server().at(-1)).toMatchObject({
      action: 'serverResolved',
      cause: second!.id,
    })

    // Отказ — с откатом и причиной.
    act(() =>
      changePageByUser(captured, () => captured.setPageIndex(3), 3, 25, 'next'),
    )
    const page = server().at(-1)!
    expect(page).toMatchObject({
      plugin: 'pagination',
      action: 'serverRequest',
    })
    await act(async () => replies[2]!.reject(new Error('Нет связи')))
    expect(server().at(-1)).toMatchObject({
      plugin: 'pagination',
      action: 'serverRejected',
      cause: page.id,
      detail: { error: 'Нет связи', reverted: true },
    })
    expect(captured.atoms.pagination.get().pageIndex).toBe(0)
  })
})

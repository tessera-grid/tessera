// @vitest-environment happy-dom
/**
 * Серверные действия (ADR 0116, этап 1): промис и `signal` у колбэков сортировки,
 * фильтра, поиска и страницы, замена ожидающего действия, откат к состоянию до цепочки
 * и `revertOnReject`. SA7–SA8 — визуальные (`visual/server-actions.test.tsx`).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { setColumnFiltersByUser, setSearchByUser } from '../core/filtering'
import { readServerAction } from '../core/serverActions'
import { useCreateTable } from '../core/useCreateTable'
import { columnFiltering } from '../plugins/columnFiltering'
import { sortHeaderAction } from '../plugins/columnSorting/sortHeaderAction'
import { columnSorting } from '../plugins/columnSorting'
import { changePageByUser } from '../plugins/pagination/model'
import { pagination } from '../plugins/pagination'
import { reconcileColumnMoves } from '../plugins/columnDragging/commitColumnMove'
import { reconcileRowMoves } from '../plugins/rowDragging/reconcileRowMoves'
import { clearExpandFailed } from '../plugins/rowExpanding/lazyChildrenFeature'
import { quickSearch } from '../plugins/quickSearch'

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
  // Промис клиентского режима грид не ждёт — его отказ не должен всплыть в прогоне.
  promise.catch(() => {})
  return { promise, resolve, reject }
}

type Answer = 'pending' | 'sync'

interface HostProps {
  server?: boolean
  sortingRevert?: boolean
  paginationRevert?: boolean
  answer: Answer
  calls: { kind: string; signal: AbortSignal; deferred?: Deferred }[]
}

let captured: any

const Host = ({
  server = true,
  sortingRevert,
  paginationRevert,
  answer,
  calls,
}: HostProps) => {
  const reply =
    (kind: string) =>
    (...args: unknown[]): Promise<void> | void => {
      const { signal } = args.at(-1) as { signal: AbortSignal }
      if (answer === 'sync') {
        calls.push({ kind, signal })
        return
      }
      const call = { kind, signal, deferred: deferred() }
      calls.push(call)
      return call.deferred.promise
    }
  captured = useCreateTable({
    columns: columns as never,
    data,
    plugins: [
      columnSorting({
        server,
        revertOnReject: sortingRevert,
        onToggleColumnSort: reply('sorting'),
      }),
      pagination({
        server,
        rowCount: 1000,
        initialPageSize: 25,
        revertOnReject: paginationRevert,
        onPageChange: reply('pagination'),
      }),
      columnFiltering({ server, onFilterChange: reply('filtering') }),
      quickSearch({ server, onSearchChange: reply('search') }),
    ],
  })
  return null
}

let unmount: (() => void) | undefined

const mount = (props: Omit<HostProps, 'calls'>) => {
  const calls: HostProps['calls'] = []
  const root = createRoot(document.createElement('div'))
  const rerender = (next: Partial<Omit<HostProps, 'calls'>>) =>
    act(() => root.render(<Host {...props} {...next} calls={calls} />))
  rerender({})
  unmount = () => act(() => root.unmount())
  return { calls, rerender }
}

afterEach(() => {
  unmount?.()
  unmount = undefined
})

const table = () => captured
const sorting = () => table().atoms.sorting.get()
const page = () => table().atoms.pagination.get()
const status = () => readServerAction(table())

const sort = () =>
  act(() =>
    sortHeaderAction.onSelect(
      { column: table().getColumn('name'), table: table() } as never,
      { shiftKey: false } as never,
    ),
  )
const goToPage = (index: number) =>
  act(() =>
    changePageByUser(
      table(),
      () => table().setPageIndex(index),
      index,
      25,
      'next',
    ),
  )
const filter = () =>
  act(() => setColumnFiltersByUser(table(), [{ id: 'name', value: 'Name 1' }]))
const search = () => act(() => setSearchByUser(table(), 'Name'))

const settle = async (run: () => void) => {
  await act(async () => {
    run()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

const SERVER_ERROR = new Error('Server error')

describe('серверные действия (ADR 0116)', () => {
  it('SA1: в серверном режиме колбэки сортировки, фильтра, поиска и страницы могут вернуть промис; синхронный результат и клиентский режим работают как сейчас', async () => {
    const actions = [
      ['sorting', sort],
      ['filtering', filter],
      ['search', search],
      ['pagination', () => goToPage(2)],
    ] as const

    const pending = mount({ answer: 'pending' })
    for (const [kind, run] of actions) {
      run()
      expect(pending.calls.at(-1)!.kind).toBe(kind)
      expect(status().pending?.kind).toBe(kind)
    }
    await settle(() => pending.calls.at(-1)!.deferred!.resolve())
    expect(status()).toEqual({})
    unmount!()

    const sync = mount({ answer: 'sync' })
    sort()
    expect(sorting()).toEqual([{ id: 'name', desc: true }])
    expect(status()).toEqual({})
    unmount!()

    const client = mount({ answer: 'pending', server: false })
    for (const [kind, run] of actions) {
      run()
      const call = client.calls.at(-1)!
      expect(call.kind).toBe(kind)
      expect(call.signal.aborted).toBe(false)
      expect(status()).toEqual({})
    }
    await settle(() => client.calls[0].deferred!.reject(SERVER_ERROR))
    expect(sorting()).toEqual([{ id: 'name', desc: true }])
    expect(status()).toEqual({})
    expect(sync.calls).toHaveLength(1)
  })

  it('SA2: колбэк получает `{ signal }`; его прерывает следующая смена любого из четырёх срезов и размонтирование; итог прерванного вызова игнорируется', async () => {
    const { calls } = mount({ answer: 'pending' })
    sort()
    filter()
    search()
    goToPage(4)
    sort()
    expect(calls.map(call => call.kind)).toEqual([
      'sorting',
      'filtering',
      'search',
      'pagination',
      'sorting',
    ])
    expect(calls.slice(0, 4).every(call => call.signal.aborted)).toBe(true)
    expect(calls[4].signal.aborted).toBe(false)

    // Отказ прерванной страницы не откатывает и не отмечает; ожидание — у сортировки.
    const pendingStatus = status()
    await settle(() => calls[3].deferred!.reject(SERVER_ERROR))
    expect(page().pageIndex).toBe(4)
    expect(status()).toBe(pendingStatus)

    unmount!()
    unmount = undefined
    expect(calls[4].signal.aborted).toBe(true)
    const sortedBeforeReject = sorting()
    await settle(() => calls[4].deferred!.reject(SERVER_ERROR))
    expect(sorting()).toBe(sortedBeforeReject)
    expect(status()).toBe(pendingStatus)
  })

  it('SA3: новое действие во время ожидания не блокируется и заменяет прежнее; откат — к последнему подтверждённому состоянию', async () => {
    const { calls } = mount({ answer: 'pending' })
    sort()
    goToPage(3)
    expect(sorting()).toEqual([{ id: 'name', desc: true }])
    expect(status().pending?.kind).toBe('pagination')

    // Отказ страницы возвращает и сортировку, начавшую цепочку.
    await settle(() => calls[1].deferred!.reject(SERVER_ERROR))
    expect(sorting()).toEqual([])
    expect(page()).toEqual({ pageIndex: 0, pageSize: 25 })
    expect(status().failed?.kind).toBe('pagination')

    // Успех подтверждает состояние: следующий отказ возвращает к нему.
    sort()
    await settle(() => calls[2].deferred!.resolve())
    expect(status()).toEqual({})
    goToPage(5)
    await settle(() => calls[3].deferred!.reject(SERVER_ERROR))
    expect(sorting()).toEqual([{ id: 'name', desc: true }])
    expect(page().pageIndex).toBe(0)
  })

  it('SA10: `revertOnReject: false` у `columnSorting` и `pagination` — состояние остаётся новым с отметкой ошибки; аргумент живой', async () => {
    const { calls, rerender } = mount({
      answer: 'pending',
      sortingRevert: false,
      paginationRevert: false,
    })
    sort()
    goToPage(2)
    await settle(() => calls[1].deferred!.reject(SERVER_ERROR))
    expect(sorting()).toEqual([{ id: 'name', desc: true }])
    expect(page().pageIndex).toBe(2)
    expect(status().failed).toEqual(
      expect.objectContaining({ kind: 'pagination', error: SERVER_ERROR }),
    )

    rerender({ sortingRevert: true, paginationRevert: true })
    sort()
    goToPage(6)
    await settle(() => calls[3].deferred!.reject(SERVER_ERROR))
    expect(sorting()).toEqual([{ id: 'name', desc: true }])
    expect(page().pageIndex).toBe(2)

    rerender({ sortingRevert: true, paginationRevert: false })
    sort()
    goToPage(7)
    await settle(() => calls[5].deferred!.reject(SERVER_ERROR))
    expect(sorting()).toEqual([{ id: 'name', desc: true }])
    expect(page().pageIndex).toBe(7)
  })
})

describe('Снятие отметки отказа сменой цели (ADR 0127, ADR 0136)', () => {
  it('IR14: отметку снимает смена цели — прошедшая другая сортировка; строка, ушедшая из модели; скрытая колонка', async () => {
    // Серверная сортировка отказала — отметка у причины; прошедшая сортировка её снимает.
    const { calls } = mount({ answer: 'pending' })
    sort()
    await settle(() => calls.at(-1)!.deferred!.reject(SERVER_ERROR))
    expect(status().failed?.kind).toBe('sorting')
    sort()
    await settle(() => calls.at(-1)!.deferred!.resolve())
    expect(status().failed).toBeUndefined()

    // Строка, ушедшая из модели: отметки переноса и раскрытия снимаются.
    type Fails = Record<string, { attempt: number; error: unknown }>
    const fail = { attempt: 1, error: SERVER_ERROR }
    const rows = {
      atoms: { rowMoveFailed: { get: () => moveFails } },
      options: { data: [] },
      getCoreRowModel: () => ({ rowsById: { r1: {} } }),
      setRowMoveFailed: (updater: (prev: Fails) => Fails) => {
        moveFails = updater(moveFails)
      },
    }
    let moveFails: Fails = { r1: fail, gone: fail }
    reconcileRowMoves(rows)
    expect(Object.keys(moveFails)).toEqual(['r1'])

    let expandFails: Fails = { r1: fail, gone: fail }
    const lazy = {
      atoms: { rowExpandFailed: { get: () => expandFails } },
      options: {},
      updateLazySlice: (_key: string, updater: (prev: Fails) => Fails) => {
        expandFails = updater(expandFails)
      },
    }
    clearExpandFailed(lazy, id => id === 'r1')
    expect(Object.keys(expandFails)).toEqual(['r1'])

    // Колонка, которую скрыли: отметка переноса снимается.
    let columnFails: Fails = { a: fail, b: fail }
    const columns = {
      options: {},
      atoms: {
        columnMoves: { get: () => ({}) },
        columnMoveFailed: { get: () => columnFails },
      },
      getAllFlatColumns: () => [
        { id: 'a', getIsVisible: () => true },
        { id: 'b', getIsVisible: () => false },
      ],
      setColumnOrder: () => {},
      setColumnMoveFailed: (updater: (prev: Fails) => Fails) => {
        columnFails = updater(columnFails)
      },
    }
    reconcileColumnMoves(columns)
    expect(Object.keys(columnFails)).toEqual(['a'])
  })
})

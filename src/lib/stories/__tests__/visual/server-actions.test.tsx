import { useState } from 'react'

import type { SortingState } from '@tanstack/react-table'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { DataGrid } from '../../../grid/DataGrid'
import { useCreateTable } from '../../../core/useCreateTable'
import { columnSorting } from '../../../plugins/columnSorting'
import { pagination } from '../../../plugins/pagination'

// Серверные действия (ADR 0116, этап 1): отказ промиса сортировки и страницы откатывает
// их настоящими событиями браузера. SA1–SA3, SA10 — модульные
// (`src/lib/__tests__/serverActions.dom.test.tsx`).

interface Deferred {
  promise: Promise<void>
  reject: (error: unknown) => void
  resolve: () => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'value', accessorKey: 'value', header: 'Value' },
]
const DATA = Array.from({ length: 100 }, (_, index) => ({
  id: String(index),
  name: `Row ${index}`,
  value: index,
}))

interface Options {
  sortingServer?: boolean
  paginationServer?: boolean
  pageSize: number
  controlled?: boolean
}

interface Harness {
  options: Options
  answers: Deferred[]
  onSortingChange: ReturnType<typeof vi.fn<(sorting: SortingState) => void>>
}

let harness: Harness

const answer = () => {
  const next = deferred()
  harness.answers.push(next)
  return next.promise
}

const Grid = () => {
  const { options } = harness
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: options.paginationServer ? DATA.slice(0, options.pageSize) : DATA,
    ...(options.controlled
      ? {
          state: { sorting },
          handlers: {
            onSortingChange: (
              updater: SortingState | ((prev: SortingState) => SortingState),
            ) => {
              const next =
                typeof updater === 'function' ? updater(sorting) : updater
              harness.onSortingChange(next)
              setSorting(next)
            },
          },
        }
      : {}),
    plugins: [
      columnSorting({
        server: options.sortingServer,
        multiSort: false,
        onToggleColumnSort: answer,
      }),
      pagination({
        server: options.paginationServer,
        rowCount: options.paginationServer ? 1000 : undefined,
        initialPageSize: options.pageSize,
        onPageChange: answer,
      }),
    ],
  })
  return (
    <div style={{ height: 500, width: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const mount = async (options: Options) => {
  harness = { options, answers: [], onSortingChange: vi.fn() }
  const result = await render(<Grid />)
  await expect.poll(() => nameCell()).not.toBeNull()
  return result
}

const nameCell = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__head-cell[aria-colindex]',
    ),
  ].find(cell => cell.textContent?.includes('Name'))
const ariaSort = () => nameCell()!.getAttribute('aria-sort')
const sortButton = () =>
  nameCell()!.querySelector<HTMLElement>('.column-sort__button')!
const range = () =>
  document.querySelector<HTMLElement>('[data-testid="pagination-range"]')!
    .textContent
const pageButton = (action: 'next' | 'previous') =>
  document.querySelector<HTMLButtonElement>(`[data-page-action="${action}"]`)!
const sizeTrigger = () =>
  document.querySelector<HTMLElement>('[data-testid="page-size-select"]')

const chooseSize = async (size: number) => {
  await expect.poll(sizeTrigger).not.toBeNull()
  await userEvent.click(sizeTrigger()!)
  const option = await vi.waitFor(() => {
    const item = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ].find(node => node.textContent?.trim() === String(size))
    if (!item) throw new Error(`option ${size} not rendered`)
    return item
  })
  await userEvent.click(option)
}

const SERVER_ERROR = new Error('Server error')

describe('серверные действия: откат (ADR 0116)', () => {
  test('SA7: отказ сортировки возвращает её вместе со сбросом страницы, вызванным сортировкой; при контролируемом state.sorting откат приходит в onSortingChange', async () => {
    const own = await mount({ sortingServer: true, pageSize: 10 })
    await userEvent.click(pageButton('next'))
    await userEvent.click(pageButton('next'))
    await expect.poll(range).toBe('21–30 of 100')

    await userEvent.click(sortButton())
    await expect.poll(ariaSort).toBe('descending')
    await expect.poll(range).toBe('1–10 of 100')

    harness.answers.at(-1)!.reject(SERVER_ERROR)
    await expect.poll(ariaSort).toBe('none')
    await expect.poll(range).toBe('21–30 of 100')
    await own.unmount()

    await mount({ sortingServer: true, pageSize: 10, controlled: true })
    await userEvent.click(sortButton())
    await expect.poll(ariaSort).toBe('descending')
    expect(harness.onSortingChange).toHaveBeenLastCalledWith([
      { id: 'name', desc: true },
    ])

    harness.answers.at(-1)!.reject(SERVER_ERROR)
    await expect.poll(ariaSort).toBe('none')
    expect(harness.onSortingChange).toHaveBeenLastCalledWith([])
  })

  test('SA8: отказ смены страницы или её размера возвращает pageIndex и pageSize', async () => {
    await mount({ paginationServer: true, pageSize: 25 })
    await userEvent.click(pageButton('next'))
    await expect.poll(range).toBe('26–50 of 1000')
    harness.answers.at(-1)!.reject(SERVER_ERROR)
    await expect.poll(range).toBe('1–25 of 1000')

    await userEvent.click(pageButton('next'))
    harness.answers.at(-1)!.resolve()
    await expect.poll(range).toBe('26–50 of 1000')

    await chooseSize(50)
    await expect.poll(range).toBe('1–50 of 1000')
    harness.answers.at(-1)!.reject(SERVER_ERROR)
    await expect.poll(range).toBe('26–50 of 1000')
  })
})

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { COLUMN_EXPANDING_ID } from '../../../../lib/plugins/rowExpanding'
import { composed } from '../stories'
import { humanClick, scrollToEnd, getScroller } from '../helpers'

// Ленивые дети строк (ADR 0054): RE17–RE18, RE20, RE23–RE25, RE30–RE33, RE37, RE40.
// Грид — история RowExpanding с данными без `subRows`; `hasChildren` читает
// `childCount`, `loadChildren` отдаёт ответы, которыми управляет тест. Состояние
// читается из контракта DOM: `data-row-id`, `data-expanded`, `aria-busy`,
// `aria-expanded` тоггла, `data-error-flash` и live-область грида.

interface Person {
  id: string
  firstName: string
  lastName: string
  childCount?: number
}

const person = (id: string, childCount = 0): Person => ({
  id,
  firstName: id,
  lastName: 'Doe',
  childCount,
})
const kids = (parent: string, count: number) =>
  Array.from({ length: count }, (_, i) => person(`${parent}-c${i}`))

const ROOTS = [person('lazy', 2), person('leaf'), person('other', 1)]

const hasChildren = (row: { original: Person }) =>
  (row.original.childCount ?? 0) > 0

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Loader = (row: { id: string }) => Person[] | Promise<Person[]>

const renderLazy = (
  loadChildren: Loader,
  args: Partial<Parameters<typeof composed.RowExpanding>[0]> = {},
) =>
  render(
    <composed.RowExpanding
      dataOverride={ROOTS}
      rowExpandingHasChildren={hasChildren as never}
      rowExpandingLoadChildren={loadChildren as never}
      {...args}
    />,
  )

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const toggleOf = (id: string) =>
  rowOf(id)?.querySelector<HTMLElement>('.row-expand-button') ?? null
const liveText = () =>
  document.querySelector('[role="status"][aria-live]')?.textContent ?? ''

const waitRow = (id: string) => expect.poll(() => rowOf(id)).not.toBeNull()

describe('Row expanding: lazy children', () => {
  test('RE17: a row marked by hasChildren without subRows gets a toggle and data-expanded="false"; an unmarked row is a leaf', async () => {
    await renderLazy(() => [])
    await waitRow('lazy')
    expect(toggleOf('lazy')).not.toBeNull()
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('false')
    expect(toggleOf('leaf')).toBeNull()
    expect(rowOf('leaf')!.hasAttribute('data-expanded')).toBe(false)
  })

  test('RE18: the first expand calls loadChildren, the toggle and the row are busy, the answer shows the children under the row', async () => {
    const answer = deferred<Person[]>()
    const load = vi.fn<Loader>(() => answer.promise)
    await renderLazy(load)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0]![0].id).toBe('lazy')
    await expect
      .poll(() => toggleOf('lazy')!.getAttribute('aria-busy'))
      .toBe('true')
    expect(rowOf('lazy')!.getAttribute('aria-busy')).toBe('true')
    expect(getComputedStyle(toggleOf('lazy')!, '::after').content).not.toBe(
      'none',
    )
    answer.resolve(kids('lazy', 2))
    await waitRow('lazy-c1')
    expect(rowOf('lazy-c0')).not.toBeNull()
    expect(rowOf('lazy')!.hasAttribute('aria-busy')).toBe(false)
    expect(toggleOf('lazy')!.hasAttribute('aria-busy')).toBe(false)
  })

  test('RE20: collapsing keeps the answer; expanding again shows the saved children at once and calls loadChildren again', async () => {
    const refresh = deferred<Person[]>()
    const load = vi
      .fn<Loader>()
      .mockReturnValueOnce(kids('lazy', 2))
      .mockReturnValueOnce(refresh.promise)
    await renderLazy(load)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await humanClick(toggleOf('lazy')!)
    await expect.poll(() => rowOf('lazy-c0')).toBeNull()
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    expect(load).toHaveBeenCalledTimes(2)
    expect(toggleOf('lazy')!.getAttribute('aria-busy')).toBe('true')
    refresh.resolve(kids('lazy', 3))
    await waitRow('lazy-c2')
  })

  test('RE23: an empty answer turns the row into a leaf until data changes; then the toggle returns', async () => {
    const screen = await renderLazy(() => [])
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await expect.poll(() => toggleOf('lazy')).toBeNull()
    expect(rowOf('lazy')!.hasAttribute('data-expanded')).toBe(false)
    await screen.rerender(
      <composed.RowExpanding
        dataOverride={[...ROOTS]}
        rowExpandingHasChildren={hasChildren as never}
        rowExpandingLoadChildren={(() => []) as never}
      />,
    )
    await expect.poll(() => toggleOf('lazy')).not.toBeNull()
  })

  test('RE24: a failure without a saved answer collapses the row, flashes the toggle and announces the error text', async () => {
    await renderLazy(() => Promise.reject(new Error('Server down')))
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await expect
      .poll(() => toggleOf('lazy')!.getAttribute('data-error-flash'))
      .toBe('on')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('false')
    await expect.poll(liveText).toContain("Couldn't load: Server down")
  })

  test('RE25: a failure with a saved answer keeps the row expanded with the old children; flash and announcement are the same', async () => {
    const load = vi
      .fn<Loader>()
      .mockReturnValueOnce(kids('lazy', 2))
      .mockImplementationOnce(() => Promise.reject('Timeout'))
    await renderLazy(load)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await humanClick(toggleOf('lazy')!)
    await humanClick(toggleOf('lazy')!)
    await expect
      .poll(() => toggleOf('lazy')!.getAttribute('data-error-flash'))
      .toBe('on')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('true')
    expect(rowOf('lazy-c1')).not.toBeNull()
    await expect.poll(liveText).toContain("Couldn't load: Timeout")
  })

  test('RE30: column "auto" shows the expanding column when a root is marked by hasChildren and no row has subRows', async () => {
    const expandingHead = () =>
      document.querySelector(
        `.data-grid__head-cell[data-column-id='${COLUMN_EXPANDING_ID}']`,
      )
    const screen = await renderLazy(() => [])
    await waitRow('lazy')
    expect(expandingHead()).not.toBeNull()
    await screen.rerender(
      <composed.RowExpanding
        dataOverride={[person('x'), person('y')]}
        rowExpandingHasChildren={hasChildren as never}
        rowExpandingLoadChildren={(() => []) as never}
      />,
    )
    await expect.poll(expandingHead).toBeNull()
  })

  test('RE31: Enter expands a lazy row from the keyboard; ARIA is right in treegrid and in table', async () => {
    const load = vi.fn<Loader>(row => kids(row.id, 1))
    const screen = await renderLazy(load, { enableKeyboardNavigation: true })
    await waitRow('lazy')
    expect(document.querySelector('[role="treegrid"]')).not.toBeNull()
    const expandCell = rowOf('lazy')!.querySelector<HTMLElement>(
      `[data-column-id='${COLUMN_EXPANDING_ID}']`,
    )!
    expandCell.focus()
    await userEvent.keyboard('{Enter}')
    await waitRow('lazy-c0')
    expect(load).toHaveBeenCalledTimes(1)
    expect(rowOf('lazy')!.getAttribute('aria-expanded')).toBe('true')
    await screen.unmount()

    await renderLazy(load)
    await waitRow('other')
    expect(document.querySelector('[role="table"]')).not.toBeNull()
    await humanClick(toggleOf('other')!)
    await waitRow('other-c0')
    expect(toggleOf('other')!.getAttribute('aria-expanded')).toBe('true')
    expect(rowOf('other')!.hasAttribute('aria-expanded')).toBe(false)
  })

  test('RE32: an expanded lazy row with children survives leaving the virtualization window, sorting and a page change', async () => {
    const many = [
      person('lazy', 2),
      ...Array.from({ length: 120 }, (_, i) =>
        person(`row-${String(i).padStart(3, '0')}`),
      ),
    ]
    const load = vi.fn<Loader>(row => kids(row.id, 2))
    const args = {
      dataOverride: many,
      rowExpandingHasChildren: hasChildren as never,
      rowExpandingLoadChildren: load as never,
    }
    const screen = await render(<composed.RowExpanding {...args} />)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await scrollToEnd('y')
    await expect.poll(() => rowOf('lazy')).toBeNull()
    getScroller().scrollTop = 0
    await waitRow('lazy-c1')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('true')

    await screen.rerender(
      <composed.RowExpanding {...args} enableColumnSorting />,
    )
    const sort = document.querySelector<HTMLElement>(
      ".data-grid__head-cell[data-column-id='firstName'] .column-sort__button",
    )!
    await humanClick(sort)
    await humanClick(sort)
    await waitRow('lazy-c1')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('true')
    await screen.unmount()

    await render(
      <composed.RowExpanding
        {...args}
        enablePagination
        paginationPageSize={10}
      />,
    )
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await humanClick(
      document.querySelector<HTMLElement>('[aria-label="Next page"]')!,
    )
    await expect.poll(() => rowOf('lazy')).toBeNull()
    await humanClick(
      document.querySelector<HTMLElement>('[aria-label="Previous page"]')!,
    )
    await waitRow('lazy-c1')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('true')
    // Сортировка и смена страницы не перезагружают детей.
    expect(load).toHaveBeenCalledTimes(2)
  })

  test('RE33: children of a selected parent arrive unselected; the parent selection does not change', async () => {
    const answer = deferred<Person[]>()
    await renderLazy(() => answer.promise, {
      enableRowSelection: true,
      enableSubRowSelection: true,
    })
    await waitRow('lazy')
    const checkbox = (id: string) =>
      rowOf(id)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
    await humanClick(checkbox('lazy')!)
    await expect
      .poll(() => checkbox('lazy')!.getAttribute('aria-checked'))
      .toBe('true')
    await humanClick(toggleOf('lazy')!)
    answer.resolve(kids('lazy', 2))
    await waitRow('lazy-c1')
    for (const id of ['lazy-c0', 'lazy-c1']) {
      expect(checkbox(id)!.getAttribute('aria-checked'), id).toBe('false')
    }
    expect(checkbox('lazy')!.getAttribute('aria-checked')).toBe('true')
  })

  test('RE37: a rejected onExpandRow promise without loadChildren gives the same flash and announcement', async () => {
    const tree = [{ ...person('p'), subRows: [person('p-c0')] }, person('q')]
    await render(
      <composed.RowExpanding
        dataOverride={tree}
        onExpandRow={(_row, expanded) =>
          expanded ? Promise.reject(new Error('No access')) : undefined
        }
      />,
    )
    await waitRow('p')
    await humanClick(toggleOf('p')!)
    await expect
      .poll(() => toggleOf('p')!.getAttribute('data-error-flash'))
      .toBe('on')
    expect(rowOf('p')!.getAttribute('data-expanded')).toBe('false')
    await expect.poll(liveText).toContain("Couldn't load: No access")
  })

  test('RE40: the story "Row expanding — lazy children (server)" loads children, refreshes on re-expand, turns the empty node into a leaf and flashes on failure; the log shows it', async () => {
    await render(<composed.RowExpandingLazyChildren loadDelayMs={50} />)
    const log = () => document.body.textContent ?? ''
    await waitRow('node-0')
    await humanClick(toggleOf('node-0')!)
    await waitRow('node-0-0')
    await expect.poll(log).toContain('children of node-0: 3')
    await humanClick(toggleOf('node-0')!)
    await humanClick(toggleOf('node-0')!)
    expect(rowOf('node-0-0')).not.toBeNull()
    await expect
      .poll(() => log().split('loadChildren').length - 1)
      .toBeGreaterThanOrEqual(2)

    await humanClick(toggleOf('node-3')!)
    await expect.poll(() => toggleOf('node-3')).toBeNull()
    await expect.poll(log).toContain('children of node-3: 0')

    await humanClick(
      [...document.querySelectorAll('button')].find(
        b => b.textContent === 'Fail next load',
      )!,
    )
    await humanClick(toggleOf('node-1')!)
    await expect
      .poll(() => toggleOf('node-1')!.getAttribute('data-error-flash'))
      .toBe('on')
    await expect.poll(log).toContain('children of node-1 failed to load')
  })
})

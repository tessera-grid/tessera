import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { ROW_ACTIONS_COLUMN_ID } from '../../../core/createColumns'
import { COLUMN_EXPANDING_ID } from '../../../plugins/rowExpanding/rowExpandingColumn'
import { COLUMN_SELECTION_ID } from '../../../plugins/rowSelection/rowSelectionColumn'
import { makeData } from '../../__mocks__/data'
import { Stories } from '../helpers'

// Показ служебных колонок по условию (ADR 0050): SC3–SC5, SC7, RE14–RE16, RA3.
// SC1–SC2, SC6, SC8–SC9 — модульные (`src/lib/__tests__/servicePresence.dom.test.tsx`).

const HEAD_CELL = '.data-grid__head-cell'
const BODY_ROW = '.data-grid__body-row'
const BODY_CELL = '.data-grid__body-cell'

const flat = makeData({ shape: 'flat', count: 6 })
const tree = [
  ...flat,
  ...makeData({ shape: 'tree', count: 1, depth: 2, breadth: 2 }),
]

const columnCells = (id: string) =>
  document.querySelectorAll(
    `${HEAD_CELL}[data-column-id='${id}'], ${BODY_CELL}[data-column-id='${id}']`,
  )
const hasColumn = (id: string) => columnCells(id).length > 0
const gridRoot = () => document.querySelector<HTMLElement>('[aria-colcount]')!
const firstRowCells = () => [
  ...document.querySelector(BODY_ROW)!.querySelectorAll<HTMLElement>(BODY_CELL),
]

const mount = async (node: React.ReactElement) => {
  const result = await render(node)
  await expect
    .poll(() => document.querySelectorAll(BODY_ROW).length)
    .toBeGreaterThan(0)
  return result
}

describe('Service column presence', () => {
  test('SC3: a hidden service column is absent from head and body, aria-colcount drops and aria-colindex stays contiguous', async () => {
    const always = await mount(
      <Stories.RowExpandingFlatData
        dataOverride={flat}
        rowExpandingColumn="always"
      />,
    )
    expect(hasColumn(COLUMN_EXPANDING_ID)).toBe(true)
    const withColumn = Number(gridRoot().getAttribute('aria-colcount'))
    await always.unmount()

    await mount(<Stories.RowExpandingFlatData dataOverride={flat} />)
    expect(hasColumn(COLUMN_EXPANDING_ID)).toBe(false)
    expect(Number(gridRoot().getAttribute('aria-colcount'))).toBe(
      withColumn - 1,
    )
    const indexes = firstRowCells().map(cell =>
      Number(cell.getAttribute('aria-colindex')),
    )
    expect(indexes).toEqual(indexes.map((_, i) => i + 1))
  })

  test('SC4: keyboard navigation does not enter a hidden service column', async () => {
    await mount(
      <Stories.RowExpandingFlatData
        dataOverride={flat}
        enableKeyboardNavigation
      />,
    )
    const [selection, next] = firstRowCells()
    expect(selection.getAttribute('data-column-id')).toBe(COLUMN_SELECTION_ID)
    selection.focus()
    await userEvent.keyboard('{ArrowRight}')
    const active = document.activeElement!.closest(BODY_CELL)!
    expect(active.getAttribute('data-column-id')).toBe(
      next.getAttribute('data-column-id'),
    )
    expect(active.getAttribute('data-column-id')).not.toBe(COLUMN_EXPANDING_ID)
  })

  test('SC5: the column appearing and disappearing with new data keeps expansion, selection and column widths', async () => {
    const args = { enableColumnSizing: true }
    const view = await mount(
      <Stories.RowExpandingFlatData {...args} dataOverride={tree} />,
    )
    const width = () =>
      document
        .querySelector(`${HEAD_CELL}[data-column-id='firstName']`)!
        .getBoundingClientRect().width
    const rowById = (id: string) =>
      document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-id='${id}']`)
    const checkbox = (id: string) =>
      rowById(id)!.querySelector<HTMLElement>('[role="checkbox"]')!

    await userEvent.click(checkbox('row-0'))
    await userEvent.click(
      rowById('node-0')!.querySelector<HTMLElement>('.row-expand-button')!,
    )
    await expect.poll(() => rowById('node-0-0')).not.toBeNull()
    const separator = document.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-column-id='firstName'] [role="separator"]`,
    )!
    separator.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    const resized = width()

    await view.rerender(
      <Stories.RowExpandingFlatData {...args} dataOverride={flat} />,
    )
    await expect.poll(() => hasColumn(COLUMN_EXPANDING_ID)).toBe(false)
    expect(checkbox('row-0').getAttribute('aria-checked')).toBe('true')
    expect(width()).toBe(resized)

    await view.rerender(
      <Stories.RowExpandingFlatData {...args} dataOverride={tree} />,
    )
    await expect.poll(() => hasColumn(COLUMN_EXPANDING_ID)).toBe(true)
    expect(rowById('node-0-0')).not.toBeNull()
    expect(checkbox('row-0').getAttribute('aria-checked')).toBe('true')
    expect(width()).toBe(resized)
  })

  test('SC7: an appearing leading service column joins the pinned block; a hidden one takes no part in sticky offsets', async () => {
    const args = { enableColumnPinning: true, enableRowSelection: false }
    const view = await mount(
      <Stories.RowExpandingFlatData {...args} dataOverride={flat} />,
    )
    const country = () =>
      document.querySelector<HTMLElement>(
        `${HEAD_CELL}[data-column-id='country']`,
      )!
    await userEvent.hover(country())
    await userEvent.click(
      country().querySelector<HTMLElement>('.column-pin__button')!,
    )
    await expect
      .poll(() => country().getAttribute('data-cell-pinned'))
      .toBe('left')
    // Скрытая колонка раскрытия не сдвигает закреплённую.
    expect(getComputedStyle(country()).left).toBe('0px')

    await view.rerender(
      <Stories.RowExpandingFlatData {...args} dataOverride={tree} />,
    )
    const expand = () =>
      document.querySelector<HTMLElement>(
        `${HEAD_CELL}[data-column-id='${COLUMN_EXPANDING_ID}']`,
      )
    await expect
      .poll(() => expand()?.getAttribute('data-cell-pinned'))
      .toBe('left')
    await expect
      .poll(() => getComputedStyle(country()).left)
      .toBe(`${Math.round(expand()!.getBoundingClientRect().width)}px`)
  })

  test('RE14: rowExpanding — no expandable rows in the data means no column; one expandable row brings it', async () => {
    const view = await mount(
      <Stories.RowExpandingFlatData dataOverride={flat} />,
    )
    expect(hasColumn(COLUMN_EXPANDING_ID)).toBe(false)
    await view.rerender(<Stories.RowExpandingFlatData dataOverride={tree} />)
    await expect.poll(() => hasColumn(COLUMN_EXPANDING_ID)).toBe(true)
    expect(
      document.querySelectorAll(`${BODY_ROW} .row-expand-button`).length,
    ).toBe(1)
  })

  test('RE15: rowExpanding — a search that hides every expandable row keeps the column', async () => {
    await mount(
      <Stories.RowExpandingFlatData dataOverride={tree} enableQuickSearch />,
    )
    expect(hasColumn(COLUMN_EXPANDING_ID)).toBe(true)
    const search = () =>
      document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
    // Тулбар грузится лениво.
    await expect.poll(search).not.toBeNull()
    await userEvent.fill(search()!, flat[0].firstName)
    await expect
      .poll(
        () =>
          document.querySelectorAll(`${BODY_ROW} .row-expand-button`).length,
      )
      .toBe(0)
    expect(hasColumn(COLUMN_EXPANDING_ID)).toBe(true)
  })

  test('RE16: rowExpanding — with the rowGrouping plugin the column is there for flat data and expands groups', async () => {
    await mount(
      <Stories.RowExpandingFlatData
        dataOverride={flat}
        enableRowGrouping
        initialGrouping={['gender']}
      />,
    )
    await expect.poll(() => hasColumn(COLUMN_EXPANDING_ID)).toBe(true)
    const group = document.querySelector<HTMLElement>(
      `${BODY_ROW}[data-group-row='true']`,
    )!
    const rows = document.querySelectorAll(BODY_ROW).length
    await userEvent.click(
      group.querySelector<HTMLElement>('.row-expand-button')!,
    )
    await expect
      .poll(() => document.querySelectorAll(BODY_ROW).length)
      .toBeGreaterThan(rows)
  })

  test('RA3: rowActions — no actions means no column; once an action is added the column is there', async () => {
    const view = await mount(<Stories.RowActionsWithoutActions />)
    expect(hasColumn(ROW_ACTIONS_COLUMN_ID)).toBe(false)
    await view.rerender(
      <Stories.RowActionsWithoutActions actionsDemo="basic" />,
    )
    await expect.poll(() => hasColumn(ROW_ACTIONS_COLUMN_ID)).toBe(true)
  })
})

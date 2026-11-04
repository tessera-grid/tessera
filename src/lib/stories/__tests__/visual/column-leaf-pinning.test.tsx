import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'
import { COLUMN_SELECTION_ID } from '../../../../lib/plugins/rowSelection'
import { COLUMN_DRAGGING_ID } from '../../../../lib/plugins/rowDragging'
import { ROW_ACTIONS_COLUMN_ID } from '../../../plugins/rowActions'
import { tableLabels } from '../labels'
import { LEAF_PINNING } from './header-fixtures'
import { columnPinningLabels } from '../../../plugins/columnPinning/labels'

// Reorder-out (LP1–LP10): под вложенной шапкой за opt-in флагом
// `columnPinningLeafPinning` закрепляется любая единица — лист или группа любого уровня.
// Отдельный файл + префикс `LP<n>`, отдельный от контракта группового пиннинга
// (CP*). Механика: при закреплении листья цели «вырываются» к левому краю через
// переупорядочивание `columnOrder`; спанящие шапки родителей режутся на сегменты
// (`buildHeaderGroups` группирует по смежным прогонам одного родителя).

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'
const PIN_BUTTON = '.column-pin__button'
const FIRST_ROW_HEAD = `${HEAD_CELL}[data-first-headers-row='true']`
const LAST_ROW_HEAD = `${HEAD_CELL}[data-last-headers-row='true']`
/** An intermediate header row cell — neither the top group row nor the leaf row. */
const MIDDLE_ROW_HEAD = `${HEAD_CELL}:not([data-first-headers-row='true']):not([data-last-headers-row='true'])`

type LeafPinningArgs = Partial<
  Parameters<typeof composed.ColumnPinningPlayground>[0]
>

async function renderLeafPinning(args: LeafPinningArgs = {}) {
  const { container } = await render(
    <composed.ColumnPinningPlayground {...LEAF_PINNING} {...args} />,
  )
  await expect
    .poll(() => container.querySelectorAll(HEAD_CELL).length)
    .toBeGreaterThan(3)
  return container
}

/** The head cell of a service column addressed by its id (spans all header rows). */
const serviceHeadCell = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)

/** A head cell addressed by its column id. */
const headCellsById = (container: HTMLElement, id: string) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      `${HEAD_CELL}[data-column-id='${id}']`,
    ),
  )

/** The leaf header cell (last header row) of a given column id. */
const leafHeadCell = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(
    `${LAST_ROW_HEAD}[data-column-id='${id}']`,
  )!

const bodyCellsById = (container: HTMLElement, id: string) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      `${BODY_CELL}[data-column-id='${id}']`,
    ),
  )

/** Reveal a leaf header's hover-hidden pin toggle and return it. */
const revealLeafPin = async (cell: HTMLElement) => {
  await userEvent.hover(cell)
  const button = cell.querySelector<HTMLElement>(PIN_BUTTON)!
  const wrapper = button.closest<HTMLElement>('[data-button-active]')!
  await expect.poll(() => getComputedStyle(wrapper).opacity).toBe('1')
  return button
}

const menuItemByText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    i => i.textContent?.trim() === text,
  )

/**
 * Toggle a header's pinning via its inline popover. The leaf-pinning story's
 * columns allow both sides (`pinSides` default `both`), so the inline pin button
 * opens a mini-menu — reveal it, then choose «Pin left» / «Pin right» (clicking
 * the same side again toggles it off).
 */
const pinLeafViaPopover = async (
  cell: HTMLElement,
  item: string = columnPinningLabels(tableLabels).pinLeft,
) => {
  await userEvent.click(await revealLeafPin(cell))
  await expect.poll(() => menuItemByText(item)).toBeTruthy()
  await userEvent.click(menuItemByText(item)!)
}

describe('Column Leaf Pinning (PoC) — reorder-out', () => {
  test('LP1: pin toggles appear on every pinnable header — leaves, top groups, and intermediate groups', async () => {
    const container = await renderLeafPinning()
    // Leaves (last header row)…
    expect(
      container.querySelector(`${LAST_ROW_HEAD} ${PIN_BUTTON}`),
    ).not.toBeNull()
    // …top-level group headers (first row)…
    expect(
      container.querySelector(`${FIRST_ROW_HEAD} ${PIN_BUTTON}`),
    ).not.toBeNull()
    // …and intermediate group headers — pinning works at any depth.
    expect(
      container.querySelector(`${MIDDLE_ROW_HEAD} ${PIN_BUTTON}`),
    ).not.toBeNull()
  })

  test('LP2: pinning a leaf peels it to the left edge and splits its group header', async () => {
    const container = await renderLeafPinning()

    // `lastName` is a middle leaf of the `name` group → before pinning the group
    // header renders as a single cell.
    expect(headCellsById(container, 'name').length).toBe(1)

    await pinLeafViaPopover(leafHeadCell(container, 'lastName'))

    // The pinned leaf's body cell is now sticky at the left edge (getStart 0).
    await expect
      .poll(() =>
        bodyCellsById(container, 'lastName')[0]?.getAttribute(
          'data-cell-pinned',
        ),
      )
      .toBe('left')
    const lastNameBody = bodyCellsById(container, 'lastName')[0]
    expect(getComputedStyle(lastNameBody).position).toBe('sticky')
    expect(getComputedStyle(lastNameBody).left).toBe('0px')

    // The `name` group header split into two cells: the left segment (over the
    // pinned leaf) and the center segment (over the remaining leaf).
    await expect.poll(() => headCellsById(container, 'name').length).toBe(2)
    const pinnedStates = headCellsById(container, 'name').map(cell =>
      cell.getAttribute('data-cell-pinned'),
    )
    expect(pinnedStates).toContain('left') // left segment is frozen…
    expect(pinnedStates).toContain('false') // …center segment scrolls
  })

  test('LP3: unpinning the leaf returns it and merges the group header back', async () => {
    const container = await renderLeafPinning()

    await pinLeafViaPopover(leafHeadCell(container, 'lastName'))
    await expect.poll(() => headCellsById(container, 'name').length).toBe(2)

    // Unpin from the (now sticky) leaf header and the split heals.
    await pinLeafViaPopover(leafHeadCell(container, 'lastName'))

    await expect.poll(() => headCellsById(container, 'name').length).toBe(1)
    await expect
      .poll(() =>
        bodyCellsById(container, 'lastName')[0]?.getAttribute(
          'data-cell-pinned',
        ),
      )
      .toBe('false')
  })

  test('LP4: pinning a whole top-level group keeps its header intact and pins all leaves as one block', async () => {
    const container = await renderLeafPinning()

    // Pin the `name` group from its top-level header cell (first row).
    const groupHead = container.querySelector<HTMLElement>(
      `${FIRST_ROW_HEAD}[data-column-id='name']`,
    )!
    await pinLeafViaPopover(groupHead)

    // Both leaves of the group are pinned…
    for (const leaf of ['firstName', 'lastName']) {
      // eslint-disable-next-line no-await-in-loop
      await expect
        .poll(() =>
          bodyCellsById(container, leaf)[0]?.getAttribute('data-cell-pinned'),
        )
        .toBe('left')
    }
    // …and the group header stays a SINGLE sticky cell (no split — the leaves
    // moved left together as one contiguous block).
    await expect.poll(() => headCellsById(container, 'name').length).toBe(1)
    expect(
      headCellsById(container, 'name')[0].getAttribute('data-cell-pinned'),
    ).toBe('left')
  })

  test('LP5: unpinning one leaf of a pinned group leaves the split segment over it inactive', async () => {
    const container = await renderLeafPinning()

    // Pin the whole `name` group…
    const groupHead = container.querySelector<HTMLElement>(
      `${FIRST_ROW_HEAD}[data-column-id='name']`,
    )!
    await pinLeafViaPopover(groupHead)
    await expect
      .poll(() =>
        bodyCellsById(container, 'firstName')[0]?.getAttribute(
          'data-cell-pinned',
        ),
      )
      .toBe('left')

    // …then unpin the `firstName` leaf from its own leaf header.
    await pinLeafViaPopover(leafHeadCell(container, 'firstName'))

    // The group header splits: `lastName` stays pinned, `firstName` returns.
    await expect.poll(() => headCellsById(container, 'name').length).toBe(2)

    // Each `name` segment's pin button active state must MATCH its pinned state —
    // the segment over the now-unpinned `firstName` must NOT stay active (the bug).
    const pinActiveOf = (segment: HTMLElement) =>
      segment
        .querySelector<HTMLElement>(PIN_BUTTON)
        ?.closest('[data-button-active]')
        ?.getAttribute('data-button-active') === 'true'

    await expect
      .poll(() =>
        headCellsById(container, 'name').every(
          segment =>
            pinActiveOf(segment) ===
            (segment.getAttribute('data-cell-pinned') === 'left'),
        ),
      )
      .toBe(true)

    const unpinnedSegment = headCellsById(container, 'name').find(
      segment => segment.getAttribute('data-cell-pinned') !== 'left',
    )!
    expect(pinActiveOf(unpinnedSegment)).toBe(false)
  })

  test('LP6: an intermediate group pins its leaves and splits its parent group header', async () => {
    const container = await renderLeafPinning()

    // `more-info` is an intermediate group (Age + Gender) under the top `info`
    // group (which also holds Visits).
    const midGroup = container.querySelector<HTMLElement>(
      `${MIDDLE_ROW_HEAD}[data-column-id='more-info']`,
    )!
    await pinLeafViaPopover(midGroup)

    // Its leaves pin left as one block…
    for (const leaf of ['age', 'gender']) {
      // eslint-disable-next-line no-await-in-loop
      await expect
        .poll(() =>
          bodyCellsById(container, leaf)[0]?.getAttribute('data-cell-pinned'),
        )
        .toBe('left')
    }
    // …the intermediate group header stays a single (sticky) cell…
    await expect
      .poll(() => headCellsById(container, 'more-info').length)
      .toBe(1)
    expect(
      headCellsById(container, 'more-info')[0].getAttribute('data-cell-pinned'),
    ).toBe('left')
    // …and its PARENT `info` group header splits (pinned Age/Gender vs. Visits).
    await expect.poll(() => headCellsById(container, 'info').length).toBe(2)
  })

  test('LP7: reorder-out keeps the auto-pinned rowActions column pinned right', async () => {
    const container = await renderLeafPinning({
      enableRowActions: true,
      enableRowSelection: true,
    })

    // The row-actions service column is auto-pinned right from the start.
    await expect
      .poll(() =>
        serviceHeadCell(container, ROW_ACTIONS_COLUMN_ID)?.getAttribute(
          'data-cell-pinned',
        ),
      )
      .toBe('right')

    // Pin a user leaf via reorder-out…
    await pinLeafViaPopover(leafHeadCell(container, 'lastName'))
    await expect
      .poll(() =>
        bodyCellsById(container, 'lastName')[0]?.getAttribute(
          'data-cell-pinned',
        ),
      )
      .toBe('left')

    // …the row-actions column is STILL pinned right (not disturbed by the reorder).
    expect(
      serviceHeadCell(container, ROW_ACTIONS_COLUMN_ID)?.getAttribute(
        'data-cell-pinned',
      ),
    ).toBe('right')
  })

  test('LP8: leading service column joins the left block on pin and releases on unpin (no leak)', async () => {
    const container = await renderLeafPinning({
      enableRowActions: true,
      enableRowSelection: true,
    })

    const selectionPinned = () =>
      serviceHeadCell(container, COLUMN_SELECTION_ID)?.getAttribute(
        'data-cell-pinned',
      )

    // Before any user pin the leading selection column is not left-pinned.
    expect(selectionPinned()).not.toBe('left')

    // Pinning a user leaf pulls the leading service column into the left block…
    await pinLeafViaPopover(leafHeadCell(container, 'lastName'))
    await expect.poll(() => selectionPinned()).toBe('left')
    // …and the selection column stays LEFT of the pinned user leaf (service keeps
    // the left edge — reorder-out inserts user pins after the leading service).
    const selLeft = serviceHeadCell(
      container,
      COLUMN_SELECTION_ID,
    )!.getBoundingClientRect().left
    const leafLeft = bodyCellsById(
      container,
      'lastName',
    )[0].getBoundingClientRect().left
    expect(selLeft).toBeLessThan(leafLeft)

    // Unpinning the last user leaf releases the leading service column (no leak of
    // service ids into the stored user pinning).
    await pinLeafViaPopover(leafHeadCell(container, 'lastName'))
    await expect.poll(() => selectionPinned()).not.toBe('left')
  })

  test('LP9: multiple leading service columns (selection + row-dragging) all stay left of pinned leaves', async () => {
    const container = await renderLeafPinning({
      enableRowSelection: true,
      enableRowDragging: true,
      enableRowActions: true,
    })

    const pinnedOf = (id: string) =>
      serviceHeadCell(container, id)?.getAttribute('data-cell-pinned')
    const leftOf = (id: string) =>
      serviceHeadCell(container, id)!.getBoundingClientRect().left

    // Both leading service columns exist and start unpinned.
    expect(serviceHeadCell(container, COLUMN_SELECTION_ID)).not.toBeNull()
    expect(serviceHeadCell(container, COLUMN_DRAGGING_ID)).not.toBeNull()
    expect(pinnedOf(COLUMN_SELECTION_ID)).not.toBe('left')
    expect(pinnedOf(COLUMN_DRAGGING_ID)).not.toBe('left')

    // Pin a user leaf → BOTH leading service columns join the left block…
    await pinLeafViaPopover(leafHeadCell(container, 'lastName'))
    await expect.poll(() => pinnedOf(COLUMN_SELECTION_ID)).toBe('left')
    await expect.poll(() => pinnedOf(COLUMN_DRAGGING_ID)).toBe('left')

    // …and both stay to the LEFT of the pinned user leaf (service keeps the edge).
    const leafLeft = bodyCellsById(
      container,
      'lastName',
    )[0].getBoundingClientRect().left
    expect(leftOf(COLUMN_SELECTION_ID)).toBeLessThan(leafLeft)
    expect(leftOf(COLUMN_DRAGGING_ID)).toBeLessThan(leafLeft)

    // Unpinning releases both leading service columns (no leak).
    await pinLeafViaPopover(leafHeadCell(container, 'lastName'))
    await expect.poll(() => pinnedOf(COLUMN_SELECTION_ID)).not.toBe('left')
    expect(pinnedOf(COLUMN_DRAGGING_ID)).not.toBe('left')
  })

  test('LP10: reorder-out pins a leaf to the RIGHT — it peels to the right edge before rowActions and splits its group header', async () => {
    const container = await renderLeafPinning({ enableRowActions: true })

    // Before pinning, the `name` group header is a single cell.
    expect(headCellsById(container, 'name').length).toBe(1)

    // Pin the `lastName` leaf RIGHT via its popover (symmetric to LP2's left pin).
    await pinLeafViaPopover(
      leafHeadCell(container, 'lastName'),
      columnPinningLabels(tableLabels).pinRight,
    )

    // The leaf's body cell is now sticky at the right edge.
    await expect
      .poll(() =>
        bodyCellsById(container, 'lastName')[0]?.getAttribute(
          'data-cell-pinned',
        ),
      )
      .toBe('right')
    expect(
      getComputedStyle(bodyCellsById(container, 'lastName')[0]).position,
    ).toBe('sticky')

    // The `name` group header splits into two segments (the pinned-right leaf +
    // the remaining `firstName` in the center), mirroring the left-pin split.
    await expect.poll(() => headCellsById(container, 'name').length).toBe(2)

    // The pinned user leaf sits to the LEFT of the trailing auto-pinned rowActions
    // column — reorder-out inserts user right-pins before the trailing service.
    const leafLeft = bodyCellsById(
      container,
      'lastName',
    )[0].getBoundingClientRect().left
    const actionsLeft = container
      .querySelector<HTMLElement>(
        `${BODY_CELL}[data-column-id='${ROW_ACTIONS_COLUMN_ID}']`,
      )!
      .getBoundingClientRect().left
    expect(leafLeft).toBeLessThan(actionsLeft)
  })
})

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  composed,
  HEAD_CELL,
  BODY_CELL,
  PIN_BUTTON,
  LEFT_PINNED_HEAD,
  FIRST_ROW_HEAD,
  LAST_ROW_HEAD,
  headCellById,
  renderColumnPinning,
  renderHeaderGroupsPinning,
  pinFirstColumn,
  pinViaPopover,
} from './column-pinning-helpers'

// CP13–CP19: вложенная шапка и сервисные столбцы.
// Каждое требование — отдельный тест с ID из таблицы требований
// docs/decisions/0011-column-pinning.md (правило именования — ADR 0009).
// Селекторы и хелперы — column-pinning-helpers.tsx.

describe('Column Pinning — nested headers and service columns', () => {
  test('CP13: under nested headers a leaf under a group is not individually pinnable', async () => {
    const container = await renderHeaderGroupsPinning()
    // Leaf headers live in the last header row — none of them carries a pin
    // toggle: only whole top-level groups are pinnable.
    expect(container.querySelectorAll(HEAD_CELL).length).toBeGreaterThan(1)
    expect(container.querySelector(`${LAST_ROW_HEAD} ${PIN_BUTTON}`)).toBeNull()
  })

  test('CP16: enabling the plugin after mount reveals top-level group pinning under nested headers (matches a fresh mount)', async () => {
    // Regression: the plugin's `feature.createColumn` wraps `getCanPin` to scope
    // pinning to top-level groups under nested headers (CP17). TanStack freezes
    // `_features` at `createTable` (useReactTable never rebuilds the table), so a
    // feature absent at mount never appears on a live toggle. The registry keeps
    // the pinning feature in `_features` even while disabled (inert until
    // `enableColumnPinning`), so a live toggle matches a fresh mount — the top
    // group buttons appear, and leaf headers stay button-free.
    const { container, rerender } = await render(
      <composed.HeaderGroupsPinning enableColumnPinning={false} />,
    )
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(1)
    // Disabled: no toggles yet.
    expect(container.querySelector(PIN_BUTTON)).toBeNull()

    // Toggle the plugin on without a remount — top-level group headers reveal
    // their pin toggle (as a fresh mount would), leaves stay button-free.
    await rerender(<composed.HeaderGroupsPinning enableColumnPinning />)
    await expect
      .poll(() => container.querySelector(PIN_BUTTON) !== null)
      .toBe(true)
    expect(container.querySelector(`${LAST_ROW_HEAD} ${PIN_BUTTON}`)).toBeNull()
  })

  test('CP17: under nested headers only top-level group headers get a pin button', async () => {
    const container = await renderHeaderGroupsPinning()
    const buttons = Array.from(
      container.querySelectorAll<HTMLElement>(PIN_BUTTON),
    )
    // There are pin toggles…
    expect(buttons.length).toBeGreaterThan(0)
    // …every one of them lives in a top (first-row) header cell…
    expect(buttons.every(btn => btn.closest(FIRST_ROW_HEAD) !== null)).toBe(
      true,
    )
    // …and none in the leaf (last) header row.
    expect(container.querySelector(`${LAST_ROW_HEAD} ${PIN_BUTTON}`)).toBeNull()
  })

  test('CP18: clicking a top-level group toggle pins the whole group (all its leaves)', async () => {
    const container = await renderHeaderGroupsPinning()
    // The `name` group spans the firstName + lastName leaves (see the mock).
    // Group headers default to `both` sides → pin via the inline popover.
    const nameGroup = headCellById(container, 'name')
    await pinViaPopover(nameGroup, 'Pin left')

    // The group header itself goes sticky-left…
    await expect
      .poll(() =>
        headCellById(container, 'name').getAttribute('data-cell-pinned'),
      )
      .toBe('left')

    // …and every leaf of the group is left-pinned in the body.
    for (const leaf of ['firstName', 'lastName']) {
      // eslint-disable-next-line no-await-in-loop
      await expect
        .poll(
          () =>
            container.querySelector(
              `${BODY_CELL}[data-column-id='${leaf}'][data-cell-pinned='left']`,
            ) !== null,
        )
        .toBe(true)
    }
  })

  test('CP19: a pinned group and its leaves stick to the left edge with the correct offset', async () => {
    const container = await renderHeaderGroupsPinning()
    const nameGroup = headCellById(container, 'name')
    await pinViaPopover(nameGroup, 'Pin left')
    await expect
      .poll(() =>
        headCellById(container, 'name').getAttribute('data-cell-pinned'),
      )
      .toBe('left')

    // The group is the only left-pinned block, so its first leaf sits flush at
    // the edge → the group header AND that leaf's body cell are sticky at 0px.
    const groupHead = headCellById(container, 'name')
    const firstLeafBody = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='firstName']`,
    )!
    expect(getComputedStyle(groupHead).position).toBe('sticky')
    expect(getComputedStyle(groupHead).left).toBe('0px')
    expect(getComputedStyle(firstLeafBody).position).toBe('sticky')
    expect(getComputedStyle(firstLeafBody).left).toBe('0px')
  })

  test('CP14: the row-actions column is auto-pinned right without any click', async () => {
    const container = await renderColumnPinning({
      enableRowSelection: true,
      enableRowActions: true,
      columnCount: 5,
    })

    // The trailing row-actions service column is auto-pinned to the right from
    // the start (no user interaction).
    const actionPins = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-actions-column-cell='true']`,
        ),
      ).map(cell => cell.getAttribute('data-cell-pinned'))
    await expect.poll(() => actionPins()).toContain('right')
  })

  test('CP14b: leading service columns follow the pinned block once a column is pinned left', async () => {
    const container = await renderColumnPinning({
      enableRowSelection: true,
      enableRowActions: true,
      columnCount: 5,
    })

    const leadingServicePins = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-actions-column-cell='true']`,
        ),
      )
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )[0]
        ?.getAttribute('data-cell-pinned')

    // Before any user pin, the leading service column is not left-pinned…
    expect(leadingServicePins()).not.toBe('left')

    // …but once the user pins a data column left, the leading service column
    // joins the left-pinned block (merge logic in useCreateState).
    await pinFirstColumn(container)
    await expect.poll(() => leadingServicePins()).toBe('left')
  })

  test('CP14c: unpinning the last user column releases leading service columns (pin.when=with-user)', async () => {
    const container = await renderColumnPinning({
      enableRowSelection: true,
      enableRowActions: true,
      columnCount: 5,
    })

    const leadingServicePin = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-actions-column-cell='true']`,
        ),
      )
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )[0]
        ?.getAttribute('data-cell-pinned')

    // Pin a data column left → the leading service column joins the left block…
    await pinFirstColumn(container)
    await expect.poll(() => leadingServicePin()).toBe('left')

    // …unpin it → with no user pins left, the leading service column releases
    // (proves service ids don't leak into the stored user pinning and keep it
    // stuck — `when: 'with-user'` is evaluated on real user pins only). Re-query
    // the data column's pin toggle fresh — the node re-rendered above (the
    // service column carries no toggle: enablePinning=false).
    const dataPinButton = container.querySelector<HTMLElement>(
      `${LEFT_PINNED_HEAD} ${PIN_BUTTON}`,
    )!
    await userEvent.click(dataPinButton)
    await expect.poll(() => leadingServicePin()).not.toBe('left')
  })

  test('CP15: a pinned column cannot be dragged — covered by column-dragging D29', () => {
    // The pinned-column-not-draggable guarantee is exercised where dragging lives:
    // see `column-dragging.test.tsx` → D29 (docs/decisions/0006-dnd-with-dnd-kit.md).
    // Kept as a named marker so CP15 shows up in the requirement roll-call.
    expect(true).toBe(true)
  })
})

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import { ROW_ACTIONS_COLUMN_ID } from '../../../core/createColumns'
import { DEFAULT_LABELS } from '../../../core/localization'

import {
  HEAD_CELL,
  BODY_CELL,
  headCellById,
  renderColumnPinning,
  revealPin,
  menuItems,
  menuItemByText,
  pinViaPopover,
} from './column-pinning-helpers'

// CP20–CP27: закрепление справа, колонка действий, виртуализация.
// Каждое требование — отдельный тест с ID из таблицы требований
// docs/decisions/0011-column-pinning.md (правило именования — ADR 0009).
// Селекторы и хелперы — column-pinning-helpers.tsx.

describe('Column Pinning — right side', () => {
  test('CP20: a both-sided column opens a pin popover; a one-sided column toggles directly', async () => {
    const container = await renderColumnPinning()

    // `firstName` allows both sides (default) → its inline pin is a popover with
    // two directional items, and clicking the trigger does not pin on its own.
    const both = headCellById(container, 'firstName')
    await userEvent.click(await revealPin(both))
    await expect.poll(() => menuItemByText('Pin left')).toBeTruthy()
    expect(menuItemByText('Pin right')).toBeTruthy()
    expect(both.getAttribute('data-cell-pinned')).toBe('false')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => menuItems().length).toBe(0)

    // `country` is `pinSides:'start'` (see the mock) → the inline pin is a direct
    // toggle: clicking it pins left with no popover.
    const oneSide = headCellById(container, 'country')
    await userEvent.click(await revealPin(oneSide))
    await expect
      .poll(() =>
        headCellById(container, 'country').getAttribute('data-cell-pinned'),
      )
      .toBe('left')
    expect(menuItems().length).toBe(0)
  })

  test('CP21: choosing "Pin right" sticks the column to the right edge (mounted at scroll 0)', async () => {
    const container = await renderColumnPinning()

    // Pin a both-sided column right via the popover. It must render sticky at the
    // right edge immediately — without scrolling — even under column virtualization
    // (the range extractor re-windows on the pinning change).
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')

    const rightHead = () =>
      container.querySelector<HTMLElement>(
        `${HEAD_CELL}[data-column-id='firstName'][data-cell-pinned='right']`,
      )
    await expect.poll(() => rightHead() !== null).toBe(true)
    const head = rightHead()!
    expect(getComputedStyle(head).position).toBe('sticky')
    // Only right-pinned column → flush at the right edge (getAfter('right') === 0).
    expect(getComputedStyle(head).right).toBe('0px')
    // Its body cell mounts and is sticky too (proves it left the virtual window
    // yet stays pinned).
    const body = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='firstName'][data-cell-pinned='right']`,
    )!
    expect(body).toBeTruthy()
    expect(getComputedStyle(body).position).toBe('sticky')
  })

  test('CP22: a right-pinned column keeps a background and a left divider border', async () => {
    const container = await renderColumnPinning()
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')

    const body = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='firstName'][data-cell-pinned='right']`,
    )!
    // Opaque background so scrolled content can't bleed through (mirror of left).
    await expect
      .poll(() => {
        const bg = getComputedStyle(body).backgroundColor
        return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      })
      .toBe(true)
    // The first (leftmost) right-pinned column carries the divider on its left.
    expect(body.getAttribute('data-cell-first-right-pinned')).toBe('true')
    expect(parseFloat(getComputedStyle(body).borderLeftWidth)).toBeGreaterThan(
      0,
    )
  })

  test('CP27: an end-only column pins to the right with a direct toggle', async () => {
    // Explicit columns so the end-only column (c1) is mounted at scroll 0 under
    // column virtualization in any viewport width.
    const columns = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      accessorKey: `c${i}`,
      header: `C${i}`,
      size: 150,
      enablePinning: true,
      ...(i === 1 ? { meta: { pinSides: 'end' as const } } : {}),
    }))
    const container = await renderColumnPinning({ columnsOverride: columns })

    // `pinSides:'end'` → the inline pin is a direct toggle that pins RIGHT (the
    // logical `end` side), with no popover.
    await userEvent.click(await revealPin(headCellById(container, 'c1')))
    await expect
      .poll(() =>
        headCellById(container, 'c1').getAttribute('data-cell-pinned'),
      )
      .toBe('right')
    expect(menuItems().length).toBe(0)
    expect(getComputedStyle(headCellById(container, 'c1')).position).toBe(
      'sticky',
    )
  })

  // --- Row-actions column (CP23–CP25) ----------------------------------------
  // The trailing row-actions service column is auto-pinned right (CP14). These
  // pin down how it looks in the two-sided world: transparent by default, but
  // adopting the pinned backing once the user pins a data column right.

  /** The auto-pinned row-actions column body/head cells. */
  const actionsBody = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='${ROW_ACTIONS_COLUMN_ID}']`,
    )!
  const actionsHead = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-column-id='${ROW_ACTIONS_COLUMN_ID}']`,
    )!
  /** A cell paints an opaque (non-transparent) background. */
  const isOpaque = (el: HTMLElement) => {
    const bg = getComputedStyle(el).backgroundColor
    return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
  }

  test('CP23: the row-actions column is transparent by default but adopts the pinned backing once a column is pinned right', async () => {
    const container = await renderColumnPinning({ enableRowActions: true })

    // Auto-pinned right (CP14) yet the SOLE right column → first-right, no backing.
    await expect
      .poll(() => actionsBody(container).getAttribute('data-cell-pinned'))
      .toBe('right')
    expect(
      actionsBody(container).getAttribute('data-cell-first-right-pinned'),
    ).toBe('true')
    expect(isOpaque(actionsBody(container))).toBe(false)

    // Pin a both-sided data column right → row-actions is no longer first-right
    // and joins the pinned block with the same backing (body).
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')
    await expect
      .poll(() =>
        actionsBody(container).getAttribute('data-cell-first-right-pinned'),
      )
      .toBe('false')
    await expect.poll(() => isOpaque(actionsBody(container))).toBe(true)

    // Its header adopts the backing too — sticky, aligned with its body, and with
    // no visible content: only the visually hidden service label (ADR 0032, W13).
    const head = actionsHead(container)
    expect(isOpaque(head)).toBe(true)
    expect(getComputedStyle(head).position).toBe('sticky')
    expect(head.textContent).toBe(DEFAULT_LABELS.rowActionsColumn)
    expect(
      Array.from(head.querySelectorAll<HTMLElement>('*')).some(
        el =>
          el.childElementCount === 0 &&
          !!el.textContent?.trim() &&
          el.getBoundingClientRect().width > 1,
      ),
    ).toBe(false)
    expect(Math.round(head.getBoundingClientRect().left)).toBe(
      Math.round(actionsBody(container).getBoundingClientRect().left),
    )
  })

  test('CP24: a user right-pin sits left of the row-actions column, which never carries a divider', async () => {
    const container = await renderColumnPinning({ enableRowActions: true })
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')

    const userPin = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='firstName'][data-cell-pinned='right']`,
    )!
    const actions = actionsBody(container)

    // User right-pin is to the LEFT of the trailing row-actions column.
    await expect
      .poll(() => userPin.getBoundingClientRect().left)
      .toBeLessThan(actions.getBoundingClientRect().left)

    // The user column is first in the right block → it carries the divider;
    // the row-actions column never does (even though it is right-pinned).
    expect(userPin.getAttribute('data-cell-first-right-pinned')).toBe('true')
    expect(
      parseFloat(getComputedStyle(userPin).borderLeftWidth),
    ).toBeGreaterThan(0)
    expect(parseFloat(getComputedStyle(actions).borderLeftWidth)).toBe(0)
  })

  test('CP25: row-action buttons keep an opaque chip so they read over scrolled content', async () => {
    const container = await renderColumnPinning({ enableRowActions: true })

    // The row-actions column is sticky and transparent, so scrolled content can
    // pass under it; each row-action button must stay an opaque chip (background
    // + elevation) to remain legible. Buttons live in the row-actions cell,
    // revealed on row hover.
    const row = container.querySelector<HTMLElement>('.data-grid__body-row')!
    await userEvent.hover(row)
    const button = actionsBody(container).querySelector<HTMLElement>(
      '.row__button button',
    )!
    expect(button).toBeTruthy()
    expect(isOpaque(button)).toBe(true)
    expect(getComputedStyle(button).boxShadow).not.toBe('none')
  })

  // --- Virtualization order (CP26) ----------------------------------------------

  test('CP26: center columns stay contiguous after right-pinning a column of a different width', async () => {
    // 20 равных столбцов, кроме c5 (400px, закрепляемый только вправо). Закрепление
    // уносит c5 в конец порядка отображения; виртуализатор обязан размечать слоты в
    // том же порядке, иначе ширина c5 ляжет в слот c6 и центр «разъедется».
    const columns = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      accessorKey: `c${i}`,
      header: `C${i}`,
      size: i === 5 ? 400 : 150,
      enablePinning: true,
      ...(i === 5 ? { meta: { pinSides: 'end' as const } } : {}),
    }))
    const container = await renderColumnPinning({ columnsOverride: columns })

    await userEvent.click(await revealPin(headCellById(container, 'c5')))
    await expect
      .poll(
        () =>
          container.querySelector(
            `${HEAD_CELL}[data-column-id='c5'][data-cell-pinned='right']`,
          ) !== null,
      )
      .toBe(true)

    const centerHeads = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-virtual-cell]`,
        ),
      ).sort(
        (a, b) =>
          a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      )
    /** Зазор между каждым центральным заголовком и его левым соседом, px. */
    const gaps = () => {
      const rects = centerHeads().map(head => head.getBoundingClientRect())
      return rects
        .slice(1)
        .map((rect, i) => Math.round(rect.left - rects[i].right))
    }

    // Окно содержит соседей бывшей позиции c5 — именно там разъезжался бы центр.
    await expect
      .poll(() =>
        centerHeads().map(head => head.getAttribute('data-column-id')),
      )
      .toEqual(expect.arrayContaining(['c4', 'c6', 'c7']))
    await expect.poll(() => gaps().every(gap => Math.abs(gap) <= 1)).toBe(true)
  })
})

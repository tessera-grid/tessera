import type { RowSelectionState } from '@tanstack/react-table'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import { ROW_ACTIONS_COLUMN_ID } from '../../../core/createColumns'
import { DEFAULT_LABELS } from '../../../core/localization'
import { syncStickyGeometry } from '../../../core/stickyGeometry'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnPinning, rowActions, rowSelection } from '../../../plugins'

import {
  HEAD_CELL,
  BODY_CELL,
  headCellById,
  renderColumnPinning,
  revealPin,
  menuItems,
  menuItemByText,
  pinViaPopover,
  headVsBodyColumns,
  scrollerOf,
  withWideViewport,
} from './column-pinning-helpers'

// CP20–CP27, CP29, CP34: закрепление справа, колонка действий, виртуализация.
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
    await expect.poll(() => isOpaque(head)).toBe(true)
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
    // Firefox после перекладки отдаёт sticky-ячейкам незакреплённое положение, пока
    // не прокрутят (ADR 0085) — пересчитать, как грид перед нажатием.
    syncStickyGeometry(
      container.querySelector<HTMLElement>('.data-grid__container')!,
    )
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
    // + shadow: the overlay button variant, ADR 0017, TC-9) to remain legible. Buttons live in the row-actions cell,
    // revealed on row hover.
    // Наводим на ячейку действий самой строки: центр широкой строки может быть
    // вне видимой области, и наведения не случилось бы.
    await userEvent.hover(actionsBody(container))
    const button = actionsBody(container).querySelector<HTMLElement>(
      '.row__button button',
    )!
    expect(button).toBeTruthy()
    await expect.poll(() => isOpaque(button)).toBe(true)
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

  test('CP29: with free space on the right, right-pinned headers keep the left edge and width of their body columns', async () => {
    await withWideViewport(async () => {
      const container = await renderColumnPinning({ columnCount: 5 })
      await pinViaPopover(headCellById(container, 'lastName'), 'Pin right')
      await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')
      await expect
        .poll(
          () =>
            container.querySelectorAll(`${HEAD_CELL}[data-cell-pinned='right']`)
              .length,
        )
        .toBe(2)
      // Свободное место есть: колонки уже контейнера, иначе растягивать нечего.
      const scroller = scrollerOf(container)
      expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth)
      for (const { id, head, body } of headVsBodyColumns(container)) {
        expect(head, id!).toEqual(body)
      }
    })
  })
})

// CP34: непрозрачные ячейки справа (пользовательский пин и колонка действий в правом
// блоке) следуют наведению и выбору строки так же, как закреплённые слева.
interface Cp34Item {
  id: string
  a: string
  b: string
  c: string
}
const CP34_DATA: Cp34Item[] = Array.from({ length: 4 }, (_, i) => ({
  id: `r${i}`,
  a: `A${i}`,
  b: `B${i}`,
  c: `C${i}`,
}))
const cp34Actions = {
  id: 'cp34Actions',
  slotActions: [
    {
      id: 'open',
      slot: 'actionRowSlot',
      icon: () => <span aria-hidden>O</span>,
      label: () => 'Open',
      onSelect: () => {},
    },
  ],
}
const CP34_SELECTED = { r1: true, r2: true }
const Cp34Grid = () => {
  const table = useCreateTable({
    columns: [
      { id: 'a', accessorKey: 'a', header: 'A', size: 120 },
      { id: 'b', accessorKey: 'b', header: 'B', size: 160 },
      { id: 'c', accessorKey: 'c', header: 'C', size: 120 },
    ] as never,
    data: CP34_DATA,
    getRowId: (row: Cp34Item) => row.id,
    state: { columnPinning: { start: ['a'], end: ['c'] } },
    plugins: [
      columnPinning(),
      rowSelection({ rowSelection: CP34_SELECTED as RowSelectionState }),
      rowActions(),
      cp34Actions,
    ] as never,
  } as never)
  return (
    <div style={{ width: 640, height: 320 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Column Pinning — right side, row states', () => {
  test('CP34: right-pinned opaque cells (user pin and the actions column in the right block) follow row hover and selection like left-pinned ones', async () => {
    await render(<Cp34Grid />)
    const row = (id: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="${id}"]`,
      )!
    await expect.poll(() => row('r0')).toBeTruthy()
    // Фон закреплённой ячейки и слои поверх: наведение и выбор — слой строки (ADR 0126).
    const bg = (id: string, column: string) => {
      const style = getComputedStyle(
        row(id).querySelector<HTMLElement>(`[data-column-id="${column}"]`)!,
      )
      return `${style.backgroundColor} ${style.backgroundImage}`
    }
    const actions = row('r0').querySelector<HTMLElement>(
      `[data-column-id="${ROW_ACTIONS_COLUMN_ID}"]`,
    )!
    expect(actions.dataset.cellPinned).toBe('right')
    expect(actions.dataset.cellFirstRightPinned).not.toBe('true')

    const sameAsLeft = async (id: string, state: string) => {
      for (const column of ['c', ROW_ACTIONS_COLUMN_ID]) {
        await expect
          .poll(() => [state, column, bg(id, column)])
          .toEqual([state, column, bg(id, 'a')])
      }
    }
    // Покой: r0 — чётная, r3 — нечётная; r1 и r2 — выбранные.
    const rest = { r0: bg('r0', 'a'), r1: bg('r1', 'a') }
    await sameAsLeft('r0', 'покой')
    await sameAsLeft('r3', 'покой, нечётная')
    await sameAsLeft('r1', 'выбор')
    await sameAsLeft('r2', 'выбор, нечётная')

    await userEvent.hover(row('r0').querySelector('[data-column-id="b"]')!)
    await expect.poll(() => bg('r0', 'a')).not.toBe(rest.r0)
    await sameAsLeft('r0', 'наведение')

    await userEvent.hover(row('r1').querySelector('[data-column-id="b"]')!)
    await expect.poll(() => bg('r1', 'a')).not.toBe(rest.r1)
    await sameAsLeft('r1', 'выбор и наведение')
  })
})

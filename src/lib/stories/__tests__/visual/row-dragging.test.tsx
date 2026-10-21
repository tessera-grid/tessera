import { addons, mockChannel } from 'storybook/preview-api'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { PlayArgs } from '../../__mocks__/catalog'
import { composed } from '../stories'
import {
  DRAG_COLUMN_WIDTH,
  DRAG_FILL,
  DRAG_ICON_SIZE,
  HANDLE,
  OVERLAY,
  ROW,
  SCROLLER,
  USER_CELL,
  beginDrag,
  dragRowOnto,
  firePointer,
  nextFrame,
  rowIdOrder,
  sortedRows,
} from '../../rowDragging.dnd'
import { violations } from './a11y-helpers'

// Every Row Dragging requirement is its own named test, prefixed with its spec ID
// (D1–D14, the row block of the shared drag & drop requirements table in
// docs/decisions/0006-dnd-with-dnd-kit.md; columns are D15–D30).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md). All tests drive the canonical `RowDragging`
// story, sized to overflow on both axes so the auto-scroll requirements (D12–D14)
// have real scroll distance. The thin Storybook `play` in dataGridMeta.tsx is
// only a demo scenario now; the assertions live here. Synthetic pointer events
// drive the mechanics; the one thing they can't do — the CSS-`:hover` reveal (D7)
// — uses trusted Playwright input.

/** Render the RowDragging story and wait until its rows are on screen. */
async function renderRowDragging() {
  const { container } = await render(<composed.RowDragging />)
  await expect
    .poll(() => container.querySelectorAll(ROW).length)
    .toBeGreaterThan(3)
  return container
}

/** The overflowing scroll container of the rendered grid. */
const scrollerOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(SCROLLER)!

/** True once `sourceId` sits BELOW `targetId` in the visible id-order (real move). */
const movedBelow = (
  container: HTMLElement,
  sourceId: string | null,
  targetId: string | null,
) => {
  const after = rowIdOrder(container)
  const si = after.indexOf(sourceId)
  const ti = after.indexOf(targetId)
  return si !== -1 && ti !== -1 && si > ti
}

// --- Setup guard --------------------------------------------------------------
// Not a requirement itself; it protects the auto-scroll requirements (D12–D14)
// from silently passing when the grid doesn't actually overflow.

describe('Row Dragging — setup guard', () => {
  test('RowDragging story overflows on both axes (feeds D12–D14)', async () => {
    const scroller = scrollerOf(await renderRowDragging())
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
  })
})

// --- Requirements (D1–D14) ----------------------------------------------------

describe('Row Dragging — requirements', () => {
  test('D1: the plugin activates when `enableRowDragging` is on', async () => {
    // With the flag on, the story renders drag handles at all.
    const container = await renderRowDragging()
    expect(container.querySelectorAll(HANDLE).length).toBeGreaterThan(0)
  })

  test('D2: the drag handle lives in the dedicated first (service) column', async () => {
    const container = await renderRowDragging()
    const handle = container.querySelector<HTMLElement>(HANDLE)!
    const dragCell = handle.closest<HTMLElement>('.data-grid__body-cell')!
    const row = handle.closest<HTMLElement>(ROW)!

    // It is an action column...
    expect(dragCell.getAttribute('data-actions-column-cell')).toBe('true')
    // ...and the left-most cell of its row.
    expect(dragCell).toBe(row.querySelector('.data-grid__body-cell'))
  })

  test('D3: the drag handle icon is 16×16', async () => {
    const container = await renderRowDragging()
    const svg = container.querySelector<HTMLElement>(`${HANDLE} svg`)!
    const style = getComputedStyle(svg)
    expect(style.width).toBe(`${DRAG_ICON_SIZE}px`)
    expect(style.height).toBe(`${DRAG_ICON_SIZE}px`)
  })

  test('D4: the service column width is 32px (compact button 24 + padding 4 + 4)', async () => {
    const container = await renderRowDragging()
    const dragCell = container
      .querySelector<HTMLElement>(HANDLE)!
      .closest<HTMLElement>('.data-grid__body-cell')!
    // Spec width: 24 + 4 + 4 = 32 (`COLUMN_DRAGGING_SIZE`, border-box cell).
    expect(Math.round(dragCell.getBoundingClientRect().width)).toBe(
      DRAG_COLUMN_WIDTH,
    )
  })

  test('D5: one drag handle renders per draggable row', async () => {
    const container = await renderRowDragging()
    const rows = container.querySelectorAll(ROW)
    const handles = container.querySelectorAll(HANDLE)
    // Every rendered row is draggable here, so each carries exactly one handle.
    expect(handles.length).toBe(rows.length)
  })

  test('D6: the drag handle is hidden (opacity 0) until the row is hovered', async () => {
    const container = await renderRowDragging()
    const icon = container.querySelector<HTMLElement>(`${HANDLE} svg`)!
    expect(getComputedStyle(icon).opacity).toBe('0')
  })

  test('D7: the drag handle is revealed on row hover', async () => {
    const container = await renderRowDragging()
    // The top row (data-index 0) is reliably on-screen; hovering its first user
    // cell puts `:hover` on the row ancestor, which drives the reveal.
    const row = sortedRows(container).find(
      r => r.getAttribute('data-index') === '0',
    )!
    const cell = row.querySelector<HTMLElement>(USER_CELL)!
    const icon = row.querySelector<HTMLElement>(`${HANDLE} svg`)!

    // Trusted hover (real pointer) triggers the CSS `:hover` reveal on the row.
    await userEvent.hover(cell)
    await expect.poll(() => getComputedStyle(icon).opacity).toBe('1')
  })

  test('D8: dragging shows the "cloud" overlay', async () => {
    const container = await renderRowDragging()
    const rows = sortedRows(container)
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    const { hx } = await beginDrag(handle)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty)
    await nextFrame()
    await nextFrame()
    try {
      await expect
        .poll(() => container.querySelector(OVERLAY) !== null)
        .toBe(true)
    } finally {
      firePointer('pointerup', document, hx, ty)
    }
  })

  test('D37: облако перетаскивания строки — визуальный клон вне дерева доступности и фокуса: пока оно на экране, axe по таблице без нарушений', async () => {
    const container = await renderRowDragging()
    const rows = sortedRows(container)
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    const { hx } = await beginDrag(handle)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty)
    await nextFrame()
    await nextFrame()
    try {
      await expect
        .poll(() => container.querySelector(OVERLAY) !== null)
        .toBe(true)
      expect(
        container.querySelector(OVERLAY)!.closest('[inert]'),
      ).not.toBeNull()
      expect((await violations()).map(found => found.id)).toEqual([])
    } finally {
      firePointer('pointerup', document, hx, ty)
    }
  })

  test('D9: the dragged row slot shows the drop-indicator fill', async () => {
    const container = await renderRowDragging()
    const rows = sortedRows(container)
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    const { hx } = await beginDrag(handle)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty)
    await nextFrame()
    await nextFrame()
    try {
      await expect
        .poll(() => container.querySelector(DRAG_FILL) !== null)
        .toBe(true)
    } finally {
      firePointer('pointerup', document, hx, ty)
    }
  })

  test('D10: on drop the row takes a new index → order changes', async () => {
    const container = await renderRowDragging()
    const scroller = scrollerOf(container)
    const rows = sortedRows(container)
    const sourceId = rows[0].getAttribute('data-row-id')
    const targetId = rows[3].getAttribute('data-row-id')

    const before = rowIdOrder(container)
    expect(before.indexOf(sourceId)).toBeLessThan(before.indexOf(targetId))

    await dragRowOnto(rows[0], rows[3])
    scroller.scrollTop = 0

    // Честно по data-row-id: перетащенная строка реально ушла НИЖЕ цели — не по
    // тексту ячеек и не за счёт сдвига окна виртуализации.
    await expect
      .poll(() => movedBelow(container, sourceId, targetId))
      .toBe(true)
  })

  test('D11: after drop the cloud + fill are gone', async () => {
    const container = await renderRowDragging()
    const rows = sortedRows(container)
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    const { hx } = await beginDrag(handle)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty)
    await nextFrame()
    await nextFrame()
    firePointer('pointerup', document, hx, ty + 1)

    // Overlay unmounts and the fill attribute clears once the drag ends.
    await expect
      .poll(
        () =>
          container.querySelector(OVERLAY) === null &&
          container.querySelector(DRAG_FILL) === null,
      )
      .toBe(true)
  })

  test('D12: dragging near the bottom edge auto-scrolls vertically', async () => {
    const container = await renderRowDragging()
    const scroller = scrollerOf(container)

    scroller.scrollTop = 0
    await nextFrame()
    const handle = sortedRows(container)[0].querySelector<HTMLElement>(HANDLE)!
    const { hx, hy } = await beginDrag(handle)
    const cr = scroller.getBoundingClientRect()
    // Hold inside the bottom threshold; dnd-kit keeps scrolling per frame.
    firePointer(
      'pointermove',
      document,
      cr.left + cr.width / 2,
      cr.bottom - cr.height * 0.05,
    )
    try {
      await expect
        .poll(() => scroller.scrollTop, { timeout: 2000 })
        .toBeGreaterThan(0)
    } finally {
      firePointer('pointerup', document, hx, hy)
    }
    await nextFrame()
  })

  test('D13: a row reorders correctly after a vertical scroll', async () => {
    const container = await renderRowDragging()
    const scroller = scrollerOf(container)

    scroller.scrollTop = Math.min(
      1500,
      scroller.scrollHeight - scroller.clientHeight,
    )
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
    }

    const preScroll = scroller.scrollTop
    const rows = sortedRows(container)
    const source = rows[1]
    const target = rows[4]
    const sourceId = source.getAttribute('data-row-id')
    const targetId = target.getAttribute('data-row-id')

    const before = rowIdOrder(container)
    expect(before.indexOf(sourceId)).toBeLessThan(before.indexOf(targetId))

    // Mid-container target (no edge → no auto-scroll): the reorder is what moves.
    await dragRowOnto(source, target)
    scroller.scrollTop = preScroll

    // Честно по data-row-id (после вертикального скролла): строка ушла ниже цели.
    await expect
      .poll(() => movedBelow(container, sourceId, targetId))
      .toBe(true)
  })

  test('D14: dragging near the right edge never scrolls horizontally', async () => {
    const container = await renderRowDragging()
    const scroller = scrollerOf(container)

    scroller.scrollLeft = 0
    scroller.scrollTop = 0
    await nextFrame()
    const handle = sortedRows(container)[0].querySelector<HTMLElement>(HANDLE)!
    const { hx, hy } = await beginDrag(handle)
    const cr = scroller.getBoundingClientRect()
    // Near the right edge but vertically centred (outside the vertical threshold).
    firePointer(
      'pointermove',
      document,
      cr.right - cr.width * 0.03,
      cr.top + cr.height / 2,
    )
    for (let i = 0; i < 40; i++) {
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
    }
    try {
      expect(scroller.scrollLeft).toBe(0)
    } finally {
      firePointer('pointerup', document, hx, hy)
    }
    await nextFrame()
  })
})

// --- Nested rows (subrows) ----------------------------------------------------
// Вложенный drag реализован в reducer'е (splice по subRows/parentRow, depth), но
// каноническая RowDragging-история плоская — здесь он проверяется на вложенном моке.
// Раскрытое дерево мока: item-id-0 (root) → [item-id-0-0 → item-id-0-0-0,
// item-id-0-1, item-id-0-2], затем item-id-1. Проверка по стабильному data-row-id.

describe('Row Dragging — nested rows (subrows)', () => {
  async function renderNested() {
    const { container } = await render(
      <composed.RowDragging
        dataNesting="nested"
        enableRowExpanding
        initialExpanded
      />,
    )
    await expect
      .poll(() => container.querySelectorAll(ROW).length)
      .toBeGreaterThan(2)
    return container
  }
  const rowById = (container: HTMLElement, id: string) =>
    container.querySelector<HTMLElement>(`[data-row-id="${id}"]`)!

  test('DN1: expanded tree renders its subrows (nested drag has targets)', async () => {
    const container = await renderNested()
    const ids = rowIdOrder(container)
    // Родитель и обе его субстроки присутствуют одновременно.
    expect(ids).toContain('item-id-0')
    expect(ids).toContain('item-id-0-1')
    expect(ids).toContain('item-id-0-2')
  })

  test('DN2: a subrow reorders among its siblings, losing no row', async () => {
    const container = await renderNested()

    const before = rowIdOrder(container)
    // item-id-0-1 и item-id-0-2 — сиблинги-субстроки под item-id-0.
    expect(before.indexOf('item-id-0-1')).toBeLessThan(
      before.indexOf('item-id-0-2'),
    )

    await dragRowOnto(
      rowById(container, 'item-id-0-1'),
      rowById(container, 'item-id-0-2'),
    )

    // Честно по data-row-id: субстрока реально ушла за сиблинга, и ни одна строка
    // дерева не пропала.
    await expect
      .poll(() => {
        const after = rowIdOrder(container)
        return (
          movedBelow(container, 'item-id-0-1', 'item-id-0-2') &&
          before.every(id => after.includes(id))
        )
      })
      .toBe(true)
  })
})

// --- Storybook parity ---------------------------------------------------------
// Свой `play` историй с перетаскиванием строк (демо «Default» и сценарии) — дымовой
// прогон, чтобы сломанный сценарий падал и в `npm test`. Мета `play` не несёт (ADR 0117, SN12).

describe('Row Dragging — Storybook play parity', () => {
  const draggableStories = Object.entries(composed).filter(
    ([, story]) => story.args?.enableRowDragging && story.play,
  )

  test('at least one story enables row dragging', () => {
    expect(draggableStories.length).toBeGreaterThan(0)
  })

  test.each(draggableStories)(
    '%s: the demo play scenario runs without throwing',
    async (_name, Story) => {
      // Аргументы, которые меняет `play` (`updateArgs`), доходят до истории, как в каталоге:
      // без установленного канала каждый `getChannel` даёт новый.
      if (!addons.hasChannel()) addons.setChannel(mockChannel())
      const { container } = await render(
        <PlayArgs storyId={Story.id}>
          {updates => <Story {...updates} />}
        </PlayArgs>,
      )
      expect(Story.play).toBeDefined()
      await Story.play!({ canvasElement: container, id: Story.id })
    },
  )
})

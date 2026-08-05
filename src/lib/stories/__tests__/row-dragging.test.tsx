import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../DataGrid.stories'

// The row-dragging visual test lives as a meta-level Storybook `play` in
// DataGrid.stories.tsx (so it runs on ANY story that turns `enableRowDragging`
// on). The `RowDragging` story is sized to overflow on both axes, so running its
// play here also exercises the auto-scroll requirements (R12–R14). This runner
// drives that play under vitest-browser so it runs in `npm test` and its result
// is observable. It additionally verifies the one thing a synthetic play cannot:
// the CSS-`:hover` reveal of the drag handle, which needs trusted (Playwright)
// input.

const composed = composeStories(stories)

/** Every composed story whose args enable row dragging. */
const draggableStories = Object.entries(composed).filter(
  ([, story]) => story.args?.enableRowDragging,
)

const ROW = '.data-grid__body-row'
const HANDLE_ICON = '.drag__handler--column svg'

describe('Row Dragging (Storybook play)', () => {
  // Sanity: the filter actually matched a story, so we don't silently test nothing.
  test('there is at least one draggable story', () => {
    expect(draggableStories.length).toBeGreaterThan(0)
  })

  // Guard: the play's R12–R14 steps self-skip unless the grid actually
  // overflows. Keep the RowDragging story scroll-sized so those steps really run
  // (shrinking it would silently drop auto-scroll coverage).
  test('RowDragging story overflows on both axes (feeds R12–R14)', async () => {
    const { container } = await render(<composed.RowDragging />)
    await expect
      .poll(() => container.querySelectorAll(ROW).length)
      .toBeGreaterThan(0)

    const scroller = container.querySelector<HTMLElement>(
      '.MuiTableContainer-root',
    )!
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
  })

  test.each(draggableStories)('%s: play passes', async (_name, Story) => {
    const { container } = await render(<Story />)
    // The meta-level play is attached to every story; assert then run it.
    expect(Story.play).toBeDefined()
    await Story.play!({ canvasElement: container })
  })

  test('drag handle is hidden by default and revealed on row hover', async () => {
    const { container } = await render(<composed.RowDragging />)

    await expect
      .poll(() => container.querySelectorAll(ROW).length)
      .toBeGreaterThan(0)

    // The top row (data-index 0, top:0) is reliably on-screen; its first user
    // cell is a stable hover target. Hovering a descendant cell puts `:hover`
    // on the BodyRow ancestor, which is what drives the reveal.
    const row = Array.from(container.querySelectorAll<HTMLElement>(ROW)).find(
      r => r.getAttribute('data-index') === '0',
    )!
    const cell = row.querySelector<HTMLElement>(
      '.data-grid__body-cell:not([data-actions-column-cell="true"])',
    )!
    const icon = row.querySelector<HTMLElement>(HANDLE_ICON)!

    // Hidden until hovered.
    expect(getComputedStyle(icon).opacity).toBe('0')

    // Trusted hover (real pointer) triggers the CSS `:hover` reveal on the row.
    await userEvent.hover(cell)
    await expect.poll(() => getComputedStyle(icon).opacity).toBe('1')
  })
})

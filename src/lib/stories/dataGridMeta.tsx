// Общий meta историй DataGrid: дефолтные аргументы, render и демо-play.
import { Meta } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { expect, waitFor } from 'storybook/test'
import {
  HANDLE,
  ROW,
  beginDrag,
  firePointer,
  nextFrame,
  rowSignatures,
  sortedRows,
} from './rowDragging.dnd'
import {
  COLUMN_COUNT,
  DATA_COUNT,
  type StoryProps,
} from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'

// --- Row Dragging demo scenario -----------------------------------------------
// Meta-level play: runs for EVERY story, but only does anything when the story
// actually enables row dragging (`args.enableRowDragging`). It is intentionally
// THIN — a single representative drag-and-drop so the Storybook Interactions
// panel demonstrates the feature. The per-requirement assertions (handle, hover
// reveal, cloud + fill, column width, auto-scroll D12–D14) each live as their
// own named test in `__tests__/row-dragging.test.tsx`, so `npm test` reports and
// fails them individually. Both share the pointer choreography in
// `rowDragging.dnd.ts` so the demo and the tests can't drift apart.

const rowDraggingPlay: NonNullable<Meta<StoryProps>['play']> = async ({
  args,
  canvasElement,
  step,
}) => {
  if (!args.enableRowDragging) return

  const canvas = canvasElement

  await waitFor(() =>
    expect(canvas.querySelectorAll(ROW).length).toBeGreaterThan(3),
  )

  await step('drag the first row onto a lower row and drop', async () => {
    const before = rowSignatures(canvas)
    const rows = sortedRows(canvas)
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    // Keep x fixed (no horizontal drift) so nesting depth stays 0 on flat data.
    const { hx } = await beginDrag(handle)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty) // over the target row
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, hx, ty + 1) // settle collision/over
    await nextFrame()
    await nextFrame()
    firePointer('pointerup', document, hx, ty + 1)

    // Sanity for the demo: the drop reordered the rows.
    await waitFor(() =>
      expect(rowSignatures(canvas).join('¦')).not.toBe(before.join('¦')),
    )
  })
}

export const dataGridMeta = {
  args: {
    columnCount: COLUMN_COUNT,
    dataCount: DATA_COUNT,
  },
  play: rowDraggingPlay,
  parameters: {
    backgrounds: { disable: true },
    layout: 'fullscreen',
    controls: {
      expanded: true,
      exclude: ['dataMode', 'colorMode'],
    },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return <StoryComponent {...normalizeArgs(args)} updateArgs={updateArgs} />
  },
} satisfies Meta<StoryProps>

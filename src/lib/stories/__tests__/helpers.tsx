import type { ComponentProps } from 'react'

import { commands } from '@vitest/browser/context'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'

import * as stories from '../DataGrid.stories'
import type { ScrollWorkResult } from './perf.commands'

/** All DataGrid stories, composed as portable React components. */
export const Stories = composeStories(stories)

/** Stable DOM selectors — class names / roles are part of the component contract. */
export const SEL = {
  scroller: '.MuiTableContainer-root',
  headCell: '.data-grid__head-cell',
  bodyRow: '.data-grid__body-row',
  bodyCell: '.data-grid__body-cell',
} as const

/** 60fps frame budget in milliseconds (1000 / 60). */
export const FRAME_BUDGET_60FPS = 1000 / 60

type GridArgs = Partial<ComponentProps<typeof Stories.AllFeatures>>

/**
 * Render the DataGrid via the AllFeatures story with sensible sizing defaults.
 * Pass `enable*` flags / columnCount / dataCount to shape the case under test.
 */
export function renderGrid(args: GridArgs = {}) {
  return render(
    <Stories.AllFeatures
      containerHeight={600}
      height={500}
      columnCount={20}
      dataCount={300}
      {...args}
    />,
  )
}

/** The scroll viewport (the element that actually overflows and scrolls). */
export function getScroller(): HTMLElement {
  const el = document.querySelector<HTMLElement>(SEL.scroller)
  if (!el) {
    throw new Error('scroll container (.MuiTableContainer-root) not found')
  }
  return el
}

export function headCells(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SEL.headCell))
}

export function bodyRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SEL.bodyRow))
}

export function renderedRowIndexes(): number[] {
  return bodyRows().map(r => Number(r.getAttribute('data-index')))
}

export function renderedColumnIndexes(): number[] {
  return headCells().map(h => Number(h.getAttribute('aria-colindex')))
}

const nextFrame = () =>
  new Promise<number>(resolve => requestAnimationFrame(t => resolve(t)))

/** Scroll one axis to its far end, one animation frame at a time. */
export async function scrollToEnd(
  axis: 'y' | 'x',
  stepPx = 400,
): Promise<void> {
  const scroller = getScroller()
  const distance = () =>
    axis === 'y'
      ? scroller.scrollHeight - scroller.clientHeight
      : scroller.scrollWidth - scroller.clientWidth

  let pos = 0
  const target = distance()
  while (pos < target) {
    pos = Math.min(target, pos + stepPx)
    if (axis === 'y') scroller.scrollTop = pos
    else scroller.scrollLeft = pos
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
  }
  // let the final range settle
  await nextFrame()
  await nextFrame()
}

const perfCommands = commands as unknown as {
  perfTraceStart: (id: string) => Promise<void>
  perfTraceStop: (id: string) => Promise<ScrollWorkResult>
}

let traceSeq = 0

export type { ScrollWorkResult }

/**
 * Drive a programmatic scroll along one axis and measure the REAL main-thread
 * work per frame via CDP tracing (Playwright). Unlike `measureScrollFps`, this
 * reports actual task durations (script/style/layout), not rAF wall-clock — so
 * it is not quantised by the display refresh rate and is portable across
 * machines' refresh rates.
 */
export async function measureScrollWork(
  axis: 'y' | 'x',
  {
    frames = 60,
    stepPx = 100,
    warmupFrames = 20,
  }: { frames?: number; stepPx?: number; warmupFrames?: number } = {},
): Promise<ScrollWorkResult> {
  const scroller = getScroller()

  const distance = () =>
    axis === 'y'
      ? scroller.scrollHeight - scroller.clientHeight
      : scroller.scrollWidth - scroller.clientWidth

  const setPos = (pos: number) => {
    if (axis === 'y') scroller.scrollTop = pos
    else scroller.scrollLeft = pos
  }

  // Warm-up pass (untraced): trigger JIT compilation, the first fast-scroll
  // transition and initial layout so the measured pass reflects steady scroll
  // cost, not one-off startup spikes.
  for (let i = 1; i <= warmupFrames; i++) {
    setPos(Math.min(distance(), i * stepPx))
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
  }

  scroller.scrollTop = 0
  scroller.scrollLeft = 0
  await nextFrame()
  await nextFrame()

  const id = `${axis}-${traceSeq++}-${Date.now()}`
  await perfCommands.perfTraceStart(id)

  const total = distance()
  for (let i = 1; i <= frames; i++) {
    const pos = Math.min(total, i * stepPx)
    setPos(pos)
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
    if (pos >= total) break
  }

  return perfCommands.perfTraceStop(id)
}

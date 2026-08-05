import type { ComponentProps } from 'react'

import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'

import * as stories from '../DataGrid.stories'

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

export interface FpsResult {
  frames: number
  /** 95th-percentile frame duration in ms (lower is smoother) */
  p95: number
  /** worst single frame in ms */
  worst: number
  /** mean frame duration in ms */
  avg: number
  /** equivalent fps derived from p95 */
  fpsFromP95: number
}

/**
 * Drive a programmatic scroll along one axis and measure per-frame durations.
 * Advances by a realistic per-frame pixel delta (like a mouse wheel), so a heavy
 * re-render triggered by scrolling shows up as an inflated frame delta.
 */
export async function measureScrollFps(
  axis: 'y' | 'x',
  { frames = 60, stepPx = 100 }: { frames?: number; stepPx?: number } = {},
): Promise<FpsResult> {
  const scroller = getScroller()

  scroller.scrollTop = 0
  scroller.scrollLeft = 0
  await nextFrame()
  await nextFrame()

  const distance =
    axis === 'y'
      ? scroller.scrollHeight - scroller.clientHeight
      : scroller.scrollWidth - scroller.clientWidth

  const deltas: number[] = []
  let prev = await nextFrame()

  for (let i = 1; i <= frames; i++) {
    const pos = Math.min(distance, i * stepPx)
    if (axis === 'y') scroller.scrollTop = pos
    else scroller.scrollLeft = pos
    // eslint-disable-next-line no-await-in-loop
    const t = await nextFrame()
    deltas.push(t - prev)
    prev = t
    if (pos >= distance) break
  }

  deltas.sort((a, b) => a - b)
  const p95 = deltas[Math.max(0, Math.ceil(deltas.length * 0.95) - 1)]
  const worst = deltas[deltas.length - 1]
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length

  return { frames: deltas.length, p95, worst, avg, fpsFromP95: 1000 / p95 }
}

import type { ComponentProps } from 'react'

import { commands } from '@vitest/browser/context'
import { composeStories } from '@storybook/react-vite'
import { cleanup, render } from 'vitest-browser-react'

import * as stories from '../DataGrid.stories'
import type { PerfRecord, ScrollWorkResult } from './perf.commands'

/** All DataGrid stories, composed as portable React components. */
export const Stories = composeStories(stories)

/** Stable DOM selectors — class names / roles are part of the component contract. */
export const SEL = {
  scroller: '.data-grid__container',
  headCell: '.data-grid__head-cell',
  bodyRow: '.data-grid__body-row',
  bodyCell: '.data-grid__body-cell',
} as const

/** 60fps frame budget in milliseconds (1000 / 60). */
export { FRAME_BUDGET_60FPS } from './perf.constants'

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
    throw new Error('scroll container (.data-grid__container) not found')
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
  // aria-colindex — 1-based (ARIA), а здесь нужен 0-based индекс колонки.
  return headCells().map(h => Number(h.getAttribute('aria-colindex')) - 1)
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
  perfRecord: (record: PerfRecord) => Promise<void>
}

let traceSeq = 0

export type { PerfRecord, ScrollWorkResult }

/**
 * Persist one performance case's result for the local dashboard. Written to
 * `performance-results/latest.json` by the `perfRecord` browser command and
 * rendered by `scripts/perf-report.mjs`. Call it BEFORE the budget assertion so
 * a failing case is still recorded.
 */
export function recordPerf(record: PerfRecord): Promise<void> {
  return perfCommands.perfRecord(record)
}

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

/**
 * Measure the REAL main-thread work of the INITIAL render (mount → first paint)
 * via CDP tracing, the same way `measureScrollWork` measures scrolling: actual
 * task durations, not wall-clock, so the metric is portable across machines.
 *
 * A warmup mount+unmount runs first (untraced) so the measured mount reflects the
 * steady render cost rather than one-off JIT/startup spikes. The measured mount is
 * left in the DOM so the caller can make follow-up assertions.
 */
export async function measureRenderWork(
  mount: () => void,
  ready: () => boolean,
  {
    warmup = true,
    timeoutFrames = 600,
  }: { warmup?: boolean; timeoutFrames?: number } = {},
): Promise<ScrollWorkResult> {
  const waitReady = async () => {
    for (let i = 0; i < timeoutFrames; i++) {
      if (ready()) return
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
    }
    throw new Error('grid did not render within the frame budget')
  }

  if (warmup) {
    mount()
    await waitReady()
    cleanup()
    await nextFrame()
    await nextFrame()
  }

  const id = `render-${traceSeq++}-${Date.now()}`
  await perfCommands.perfTraceStart(id)
  mount()
  await waitReady()
  return perfCommands.perfTraceStop(id)
}

/**
 * Measure the REAL main-thread work an INTERACTION triggers (INP-style): the
 * synchronous event-handler → React re-render → commit → layout blob, via CDP
 * tracing. `trigger` performs one interaction (e.g. click select-all); it runs once
 * untraced as warm-up, then again under the trace. Use with an interaction that
 * changes ONE state slice without reordering rows/columns (row selection is ideal)
 * so the metric reflects wasted re-renders, not legitimate layout work.
 */
export async function measureInteractionWork(
  trigger: () => Promise<void>,
  { settleFrames = 6 }: { settleFrames?: number } = {},
): Promise<ScrollWorkResult> {
  // Warm-up: одно взаимодействие вне трейса (JIT + первый переход состояния).
  await trigger()
  for (let i = 0; i < settleFrames; i++) {
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
  }

  const id = `inp-${traceSeq++}-${Date.now()}`
  await perfCommands.perfTraceStart(id)
  await trigger()
  for (let i = 0; i < settleFrames; i++) {
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
  }
  return perfCommands.perfTraceStop(id)
}

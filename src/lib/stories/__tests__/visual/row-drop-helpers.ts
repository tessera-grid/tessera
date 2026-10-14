import { commands, userEvent } from 'vitest/browser'
import { expect } from 'vitest'

import { settleRowMotion } from '../helpers'
import { tokenPx } from './tree-lines-helpers'

// Перетаскивание строк настоящей мышью Playwright (TQ3): взять строку, выровнять текст
// облака по уровню, подвести слот, отпустить (ADR 0108, 0109, 0112).

export type Point = { x: number; y: number }
export type Pointer = {
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
}
export const pointer = commands as unknown as Pointer

export const BODY_ROW = '.data-grid__body-row'
export const HANDLE = '.drag__handler--column'
export const INDENT = '[data-column-id="country"]'
export const SKELETON = '[class*="skeleton"]'

export const rowById = (id: string) =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-id="${id}"]`)
export const slot = () =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-draggable="true"]`)
export const container = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
export const nextFrame = () =>
  new Promise(resolve => requestAnimationFrame(resolve))
export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

/** Строки в видимом порядке: по месту, куда их ставит dnd-kit, без анимации. */
export const rowsInOrder = () =>
  [...document.querySelectorAll<HTMLElement>(BODY_ROW)]
    .map(row => {
      const shift = /,\s*(-?[\d.]+)px,\s*0px\)$/.exec(row.style.transform)
      return { row, top: row.offsetTop + Number(shift?.[1] ?? 0) }
    })
    .sort((a, b) => a.top - b.top)
    .map(({ row }) => row)

/** Глубина строки по отступу первой колонки. */
export const depthOf = (row: HTMLElement) =>
  Math.round(
    parseFloat(getComputedStyle(row.querySelector(INDENT)!).paddingLeft) /
      tokenPx('--tsr-comp-row-nesting-indent'),
  ) || 0

export const TITLE = '.data-grid__cell-wrapper-title'
export const USER_CONTENT =
  '.data-grid__body-cell:not([data-actions-column-cell="true"]) > .data-grid__cell-wrapper-content'
export const CLOUD_TITLE = `.data-grid-body__row ${TITLE}`

/** Начало содержимого строки глубины 0 — от него считаются уровни броска. */
export const levelZeroOf = (row: HTMLElement) => {
  const content = row.querySelector<HTMLElement>(USER_CONTENT)!
  return (
    content.getBoundingClientRect().left +
    parseFloat(getComputedStyle(content).paddingLeft) -
    depthOf(row) * tokenPx('--tsr-comp-row-nesting-indent')
  )
}

/** Начало текста облака под указателем. */
export const cloudText = () =>
  document.querySelector<HTMLElement>(CLOUD_TITLE)!.getBoundingClientRect().left

/**
 * Взять строку за ручку и держать над строкой `overId`, выровняв текст облака по
 * отступу уровня `depth` (ADR 0108, §2). Возвращает точку указателя и начало уровней.
 */
export const dragOver = async (id: string, overId: string, depth: number) => {
  const row = rowById(id)!
  await userEvent.hover(row)
  const levelZero = levelZeroOf(row)
  const handle = row.querySelector<HTMLElement>(HANDLE)!.getBoundingClientRect()
  const from = {
    x: handle.left + handle.width / 2,
    y: handle.top + handle.height / 2,
  }
  const over = rowById(overId)!.getBoundingClientRect()
  const to = {
    x: from.x,
    y: over.top + over.height / 2 + (over.top > from.y ? 6 : -6),
  }
  await pointer.realDragHold(from, to)
  await expect.poll(() => document.querySelector(CLOUD_TITLE)).not.toBeNull()
  const step = tokenPx('--tsr-comp-row-nesting-indent')
  const aligned = { x: to.x + levelZero + depth * step - cloudText(), y: to.y }
  await pointer.realMouseMove(to, aligned, 4)
  for (let i = 0; i < 4; i++) await nextFrame()
  return { at: aligned, levelZero, step }
}

/** Подвести указатель по вертикали, пока слот не встанет сразу после строки `prevId`. */
export const settleSlotAfter = async (prevId: string, at: Point) => {
  for (let i = 0; i < 40; i++) {
    const order = rowsInOrder()
    const index = order.findIndex(row => row.dataset.rowId === prevId)
    const slotIndex = order.findIndex(row => row === slot())
    if (slotIndex === index + 1) return at
    const next = { x: at.x, y: at.y + (slotIndex <= index ? 3 : -3) }
    await pointer.realMouseMove(at, next, 1)
    at = next
    for (let f = 0; f < 2; f++) await nextFrame()
  }
  const order = rowsInOrder().map(row =>
    row === slot() ? 'slot' : row.dataset.rowId,
  )
  throw new Error(`slot did not settle after ${prevId}: ${order.join(' ')}`)
}

export const release = async () => {
  await pointer.realMouseUp()
  await expect.poll(() => slot()).toBeNull()
  await settleRowMotion()
}

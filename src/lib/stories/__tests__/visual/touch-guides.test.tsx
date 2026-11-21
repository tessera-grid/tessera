import { render } from 'vitest-browser-react'
import { commands, server } from 'vitest/browser'
import { renderGrid } from '../helpers'
import {
  clearRealTouchDrivers,
  setRealTapDriver,
  setRealTouchDragDriver,
  tapTarget,
} from '../../__mocks__/touchGuides'
import { composed } from '../stories'
import { waitForGrid } from './core-helpers'
import { describe, expect, test } from 'vitest'

const restoreRealTouchDrivers = () => {
  const touch = commands as unknown as {
    realTap: (at: { x: number; y: number }) => Promise<void>
    realTouchDown: (points: { x: number; y: number }[]) => Promise<void>
    realTouchMove: (
      from: { x: number; y: number },
      to: { x: number; y: number },
      steps?: number,
    ) => Promise<void>
    realTouchUp: () => Promise<void>
  }
  setRealTapDriver(at => touch.realTap(at))
  setRealTouchDragDriver(async (from, to, hold) => {
    await touch.realTouchDown([from])
    try {
      if (hold) await new Promise(resolve => setTimeout(resolve, 300))
      await touch.realTouchMove(from, to, hold ? 12 : 1)
      if (hold) await new Promise(resolve => setTimeout(resolve, 50))
    } finally {
      await touch.realTouchUp()
    }
  })
}

describe('касания в гайдах', () => {
  test('tapTarget воспроизводит полный жест: pointerdown/up, mousedown/up, click и фокус активной ячейки', async () => {
    const screen = await renderGrid({
      dataCount: 2,
      columnCount: 2,
      enableKeyboardNavigation: true,
    })
    try {
      await waitForGrid()
      const cell = document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-index="0"] .data-grid__body-cell',
      )!
      const events: string[] = []
      for (const type of [
        'pointerdown',
        'mousedown',
        'pointerup',
        'mouseup',
        'click',
      ])
        cell.addEventListener(type, event => events.push(event.type))
      tapTarget(cell)
      expect(events).toEqual([
        'pointerdown',
        'mousedown',
        'pointerup',
        'mouseup',
        'click',
      ])
      expect(document.activeElement).toBe(cell)
      await expect.poll(() => cell.getAttribute('data-kn-active')).toBe('true')
    } finally {
      await screen.unmount()
    }
  })

  test('tapTarget открывает меню ручки через touchend', async () => {
    const screen = await renderGrid({
      dataCount: 10,
      columnCount: 4,
      enableRowDragging: true,
    })
    try {
      await waitForGrid()
      const handle = document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-index="0"] .drag__handler--column',
      )!
      tapTarget(handle)
      await expect
        .poll(() => document.querySelector('[role="menu"]'), { timeout: 5000 })
        .not.toBeNull()
      await expect
        .poll(() =>
          document
            .querySelector('[role="menu"]')
            ?.contains(document.activeElement),
        )
        .toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('живой гайд переноса строки выполняет все шаги без CDP и оставляет меню открытым', async ({
    skip,
  }) => {
    skip(
      server.browser !== 'chromium',
      'синтетический DnD-жест не заменяет проверку CDP-touch',
    )
    clearRealTouchDrivers()
    const Story = composed.RowDraggingByTouch
    const screen = await render(<Story />)
    try {
      await Story.play!({
        canvasElement: screen.container,
        globals: { catalog: true },
        step: async (_name, run) => run({} as never),
      })
    } finally {
      restoreRealTouchDrivers()
      await screen.unmount()
    }
  })
})

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import { composeStories } from '@storybook/react-vite'

import * as calendarStories from '../../UI.Calendar.stories'

// Диапазон календаря кита (ADR 0183, PK23).

const { CalendarRange } = composeStories(calendarStories)

const dayButton = (iso: string) =>
  document.querySelector<HTMLButtonElement>(`[data-day="${iso}"] button`)

/** Доля непрозрачности заливки `rgb()`/`rgba()`/`color()`. */
const alphaOf = (color: string) => {
  if (color === 'transparent') return 0
  const slash = /\/\s*([\d.]+)\s*\)$/.exec(color)
  if (slash) return Number(slash[1])
  const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color)
  return rgba ? Number(rgba[1]) : 1
}

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

describe('Диапазон календаря', () => {
  test('PK23: конец диапазона, ставший серединой, теряет скругление вместе с заливкой — угол не квадратный, пока заливка конца видна', async () => {
    const view = await render(<CalendarRange />)
    await expect.poll(() => dayButton('2026-03-17')).not.toBeNull()
    const end = dayButton('2026-03-17')!
    const rest = getComputedStyle(end)
    expect(alphaOf(rest.backgroundColor)).toBeGreaterThan(0.5)
    expect(parseFloat(rest.borderTopLeftRadius)).toBeGreaterThan(0)

    // Конец уходит дальше: прежний конец становится серединой.
    await userEvent.click(dayButton('2026-03-20')!)
    const squareWhileFilled: string[] = []
    for (let frame = 0; frame < 60; frame++) {
      await nextFrame()
      const style = getComputedStyle(dayButton('2026-03-17')!)
      const alpha = alphaOf(style.backgroundColor)
      if (alpha > 0.05 && parseFloat(style.borderTopLeftRadius) === 0) {
        squareWhileFilled.push(`${frame}: ${style.backgroundColor}`)
      }
      if (alpha === 0) break
    }
    expect(squareWhileFilled).toEqual([])
    await expect
      .poll(
        () => getComputedStyle(dayButton('2026-03-17')!).borderTopLeftRadius,
      )
      .toBe('0px')
    await view.unmount()
  })
})

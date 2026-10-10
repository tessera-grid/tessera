import { commands } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { IconButton } from '@/lib/ui/IconButton'
import { SvgIcon } from '@/lib/ui/icons'

// Смена состояния кольца посреди нажатия (ADR 0055, BS18). Идёт и в
// `npm run test:browsers`: клик терял Firefox.

interface Point {
  x: number
  y: number
}

const mouse = commands as unknown as {
  realMouseDown: (at: Point) => Promise<void>
  realMouseUp: () => Promise<void>
}

const button = () => document.querySelector<HTMLButtonElement>('button')!
const shown = () => getComputedStyle(button(), '::after').content !== 'none'
const frames = (count: number) =>
  new Promise<void>(resolve => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
    step(count)
  })

describe('Кольцо кнопки и нажатие', () => {
  test('BS18: у кнопки с кольцом `::after` есть во всех фазах — покой, ожидание, вспышка, затухание и после неё; смена фазы посреди нажатия клик не теряет', async () => {
    let clicks = 0
    const view = (props: { pending?: boolean; errorFlash?: number }) => (
      <div className="data-grid-theme" style={{ padding: 20 }}>
        <div>
          <IconButton aria-label="Load" onClick={() => clicks++} {...props}>
            <SvgIcon width={20} height={20} />
          </IconButton>
        </div>
      </div>
    )
    const screen = await render(view({ errorFlash: 0 }))
    expect(shown(), 'покой').toBe(true)
    await screen.rerender(view({ errorFlash: 0, pending: true }))
    expect(shown(), 'ожидание').toBe(true)
    await screen.rerender(view({ errorFlash: 1 }))
    expect(button().getAttribute('data-error-flash')).toBe('on')
    expect(shown(), 'вспышка').toBe(true)
    await expect
      .poll(() => button().getAttribute('data-error-flash'), { timeout: 3000 })
      .toBe('off')
    expect(shown(), 'затухание').toBe(true)
    await expect
      .poll(() => button().hasAttribute('data-error-flash'), { timeout: 3000 })
      .toBe(false)
    expect(shown(), 'после вспышки').toBe(true)

    // Затухание кончается посреди нажатия: отпускание без кадра между ними — как под
    // нагрузкой. Снятие атрибута — то, что делает таймер вспышки.
    const presses = 20
    for (let i = 0; i < presses; i++) {
      button().setAttribute('data-error-flash', 'off')
      await frames(2)
      const box = button().getBoundingClientRect()
      await mouse.realMouseDown({
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
      })
      button().removeAttribute('data-error-flash')
      await mouse.realMouseUp()
      await frames(2)
    }
    expect(clicks).toBe(presses)
  })
})

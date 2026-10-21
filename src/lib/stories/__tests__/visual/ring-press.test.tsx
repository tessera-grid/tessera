import { commands } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import type { CSSProperties } from 'react'

import '../../../core/themeVariables/theme.css'
import { IconButton } from '@/lib/ui/IconButton'
import { SvgIcon } from '@/lib/ui/icons'
import { pendingArcOf } from '../helpers'

// Смена фазы дуги посреди нажатия (ADR 0055, BS18; дуга — ADR 0127). Идёт и в
// `npm run test:browsers`: клик терял Firefox, когда слой состояния появлялся или уходил
// между нажатием и отпусканием.

interface Point {
  x: number
  y: number
}

const mouse = commands as unknown as {
  realMouseDown: (at: Point) => Promise<void>
  realMouseUp: () => Promise<void>
}

const button = () => document.querySelector<HTMLButtonElement>('button')!
const frames = (count: number) =>
  new Promise<void>(resolve => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
    step(count)
  })

// Вспышка короткая: дуга отказа уходит за несколько кадров.
const SHORT = {
  '--tsr-comp-error-flash-duration': '30ms',
  '--tsr-comp-error-flash-fade-duration': '30ms',
} as CSSProperties

describe('Дуга кнопки и нажатие', () => {
  test('BS18: смена фазы посреди нажатия клик не теряет — во всех движках; дуга ожидания и отказа появляется и уходит, не отнимая нажатие', async () => {
    let clicks = 0
    const view = (errorFlash: number) => (
      <div className="data-grid-theme" style={{ padding: 20, ...SHORT }}>
        <div>
          <IconButton
            aria-label="Load"
            onClick={() => clicks++}
            errorFlash={errorFlash}
          >
            <SvgIcon width={20} height={20} />
          </IconButton>
        </div>
      </div>
    )
    const screen = await render(view(0))
    const center = () => {
      const box = button().getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    }

    // Дуга отказа появляется между нажатием и отпусканием, без кадра между ними —
    // как под нагрузкой.
    const presses = 10
    for (let i = 1; i <= presses; i++) {
      await mouse.realMouseDown(center())
      await screen.rerender(view(i))
      expect(pendingArcOf(button()), `нажатие ${i}`).not.toBeNull()
      await mouse.realMouseUp()
      // Дуга уходит: следующее нажатие начинается без неё.
      await expect
        .poll(() => pendingArcOf(button()), { timeout: 2000 })
        .toBeNull()
      await frames(2)
    }
    expect(clicks).toBe(presses)

    // Дуга уходит посреди нажатия: нажатие во время угасания, отпускание — после.
    for (let i = presses + 1; i <= presses * 2; i++) {
      await screen.rerender(view(i))
      await expect
        .poll(() => button().getAttribute('data-error-flash'), {
          timeout: 2000,
          interval: 5,
        })
        .toBe('off')
      await mouse.realMouseDown(center())
      await expect
        .poll(() => pendingArcOf(button()), { timeout: 2000, interval: 5 })
        .toBeNull()
      await mouse.realMouseUp()
      await frames(2)
    }
    expect(clicks).toBe(presses * 2)
  })
})

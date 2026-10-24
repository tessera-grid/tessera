import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../core/themeVariables/theme.css'
import { IconButton } from '@/lib/ui/IconButton'
import { SvgIcon } from '@/lib/ui/icons'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Ожидание и вспышка ошибки базовых кнопок (ADR 0055): поведение — BS1, BS2, BS8, BS13,
// BS19; вид дуги и отказа — набор `pending-arc` (ADR 0127). Кнопки рендерятся напрямую
// внутри обёртки темы; состояние читается из ARIA, атрибутов и вычисленных стилей.

const icon = <SvgIcon width={20} height={20} />

const Theme = ({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) => (
  <div className="data-grid-theme" style={{ padding: 24, ...style }}>
    {children}
  </div>
)

const button = () => document.querySelector<HTMLButtonElement>('button')!
const arc = () =>
  button().querySelector<SVGSVGElement>(':scope > svg[data-pending-arc]')

const renderIcon = (props: Parameters<typeof IconButton>[0] = {}) =>
  render(
    <Theme>
      <IconButton aria-label="Load" {...props}>
        {icon}
      </IconButton>
    </Theme>,
  )

describe('Button states: pending', () => {
  test('BS1: an IconButton with `pending` is aria-busy, not disabled, and stays focusable', async () => {
    await renderIcon({ pending: true })
    expect(button().getAttribute('aria-busy')).toBe('true')
    expect(button().disabled).toBe(false)
    expect(button().hasAttribute('disabled')).toBe(false)
    button().focus()
    expect(document.activeElement).toBe(button())
  })

  test('BS2: a pending IconButton ignores click, Enter and Space', async () => {
    const onClick = vi.fn()
    const screen = await renderIcon({ pending: true, onClick })
    await userEvent.click(button())
    button().focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onClick).not.toHaveBeenCalled()

    await screen.rerender(
      <Theme>
        <IconButton aria-label="Load" onClick={onClick}>
          {icon}
        </IconButton>
      </Theme>,
    )
    await userEvent.click(button())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('BS19: pending that ends without an error fades the arc out with the reveal transition while it keeps running; a failure at the same moment stops the arc instead', async () => {
    const screen = await renderIcon({ pending: true })
    expect(arc()!.dataset.phase).toBe('pending')
    await screen.rerender(
      <Theme>
        <IconButton aria-label="Load">{icon}</IconButton>
      </Theme>,
    )
    expect(button().hasAttribute('aria-busy')).toBe(false)
    expect(button().hasAttribute('data-pending-leaving')).toBe(true)
    // Гаснет: дуга ещё бежит, прозрачность уходит к нулю переходом проявления.
    expect(arc()!.dataset.phase).toBe('leaving')
    const running = arc()!
      .getAnimations({ subtree: true })
      .find(a => (a as CSSAnimation).animationName?.includes('pendingRun'))
    expect(running?.playState).toBe('running')
    const reveal = document.createElement('span')
    reveal.style.transition = 'var(--tsr-comp-reveal-transition)'
    button().parentElement!.appendChild(reveal)
    expect(getComputedStyle(arc()!).transition).toBe(
      getComputedStyle(reveal).transition,
    )
    reveal.remove()
    await expect
      .poll(() => (arc() ? parseFloat(getComputedStyle(arc()!).opacity) : 0))
      .toBeLessThan(1)
    await expect
      .poll(() => button().hasAttribute('data-pending-leaving'), {
        timeout: 2000,
      })
      .toBe(false)
    expect(arc()).toBeNull()

    // Отказ в тот же момент — дуга встаёт и гаснет, а не бежит (ADR 0136).
    await screen.rerender(
      <Theme>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    await screen.rerender(
      <Theme>
        <IconButton aria-label="Load" failure="Failed: offline">
          {icon}
        </IconButton>
      </Theme>,
    )
    expect(arc()!.dataset.phase).toBe('stopping')
  })
})

describe('Button states: failure', () => {
  test('BS13: a pending button and a button with a failure mark pass axe with color-contrast in both themes', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    await render(
      <Theme>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
        <IconButton aria-label="Retry" failure="Failed: offline">
          {icon}
        </IconButton>
      </Theme>,
    )
    const root = button().parentElement!
    expect(
      root.querySelector('[data-failure-indicator][data-shown="true"]'),
    ).not.toBeNull()
    await inBothThemes(async () => {
      expect((await axe.run(root, options)).violations).toEqual([])
    })
  })
})

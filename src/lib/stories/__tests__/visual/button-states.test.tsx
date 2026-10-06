import axe from 'axe-core'
import { Toolbar } from '@base-ui/react/toolbar'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../core/themeVariables/theme.css'
import { IconButton } from '@/lib/ui/IconButton'
import { ToolbarButton } from '@/lib/ui/ToolbarButton'
import { SvgIcon } from '@/lib/ui/icons'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'

// Ожидание и вспышка ошибки базовых кнопок (ADR 0055, BS1–BS16). Кнопки рендерятся
// напрямую внутри обёртки темы; состояние читается из ARIA, атрибутов и вычисленных
// стилей `::after`, а не из имён CSS-модулей.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

afterEach(() => reducedMotion(false))

const icon = <SvgIcon width={20} height={20} />

const Theme = ({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) => (
  <div className="data-grid-theme" style={style}>
    {children}
  </div>
)

const button = () => document.querySelector<HTMLButtonElement>('button')!
const ring = (el: Element = button()) => getComputedStyle(el, '::after')
const angle = () => ring().getPropertyValue('--tsr-pending-ring-angle').trim()

/** Значение токена темы, разрешённое в контексте кнопки. */
const token = (name: string, prop = 'color') => {
  const probe = document.createElement('span')
  probe.style.setProperty(prop, `var(${name})`)
  button().parentElement!.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return value
}

/** Доля контура (в %), где conic-градиент кольца прозрачен между соседними стопами. */
const clearShare = (image: string) => {
  const stops = [
    ...image.matchAll(
      /((?:rgba?|color)\([^)]*\)|transparent)\s+([\d.]+)(%|deg)/g,
    ),
  ].map(([, color, at, unit]) => ({
    clear: toRgba(color)[3] === 0,
    // Chromium отдаёт стоп то в процентах, то в градусах (`0deg`).
    at: unit === 'deg' ? (Number(at) / 360) * 100 : Number(at),
  }))
  return stops
    .slice(1)
    .reduce(
      (sum, stop, i) =>
        stop.clear && stops[i].clear ? sum + stop.at - stops[i].at : sum,
      0,
    )
}

/** Непрозрачность хвоста блика (первый стоп): 0 — блик, 1 — контур залит целиком. */
const fillOf = (image: string) => {
  const first = /((?:rgba?|color)([^)]*)|transparent)/.exec(image)
  return first ? toRgba(first[1])[3] : 0
}

const waitFrames = (ms: number) => new Promise(r => setTimeout(r, ms))

// Короткое удержание вспышки — тесты не ждут 1200 мс по умолчанию.
const FAST_FLASH = {
  '--tsr-comp-error-flash-duration': '800ms',
} as CSSProperties

const renderIcon = (props: Parameters<typeof IconButton>[0] = {}) =>
  render(
    <Theme style={FAST_FLASH}>
      <IconButton aria-label="Load" {...props}>
        {icon}
      </IconButton>
    </Theme>,
  )

const renderToolbar = (
  props: Partial<Parameters<typeof ToolbarButton>[0]> = {},
) =>
  render(
    <Theme style={FAST_FLASH}>
      <Toolbar.Root>
        <ToolbarButton label="Export" icon={icon} {...props} />
      </Toolbar.Root>
    </Theme>,
  )

describe('Button states: pending ring', () => {
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

  test('BS3: the ring follows the button shape — round by default, square with an overridden radius', async () => {
    const screen = await renderIcon({ pending: true })
    expect(ring().content).not.toBe('none')
    expect(getComputedStyle(button()).borderRadius).toBe('50%')
    expect(ring().borderRadius).toBe('50%')

    await screen.rerender(
      <Theme style={{ '--tsr-comp-radius-round': '3px' } as CSSProperties}>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    expect(getComputedStyle(button()).borderRadius).toBe('3px')
    expect(ring().borderRadius).toBe('3px')
  })

  test('BS4: the ring keeps the button size and position and stays within its frame', async () => {
    const screen = await renderIcon()
    const before = button().getBoundingClientRect().toJSON()
    await screen.rerender(
      <Theme>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    expect(button().getBoundingClientRect().toJSON()).toEqual(before)
    const style = ring()
    expect(style.position).toBe('absolute')
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(style[side], side).toBe('0px')
    }
  })

  test('BS5: a shine runs around the outline with the duration token; its color and width come from the ring tokens, the rest of the outline is clear', async () => {
    const overrides = {
      '--tsr-comp-pending-ring-color': 'rgb(1, 2, 3)',
      '--tsr-comp-pending-ring-width': '3px',
      '--tsr-comp-pending-ring-duration': '2s',
    } as CSSProperties
    const screen = await renderIcon({ pending: true })
    expect(ring().animationDuration).toBe(
      token('--tsr-comp-pending-ring-duration', 'animation-duration'),
    )
    expect(ring().animationIterationCount).toBe('infinite')
    const first = angle()
    await waitFrames(150)
    expect(angle()).not.toBe(first)

    await screen.rerender(
      <Theme style={overrides}>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    expect(ring().animationDuration).toBe('2s')
    expect(ring().backgroundImage).toContain('rgb(1, 2, 3)')
    // Блик, а не сплошной контур: прозрачна хотя бы половина контура.
    expect(clearShare(ring().backgroundImage)).toBeGreaterThanOrEqual(50)
    expect(ring().paddingTop).toBe('3px')
  })

  test('BS6: with reduced motion the shine stands still and stays visible', async () => {
    await reducedMotion(true)
    await renderIcon({ pending: true })
    await waitFrames(50)
    const first = angle()
    await waitFrames(150)
    expect(angle()).toBe(first)
    expect(ring().content).not.toBe('none')
    expect(ring().opacity).toBe('1')
    expect(ring().backgroundImage).toContain(
      token('--tsr-comp-pending-ring-color'),
    )
  })
})

describe('Button states: error flash', () => {
  const flashColor = () => token('--tsr-comp-error-flash-color')

  test('BS7: a new `errorFlash` value fills only the outline with the flash color for the hold duration, the icon keeps its color, then the look is restored', async () => {
    const screen = await renderIcon({ errorFlash: 0 })
    const rest = getComputedStyle(button()).color
    await screen.rerender(
      <Theme style={FAST_FLASH}>
        <IconButton aria-label="Load" errorFlash={1}>
          {icon}
        </IconButton>
      </Theme>,
    )
    expect(button().getAttribute('data-error-flash')).toBe('on')
    expect(ring().backgroundImage).toContain(flashColor())
    await expect.poll(() => fillOf(ring().backgroundImage)).toBe(1)
    expect(ring().opacity).toBe('1')
    expect(getComputedStyle(button()).color).toBe(rest)

    await expect
      .poll(() => button().hasAttribute('data-error-flash'), { timeout: 2000 })
      .toBe(false)
    expect(ring().content).toBe('none')
    expect(getComputedStyle(button()).color).toBe(rest)
  })

  test('BS8: mounting with an `errorFlash` value or re-rendering with the same value does not flash', async () => {
    const screen = await renderIcon({ errorFlash: 5 })
    await waitFrames(30)
    expect(button().hasAttribute('data-error-flash')).toBe(false)
    await screen.rerender(
      <Theme style={FAST_FLASH}>
        <IconButton aria-label="Load" errorFlash={5}>
          {icon}
        </IconButton>
      </Theme>,
    )
    await waitFrames(30)
    expect(button().hasAttribute('data-error-flash')).toBe(false)
  })

  test('BS9: with reduced motion the flash holds its color for the same duration and drops without a transition', async () => {
    await reducedMotion(true)
    const screen = await renderIcon({ errorFlash: 0 })
    await screen.rerender(
      <Theme style={FAST_FLASH}>
        <IconButton aria-label="Load" errorFlash={1}>
          {icon}
        </IconButton>
      </Theme>,
    )
    const start = performance.now()
    // Заливка без перехода: контур сразу сплошной.
    expect(ring().backgroundImage).toContain(flashColor())
    expect(fillOf(ring().backgroundImage)).toBe(1)
    for (const part of ring().transitionDuration.split(',')) {
      expect(part.trim()).toBe('0s')
    }
    await waitFrames(250)
    expect(button().getAttribute('data-error-flash')).toBe('on')
    await expect
      .poll(() => button().hasAttribute('data-error-flash'), { timeout: 2000 })
      .toBe(false)
    // Удержание 800 мс, затухания нет — атрибут снят вскоре после удержания.
    expect(performance.now() - start).toBeGreaterThanOrEqual(780)
    expect(performance.now() - start).toBeLessThan(1100)
  })

  test('BS14: from pending, the shine of every switching button turns into the flash color where it stands and smoothly fills the whole outline', async () => {
    // Несколько кнопок переключаются одним коммитом — как кнопки одного запроса.
    const Group = ({ pending, flash }: { pending: boolean; flash: number }) => (
      <Theme style={FAST_FLASH}>
        <IconButton aria-label="One" pending={pending} errorFlash={flash}>
          {icon}
        </IconButton>
        <IconButton aria-label="Two" pending={pending} errorFlash={flash}>
          {icon}
        </IconButton>
        <Toolbar.Root>
          <ToolbarButton
            label="Three"
            icon={icon}
            pending={pending}
            errorFlash={flash}
          />
        </Toolbar.Root>
      </Theme>
    )
    const all = () => [...document.querySelectorAll<HTMLElement>('button')]
    const angleOf = (el: Element) =>
      parseFloat(ring(el).getPropertyValue('--tsr-pending-ring-angle'))
    const screen = await render(<Group pending flash={0} />)
    // Ждём блик подальше от начального угла, чтобы сброс был заметен.
    await expect
      .poll(() => angleOf(all()[0]))
      .toSatisfy((deg: number) => deg > 120 && deg < 240)
    const before = all().map(angleOf)
    await screen.rerender(<Group pending={false} flash={1} />)
    await new Promise(r => requestAnimationFrame(r))
    all().forEach((el, i) => {
      expect(Math.abs(angleOf(el) - before[i]), `button ${i}`).toBeLessThan(60)
      expect(ring(el).backgroundImage).toContain(flashColor())
      expect(fillOf(ring(el).backgroundImage)).toBeLessThan(0.5)
    })
    await waitFrames(100)
    const midway = fillOf(ring().backgroundImage)
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(1)
    await expect.poll(() => fillOf(ring().backgroundImage)).toBe(1)
  })

  test('BS15: a flash without a preceding pending state also starts as a shine and fills the outline', async () => {
    const screen = await renderIcon({ errorFlash: 0 })
    await screen.rerender(
      <Theme style={FAST_FLASH}>
        <IconButton aria-label="Load" errorFlash={1}>
          {icon}
        </IconButton>
      </Theme>,
    )
    expect(fillOf(ring().backgroundImage)).toBeLessThan(0.2)
    await expect.poll(() => fillOf(ring().backgroundImage)).toBe(1)
  })
})

describe('Button states: ToolbarButton', () => {
  test('BS10: a pending ToolbarButton draws the ring along its square radius, is aria-busy and ignores presses', async () => {
    const onClick = vi.fn()
    await renderToolbar({ pending: true, onClick })
    expect(button().getAttribute('aria-busy')).toBe('true')
    expect(ring().borderRadius).toBe(
      token('--tsr-comp-toolbar-button-radius', 'border-top-left-radius'),
    )
    expect(ring().borderRadius).toBe(getComputedStyle(button()).borderRadius)
    expect(ring().animationIterationCount).toBe('infinite')
    await userEvent.click(button())
    button().focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()
  })

  test('BS11: a new `errorFlash` value fills the outline of a ToolbarButton', async () => {
    const screen = await renderToolbar({ errorFlash: 0 })
    const rest = getComputedStyle(button()).color
    await screen.rerender(
      <Theme style={FAST_FLASH}>
        <Toolbar.Root>
          <ToolbarButton label="Export" icon={icon} errorFlash={1} />
        </Toolbar.Root>
      </Theme>,
    )
    expect(button().getAttribute('data-error-flash')).toBe('on')
    expect(ring().backgroundImage).toContain(
      token('--tsr-comp-error-flash-color'),
    )
    await expect.poll(() => fillOf(ring().backgroundImage)).toBe(1)
    expect(getComputedStyle(button()).color).toBe(rest)
  })
})

describe('Button states: contrast and axe', () => {
  test('BS12: the ring and flash colors keep 3:1 against the grid background in both themes', async () => {
    await renderIcon({ pending: true })
    await inBothThemes(async () => {
      const bg = backgroundOf(button())
      for (const name of [
        '--tsr-comp-pending-ring-color',
        '--tsr-comp-error-flash-color',
      ]) {
        expect(contrast(toRgba(token(name)), bg), name).toBeGreaterThanOrEqual(
          3,
        )
      }
    })
  })

  test('BS16: by default the shine takes the progress bar color in both themes', async () => {
    await renderIcon({ pending: true })
    await inBothThemes(async () => {
      expect(token('--tsr-comp-pending-ring-color')).toBe(
        token('--tsr-comp-loader-bar'),
      )
      expect(ring().backgroundImage).toContain(token('--tsr-comp-loader-bar'))
    })
  })

  test('BS13: a pending and a flashing button pass axe with color-contrast in both themes', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const long = {
      '--tsr-comp-error-flash-duration': '10s',
    } as CSSProperties
    const screen = await render(
      <Theme style={long}>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
        <IconButton aria-label="Retry" errorFlash={0}>
          {icon}
        </IconButton>
      </Theme>,
    )
    await screen.rerender(
      <Theme style={long}>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
        <IconButton aria-label="Retry" errorFlash={1}>
          {icon}
        </IconButton>
      </Theme>,
    )
    const root = button().parentElement!
    expect(root.querySelector('[data-error-flash="on"]')).not.toBeNull()
    await inBothThemes(async () => {
      expect((await axe.run(root, options)).violations).toEqual([])
    })
  })
})

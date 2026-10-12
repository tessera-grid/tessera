import axe from 'axe-core'
import { Toolbar } from '@base-ui/react/toolbar'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../core/themeVariables/theme.css'
import { IconButton } from '@/lib/ui/IconButton'
import { ToolbarButton } from '@/lib/ui/ToolbarButton'
import { SvgIcon } from '@/lib/ui/icons'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'

// Ожидание и вспышка ошибки базовых кнопок (ADR 0055, BS1–BS17; вид — ADR 0095). Кнопки
// рендерятся напрямую внутри обёртки темы; состояние читается из ARIA, атрибутов,
// вычисленных стилей `::after` и пикселей скриншота, а не из имён CSS-модулей.

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
  <div className="data-grid-theme" style={{ padding: 24, ...style }}>
    {children}
  </div>
)

const button = () => document.querySelector<HTMLButtonElement>('button')!
const ring = (el: Element = button()) => getComputedStyle(el, '::after')
/** Насколько свет перешёл в красную заливку ошибки, %. */
const fill = (el: Element = button()) =>
  parseFloat(ring(el).getPropertyValue('--tsr-ring-fill'))

/** Значение токена темы, разрешённое в контексте кнопки. */
const token = (name: string, prop = 'color') => {
  const probe = document.createElement('span')
  probe.style.setProperty(prop, `var(${name})`)
  button().parentElement!.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return value
}

/** Цвет выражения, разрешённый в контексте кнопки. */
const resolved = (value: string) => {
  const probe = document.createElement('span')
  probe.style.color = value
  button().parentElement!.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

interface Shadow {
  color: string
  x: number
  y: number
  blur: number
  spread: number
  inset: boolean
}

/** Тени `box-shadow` по одной: цвет и длины (запятые внутри цветов не делят). */
const shadowsOf = (value: string): Shadow[] => {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth--
    else if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(value.slice(start).trim())
  return parts.map(part => {
    const lengths = [...part.matchAll(/(-?[\d.]+)px/g)].map(m => Number(m[1]))
    const [x = 0, y = 0, blur = 0, spread = 0] = lengths
    return {
      color: part
        .replace(/\s*-?[\d.]+px/g, '')
        .replace(/\binset\b/, '')
        .trim(),
      x,
      y,
      blur,
      spread,
      inset: /\binset\b/.test(part),
    }
  })
}

/** Пиксели скриншота в CSS-координатах окна. */
const snapshot = async () => {
  const shot = (await page.screenshot({
    base64: true,
    save: false,
  })) as unknown as string | { base64: string }
  const base64 = typeof shot === 'string' ? shot : shot.base64
  const image = new Image()
  image.src = `data:image/png;base64,${base64}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const scale = image.width / document.documentElement.clientWidth
  return (x: number, y: number) =>
    Array.from(
      context
        .getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1)
        .data.slice(0, 3),
    )
}

/** Точки на `gap` px снаружи круглой кнопки — по восьми направлениям. */
const around = (el: Element, gap: number) => {
  const box = el.getBoundingClientRect()
  // Скругление кнопки в px (50% — круг): углы берутся снаружи дуги, стороны — по центру.
  const raw = getComputedStyle(el).borderTopLeftRadius
  const r = Math.min(
    raw.endsWith('%') ? (box.width * parseFloat(raw)) / 100 : parseFloat(raw),
    box.width / 2,
    box.height / 2,
  )
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const corner = (sx: number, sy: number) =>
    [
      cx + sx * (box.width / 2 - r + (r + gap) * Math.SQRT1_2),
      cy + sy * (box.height / 2 - r + (r + gap) * Math.SQRT1_2),
    ] as const
  return [
    [box.right + gap, cy] as const,
    corner(1, 1),
    [cx, box.bottom + gap] as const,
    corner(-1, 1),
    [box.left - gap, cy] as const,
    corner(-1, -1),
    [cx, box.top - gap] as const,
    corner(1, -1),
  ]
}

/** Анимации пятен света кнопки (CSS-анимации её `::after`). */
const spotAnimations = (el: Element) =>
  el
    .getAnimations({ subtree: true })
    .filter(animation =>
      (animation as CSSAnimation).animationName?.includes('pendingSpot'),
    ) as CSSAnimation[]

const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!))

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

/** Вспышка кнопки, смонтированной кадром раньше: отказ приходит после монтирования. */
const flashIcon = async (
  screen: Awaited<ReturnType<typeof renderIcon>>,
  style: CSSProperties = FAST_FLASH,
) => {
  await new Promise(resolve => requestAnimationFrame(resolve))
  return screen.rerender(
    <Theme style={style}>
      <IconButton aria-label="Load" errorFlash={1}>
        {icon}
      </IconButton>
    </Theme>,
  )
}

describe('Button states: pending light', () => {
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

  test('BS3: the light follows the button shape — round by default, square with an overridden radius', async () => {
    const screen = await renderIcon({ pending: true })
    expect(ring().opacity).toBe('1')
    expect(getComputedStyle(button()).borderRadius).toBe('50%')
    expect(ring().borderRadius).toBe('50%')

    await screen.rerender(
      <Theme
        style={{ '--tsr-comp-button-radius-circle': '3px' } as CSSProperties}
      >
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    expect(getComputedStyle(button()).borderRadius).toBe('3px')
    expect(ring().borderRadius).toBe('3px')
  })

  test('BS4: the light keeps the button size and position and is not drawn inside the button', async () => {
    const screen = await renderIcon()
    const before = button().getBoundingClientRect().toJSON()
    const box = button().getBoundingClientRect()
    // Между рамкой и иконкой: отступ кнопки 8px.
    const inside = [box.left + 3, box.top + box.height / 2] as const
    const plain = (await snapshot())(...inside)

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
    expect(style.backgroundImage).toBe('none')
    const shadows = shadowsOf(style.boxShadow)
    expect(shadows.length).toBeGreaterThan(0)
    expect(shadows.some(shadow => shadow.inset)).toBe(false)
    for (let i = 0; i < 3; i++) {
      expect((await snapshot())(...inside), `frame ${i}`).toEqual(plain)
      await waitFrames(150)
    }
  })

  test('BS5: the pending light is spot shadows around the button: offset and blur come from the glow tokens, the periods from the duration token', async () => {
    const overrides = {
      '--tsr-comp-pending-glow-offset': '3px',
      '--tsr-comp-pending-glow-blur': '5px',
      '--tsr-comp-pending-glow-duration': '1s',
    } as CSSProperties
    await render(
      <Theme style={overrides}>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    const shadows = shadowsOf(ring().boxShadow)
    // Четыре пятна, ровный слой ошибки, ореол.
    expect(shadows).toHaveLength(6)
    for (const spot of shadows.slice(0, 4)) {
      expect(Math.hypot(spot.x, spot.y)).toBeCloseTo(3, 1)
      expect(spot.blur).toBe(5)
      expect(spot.spread).toBe(0)
    }
    // Слой ошибки вне вспышки прозрачен.
    expect(shadows[4]!.spread).toBe(3)
    expect(toRgba(shadows[4]!.color)[3]).toBe(0)
    expect(ring().animationName.split(',')).toHaveLength(4)
    expect(ring().animationDuration).toBe('1.7s, 2.3s, 2.9s, 3.7s')
    for (const count of ring().animationIterationCount.split(',')) {
      expect(count.trim()).toBe('infinite')
    }
  })

  test('BS6: with reduced motion the light stands still and stays visible', async () => {
    await reducedMotion(true)
    await renderIcon({ pending: true })
    await waitFrames(50)
    const points = around(button(), 2)
    const box = button().getBoundingClientRect()
    const first = await snapshot()
    const background = first(box.right + 40, box.top + box.height / 2)
    const lit = points.filter(
      ([x, y]) => distance(first(x, y), background) > 12,
    )
    expect(lit.length).toBeGreaterThanOrEqual(4)
    await waitFrames(200)
    const second = await snapshot()
    for (const [x, y] of points) {
      expect(second(x, y)).toEqual(first(x, y))
    }
    expect(ring().opacity).toBe('1')
  })
})

describe('Button states: error flash', () => {
  /** Пиксель покраснел: красный канал заметно выше зелёного и синего. */
  const reddish = ([r, g, b]: number[]) => r! - g! > 20 && r! - b! > 20

  test('BS7: a new `errorFlash` value lights a steady red glow around the whole button for the hold duration, the icon keeps its color, then the look is restored', async () => {
    const screen = await renderIcon({ errorFlash: 0 })
    const rest = getComputedStyle(button()).color
    await flashIcon(screen)
    expect(button().getAttribute('data-error-flash')).toBe('on')
    await expect.poll(() => fill()).toBe(100)
    expect(ring().opacity).toBe('1')
    const shot = await snapshot()
    for (const [x, y] of around(button(), 1)) {
      expect(reddish(shot(x, y)), `${x},${y}`).toBe(true)
    }
    expect(getComputedStyle(button()).color).toBe(rest)

    await expect
      .poll(() => button().hasAttribute('data-error-flash'), { timeout: 2000 })
      .toBe(false)
    // Носитель на месте, но не виден и не движется (BS18).
    expect(ring().opacity).toBe('0')
    expect(ring().animationName).toBe('none')
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

  test('BS9: with reduced motion the red light is full at once, holds for the same duration and drops without a transition', async () => {
    await reducedMotion(true)
    const screen = await renderIcon({ errorFlash: 0 })
    await flashIcon(screen)
    const start = performance.now()
    for (let i = 0; i < 2; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
    expect(fill()).toBe(100)
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

  test('BS17: after the hold the red light fades out with the motion transition instead of dropping', async () => {
    const screen = await renderIcon({ errorFlash: 0 })
    await flashIcon(screen)
    await expect
      .poll(() => button().getAttribute('data-error-flash'), { timeout: 2000 })
      .toBe('off')
    // Гаснет: красный слой ещё нарисован, а прозрачность уходит к нулю переходом.
    expect(toRgba(shadowsOf(ring().boxShadow)[4]!.color)[3]).toBeGreaterThan(0)
    await expect
      .poll(() =>
        button().getAttribute('data-error-flash') === 'off'
          ? parseFloat(ring().opacity)
          : 1,
      )
      .toBeLessThan(1)
    await expect
      .poll(() => button().hasAttribute('data-error-flash'), { timeout: 2000 })
      .toBe(false)
  })

  test('BS19: pending that ends without an error fades the light out with the reveal transition instead of dropping; an error at the same moment flashes instead', async () => {
    const screen = await renderIcon({ pending: true })
    expect(ring().opacity).toBe('1')
    await screen.rerender(
      <Theme style={FAST_FLASH}>
        <IconButton aria-label="Load">{icon}</IconButton>
      </Theme>,
    )
    expect(button().hasAttribute('aria-busy')).toBe(false)
    expect(button().hasAttribute('data-pending-leaving')).toBe(true)
    // Гаснет: пятна ещё живут, прозрачность уходит к нулю переходом.
    expect(ring().animationName).toContain('pendingSpot')
    expect(ring().transitionProperty).toContain('opacity')
    await expect
      .poll(() =>
        button().hasAttribute('data-pending-leaving')
          ? parseFloat(ring().opacity)
          : 0,
      )
      .toBeLessThan(1)
    await expect
      .poll(() => button().hasAttribute('data-pending-leaving'), {
        timeout: 2000,
      })
      .toBe(false)
    expect(ring().opacity).toBe('0')

    // Отказ в тот же момент — вспышка ведёт свет, угасания нет.
    await screen.rerender(
      <Theme style={FAST_FLASH}>
        <IconButton aria-label="Load" pending errorFlash={0}>
          {icon}
        </IconButton>
      </Theme>,
    )
    await screen.rerender(
      <Theme style={FAST_FLASH}>
        <IconButton aria-label="Load" errorFlash={1}>
          {icon}
        </IconButton>
      </Theme>,
    )
    expect(button().getAttribute('data-error-flash')).toBe('on')
    expect(button().hasAttribute('data-pending-leaving')).toBe(false)
  })

  test('BS14: from pending, the light of every switching button smoothly turns into the red fill; the spots do not jump', async () => {
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
    const screen = await render(<Group pending flash={0} />)
    await waitFrames(300)
    const before = all().map(spotAnimations)
    const times = before.map(list => list.map(a => Number(a.currentTime)))
    await screen.rerender(<Group pending={false} flash={1} />)
    await new Promise(r => requestAnimationFrame(r))
    all().forEach((el, i) => {
      // Те же анимации, не начатые заново: встали на паузу там, где были.
      const after = spotAnimations(el)
      expect(after, `button ${i}`).toEqual(before[i])
      after.forEach((animation, k) => {
        expect(animation.playState).toBe('paused')
        expect(Number(animation.currentTime)).toBeGreaterThanOrEqual(
          times[i]![k]!,
        )
      })
      expect(fill(el), `button ${i}`).toBeLessThan(50)
    })
    await waitFrames(150)
    const midway = fill()
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(100)
    for (const el of all()) {
      await expect.poll(() => fill(el)).toBe(100)
    }
  })

  test('BS15: a flash without a preceding pending state also grows from zero', async () => {
    const screen = await renderIcon({ errorFlash: 0 })
    await flashIcon(screen)
    expect(fill()).toBeLessThan(20)
    await expect.poll(() => fill()).toBe(100)
  })
})

describe('Button states: ToolbarButton', () => {
  test('BS10: a pending ToolbarButton draws the light along its square radius, is aria-busy and ignores presses', async () => {
    const onClick = vi.fn()
    await renderToolbar({ pending: true, onClick })
    expect(button().getAttribute('aria-busy')).toBe('true')
    expect(ring().borderRadius).toBe(
      token('--tsr-comp-button-radius-square', 'border-top-left-radius'),
    )
    expect(ring().borderRadius).toBe(getComputedStyle(button()).borderRadius)
    expect(shadowsOf(ring().boxShadow)).toHaveLength(6)
    await userEvent.click(button())
    button().focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()
  })

  test('BS11: a new `errorFlash` value lights the red glow around a ToolbarButton', async () => {
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
    await expect.poll(() => fill()).toBe(100)
    expect(toRgba(shadowsOf(ring().boxShadow)[4]!.color)).toEqual(
      toRgba(token('--tsr-comp-error-flash-glow')),
    )
    expect(getComputedStyle(button()).color).toBe(rest)
  })
})

describe('Button states: tokens and axe', () => {
  test('BS16: by default the pending tones are the loading glow tones at the pending strength in both themes', async () => {
    await renderIcon({ pending: true })
    await inBothThemes(async () => {
      for (const i of [1, 2, 3, 4]) {
        expect(token(`--tsr-comp-pending-glow-${i}`), `tone ${i}`).toBe(
          resolved(
            `color-mix(in oklch, var(--tsr-comp-loader-glow-${i}) var(--tsr-comp-pending-glow-strength), transparent)`,
          ),
        )
      }
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

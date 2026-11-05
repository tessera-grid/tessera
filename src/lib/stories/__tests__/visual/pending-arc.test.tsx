import { Toolbar } from '@base-ui/react/toolbar'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../ui/theme/theme.css'
import { Button } from '@/lib/ui/Button'
import { IconButton } from '@/lib/ui/IconButton'
import { ToolbarButton } from '@/lib/ui/ToolbarButton'
import { SvgIcon } from '@/lib/ui/icons'
import { SelectTrigger } from '@/lib/ui/SelectTrigger/SelectTrigger'
import { arcHeadOf, arcTailOf, arcTrackOf, pendingArcOf } from '../helpers'
import { toRgba } from './a11y-helpers'

// Дуга ожидания и отказ кнопок кита (ADR 0127, IR1–IR6, IR10–IR11, IR31–IR32; ADR 0136,
// FB1–FB2). Кнопки рендерятся напрямую в обёртке темы; состояние читается из ARIA,
// атрибутов, вычисленных стилей и анимаций слоя дуги, а не из имён CSS-модулей. Слой —
// дорожка и хвост из восьми отрезков.

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
  <div
    className="data-grid-theme"
    style={{ display: 'flex', gap: 24, padding: 24, ...style }}
  >
    {children}
  </div>
)

const byLabel = (label: string) =>
  document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"], button[data-label="${label}"]`,
  )!
const arcOf = pendingArcOf
const trackOf = (el: Element) => arcTrackOf(arcOf(el)!)
const tailOf = (el: Element) => arcTailOf(arcOf(el)!)
const headOf = (el: Element) => arcHeadOf(arcOf(el)!)
/** Анимация слоя дуги или его частей: ход и оттенки — у слоя, покраснение — у дорожки. */
const animationOf = (el: Element, name: string) =>
  arcOf(el)!
    .getAnimations({ subtree: true })
    .find(a => (a as CSSAnimation).animationName?.includes(name)) as
    CSSAnimation | undefined
const number = (value: string) => parseFloat(value.replace('calc(', ''))
/** Штрих и пробел отрезка — доли периметра (`pathLength` 100). */
const dashOf = (rect: SVGRectElement) =>
  getComputedStyle(rect).strokeDasharray.split(',').map(number)
/** Где на контуре кончается штрих отрезка — его голова, доля периметра от начала. */
const headAt = (rect: SVGRectElement) =>
  dashOf(rect)[0]! - number(getComputedStyle(rect).strokeDashoffset)
const strokeOf = (rect: SVGRectElement) => toRgba(getComputedStyle(rect).stroke)
const opacityOf = (el: Element) => parseFloat(getComputedStyle(el).opacity)
/** Кривая CSS-анимации: `animation-timing-function` — у ключевых кадров, а не у эффекта. */
const keyframeEasingOf = (animation: CSSAnimation) =>
  (animation.effect as KeyframeEffect).getKeyframes()[0]!.easing
const boxOf = ({ x, y, width, height }: DOMRect) => ({ x, y, width, height })
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

/** Значение токена темы, разрешённое в контексте элемента. */
const token = (el: Element, name: string, prop = 'color') => {
  const probe = document.createElement('span')
  probe.style.setProperty(prop, `var(${name})`)
  el.parentElement!.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return value
}

/** Кнопки всех форм кита: круг, круг со своим радиусом, квадрат, тулбар, с подписью. */
const Shapes = ({
  pending,
  style,
}: {
  pending: boolean
  style?: CSSProperties
}) => (
  <Theme style={style}>
    <IconButton aria-label="Circle" pending={pending}>
      {icon}
    </IconButton>
    <span style={{ '--tsr-comp-button-radius-circle': '6px' } as CSSProperties}>
      <IconButton aria-label="Rounded" pending={pending}>
        {icon}
      </IconButton>
    </span>
    <IconButton aria-label="Square" shape="square" pending={pending}>
      {icon}
    </IconButton>
    <Toolbar.Root>
      <ToolbarButton label="Toolbar" icon={icon} pending={pending} />
    </Toolbar.Root>
    <Button data-label="Text" pending={pending}>
      Retry
    </Button>
  </Theme>
)

const SHAPES = ['Circle', 'Rounded', 'Square', 'Toolbar', 'Text']

describe('Pending arc', () => {
  test('IR1: a pending kit button lays a track and runs an arc, both of the ring width, along its own contour in every shape; the track is the arc tone at the track strength; the button keeps its size and place; no spot light', async () => {
    const screen = await render(<Shapes pending={false} />)
    const rest = SHAPES.map(label => byLabel(label).getBoundingClientRect())
    await screen.rerender(<Shapes pending />)
    SHAPES.forEach((label, i) => {
      const el = byLabel(label)
      const box = el.getBoundingClientRect()
      expect(box.toJSON(), label).toEqual(rest[i]!.toJSON())

      const svg = arcOf(el)!
      expect(svg, label).not.toBeNull()
      expect(getComputedStyle(el, '::after').content, label).toBe('none')
      const track = trackOf(el)
      expect(track, `${label}: дорожка`).not.toBeNull()
      expect(tailOf(el), `${label}: хвост`).toHaveLength(8)

      const width = parseFloat(
        token(el, '--tsr-comp-pending-ring-width', 'width'),
      )
      const radius = getComputedStyle(el).borderTopLeftRadius
      const rx = radius.endsWith('%')
        ? '50%'
        : String(parseFloat(radius) - width / 2)
      // Дорожка и все отрезки дуги лежат на одной линии одной толщины.
      for (const rect of [track, ...tailOf(el)]) {
        expect(parseFloat(getComputedStyle(rect).strokeWidth), label).toBe(
          width,
        )
        expect(rect.getAttribute('rx'), label).toBe(rx)
        expect(boxOf(rect.getBBox()), label).toEqual(boxOf(track.getBBox()))
      }
      // Дорожка — весь контур, без пробелов.
      expect(getComputedStyle(track).strokeDasharray, label).toBe('none')
      // Средняя линия — на половину толщины внутрь от внешнего края кнопки. Геометрия
      // `getBBox()` без штриха и CSS-бокс слоя: рамку штриха движки считают по-разному.
      const layer = svg.getBoundingClientRect()
      const geometry = track.getBBox()
      const line = new DOMRect(
        layer.left + geometry.x,
        layer.top + geometry.y,
        geometry.width,
        geometry.height,
      )
      expect(line.left - box.left, label).toBeCloseTo(width / 2, 1)
      expect(box.right - line.right, label).toBeCloseTo(width / 2, 1)
      expect(line.top - box.top, label).toBeCloseTo(width / 2, 1)
      expect(box.bottom - line.bottom, label).toBeCloseTo(width / 2, 1)

      // Дорожка — оттенок головы дуги того же кадра силой токена (15 %).
      const [r, g, b, a] = strokeOf(track)
      const tone = strokeOf(headOf(el))
      expect(a, label).toBeCloseTo(0.15, 1)
      expect(
        Math.hypot(r! - tone[0]!, g! - tone[1]!, b! - tone[2]!),
        label,
      ).toBeLessThan(12)
    })
    // Дуга 2px: радиус 6px минус половина толщины.
    expect(
      token(byLabel('Rounded'), '--tsr-comp-pending-ring-width', 'width'),
    ).toBe('2px')
    expect(trackOf(byLabel('Rounded')).getAttribute('rx')).toBe('5')

    // Сила дорожки — из токена.
    await screen.rerender(
      <Shapes
        pending
        style={{ '--tsr-comp-pending-track-strength': '40%' } as CSSProperties}
      />,
    )
    expect(strokeOf(trackOf(byLabel('Circle')))[3]).toBeCloseTo(0.4, 1)
  })

  test('IR2: the arc is `--tsr-comp-pending-arc` percent of the perimeter, its density grows from the end to the rounded head in front; it laps in half the pending duration on any button size at one speed along every side and cycles the spinner tones in 1.7 durations over the arc and the track', async () => {
    const view = (style?: CSSProperties) => (
      <Theme style={style}>
        <IconButton aria-label="Small" shape="square" size="compact" pending>
          {icon}
        </IconButton>
        <Button data-label="Wide" pending>
          A much longer label
        </Button>
      </Theme>
    )
    const screen = await render(view())
    const duration =
      parseFloat(
        token(
          byLabel('Small'),
          '--tsr-comp-pending-glow-duration',
          'transition-duration',
        ),
      ) * 1000
    const arc = Number(
      getComputedStyle(byLabel('Small')).getPropertyValue(
        '--tsr-comp-pending-arc',
      ),
    )
    expect(arc).toBe(30)
    for (const label of ['Small', 'Wide']) {
      const el = byLabel(label)
      const run = animationOf(el, 'pendingRun')!
      expect(run.effect!.getTiming().duration, label).toBe(duration * 0.5)
      // Ход — доля периметра в единицу времени: скорость вдоль края одна на всех сторонах.
      expect(keyframeEasingOf(run), label).toBe('linear')
      for (const rect of [trackOf(el), ...tailOf(el)]) {
        expect(rect.getAttribute('pathLength'), label).toBe('100')
      }
      run.pause()
      for (const share of [0, 0.25]) {
        run.currentTime = Number(run.effect!.getTiming().duration) * share
        // Отрезок `i` — `i/8` дуги, головы у всех в одной точке, которая идёт впереди.
        tailOf(el).forEach((rect, i) => {
          const [dash, gap] = dashOf(rect)
          expect(dash, `${label} #${i + 1}`).toBeCloseTo((arc * (i + 1)) / 8, 5)
          expect(dash! + gap!, `${label} #${i + 1}`).toBeCloseTo(100, 5)
          expect(headAt(rect), `${label} #${i + 1}`).toBeCloseTo(
            arc + 100 * share,
            3,
          )
        })
      }
      run.play()
      // Скруглена только голова.
      const caps = tailOf(el).map(rect => getComputedStyle(rect).strokeLinecap)
      expect(caps, label).toEqual(['round', ...Array(7).fill('butt')])
      // Плотность по участкам от конца к голове: участок `k` покрыт `k` самыми длинными
      // отрезками — растёт ровно и у головы полная.
      const alphas = tailOf(el).map(rect =>
        Number(getComputedStyle(rect).strokeOpacity),
      )
      const density = alphas.map((_, k) =>
        alphas
          .slice(alphas.length - 1 - k)
          .reduce((covered, a) => covered + (1 - covered) * a, 0),
      )
      density.forEach((value, k) => {
        expect(value, `${label}: участок ${k + 1}`).toBeCloseTo((k + 1) / 8, 5)
      })

      const tones = animationOf(el, 'spinnerTones')!
      expect(tones.effect!.getTiming().duration).toBeCloseTo(duration * 1.7, 0)
      // Оттенок слоя ведёт и дугу, и дорожку.
      tones.pause()
      const cycle = tones.effect!.getTiming().duration as number
      for (const index of [1, 2, 3, 4]) {
        tones.currentTime = (cycle * (index - 1)) / 4
        const tone = toRgba(token(el, `--tsr-comp-pending-spinner-${index}`))
        expect(strokeOf(headOf(el)).slice(0, 3), `${label} ${index}`).toEqual(
          tone.slice(0, 3),
        )
        const track = strokeOf(trackOf(el))
        expect(
          Math.hypot(...track.slice(0, 3).map((c, j) => c - tone[j]!)),
          `${label} track ${index}`,
        ).toBeLessThan(12)
      }
      tones.play()
    }
    await screen.rerender(
      view({ '--tsr-comp-pending-arc': '40' } as CSSProperties),
    )
    expect(dashOf(tailOf(byLabel('Wide'))[7]!)[0]).toBeCloseTo(40, 5)
  })

  test('IR3: a pending button drops its own border; an overlay button keeps its shadow', async () => {
    const view = (pending: boolean) => (
      <Theme>
        <Button data-label="Outline" pending={pending}>
          Retry
        </Button>
        <IconButton aria-label="Overlay" variant="overlay" pending={pending}>
          {icon}
        </IconButton>
      </Theme>
    )
    const screen = await render(view(false))
    const border = getComputedStyle(byLabel('Outline')).borderTopColor
    const shadow = getComputedStyle(byLabel('Overlay')).boxShadow
    expect(border).not.toBe('rgba(0, 0, 0, 0)')
    expect(shadow).not.toBe('none')
    await screen.rerender(view(true))
    await expect
      .poll(() => getComputedStyle(byLabel('Outline')).borderTopColor)
      .toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(byLabel('Overlay')).boxShadow).toBe(shadow)
  })

  test('IR4: a pending ToolbarButton and Button are aria-busy and ignore click and Enter', async () => {
    const onClick = vi.fn()
    await render(
      <Theme>
        <Toolbar.Root>
          <ToolbarButton label="Export" icon={icon} pending onClick={onClick} />
        </Toolbar.Root>
        <Button data-label="Retry" pending onClick={onClick}>
          Retry
        </Button>
      </Theme>,
    )
    for (const label of ['Export', 'Retry']) {
      const el = byLabel(label)
      expect(el.getAttribute('aria-busy'), label).toBe('true')
      await userEvent.click(el)
      el.focus()
      await userEvent.keyboard('{Enter}')
    }
    expect(onClick).not.toHaveBeenCalled()
  })

  test('IR5: a pending button shows no hover — no background, no tooltip, the default cursor', async () => {
    const openTooltip = () => document.querySelector('[data-side]')
    const view = (pending: boolean) => (
      <Theme>
        <IconButton label="Load data" pending={pending}>
          {icon}
        </IconButton>
        <IconButton label="Pin" variant="overlay" pending={pending}>
          {icon}
        </IconButton>
        <Button data-label="Retry" tooltip="Retry loading" pending={pending}>
          Retry
        </Button>
      </Theme>
    )
    // В покое наведение заметно — проверка видит разницу.
    const screen = await render(view(false))
    await userEvent.hover(byLabel('Load data'))
    await expect
      .poll(() => getComputedStyle(byLabel('Load data')).backgroundColor)
      .not.toBe('rgba(0, 0, 0, 0)')
    await expect.poll(() => openTooltip(), { timeout: 3000 }).not.toBeNull()
    await userEvent.unhover(byLabel('Load data'))
    await expect.poll(() => openTooltip()).toBeNull()

    await screen.rerender(view(true))
    for (const label of ['Load data', 'Pin', 'Retry']) {
      const el = byLabel(label)
      await userEvent.hover(el)
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(openTooltip(), label).toBeNull()
      expect(getComputedStyle(el).cursor, label).toBe('default')
      if (label === 'Pin') {
        expect(getComputedStyle(el, '::before').opacity).toBe('0')
      } else {
        expect(getComputedStyle(el).backgroundColor, label).toBe(
          'rgba(0, 0, 0, 0)',
        )
      }
      await userEvent.unhover(el)
    }
  })

  test('IR6: focus stays on a pending button and stays visible — the focus ring is outside the arc with a gap of its width and uses the pending focus ring width; at rest the ring is the regular one', async () => {
    const screen = await render(
      <Theme>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
        <Button data-label="Retry" pending>
          Retry
        </Button>
        <Button data-label="Rest">Rest</Button>
      </Theme>,
    )
    for (const label of ['Load', 'Retry']) {
      await userEvent.tab()
      const el = byLabel(label)
      expect(document.activeElement, label).toBe(el)
      expect(el.matches(':focus-visible'), label).toBe(true)
      const style = getComputedStyle(el)
      expect(style.outlineStyle, label).toBe('solid')
      expect(style.outlineWidth, label).toBe(
        token(el, '--tsr-comp-pending-focus-ring-width', 'width'),
      )
      expect(style.outlineWidth, label).toBe('1px')
      expect(style.outlineOffset, label).toBe(
        token(el, '--tsr-comp-pending-ring-width', 'width'),
      )
      expect(style.boxShadow, label).toBe('none')
      expect(arcOf(el), label).not.toBeNull()
    }
    // Кнопка в покое — общее кольцо фокуса кита.
    await userEvent.tab()
    const rest = byLabel('Rest')
    expect(document.activeElement).toBe(rest)
    expect(getComputedStyle(rest).boxShadow).toContain(
      `0px 0px 0px ${token(rest, '--tsr-comp-focus-ring-width', 'width')}`,
    )
    await screen.unmount()
  })
})

describe('Pending arc: dimmed label', () => {
  test('IR31: the label and icon of a pending IconButton, ToolbarButton and Button take the disabled color; after pending they return to the rest color', async () => {
    const screen = await render(<Shapes pending={false} />)
    const rest = SHAPES.map(label => getComputedStyle(byLabel(label)).color)
    await screen.rerender(<Shapes pending />)
    for (const label of SHAPES) {
      const el = byLabel(label)
      const disabled = token(el, '--tsr-comp-control-disabled-color')
      expect(disabled, label).not.toBe(rest[SHAPES.indexOf(label)])
      await expect
        .poll(() => getComputedStyle(el).color, { timeout: 2000 })
        .toBe(disabled)
    }
    await screen.rerender(<Shapes pending={false} />)
    for (const [i, label] of SHAPES.entries()) {
      await expect
        .poll(() => getComputedStyle(byLabel(label)).color, { timeout: 2000 })
        .toBe(rest[i])
    }
  })
})

describe('Pending arc: failure', () => {
  test('FB1: a failure on IconButton, ToolbarButton and Button stops the arc and fades it with the track within --tsr-comp-pending-stop-duration; the contour does not turn red; the button carries no failure mark', async () => {
    const view = (pending: boolean, failed?: boolean) => (
      <Theme>
        <IconButton aria-label="Icon" pending={pending} failed={failed}>
          {icon}
        </IconButton>
        <Toolbar.Root>
          <ToolbarButton
            label="Toolbar"
            icon={icon}
            pending={pending}
            failed={failed}
          />
        </Toolbar.Root>
        <Button data-label="Text" pending={pending} failed={failed}>
          Retry
        </Button>
      </Theme>
    )
    const labels = ['Icon', 'Toolbar', 'Text']
    const screen = await render(view(true))
    for (const label of labels) {
      expect(arcOf(byLabel(label))!.dataset.phase, label).toBe('pending')
    }
    await screen.rerender(view(false, true))
    for (const label of labels) {
      const el = byLabel(label)
      const arc = arcOf(el)!
      // Кадр конца ожидания: дуга встала и гаснет, отметки отказа на кнопке нет.
      expect(arc.dataset.phase, label).toBe('stopping')
      expect(el.querySelector('[data-failure-indicator]'), label).toBeNull()
      expect(
        arc
          .getAnimations()
          .filter(a => a instanceof CSSAnimation)
          .every(a => a.playState === 'paused'),
        label,
      ).toBe(true)
      const style = getComputedStyle(arc)
      // Угасание идёт переходом непрозрачности к нулю.
      const fade = arc
        .getAnimations()
        .find(
          a => a instanceof CSSTransition && a.transitionProperty === 'opacity',
        ) as CSSTransition
      const keyframes = (fade.effect as KeyframeEffect).getKeyframes()
      expect(keyframes.at(-1)!.opacity, label).toBe('0')
      expect(style.transitionDuration, label).toBe(
        token(el, '--tsr-comp-pending-stop-duration', 'transition-duration'),
      )
      expect(style.transitionTimingFunction, label).toBe(
        token(el, '--tsr-comp-motion-easing-out', 'transition-timing-function'),
      )
      // Контур не краснеет: дорожка — бледный оттенок дуги, а не цвет ошибки.
      const red = toRgba(token(el, '--tsr-comp-error-flash-color'))
      const [r, g, b, a] = strokeOf(trackOf(el))
      expect(
        a! < 1 || Math.hypot(r! - red[0]!, g! - red[1]!, b! - red[2]!) > 40,
        label,
      ).toBe(true)
      expect(getComputedStyle(el).borderColor).not.toBe(
        token(el, '--tsr-comp-error-flash-color'),
      )
    }
    for (const label of labels) {
      await expect
        .poll(() => arcOf(byLabel(label)), { timeout: 2000 })
        .toBeNull()
    }
  })

  test('IR32: the outline border of Button and the page size trigger leaves while pending and comes back as the arc fades after a failure', async () => {
    const view = (pending: boolean, failed?: boolean) => (
      <Theme>
        <Button data-label="Text" pending={pending} failed={failed}>
          Retry
        </Button>
        <SelectTrigger data-label="Size" pending={pending} failed={failed}>
          25
        </SelectTrigger>
      </Theme>
    )
    const labels = ['Text', 'Size']
    const screen = await render(view(false))
    const rest = labels.map(l => getComputedStyle(byLabel(l)).borderTopColor)
    for (const value of rest) expect(value).not.toBe('rgba(0, 0, 0, 0)')
    await screen.rerender(view(true))
    for (const label of labels) {
      await expect
        .poll(() => getComputedStyle(byLabel(label)).borderTopColor, {
          timeout: 1000,
        })
        .toBe('rgba(0, 0, 0, 0)')
    }
    await screen.rerender(view(false, true))
    // Фазы — сразу у обеих: пока ждём рамку первой, дуга второй успевает погаснуть.
    expect(labels.map(label => arcOf(byLabel(label))?.dataset.phase)).toEqual(
      labels.map(() => 'stopping'),
    )
    for (const [i, label] of labels.entries()) {
      await expect
        .poll(() => getComputedStyle(byLabel(label)).borderTopColor, {
          timeout: 1000,
        })
        .toBe(rest[i])
    }
  })

  test('IR11: with reduced motion the arc with its tail and the track are visible and still; a failure drops the arc without a transition', async () => {
    await reducedMotion(true)
    const view = (pending: boolean, failed?: boolean) => (
      <Theme>
        <IconButton aria-label="Load" pending={pending} failed={failed}>
          {icon}
        </IconButton>
      </Theme>
    )
    const screen = await render(view(true))
    const el = byLabel('Load')
    await frame()
    expect(getComputedStyle(arcOf(el)!).opacity).toBe('1')
    await expect
      .poll(() =>
        arcOf(el)!
          .getAnimations({ subtree: true })
          .some(animation => animation.playState === 'running'),
      )
      .toBe(false)
    // Дуга стоит у начала контура первым оттенком, с хвостом, над дорожкой.
    const arc = Number(
      getComputedStyle(el).getPropertyValue('--tsr-comp-pending-arc'),
    )
    for (const rect of tailOf(el)) expect(headAt(rect)).toBeCloseTo(arc, 3)
    const first = toRgba(token(el, '--tsr-comp-pending-spinner-1'))
    expect(strokeOf(headOf(el))).toEqual(first)
    expect(strokeOf(trackOf(el))[3]).toBeCloseTo(0.15, 1)
    await screen.rerender(view(false, true))
    if (arcOf(el)) {
      for (const part of getComputedStyle(arcOf(el)!).transitionDuration.split(
        ',',
      )) {
        expect(part.trim()).toBe('0s')
      }
    }
    await expect.poll(() => arcOf(el), { timeout: 500 }).toBeNull()
  })
})

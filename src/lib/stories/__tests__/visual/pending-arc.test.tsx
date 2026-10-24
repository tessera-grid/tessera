import { Toolbar } from '@base-ui/react/toolbar'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../core/themeVariables/theme.css'
import { Button } from '@/lib/ui/Button'
import { IconButton } from '@/lib/ui/IconButton'
import { ToolbarButton } from '@/lib/ui/ToolbarButton'
import { SvgIcon } from '@/lib/ui/icons'
import { SizeTrigger } from '@/lib/plugins/pagination/SizeTrigger'
import paginationStyles from '@/lib/plugins/pagination/Pagination.module.css'
import { arcHeadOf, arcTailOf, arcTrackOf, pendingArcOf } from '../helpers'
import { toRgba } from './a11y-helpers'

// Дуга ожидания и отказ кнопок кита (ADR 0127, IR1–IR11). Кнопки рендерятся напрямую в
// обёртке темы; состояние читается из ARIA, атрибутов, вычисленных стилей и анимаций
// слоя дуги, а не из имён CSS-модулей. Слой — дорожка и хвост из восьми отрезков.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

afterEach(() => reducedMotion(false))

const icon = <SvgIcon width={20} height={20} />

// Удержание вспышки в тестах — 800 мс: фазу удержания успевают прочитать.
const FAST_FLASH = {
  '--tsr-comp-error-flash-duration': '800ms',
} as CSSProperties

const Theme = ({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) => (
  <div
    className="data-grid-theme"
    style={{ display: 'flex', gap: 24, padding: 24, ...FAST_FLASH, ...style }}
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
/** Переход непрозрачности хвоста при отказе. */
const tailFadeOf = (el: Element) =>
  arcOf(el)!.querySelector('g')!.getAnimations()[0] as CSSTransition | undefined
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

  test('IR6: focus stays on a pending button and stays visible — the focus ring is outside the arc with a gap of its width; pending buttons and buttons holding the red contour use the pending focus ring width; as the red fades and at rest the ring is the regular one', async () => {
    const LONG_FLASH = {
      '--tsr-comp-error-flash-duration': '10s',
    } as CSSProperties
    const view = (flash: number) => (
      <Theme style={LONG_FLASH}>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
        <Button data-label="Retry" pending>
          Retry
        </Button>
        <IconButton aria-label="Failed" errorFlash={flash}>
          {icon}
        </IconButton>
        <Button data-label="Rest">Rest</Button>
      </Theme>
    )
    const screen = await render(view(0))
    await screen.rerender(view(1))
    for (const label of ['Load', 'Retry', 'Failed']) {
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

    // Угасание красного: кольцо снова обычное, пока контур ещё гаснет.
    const FADE = {
      '--tsr-comp-error-flash-duration': '300ms',
      '--tsr-comp-error-flash-fade-duration': '3s',
    } as CSSProperties
    const fading = (flash: number) => (
      <Theme style={FADE}>
        <Button data-label="Fading" errorFlash={flash}>
          Retry
        </Button>
        <IconButton
          aria-label="Fading chip"
          variant="overlay"
          errorFlash={flash}
        >
          {icon}
        </IconButton>
      </Theme>
    )
    const second = await render(fading(0))
    await second.rerender(fading(1))
    for (const label of ['Fading', 'Fading chip']) {
      const el = byLabel(label)
      await userEvent.tab()
      expect(document.activeElement, label).toBe(el)
      await expect
        .poll(() => el.getAttribute('data-error-flash'), {
          timeout: 2000,
          interval: 10,
        })
        .toBe('off')
      const style = getComputedStyle(el)
      expect(arcOf(el)?.dataset.phase, label).toBe('off')
      expect(style.outlineStyle, label).toBe('none')
      expect(
        style.boxShadow.startsWith(ringOf(el)),
        `${label}: ${style.boxShadow}`,
      ).toBe(true)
    }
  })
})

/** Обычное кольцо фокуса кита — первый слой `box-shadow`. */
const ringOf = (el: Element) =>
  `${token(el, '--tsr-comp-focus-ring')} 0px 0px 0px ${token(el, '--tsr-comp-focus-ring-width', 'width')}`

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
  test('IR7: a failure stops the arc and within the fill duration with the easing-out curve fades it while the track turns smoothly from its tone to full red along the whole contour; the red contour holds and fades out — on IconButton, ToolbarButton and Button; the label and icon do not turn red and take the rest color within the fill duration', async () => {
    const view = (pending: boolean, flash: number) => (
      <Theme>
        <IconButton aria-label="Icon" pending={pending} errorFlash={flash}>
          {icon}
        </IconButton>
        <Toolbar.Root>
          <ToolbarButton
            label="Toolbar"
            icon={icon}
            pending={pending}
            errorFlash={flash}
          />
        </Toolbar.Root>
        <Button data-label="Text" pending={pending} errorFlash={flash}>
          Retry
        </Button>
      </Theme>
    )
    const labels = ['Icon', 'Toolbar', 'Text']
    // По умолчанию удержание и угасание контура — ритм вспышки итога (ADR 0134); тема,
    // меняющая ритм вспышки, меняет и контур.
    const probe = document.createElement('div')
    probe.className = 'data-grid-theme'
    document.body.appendChild(probe)
    const rhythm = () => {
      const style = getComputedStyle(probe)
      const value = (name: string) => style.getPropertyValue(name).trim()
      return {
        hold: value('--tsr-comp-error-flash-duration'),
        fade: value('--tsr-comp-error-flash-fade-duration'),
        flashHold: value('--tsr-comp-flash-duration'),
        flashFade: value('--tsr-comp-flash-fade-duration'),
      }
    }
    expect(rhythm()).toEqual({
      hold: '300ms',
      fade: '500ms',
      flashHold: '300ms',
      flashFade: '500ms',
    })
    probe.style.setProperty('--tsr-comp-flash-duration', '450ms')
    probe.style.setProperty('--tsr-comp-flash-fade-duration', '650ms')
    expect(rhythm()).toMatchObject({ hold: '450ms', fade: '650ms' })
    probe.remove()
    const screen = await render(view(true, 0))
    await new Promise(resolve => setTimeout(resolve, 200))
    // Цвет покоя: занятая кнопка приглушена (IR31), в отказе — снова цвет покоя.
    const color = labels.map(l => token(byLabel(l), '--tsr-comp-button-color'))
    const times = labels.map(l =>
      Number(animationOf(byLabel(l), 'pendingRun')!.currentTime),
    )
    const start = performance.now()
    await screen.rerender(view(false, 1))
    labels.forEach((label, i) => {
      const el = byLabel(label)
      expect(arcOf(el)!.dataset.phase, label).toBe('error')
      // Та же анимация на паузе — дуга встала там, где была; оттенок — тоже.
      const run = animationOf(el, 'pendingRun')!
      expect(run.playState, label).toBe('paused')
      expect(Number(run.currentTime), label).toBeGreaterThanOrEqual(times[i]!)
      expect(animationOf(el, 'spinnerTones')!.playState, label).toBe('paused')
      // Подпись возвращается к цвету покоя в такт заливке.
      const style = getComputedStyle(el)
      for (const duration of style.transitionDuration.split(', ')) {
        expect(duration, label).toBe(
          token(
            el,
            '--tsr-comp-error-flash-fill-duration',
            'transition-duration',
          ),
        )
      }
      // Одна кривая на все переходы: значение — только повторы кривой заливки.
      const easing = token(
        el,
        '--tsr-comp-motion-easing-out',
        'transition-timing-function',
      )
      expect(
        style.transitionTimingFunction.split(easing).join(''),
        label,
      ).toMatch(/^(, )*$/)
    })
    // Кадры отказа: дорожка из своего оттенка краснеет с быстрым стартом, хвост гаснет.
    const red = toRgba(token(byLabel('Icon'), '--tsr-comp-error-flash-color'))
    const fillMs =
      parseFloat(
        token(
          byLabel('Icon'),
          '--tsr-comp-error-flash-fill-duration',
          'transition-duration',
        ),
      ) * 1000
    const easingOut = token(
      byLabel('Icon'),
      '--tsr-comp-motion-easing-out',
      'transition-timing-function',
    )
    const redness = (rgba: number[]) =>
      Math.hypot(...rgba.slice(0, 3).map((c, j) => c - red[j]!))
    for (const label of labels) {
      const el = byLabel(label)
      const turn = animationOf(el, 'trackFail')!
      const fade = tailFadeOf(el)!
      expect(turn.effect!.getComputedTiming().duration, label).toBe(fillMs)
      expect(keyframeEasingOf(turn), label).toBe(easingOut)
      expect(fade.transitionProperty, label).toBe('opacity')
      expect(fade.effect!.getComputedTiming().duration, label).toBe(fillMs)
      expect(fade.effect!.getComputedTiming().easing, label).toBe(easingOut)
      turn.pause()
      fade.pause()
      const at = (share: number) => {
        turn.currentTime = fillMs * share
        fade.currentTime = fillMs * share
        return {
          track: strokeOf(trackOf(el)),
          tail: opacityOf(arcOf(el)!.querySelector('g')!),
        }
      }
      const [begin, tenth, half, end] = [0, 0.1, 0.5, 1].map(at)
      // Начало — бледная дорожка своего оттенка, хвост в полную силу.
      expect(begin!.track[3], label).toBeCloseTo(0.15, 1)
      expect(redness(begin!.track), label).toBeGreaterThan(100)
      expect(begin!.tail, label).toBe(1)
      // Быстрый старт: к десятой доле времени — больше пятой доли пути (плавный старт
      // `motion-easing` проходит к этому моменту около 3 %).
      expect(tenth!.track[3], label).toBeGreaterThan(0.15 + 0.85 * 0.2)
      expect(tenth!.tail, label).toBeLessThan(0.8)
      expect(half!.track[3], label).toBeGreaterThan(tenth!.track[3]!)
      expect(half!.track[3], label).toBeLessThan(1)
      expect(half!.tail, label).toBeLessThan(tenth!.tail)
      expect(half!.tail, label).toBeGreaterThan(0)
      // Конец — весь контур красным в полную силу, хвоста нет.
      // Перетекание идёт в oklab — конец сверяем с допуском округления.
      expect(redness(end!.track), label).toBeLessThan(2)
      expect(end!.track[3], label).toBe(1)
      expect(end!.tail, label).toBe(0)
      expect(getComputedStyle(trackOf(el)).strokeDasharray, label).toBe('none')
      turn.play()
      fade.play()
    }
    for (const [i, label] of labels.entries()) {
      await expect
        .poll(() => getComputedStyle(byLabel(label)).color, { timeout: 1000 })
        .toBe(color[i])
    }
    for (const label of labels) {
      await expect
        .poll(() => redness(strokeOf(trackOf(byLabel(label)))) < 2, {
          timeout: fillMs + 300,
        })
        .toBe(true)
    }
    expect(performance.now() - start).toBeLessThan(fillMs + 300)
    // Держится удержание и гаснет плавно за длительность угасания с замедлением.
    await expect
      .poll(() => arcOf(byLabel('Icon'))?.dataset.phase, {
        timeout: 2000,
        interval: 10,
      })
      .toBe('off')
    expect(performance.now() - start).toBeGreaterThanOrEqual(780)
    const fade = getComputedStyle(arcOf(byLabel('Icon'))!)
    expect(fade.transitionProperty).toBe('opacity')
    expect(fade.transitionDuration).toBe(
      token(
        byLabel('Icon'),
        '--tsr-comp-error-flash-fade-duration',
        'transition-duration',
      ),
    )
    expect(fade.transitionTimingFunction).toBe(
      token(
        byLabel('Icon'),
        '--tsr-comp-motion-easing-out',
        'transition-timing-function',
      ),
    )
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(
      parseFloat(getComputedStyle(arcOf(byLabel('Icon'))!).opacity),
    ).toBeGreaterThan(0.05)
    for (const label of labels) {
      await expect
        .poll(() => arcOf(byLabel(label)), { timeout: 2000 })
        .toBeNull()
      expect(getComputedStyle(byLabel(label)).color).toBe(
        color[labels.indexOf(label)],
      )
    }
  })

  test('IR8: a failure without pending shows the contour red from transparent with the same transition, without an arc', async () => {
    const screen = await render(
      <Theme>
        <IconButton aria-label="Load" errorFlash={0}>
          {icon}
        </IconButton>
      </Theme>,
    )
    await frame()
    await screen.rerender(
      <Theme>
        <IconButton aria-label="Load" errorFlash={1}>
          {icon}
        </IconButton>
      </Theme>,
    )
    const el = byLabel('Load')
    expect(arcOf(el)!.dataset.phase).toBe('error')
    expect(arcOf(el)!.hasAttribute('data-from-pending')).toBe(false)
    // Дуги нет с первого кадра — хвост не проявляется и не гаснет.
    expect(opacityOf(arcOf(el)!.querySelector('g')!)).toBe(0)
    expect(tailFadeOf(el)).toBeUndefined()
    // Начало — на паузе: быстрый старт за время рендера уходит далеко от нуля.
    const turn = animationOf(el, 'trackFail')!
    const fillMs = Number(turn.effect!.getComputedTiming().duration)
    expect(fillMs).toBe(
      parseFloat(
        token(
          el,
          '--tsr-comp-error-flash-fill-duration',
          'transition-duration',
        ),
      ) * 1000,
    )
    expect(keyframeEasingOf(turn)).toBe(
      token(el, '--tsr-comp-motion-easing-out', 'transition-timing-function'),
    )
    turn.pause()
    turn.currentTime = 0
    expect(strokeOf(trackOf(el))[3]).toBe(0)
    turn.currentTime = fillMs / 2
    const half = strokeOf(trackOf(el))[3]!
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(1)
    turn.play()
    const red = toRgba(token(el, '--tsr-comp-error-flash-color'))
    await expect
      .poll(() => {
        const [r, g, b, a] = strokeOf(trackOf(el))
        return (
          a === 1 && Math.hypot(r! - red[0]!, g! - red[1]!, b! - red[2]!) < 2
        )
      })
      .toBe(true)
  })

  test('IR9: a kit button with `failure` shows the error dot in its top right corner once the red contour is gone, not while pending, holding or fading the red contour', async () => {
    const SLOW_FADE = {
      '--tsr-comp-error-flash-fade-duration': '1s',
    } as CSSProperties
    const view = (pending: boolean, flash: number) => (
      <Theme style={SLOW_FADE}>
        <IconButton
          aria-label="Load"
          pending={pending}
          errorFlash={flash}
          failure="Failed: offline"
        >
          {icon}
        </IconButton>
      </Theme>
    )
    const screen = await render(view(true, 0))
    const dot = () =>
      byLabel('Load').querySelector<HTMLElement>('[data-failure-indicator]')!
    expect(dot().dataset.shown).toBe('false')
    expect(getComputedStyle(dot()).opacity).toBe('0')
    await screen.rerender(view(false, 1))
    expect(byLabel('Load').getAttribute('data-error-flash')).toBe('on')
    // Пока красный контур есть — держится и гаснет, — отметки нет.
    let sawFade = false
    while (arcOf(byLabel('Load'))) {
      sawFade ||= byLabel('Load').getAttribute('data-error-flash') === 'off'
      expect(dot().dataset.shown).toBe('false')
      expect(getComputedStyle(dot()).opacity).toBe('0')
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(sawFade).toBe(true)
    // Контур погас — отметка проступает.
    expect(dot().dataset.shown).toBe('true')
    await expect.poll(() => getComputedStyle(dot()).opacity).toBe('1')
    const box = byLabel('Load').getBoundingClientRect()
    const mark = dot().getBoundingClientRect()
    expect(mark.left).toBeGreaterThan(box.left + box.width / 2)
    expect(mark.bottom).toBeLessThan(box.top + box.height / 2)
    expect(mark.right).toBeLessThanOrEqual(box.right)
    expect(mark.top).toBeGreaterThanOrEqual(box.top)
  })

  test('IR32: the outline border of Button and the page size trigger leaves while pending and while the red contour holds, and comes back as the red contour starts to fade, not after it', async () => {
    const SLOW = {
      '--tsr-comp-error-flash-duration': '300ms',
      '--tsr-comp-error-flash-fade-duration': '3s',
    } as CSSProperties
    const view = (pending: boolean, flash: number) => (
      <Theme style={SLOW}>
        <Button data-label="Text" pending={pending} errorFlash={flash}>
          Retry
        </Button>
        <SizeTrigger
          data-label="Size"
          className={paginationStyles.trigger}
          pending={pending}
          errorFlash={flash}
        >
          25
        </SizeTrigger>
      </Theme>
    )
    const labels = ['Text', 'Size']
    const screen = await render(view(false, 0))
    const rest = labels.map(l => getComputedStyle(byLabel(l)).borderTopColor)
    for (const value of rest) expect(value).not.toBe('rgba(0, 0, 0, 0)')
    const hidden = async (label: string) =>
      expect
        .poll(() => getComputedStyle(byLabel(label)).borderTopColor, {
          timeout: 1000,
        })
        .toBe('rgba(0, 0, 0, 0)')
    await screen.rerender(view(true, 0))
    for (const label of labels) await hidden(label)
    await screen.rerender(view(false, 1))
    for (const label of labels) {
      expect(byLabel(label).getAttribute('data-error-flash')).toBe('on')
      await hidden(label)
    }
    await expect
      .poll(() => byLabel('Text').getAttribute('data-error-flash'), {
        timeout: 2000,
        interval: 10,
      })
      .toBe('off')
    // Красный ещё гаснет (3 с), а рамка уже вернулась.
    for (const [i, label] of labels.entries()) {
      await expect
        .poll(() => getComputedStyle(byLabel(label)).borderTopColor, {
          timeout: 1000,
        })
        .toBe(rest[i])
      expect(arcOf(byLabel(label))?.dataset.phase, label).toBe('off')
    }
  })

  test('IR10: a kit button with `failure` shows the failure text as its tooltip instead of the label and as its description; the accessible name stays the label', async () => {
    const openTooltip = () => document.querySelector('[data-side]')
    await render(
      <Theme>
        <IconButton
          label="Pin column"
          failure="Failed: offline. Click to retry"
        >
          {icon}
        </IconButton>
        <Button
          data-label="Retry"
          tooltip="Retry loading"
          failure="Failed: timeout"
        >
          Retry
        </Button>
      </Theme>,
    )
    const cases = [
      ['Pin column', 'Failed: offline. Click to retry'],
      ['Retry', 'Failed: timeout'],
    ] as const
    for (const [name, text] of cases) {
      const el = page.getByRole('button', { name, exact: true })
      await expect.element(el).toBeInTheDocument()
      await expect.element(el).toHaveAccessibleDescription(text)
      await userEvent.hover(el)
      await expect.poll(() => openTooltip()?.textContent ?? '').toBe(text)
      await userEvent.unhover(el)
      await expect.poll(() => openTooltip()).toBeNull()
    }
  })

  test('IR11: with reduced motion the arc with its tail and the track are visible and still; a failure is the whole red contour at once, holds for the same duration and drops without a transition', async () => {
    await reducedMotion(true)
    const view = (pending: boolean, flash: number) => (
      <Theme>
        <IconButton aria-label="Load" pending={pending} errorFlash={flash}>
          {icon}
        </IconButton>
      </Theme>
    )
    const screen = await render(view(true, 0))
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
    await screen.rerender(view(false, 1))
    const start = performance.now()
    await frame()
    await frame()
    const red = toRgba(token(el, '--tsr-comp-error-flash-color'))
    const [r, g, b, a] = strokeOf(trackOf(el))
    expect(a).toBe(1)
    expect(Math.hypot(r! - red[0]!, g! - red[1]!, b! - red[2]!)).toBeLessThan(2)
    expect(opacityOf(arcOf(el)!.querySelector('g')!)).toBe(0)
    for (const part of getComputedStyle(arcOf(el)!).transitionDuration.split(
      ',',
    )) {
      expect(part.trim()).toBe('0s')
    }
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(el.getAttribute('data-error-flash')).toBe('on')
    await expect.poll(() => arcOf(el), { timeout: 2000 }).toBeNull()
    // Удержание 800 мс, угасания нет — дуга снята вскоре после удержания.
    expect(performance.now() - start).toBeGreaterThanOrEqual(780)
    expect(performance.now() - start).toBeLessThan(1100)
  })
})

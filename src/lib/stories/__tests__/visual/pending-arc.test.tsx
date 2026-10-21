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

// Дуга ожидания и отказ кнопок кита (ADR 0127, IR1–IR11). Кнопки рендерятся напрямую в
// обёртке темы; состояние читается из ARIA, атрибутов, вычисленных стилей и анимаций
// слоя дуги, а не из имён CSS-модулей.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

afterEach(() => reducedMotion(false))

const icon = <SvgIcon width={20} height={20} />

// Короткое удержание вспышки — тесты не ждут 1200 мс по умолчанию.
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
const arcOf = (el: Element) =>
  el.querySelector<SVGSVGElement>(':scope > svg[data-pending-arc]')
const rectOf = (el: Element) => arcOf(el)!.firstElementChild as SVGRectElement
const animationOf = (el: Element, name: string) =>
  rectOf(el)
    .getAnimations()
    .find(a => (a as CSSAnimation).animationName.includes(name)) as
    CSSAnimation | undefined
/** Штрих и пробел дуги — доли периметра (`pathLength` 100). */
const dashOf = (el: Element) =>
  getComputedStyle(rectOf(el))
    .strokeDasharray.split(',')
    .map(part => parseFloat(part.replace('calc(', '')))
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
const Shapes = ({ pending }: { pending: boolean }) => (
  <Theme>
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
  test('IR1: a pending kit button draws an arc of the ring width along its own contour in every shape; the button keeps its size and place; no track and no spot light', async () => {
    const screen = await render(<Shapes pending={false} />)
    const rest = SHAPES.map(label => byLabel(label).getBoundingClientRect())
    await screen.rerender(<Shapes pending />)
    SHAPES.forEach((label, i) => {
      const el = byLabel(label)
      const box = el.getBoundingClientRect()
      expect(box.toJSON(), label).toEqual(rest[i]!.toJSON())

      const svg = arcOf(el)!
      expect(svg, label).not.toBeNull()
      expect(svg.children, `${label}: только дуга, без дорожки`).toHaveLength(1)
      expect(getComputedStyle(el, '::after').content, label).toBe('none')

      const width = parseFloat(
        token(el, '--tsr-comp-pending-ring-width', 'width'),
      )
      const rect = rectOf(el)
      expect(parseFloat(getComputedStyle(rect).strokeWidth), label).toBe(width)
      // Средняя линия — на половину толщины внутрь от внешнего края кнопки. Геометрия
      // `getBBox()` без штриха и CSS-бокс слоя: рамку штриха движки считают по-разному.
      const layer = svg.getBoundingClientRect()
      const geometry = rect.getBBox()
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

      const radius = getComputedStyle(el).borderTopLeftRadius
      expect(rect.getAttribute('rx'), label).toBe(
        radius.endsWith('%') ? '50%' : String(parseFloat(radius) - width / 2),
      )
    })
    // Дуга 2px: радиус 6px минус половина толщины.
    expect(
      token(byLabel('Rounded'), '--tsr-comp-pending-ring-width', 'width'),
    ).toBe('2px')
    expect(rectOf(byLabel('Rounded')).getAttribute('rx')).toBe('5')
  })

  test('IR2: the arc is `--tsr-comp-pending-arc` percent of the perimeter, laps in half the pending duration on any button size and cycles the spinner tones in 1.7 durations', async () => {
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
    for (const label of ['Small', 'Wide']) {
      const el = byLabel(label)
      const [stroke, gap] = dashOf(el)
      expect(stroke, label).toBe(25)
      expect(stroke! + gap!, label).toBe(100)
      expect(animationOf(el, 'pendingRun')!.effect!.getTiming().duration).toBe(
        duration * 0.5,
      )
      expect(
        animationOf(el, 'spinnerTones')!.effect!.getTiming().duration,
      ).toBeCloseTo(duration * 1.7, 0)
    }
    await screen.rerender(
      view({ '--tsr-comp-pending-arc': '40' } as CSSProperties),
    )
    expect(dashOf(byLabel('Wide'))[0]).toBe(40)
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
  test('IR7: a failure stops the arc and grows it smoothly over the whole contour within the fill duration with the easing-out curve while its tone turns red, holds it and fades it out — on IconButton, ToolbarButton and Button; the label and icon do not turn red and take the rest color within the fill duration', async () => {
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
      // Та же анимация на паузе — дуга встала там, где была.
      const run = animationOf(el, 'pendingRun')!
      expect(run.playState, label).toBe('paused')
      expect(Number(run.currentTime), label).toBeGreaterThanOrEqual(times[i]!)
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
    // Кадры заливки: длина растёт плавно и с быстрым стартом, цвет перетекает в красный.
    const red = token(byLabel('Icon'), '--tsr-comp-error-flash-color')
    for (const label of labels) {
      const el = byLabel(label)
      const fill = animationOf(el, 'pendingFill')!
      const total = Number(fill.effect!.getComputedTiming().duration)
      fill.pause()
      const at = (share: number) => {
        fill.currentTime = total * share
        return {
          dash: dashOf(el)[0]!,
          stroke: getComputedStyle(rectOf(el)).stroke,
        }
      }
      const [start, tenth, quarter, half, end] = [0, 0.1, 0.25, 0.5, 1].map(at)
      expect(start!.dash, label).toBeCloseTo(25, 0)
      expect(start!.stroke, label).not.toBe(red)
      // Быстрый старт: к десятой доле времени — больше пятой доли пути (плавный старт
      // `motion-easing` проходит к этому моменту около 3 %).
      expect(tenth!.dash, label).toBeGreaterThan(25 + 75 * 0.2)
      expect(quarter!.dash, label).toBeGreaterThan(tenth!.dash)
      expect(half!.dash, label).toBeGreaterThan(quarter!.dash)
      expect(half!.dash, label).toBeLessThan(100)
      expect(quarter!.stroke, label).not.toBe(start!.stroke)
      expect(quarter!.stroke, label).not.toBe(red)
      expect(end!.dash, label).toBe(100)
      expect(end!.stroke, label).toBe(red)
      fill.play()
    }
    for (const [i, label] of labels.entries()) {
      await expect
        .poll(() => getComputedStyle(byLabel(label)).color, { timeout: 1000 })
        .toBe(color[i])
    }
    const fill =
      parseFloat(
        token(
          byLabel('Icon'),
          '--tsr-comp-error-flash-fill-duration',
          'transition-duration',
        ),
      ) * 1000
    for (const label of labels) {
      await expect
        .poll(() => dashOf(byLabel(label)), { timeout: fill + 300 })
        .toEqual([100, 0])
    }
    expect(performance.now() - start).toBeLessThan(fill + 300)
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

  test('IR8: a failure without pending fills the contour red from zero with the same transition', async () => {
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
    // Начало заливки — на паузе: быстрый старт за время рендера уходит далеко от нуля.
    const fill = animationOf(el, 'pendingFill')!
    fill.pause()
    fill.currentTime = 0
    expect(dashOf(el)[0]).toBeCloseTo(0, 0)
    fill.play()
    await expect.poll(() => dashOf(el)).toEqual([100, 0])
  })

  test('IR9: a kit button with `failure` shows the error dot in its top right corner as the red contour starts to fade, not while pending or holding the red contour', async () => {
    const view = (pending: boolean, flash: number) => (
      <Theme>
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
    expect(dot().dataset.shown).toBe('false')
    await expect
      .poll(() => byLabel('Load').getAttribute('data-error-flash'), {
        timeout: 2000,
        interval: 10,
      })
      .toBe('off')
    // Угасание началось — отметка проступает, пока красный ещё виден.
    expect(dot().dataset.shown).toBe('true')
    expect(arcOf(byLabel('Load'))).not.toBeNull()
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

  test('IR11: with reduced motion the arc is visible and still; a failure is the whole red contour at once, holds for the same duration and drops without a transition', async () => {
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
        rectOf(el)
          .getAnimations()
          .some(animation => animation.playState === 'running'),
      )
      .toBe(false)
    await screen.rerender(view(false, 1))
    const start = performance.now()
    await frame()
    await frame()
    expect(dashOf(el)).toEqual([100, 0])
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

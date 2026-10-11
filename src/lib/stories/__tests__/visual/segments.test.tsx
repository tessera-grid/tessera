import { useState } from 'react'

import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../core/themeVariables'
import { Segments, type SegmentOption } from '../../../ui/Segments'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Примитив `ui/Segments` (ADR 0074, SG1–SG4): семантика radiogroup, вид из токенов,
// доступность, движение. SG5 (экспорт и история) — модульный `uiStories`.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

afterEach(() => reducedMotion(false))

const OPTIONS: SegmentOption[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON', disabled: true },
  { value: 'xlsx', label: 'Excel' },
]

const Harness = ({
  options = OPTIONS,
  width = 260,
}: {
  options?: SegmentOption[]
  width?: number
}) => {
  const [value, setValue] = useState(options[0]!.value)
  return (
    // Примитив лежит на поверхности темы (поповер, тулбар), а не на странице.
    <div
      className={DATA_GRID_THEME_CLASS}
      style={{ width, padding: 16, background: 'var(--tsr-sys-surface)' }}
    >
      <button type="button" data-testid="before">
        before
      </button>
      <Segments
        value={value}
        options={options}
        onValueChange={setValue}
        aria-label="Format"
        data-testid="segments"
      />
    </div>
  )
}

const segments = () => [
  ...document.querySelectorAll<HTMLElement>(
    '[data-testid="segments"] [role="radio"]',
  ),
]
const segment = (value: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="segments"] [role="radio"][data-value="${value}"]`,
  )!
const indicator = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="segments"] > span[aria-hidden]',
  )!
const checked = () =>
  segments()
    .filter(el => el.getAttribute('aria-checked') === 'true')
    .map(el => el.dataset.value)

const resolve = (token: string, prop: string) => {
  const probe = document.createElement('div')
  probe.className = DATA_GRID_THEME_CLASS
  probe.style.setProperty(prop, `var(${token})`)
  document.body.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop).trim()
  probe.remove()
  return value
}

describe('ui/Segments', () => {
  test('SG1: radiogroup — один выбранный radio; стрелки переводят выбор, Tab попадает на выбранный, недоступный пропускается', async () => {
    await render(<Harness />)
    const group = document.querySelector('[data-testid="segments"]')!
    expect(group.getAttribute('role')).toBe('radiogroup')
    expect(segments()).toHaveLength(3)
    expect(checked()).toEqual(['csv'])

    await userEvent.click(segment('xlsx'))
    expect(checked()).toEqual(['xlsx'])

    document.querySelector<HTMLElement>('[data-testid="before"]')!.focus()
    await userEvent.keyboard('{Tab}')
    expect(document.activeElement).toBe(segment('xlsx'))

    // Недоступный JSON пропускается: влево из Excel — сразу CSV.
    await userEvent.keyboard('{ArrowLeft}')
    await expect.poll(checked).toEqual(['csv'])
    expect(document.activeElement).toBe(segment('csv'))
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(checked).toEqual(['xlsx'])
  })

  test('SG2: дорожка и рамка под выбранным — фон и тень из токенов; ширины равные; длинная подпись обрезается с многоточием', async () => {
    await render(
      <Harness
        width={200}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'A very long segment label' },
        ]}
      />,
    )
    const track = document.querySelector<HTMLElement>(
      '[data-testid="segments"]',
    )!
    const [first, second] = segments()
    document.getAnimations().forEach(animation => animation.finish())
    expect(getComputedStyle(track).backgroundColor).toBe(
      resolve('--tsr-comp-segments-track-bg', 'background-color'),
    )
    const frame = indicator()
    expect(getComputedStyle(frame).backgroundColor).toBe(
      resolve('--tsr-comp-segments-selected-bg', 'background-color'),
    )
    expect(getComputedStyle(frame).boxShadow).toBe(
      resolve('--tsr-comp-segments-selected-shadow', 'box-shadow'),
    )
    // Рамка лежит под выбранным сегментом и совпадает с ним по ширине.
    const box = frame.getBoundingClientRect()
    const under = first!.getBoundingClientRect()
    expect(box.left).toBeCloseTo(under.left, 0)
    expect(box.width).toBeCloseTo(under.width, 0)
    expect(getComputedStyle(second!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(first!.getBoundingClientRect().width).toBeCloseTo(
      second!.getBoundingClientRect().width,
      0,
    )
    const label = second!.firstElementChild as HTMLElement
    expect(getComputedStyle(label).textOverflow).toBe('ellipsis')
    expect(label.scrollWidth).toBeGreaterThan(label.clientWidth)
  })

  test('SG3: axe с color-contrast в обеих темах; фокус — кольцо общего токена', async () => {
    await render(<Harness />)
    await inBothThemes(async () => {
      const result = await axe.run(
        document.querySelector<HTMLElement>('[data-testid="segments"]')!,
        {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        },
      )
      expect(result.violations).toEqual([])
    })
    document.querySelector<HTMLElement>('[data-testid="before"]')!.focus()
    await userEvent.keyboard('{Tab}')
    document.getAnimations().forEach(animation => animation.finish())
    const ring = resolve('--tsr-comp-focus-ring', 'color')
    expect(getComputedStyle(segment('csv')).boxShadow).toContain(ring)
  })

  test('SG4: рамка выбранного переезжает по горизонтали к новому сегменту переходом токена; при «меньше движения» — мгновенно', async () => {
    await render(<Harness />)
    const frame = indicator()
    const style = getComputedStyle(frame)
    expect(style.transitionProperty).toBe('transform')
    expect(style.transitionDuration).toBe(
      resolve('--tsr-comp-motion-duration', 'transition-duration'),
    )
    const startLeft = frame.getBoundingClientRect().left
    await userEvent.click(segment('xlsx'))
    // Переезд идёт анимацией: сразу после клика рамка ещё в пути, затем — под Excel.
    const moving = frame
      .getAnimations()
      .some(
        animation =>
          (animation as CSSTransition).transitionProperty === 'transform',
      )
    expect(moving).toBe(true)
    document.getAnimations().forEach(animation => animation.finish())
    // WebKit округляет сдвиг рамки до целого пикселя — допуск в пиксель.
    expect(
      Math.abs(
        frame.getBoundingClientRect().left -
          segment('xlsx').getBoundingClientRect().left,
      ),
    ).toBeLessThanOrEqual(1)
    expect(frame.getBoundingClientRect().left).toBeGreaterThan(startLeft)
    expect(frame.getBoundingClientRect().top).toBeCloseTo(
      segment('xlsx').getBoundingClientRect().top,
      0,
    )

    await reducedMotion(true)
    await expect
      .poll(() => getComputedStyle(indicator()).transitionDuration)
      .toBe('0s')
    await userEvent.click(segment('csv'))
    expect(indicator().getAnimations()).toHaveLength(0)
    expect(indicator().getBoundingClientRect().left).toBeCloseTo(
      segment('csv').getBoundingClientRect().left,
      0,
    )
  })
})

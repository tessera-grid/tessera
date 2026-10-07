import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { Bubble } from '@/lib/ui/Bubble'
import { IconButton } from '@/lib/ui/IconButton'
import { Tooltip } from '@/lib/ui/Tooltip'
import { Switch } from '@/lib/ui/Switch'
import { Skeleton } from '@/lib/ui/Skeleton'
import { LinearProgress } from '@/lib/ui/LinearProgress'
import {
  SvgIcon,
  CheckboxOutlineIcon,
  DEFAULT_ICONS,
  IconsProvider,
  useIcons,
  type TableIcons,
} from '@/lib/ui/icons'

// Every UI-component requirement is its own named test, prefixed with its spec ID
// (IB/TT/SW/SK/LP/IC/BU<n> from the requirements tables in
// docs/decisions/0017-ui-components.md). So `npm test` reports — and fails —
// each requirement individually, and the test name points straight at the
// requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
//
// Components are rendered directly (no DataGrid story) and read from the
// DOM/ARIA contract — role, aria-*, form, inline styles, style hooks — never
// from the hashed CSS-module class names, which are an implementation detail.

const computed = (el: Element) => getComputedStyle(el as HTMLElement)

// --- IconButton (IB1–IB4) -----------------------------------------------------

describe('IconButton', () => {
  const icon = <SvgIcon width={24} height={24} />

  test('IB1: renders a non-submit native button', async () => {
    const { container } = await render(<IconButton>{icon}</IconButton>)
    const btn = container.querySelector('button')!
    expect(btn).not.toBeNull()
    expect(btn.tagName).toBe('BUTTON')
    // type='button' so it never submits an enclosing form.
    expect(btn.getAttribute('type')).toBe('button')
  })

  test('IB2: is a round, centered icon button', async () => {
    const { container } = await render(<IconButton>{icon}</IconButton>)
    const btn = container.querySelector('button')!
    const style = computed(btn)
    // Square box + non-zero radius = round; content centered on both axes.
    expect(btn.offsetWidth).toBe(btn.offsetHeight)
    expect(style.borderRadius).not.toBe('0px')
    expect(style.display).toBe('inline-flex')
    expect(style.alignItems).toBe('center')
    expect(style.justifyContent).toBe('center')
  })

  test('IB3: disabled state', async () => {
    const { container } = await render(
      <IconButton disabled disabledClassName="is-off">
        {icon}
      </IconButton>,
    )
    const btn = container.querySelector('button')! as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.classList.contains('is-off')).toBe(true)
    expect(computed(btn).cursor).toBe('default')
  })

  test('IB4: forwards ref, className and props', async () => {
    const ref = { current: null as HTMLButtonElement | null }
    const onClick = vi.fn()
    const { container } = await render(
      <IconButton
        ref={ref}
        onClick={onClick}
        className="extra"
        aria-label="do it"
      >
        {icon}
      </IconButton>,
    )
    const btn = container.querySelector('button')!
    // ref points at the button, arbitrary props pass through.
    expect(ref.current).toBe(btn)
    expect(btn.classList.contains('extra')).toBe(true)
    expect(btn.getAttribute('aria-label')).toBe('do it')
    await userEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

// --- Tooltip (TT1–TT4) --------------------------------------------------------

describe('Tooltip', () => {
  /** The open tooltip's positioner carries `data-side`; absent while closed. */
  const openTooltip = () => document.querySelector('[data-side]')

  test('TT1: disabled/empty renders only the trigger', async () => {
    // Disabled → no wrapper, no tooltip in the DOM, just the bare trigger.
    const { container } = await render(
      <Tooltip title="Hint text" disabled>
        <button>trigger</button>
      </Tooltip>,
    )
    expect(container.querySelector('button')!.textContent).toBe('trigger')
    expect(openTooltip()).toBeNull()
    // Empty title behaves the same way.
    const empty = await render(
      <Tooltip title="">
        <button>t2</button>
      </Tooltip>,
    )
    expect(empty.container.querySelector('button')!.textContent).toBe('t2')
    expect(openTooltip()).toBeNull()
  })

  test('TT2: hovering shows the tooltip', async () => {
    const { container } = await render(
      <Tooltip title="Hint text" delayDuration={0}>
        <button>trigger</button>
      </Tooltip>,
    )
    await userEvent.hover(container.querySelector('button')!)
    // The popup appears in a portal and carries the title text.
    await expect
      .poll(() => openTooltip()?.textContent ?? '')
      .toContain('Hint text')
  })

  test('TT3: leaving hides the tooltip', async () => {
    const { container } = await render(
      <Tooltip title="Hint text" delayDuration={0}>
        <button>trigger</button>
      </Tooltip>,
    )
    const trigger = container.querySelector('button')!
    await userEvent.hover(trigger)
    await expect.poll(() => openTooltip()).not.toBeNull()
    // Self-heal: moving the pointer away closes the tooltip again.
    await userEvent.unhover(trigger)
    await expect.poll(() => openTooltip()).toBeNull()
  })

  test('TT4: honors the `side` prop', async () => {
    const { container } = await render(
      <Tooltip title="Hint text" side="bottom" delayDuration={0}>
        <button>trigger</button>
      </Tooltip>,
    )
    await userEvent.hover(container.querySelector('button')!)
    await expect.poll(() => openTooltip()).not.toBeNull()
    expect(openTooltip()!.getAttribute('data-side')).toBe('bottom')
  })
})

// --- Switch (SW1–SW4) ---------------------------------------------------------

describe('Switch', () => {
  const roleSwitch = (container: HTMLElement) =>
    container.querySelector('[role="switch"]')! as HTMLElement

  test('SW1: exposes the switch role and state', async () => {
    const on = await render(<Switch defaultChecked />)
    expect(roleSwitch(on.container).getAttribute('aria-checked')).toBe('true')
    const off = await render(<Switch />)
    expect(roleSwitch(off.container).getAttribute('aria-checked')).toBe('false')
  })

  test('SW2: clicking toggles the state', async () => {
    const { container } = await render(<Switch />)
    const sw = roleSwitch(container)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    await userEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')
    // Self-heal: toggle back to the starting state.
    await userEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })

  test('SW3: disabled state', async () => {
    const { container } = await render(<Switch disabled defaultChecked />)
    const sw = roleSwitch(container)
    // Base UI expresses disabled as a style hook / aria; the state stays put.
    expect(
      sw.hasAttribute('data-disabled') ||
        sw.getAttribute('aria-disabled') === 'true' ||
        (sw as HTMLButtonElement).disabled === true,
    ).toBe(true)
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })

  test('SW4: fixed-size track', async () => {
    const { container } = await render(<Switch />)
    const style = computed(roleSwitch(container))
    // Fixed 32×18 track that never grows/shrinks with its context.
    expect(style.width).toBe('32px')
    expect(style.height).toBe('18px')
    expect(style.flexGrow).toBe('0')
    expect(style.flexShrink).toBe('0')
  })
})

// --- Skeleton (SK1–SK3) -------------------------------------------------------

describe('Skeleton', () => {
  test('SK1: renders a sized span', async () => {
    const { container } = await render(<Skeleton width={120} height={16} />)
    const el = container.querySelector('span')! as HTMLElement
    expect(el.tagName).toBe('SPAN')
    expect(el.style.width).toBe('120px')
    expect(el.style.height).toBe('16px')
  })

  test('SK2: wave vs static animation', async () => {
    // Default 'wave' turns the element into a clipping context for the sheen.
    const wave = await render(<Skeleton width={80} height={12} />)
    const waveStyle = computed(wave.container.querySelector('span')!)
    expect(waveStyle.position).toBe('relative')
    expect(waveStyle.overflow).toBe('hidden')
    // animation={false} is a plain, static placeholder.
    const still = await render(
      <Skeleton width={80} height={12} animation={false} />,
    )
    expect(computed(still.container.querySelector('span')!).position).toBe(
      'static',
    )
  })

  test('SK3: forwards className and style', async () => {
    const { container } = await render(
      <Skeleton
        width={40}
        height={40}
        className="my-skel"
        style={{ opacity: '0.3' }}
      />,
    )
    const el = container.querySelector('span')! as HTMLElement
    expect(el.classList.contains('my-skel')).toBe(true)
    expect(el.style.opacity).toBe('0.3')
    expect(computed(el).borderRadius).toBe('4px')
  })
})

// --- LinearProgress (LP1–LP2) -------------------------------------------------

describe('LinearProgress', () => {
  test('PR1: exposes the progressbar role', async () => {
    const { container } = await render(<LinearProgress label="Loading" />)
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  test('PR2: is an absolutely-positioned overlay', async () => {
    const { container } = await render(<LinearProgress label="Loading" />)
    const root = container.querySelector('[role="progressbar"]')! as HTMLElement
    expect(computed(root).position).toBe('absolute')
    // Contains a single animated bar element.
    expect(root.querySelector('div')).not.toBeNull()
  })
})

// --- Bubble (BU1–BU4) ---------------------------------------------------------

describe('Bubble', () => {
  test('BU1: renders its content in a span', async () => {
    const { container } = await render(<Bubble>3</Bubble>)
    const el = container.querySelector('span')!
    expect(el.tagName).toBe('SPAN')
    expect(el.textContent).toBe('3')
  })

  test('BU2: is a non-interactive overlay (never steals clicks from its anchor)', async () => {
    // The whole point of the bubble is to sit ON TOP of an anchor (button, drag
    // overlay) without changing its geometry — so it must not intercept pointer
    // events. Positioning itself is the consumer's job, not the component's.
    const { container } = await render(<Bubble>1</Bubble>)
    expect(computed(container.querySelector('span')!).pointerEvents).toBe(
      'none',
    )
  })

  test('BU3: `sm` is more compact than the default `md`', async () => {
    const md = await render(<Bubble>1</Bubble>)
    const sm = await render(<Bubble size="sm">1</Bubble>)
    const mdSize = parseFloat(
      computed(md.container.querySelector('span')!).fontSize,
    )
    const smSize = parseFloat(
      computed(sm.container.querySelector('span')!).fontSize,
    )
    expect(smSize).toBeLessThan(mdSize)
  })

  test('BU4: forwards className and arbitrary props', async () => {
    const { container } = await render(
      <Bubble className="extra" data-sort-priority="2" aria-hidden>
        2
      </Bubble>,
    )
    const el = container.querySelector('span')!
    expect(el.classList.contains('extra')).toBe(true)
    expect(el.getAttribute('data-sort-priority')).toBe('2')
    expect(el.getAttribute('aria-hidden')).not.toBeNull()
  })
})

// --- Icons (IC1–IC3) ----------------------------------------------------------

describe('Icons', () => {
  test('IC1: SvgIcon draws a 24×24 currentColor svg', async () => {
    const { container } = await render(<CheckboxOutlineIcon />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('fill')).toBe('currentColor')
    // Decorative: hidden from the accessibility tree.
    expect(svg.getAttribute('aria-hidden')).not.toBeNull()
  })

  test('IC2: default icons cover the contract', async () => {
    const keys: (keyof TableIcons)[] = [
      'drag',
      'sort',
      'sortAsc',
      'sortDesc',
      'pin',
      'pinned',
      'group',
      'grouped',
      'expand',
      'expanded',
      'filter',
      'filterActive',
      'checkboxOutline',
      'checkboxChecked',
      'checkboxIndeterminate',
    ]
    for (const key of keys) {
      const Icon = DEFAULT_ICONS[key]
      expect(Icon, `DEFAULT_ICONS.${key} is defined`).toBeDefined()
      // Every default is a renderable component producing an svg.
      const { container } = await render(<Icon />)
      expect(
        container.querySelector('svg'),
        `${key} renders an svg`,
      ).not.toBeNull()
    }
  })

  test('IC3: IconsProvider overrides selectively', async () => {
    const CustomSort = () => <svg data-custom="sort" />
    const Probe = () => {
      const icons = useIcons()
      const Sort = icons.sort
      const Pin = icons.pin
      return (
        <div>
          <Sort />
          <Pin />
        </div>
      )
    }
    const { container } = await render(
      <IconsProvider icons={{ sort: CustomSort }}>
        <Probe />
      </IconsProvider>,
    )
    // The overridden icon is the custom one…
    expect(container.querySelector('[data-custom="sort"]')).not.toBeNull()
    // …while a non-overridden key stays the default (still renders an svg).
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2)
  })
})

import axe from 'axe-core'
import { commands, page, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, onTestFinished, test, vi } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../ui/theme/theme.css'
import { Button } from '@/lib/ui/Button'
import { IconButton } from '@/lib/ui/IconButton'
import { failureShownOn, pendingArcOf } from '../helpers'
import { SvgIcon } from '@/lib/ui/icons'
import { composed } from '../stories'
import { ColumnsPanel } from '../panelFixtures'
import {
  ExportPanel,
  FilterDatePanel,
  FilterOptionsPanel,
  FilterTextPanel,
} from '../panelFixtures'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

/** История или фикстура панели: компонент и `play`, который доводит его до состояния. */
type Fixture = ((props: Record<string, never>) => ReactNode) & {
  play?: (context: never) => unknown
}

// Кнопка с подписью `Button` (ADR 0097, BN1–BN6, BN9–BN11): размер и форма из токенов,
// варианты `outline` и `ghost`, контракт семейства F5, ожидание и вспышка, высокая
// контрастность, axe, встроенные кнопки грида и плагинов, подпись и отступ при иконке. BN7 — в модульном
// `uiStories`, BN8 — модульный `uiKitButtons`.

const fx = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

afterEach(async () => {
  if (server.browser !== 'webkit') await fx.forcedColors(false)
  document.documentElement.classList.remove('dark')
})

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

const buttons = () => [
  ...document.querySelectorAll<HTMLButtonElement>('button'),
]
const style = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo)

/** Значение токена в контексте элемента, разрешённое через свойство `prop`. */
const token = (host: Element, name: string, prop: string) => {
  const probe = document.createElement('span')
  probe.style.setProperty(prop, `var(${name})`)
  // Вне потока: раскладка хоста (flex, высота строки) не сжимает пробу.
  probe.style.position = 'absolute'
  host.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return value
}
const color = (host: Element, name: string) => token(host, name, 'color')

/** Кнопка — `Button` кита нужного варианта с высотой и скруглением токенов. */
const expectKit = (el: HTMLElement | null, variant: 'outline' | 'ghost') => {
  expect(el, 'кнопка на месте').not.toBeNull()
  const button = el!
  expect(button.classList).toContain('data-grid__button')
  expect(button.getAttribute('data-variant')).toBe(variant)
  const host = button.parentElement!
  expect(style(button).height).toBe(
    token(host, '--tsr-comp-button-size', 'height'),
  )
  expect(style(button).borderTopLeftRadius).toBe(
    token(host, '--tsr-comp-control-radius', 'border-top-left-radius'),
  )
  expect(style(button).borderTopColor).toBe(
    variant === 'outline'
      ? color(host, '--tsr-comp-button-border')
      : 'rgba(0, 0, 0, 0)',
  )
}

const frames = async (count = 3) => {
  for (let i = 0; i < count; i++)
    await new Promise(resolve => requestAnimationFrame(resolve))
}

describe('Button (ADR 0097)', () => {
  test('BN1: a native button with a label and an optional icon before it; height, padding, gap and radius come from the tokens', async () => {
    const screen = await render(
      <Theme>
        <Button icon={<SvgIcon width={14} height={14} />}>Retry</Button>
      </Theme>,
    )
    const [button] = buttons()
    expect(button!.tagName).toBe('BUTTON')
    expect(button!.type).toBe('button')
    expect(button!.firstElementChild!.tagName.toLowerCase()).toBe('svg')
    expect(button!.textContent).toBe('Retry')
    const icon = button!.querySelector('svg')!.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(button!.lastChild!)
    const label = range.getBoundingClientRect()
    expect(icon.right).toBeLessThanOrEqual(label.left)
    expect(Math.round(label.left - icon.right)).toBe(6)
    const host = button!.parentElement!
    expect(style(button!).height).toBe('32px')
    expect(style(button!).paddingRight).toBe(
      token(host, '--tsr-comp-button-padding-x', 'padding-right'),
    )
    expect(style(button!).borderTopLeftRadius).toBe(
      token(host, '--tsr-comp-control-radius', 'border-top-left-radius'),
    )

    // Токены управляют размером: приложение меняет их на обёртке.
    await screen.rerender(
      <Theme
        style={
          {
            '--tsr-comp-button-size': '40px',
            '--tsr-comp-button-padding-x': '20px',
            '--tsr-comp-button-gap': '10px',
            '--tsr-comp-button-radius-square': '3px',
          } as CSSProperties
        }
      >
        <Button icon={<SvgIcon width={14} height={14} />}>Retry</Button>
      </Theme>,
    )
    expect(style(button!).height).toBe('40px')
    expect(style(button!).paddingRight).toBe('20px')
    expect(style(button!).columnGap).toBe('10px')
    expect(style(button!).borderTopLeftRadius).toBe('3px')
    // Без иконки — только подпись.
    await screen.rerender(
      <Theme>
        <Button>Reset</Button>
      </Theme>,
    )
    expect(buttons()[0]!.querySelector('svg')).toBeNull()
  })

  test('BN2: outline has the button border, ghost has none; both are transparent and hover with control-hover-bg', async () => {
    await render(
      <Theme>
        <Button>Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </Theme>,
    )
    const [outline, ghost] = buttons()
    const host = outline!.parentElement!
    expect(outline!.getAttribute('data-variant')).toBe('outline')
    expect(style(outline!).borderTopWidth).toBe('1px')
    expect(style(outline!).borderTopColor).toBe(
      color(host, '--tsr-comp-button-border'),
    )
    // По умолчанию — цвет границ грида, а не тёмная граница контролов.
    expect(color(host, '--tsr-comp-button-border')).toBe(
      color(host, '--tsr-sys-border'),
    )
    expect(style(ghost!).borderTopColor).toBe('rgba(0, 0, 0, 0)')
    const hover = token(host, '--tsr-comp-control-hover-bg', 'background-color')
    for (const button of [outline!, ghost!]) {
      expect(style(button).backgroundColor).toBe('rgba(0, 0, 0, 0)')
      await userEvent.hover(button)
      await expect
        .poll(() => style(button).backgroundColor, { timeout: 5000 })
        .toBe(hover)
    }
  })

  test('BN3: family F5 — label color, disabled color with clicks blocked, outer focus ring, shared transition, no shadow', async () => {
    const onClick = vi.fn()
    await render(
      <Theme>
        <IconButton aria-label="probe">
          <SvgIcon width={14} height={14} />
        </IconButton>
        <Button onClick={onClick}>Enabled</Button>
        <Button variant="ghost" disabled onClick={onClick}>
          Disabled
        </Button>
      </Theme>,
    )
    const [iconButton, enabled, disabled] = buttons()
    const host = enabled!.parentElement!
    expect(style(enabled!).color).toBe(color(host, '--tsr-comp-button-color'))
    expect(style(enabled!).boxShadow).toBe('none')
    expect(style(enabled!).transition).toBe(style(iconButton!).transition)
    expect(style(disabled!).color).toBe(
      color(host, '--tsr-comp-control-disabled-color'),
    )
    await userEvent.click(disabled!, { force: true })
    expect(onClick).not.toHaveBeenCalled()

    // Фокус с клавиатуры — внешнее кольцо цвета и толщины токенов.
    iconButton!.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(enabled)
    await expect.poll(() => style(enabled!).boxShadow).not.toBe('none')
    const ring = style(enabled!).boxShadow
    expect(ring).toContain(color(host, '--tsr-comp-focus-ring'))
    expect(ring).toContain(
      `0px 0px 0px ${token(host, '--tsr-comp-focus-ring-width', 'width')}`,
    )
    expect(ring).not.toContain('inset')
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('BN4: pending shows the pending arc and aria-busy and ignores presses, the outline border fades out meanwhile; a failure stops the arc and shows the failure mark', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <Theme>
        <Button pending onClick={onClick}>
          Retry
        </Button>
        <Button pending>Save</Button>
      </Theme>,
    )
    const [pending, flashing] = buttons()
    expect(pending!.getAttribute('aria-busy')).toBe('true')
    expect(pending!.disabled).toBe(false)
    expect(pendingArcOf(pending!)?.dataset.phase).toBe('pending')
    // Рамка уходит переходом, а не пропадает: форму рисует дуга (ADR 0127).
    expect(style(pending!).transitionProperty).toContain('border-color')
    await expect
      .poll(() => style(pending!).borderTopColor, { timeout: 2000 })
      .toBe('rgba(0, 0, 0, 0)')
    await userEvent.click(pending!)
    pending!.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()

    expect(failureShownOn(flashing)).toBe(false)
    await screen.rerender(
      <Theme>
        <Button pending onClick={onClick}>
          Retry
        </Button>
        <Button failure="Failed: offline">Save</Button>
      </Theme>,
    )
    expect(pendingArcOf(flashing!)?.dataset.phase).toBe('stopping')
    expect(failureShownOn(flashing)).toBe(true)
    // Рамка возвращается, пока дуга гаснет.
    await expect
      .poll(() => style(flashing!).borderTopColor, { timeout: 2000 })
      .not.toBe('rgba(0, 0, 0, 0)')
  })

  test('BN5: forced colors — border and label are ButtonText, the focus ring is Highlight', async ({
    skip,
  }) => {
    skip(
      server.browser === 'webkit',
      'WebKit не подменяет цвета в forced-colors',
    )
    await fx.forcedColors(true)
    const sys = (name: string) => {
      const probe = document.createElement('span')
      probe.style.color = name
      document.body.append(probe)
      const value = getComputedStyle(probe).color
      probe.remove()
      return value
    }
    await render(
      <Theme>
        <IconButton aria-label="probe">
          <SvgIcon width={14} height={14} />
        </IconButton>
        <Button>Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </Theme>,
    )
    const [iconButton, outline, ghost] = buttons()
    expect(style(outline!).color).toBe(sys('ButtonText'))
    expect(style(outline!).borderTopColor).toBe(sys('ButtonText'))
    expect(style(ghost!).color).toBe(sys('ButtonText'))
    iconButton!.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(outline)
    expect(style(outline!).outlineStyle).toBe('solid')
    expect(style(outline!).outlineColor).toBe(sys('Highlight'))
  })

  test('BN6: both variants, enabled and disabled, pass axe with color-contrast in both themes', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    // Фон грида за кнопками: контраст считается к нему, а не к странице.
    await render(
      <Theme style={{ background: 'var(--tsr-comp-bg)' }}>
        <Button icon={<SvgIcon width={14} height={14} />}>Retry</Button>
        <Button variant="ghost">Reset</Button>
        <Button disabled>Off</Button>
        <Button variant="ghost" disabled>
          Off
        </Button>
      </Theme>,
    )
    const root = buttons()[0]!.parentElement!
    await inBothThemes(async () => {
      expect((await axe.run(root, options)).violations).toEqual([])
    })
  })

  test('BN9: built-in labelled buttons are kit Buttons — outline for load-error Retry, the infinite-scroll Retry and the filter stub reset; ghost in the filter, summary, columns and export panels', async () => {
    // Истории каталога открывают панель у колонки справа: в окне 414px с полосой
    // прокрутки WebKit её кнопка обрезана краем, и панель у кнопки выходит за кадр.
    const viewport = { width: innerWidth, height: innerHeight }
    await page.viewport(900, 720)
    onTestFinished(() => page.viewport(viewport.width, viewport.height))
    const q = (selector: string) =>
      document.querySelector<HTMLElement>(selector)
    const run = async (Story: Fixture, check: () => Promise<void> | void) => {
      const screen = await render(<Story />)
      await Story.play?.({ canvasElement: screen.container } as never)
      await check()
      await screen.unmount()
    }

    // Ошибка загрузки: сообщение при данных и заглушка без них (Playground).
    for (const firstLoad of [false, true]) {
      const screen = await render(
        <composed.LoadErrorPlayground firstLoad={firstLoad} />,
      )
      await expect
        .poll(() => q('[data-testid="load-error-retry"]'))
        .toBeTruthy()
      expectKit(q('[data-testid="load-error-retry"]'), 'outline')
      await screen.unmount()
    }

    // Панели фильтра: текст, дата, варианты.
    await run(FilterTextPanel, () =>
      expectKit(q('[data-testid="filter-reset"]'), 'ghost'),
    )
    await run(FilterDatePanel, () =>
      expectKit(q('[data-testid="filter-reset"]'), 'ghost'),
    )
    await run(FilterOptionsPanel, () => {
      expectKit(q('[data-testid="filter-reset"]'), 'ghost')
      expectKit(q('[data-testid="filter-select-all"]'), 'ghost')
      expectKit(q('[data-testid="filter-clear-selection"]'), 'ghost')
    })

    // Сводка фильтров и заглушка «нет строк»: фильтр из панели, сводка, затем пусто.
    await run(FilterTextPanel, async () => {
      const field = q('[data-testid="filter-value"]')!
      await userEvent.type(field, 'zzz')
      await userEvent.keyboard('{Escape}')
      // Фильтр применяется после дебаунса панели.
      await expect
        .poll(() => q('[data-testid="filter-stub-reset"]'), { timeout: 3000 })
        .not.toBeNull()
      expectKit(q('[data-testid="filter-stub-reset"]'), 'outline')
      await userEvent.click(q('[data-testid="filter-summary-button"]')!)
      await expect
        .poll(() => q('[data-testid="filter-summary-reset"]'))
        .not.toBeNull()
      expectKit(q('[data-testid="filter-summary-reset"]'), 'ghost')
    })

    // Меню «Колонки» и панель экспорта.
    await run(ColumnsPanel, () => {
      const footer = [
        ...document.querySelectorAll<HTMLElement>('button'),
      ].filter(button => /Reset/.test(button.textContent ?? ''))
      expect(footer).toHaveLength(1)
      for (const button of footer) expectKit(button, 'ghost')
    })
    await run(ExportPanel, () =>
      expectKit(q('[data-testid="export-run"]'), 'ghost'),
    )

    // Строка ошибки ленты: первая попытка блока падает.
    await run(composed.InfiniteScrollErrors, async () => {
      const scroller = () => q('.data-grid__container')!
      await expect
        .poll(() => document.querySelectorAll('.data-grid__body-row').length)
        .toBeGreaterThan(0)
      await expect
        .poll(
          async () => {
            scroller().scrollTop = scroller().scrollHeight
            await frames()
            return q('[data-testid="infinite-scroll-error"] button')
          },
          { timeout: 8000 },
        )
        .not.toBeNull()
      expectKit(q('[data-testid="infinite-scroll-error"] button'), 'outline')
    })
  })

  test('BN10: the label takes font size and weight from the tokens whatever the surrounding font; built-in buttons in a stub, the alert and a popover share one size', async () => {
    const screen = await render(
      <Theme style={{ fontSize: 20, fontWeight: 300 }}>
        <Button>Retry</Button>
      </Theme>,
    )
    const button = buttons()[0]!
    const host = button.parentElement!
    expect(style(button).fontSize).toBe(
      token(host, '--tsr-comp-button-font-size', 'font-size'),
    )
    expect(style(button).fontSize).toBe('13px')
    expect(style(button).fontWeight).toBe('500')
    await screen.rerender(
      <Theme
        style={
          {
            fontSize: 20,
            '--tsr-comp-button-font-size': '15px',
            '--tsr-comp-button-font-weight': '600',
          } as CSSProperties
        }
      >
        <Button>Retry</Button>
      </Theme>,
    )
    expect(style(button).fontSize).toBe('15px')
    expect(style(button).fontWeight).toBe('600')
    await screen.unmount()

    // Встроенные кнопки: заглушка (шрифт 14px), плашка и поповер (13px) — одна подпись.
    const sizes: string[] = []
    const run = async (Story: Fixture, selector: string) => {
      const story = await render(<Story />)
      await Story.play?.({ canvasElement: story.container } as never)
      const el = document.querySelector<HTMLElement>(selector)
      expect(el, selector).not.toBeNull()
      sizes.push(`${style(el!).fontSize} ${style(el!).fontWeight}`)
      await story.unmount()
    }
    // Ошибка загрузки — Playground: заглушка без данных и сообщение при данных.
    for (const firstLoad of [true, false]) {
      const story = await render(
        <composed.LoadErrorPlayground firstLoad={firstLoad} />,
      )
      await expect
        .poll(() => document.querySelector('[data-testid="load-error-retry"]'))
        .toBeTruthy()
      const el = document.querySelector<HTMLElement>(
        '[data-testid="load-error-retry"]',
      )!
      sizes.push(`${style(el).fontSize} ${style(el).fontWeight}`)
      await story.unmount()
    }
    await run(FilterTextPanel, '[data-testid="filter-reset"]')
    expect(sizes).toEqual(['13px 500', '13px 500', '13px 500'])
  })

  test('BN11: with an icon the left padding is the icon padding token and the right one the regular padding; without an icon both are the regular padding', async () => {
    const screen = await render(
      <Theme>
        <Button icon={<SvgIcon width={14} height={14} />}>Retry</Button>
        <Button>Reset</Button>
      </Theme>,
    )
    const [withIcon, plain] = buttons()
    const host = withIcon!.parentElement!
    const regular = token(host, '--tsr-comp-button-padding-x', 'padding-left')
    expect(style(withIcon!).paddingLeft).toBe(
      token(host, '--tsr-comp-button-padding-x-icon', 'padding-left'),
    )
    expect(style(withIcon!).paddingLeft).toBe('10px')
    expect(style(withIcon!).paddingRight).toBe(regular)
    expect(style(plain!).paddingLeft).toBe(regular)
    expect(style(plain!).paddingRight).toBe(regular)
    await screen.rerender(
      <Theme
        style={{ '--tsr-comp-button-padding-x-icon': '4px' } as CSSProperties}
      >
        <Button icon={<SvgIcon width={14} height={14} />}>Retry</Button>
        <Button>Reset</Button>
      </Theme>,
    )
    expect(style(withIcon!).paddingLeft).toBe('4px')
    expect(style(plain!).paddingLeft).toBe(regular)
  })
})

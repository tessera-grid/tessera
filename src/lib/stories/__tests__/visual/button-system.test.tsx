import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import { composeStories } from '@storybook/react-vite'
import type { CSSProperties, ReactNode } from 'react'

import '../../../core/themeVariables/theme.css'
import { Button } from '@/lib/ui/Button'
import { IconButton } from '@/lib/ui/IconButton'
import { pendingArcOf } from '../helpers'
import { SvgIcon } from '@/lib/ui/icons'
import * as cellStories from '../../UI.CellButton.stories'
import * as expandStories from '../../UI.ExpandButton.stories'
import * as groupStories from '../../UI.GroupButton.stories'
import * as pinStories from '../../UI.PinButton.stories'
import * as rowStories from '../../UI.RowButton.stories'
import * as sortStories from '../../UI.SortButton.stories'
import * as toolbarStories from '../../UI.ToolbarButton.stories'
import { revealCellButtons } from '../helpers'
import { composed } from '../stories'

// Единая система кнопок (ADR 0098, UB1–UB4, UB7, UB11): общие токены `Button` и
// `IconButton`, формы и состояния баз, тултип в базе, кнопки грида и плагинов в
// историях, кольцо фокуса у всех вариантов. UB5 — в модульном `uiStories`, UB6 — модульный `uiKitButtons`.

const Theme = ({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) => (
  <div
    className="data-grid-theme"
    style={{ display: 'flex', gap: 8, padding: 24, ...style }}
  >
    {children}
  </div>
)

const icon = <SvgIcon width={20} height={20} />
const style = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo)
const buttons = () => [
  ...document.querySelectorAll<HTMLButtonElement>('button'),
]

/** Значение токена в контексте элемента, разрешённое через свойство `prop`. */
const token = (host: Element, name: string, prop: string) => {
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.setProperty(prop, `var(${name})`)
  host.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return value
}

/** Токены базы в контексте элемента: размер, иконка, формы, цвет покоя, наведение. */
const kit = (host: Element) => ({
  size: token(host, '--tsr-comp-button-size', 'height'),
  icon: token(host, '--tsr-comp-button-icon-size', 'height'),
  square: token(
    host,
    '--tsr-comp-button-radius-square',
    'border-top-left-radius',
  ),
  circle: token(
    host,
    '--tsr-comp-button-radius-circle',
    'border-top-left-radius',
  ),
  color: token(host, '--tsr-comp-button-color', 'color'),
  hover: token(host, '--tsr-comp-control-hover-bg', 'background-color'),
})

const iconSize = (button: Element) => {
  const svg = button.querySelector('svg')
  return svg ? style(svg).height : null
}

describe('Button system (ADR 0098)', () => {
  test('UB1: Button and IconButton share size, icon size, the square radius, rest, active, hover and disabled colors from the kit tokens; a theme changes both at once', async () => {
    const screen = await render(
      <Theme>
        <Button icon={icon}>Retry</Button>
        <IconButton aria-label="Pin" shape="square">
          {icon}
        </IconButton>
        <Button disabled>Off</Button>
        <IconButton aria-label="Off" disabled>
          {icon}
        </IconButton>
        <IconButton aria-label="On" active>
          {icon}
        </IconButton>
      </Theme>,
    )
    const [text, iconOnly, textOff, iconOff, active] = buttons()
    const host = text!.parentElement!
    const t = kit(host)
    expect(t.size).toBe('32px')
    expect(t.icon).toBe('16px')
    for (const button of [text!, iconOnly!]) {
      expect(style(button).height).toBe(t.size)
      expect(style(button).borderTopLeftRadius).toBe(t.square)
      expect(style(button).color).toBe(t.color)
      expect(iconSize(button)).toBe(t.icon)
    }
    // Цвет покоя — цвет контролов грида, а не полный цвет текста.
    expect(t.color).toBe(token(host, '--tsr-comp-control-color', 'color'))
    const off = token(host, '--tsr-comp-control-disabled-color', 'color')
    expect(style(textOff!).color).toBe(off)
    expect(style(iconOff!).color).toBe(off)
    expect(style(active!).color).toBe(
      token(host, '--tsr-comp-control-active-color', 'color'),
    )
    for (const button of [text!, iconOnly!]) {
      await userEvent.hover(button)
      await expect
        .poll(() => style(button).backgroundColor, { timeout: 5000 })
        .toBe(t.hover)
    }

    // Общие токены: тема меняет обе базы разом.
    await screen.rerender(
      <Theme
        style={
          {
            '--tsr-comp-button-size': '40px',
            '--tsr-comp-button-icon-size': '20px',
            '--tsr-comp-button-radius-square': '2px',
          } as CSSProperties
        }
      >
        <Button icon={icon}>Retry</Button>
        <IconButton aria-label="Pin" shape="square">
          {icon}
        </IconButton>
      </Theme>,
    )
    for (const button of buttons()) {
      expect(style(button).height).toBe('40px')
      expect(iconSize(button)).toBe('20px')
      expect(style(button).borderTopLeftRadius).toBe('2px')
    }
  })

  test('UB2: IconButton is a box of the kit size, circle by default or square; the icon is the kit size whatever the props say; ghost, overlay, active and an open popup', async () => {
    await render(
      <Theme>
        <IconButton aria-label="Ghost">
          <SvgIcon width={24} height={24} />
        </IconButton>
        <IconButton aria-label="Square" shape="square" data-popup-open="">
          {icon}
        </IconButton>
        <IconButton aria-label="Overlay" variant="overlay">
          {icon}
        </IconButton>
        <IconButton aria-label="Active" active>
          {icon}
        </IconButton>
      </Theme>,
    )
    const [ghost, square, overlay, active] = buttons()
    const t = kit(ghost!.parentElement!)
    const box = ghost!.getBoundingClientRect()
    expect(`${box.width}px`).toBe(t.size)
    expect(`${box.height}px`).toBe(t.size)
    expect(style(ghost!).borderTopLeftRadius).toBe(t.circle)
    expect(t.circle).toBe('50%')
    expect(style(square!).borderTopLeftRadius).toBe(t.square)
    // Открытый поповер — кнопка «нажата»: цвет и фон активного.
    expect(style(square!).backgroundColor).toBe(
      token(
        square!.parentElement!,
        '--tsr-comp-control-active-hover-bg',
        'background-color',
      ),
    )
    expect(iconSize(ghost!)).toBe(t.icon)
    expect(style(ghost!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(style(ghost!).boxShadow).toBe('none')

    // overlay — непрозрачный чип с тенью; наведение — светлый слой под иконкой.
    const host = overlay!.parentElement!
    expect(style(overlay!).backgroundColor).toBe(
      token(host, '--tsr-comp-action-button-bg', 'background-color'),
    )
    expect(style(overlay!).boxShadow).not.toBe('none')
    await userEvent.hover(overlay!)
    const layer = () => getComputedStyle(overlay!, '::before')
    await expect.poll(() => layer().opacity, { timeout: 5000 }).toBe('1')
    expect(layer().backgroundColor).toBe(
      token(host, '--tsr-comp-action-button-hover-bg', 'background-color'),
    )

    // Активная — цвет активного; фон — при наведении.
    expect(active!.hasAttribute('data-active')).toBe(true)
    expect(style(active!).color).toBe(
      token(host, '--tsr-comp-control-active-color', 'color'),
    )
    expect(style(active!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    await userEvent.hover(active!)
    await expect
      .poll(() => style(active!).backgroundColor, { timeout: 5000 })
      .toBe(
        token(host, '--tsr-comp-control-active-hover-bg', 'background-color'),
      )
  })

  test('UB3: Button is square and has the same states as IconButton — rest, hover, focus, pending, error and disabled', async () => {
    const long = { '--tsr-comp-error-flash-duration': '10s' } as CSSProperties
    const screen = await render(
      <Theme style={long}>
        <IconButton aria-label="Probe">{icon}</IconButton>
        <Button>Rest</Button>
        <Button pending>Pending</Button>
        <Button errorFlash={0}>Error</Button>
        <Button disabled>Off</Button>
      </Theme>,
    )
    const [probe, rest, pending, error, off] = buttons()
    const host = rest!.parentElement!
    const t = kit(host)
    for (const button of [rest!, pending!, error!, off!]) {
      expect(style(button).borderTopLeftRadius).toBe(t.square)
      expect(style(button).height).toBe(t.size)
    }
    expect(style(rest!).color).toBe(t.color)
    await userEvent.hover(rest!)
    await expect
      .poll(() => style(rest!).backgroundColor, { timeout: 5000 })
      .toBe(t.hover)
    probe!.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(rest)
    expect(style(rest!).boxShadow).toContain(
      token(host, '--tsr-comp-focus-ring', 'color'),
    )
    expect(pending!.getAttribute('aria-busy')).toBe('true')
    expect(pendingArcOf(pending!)?.dataset.phase).toBe('pending')
    await screen.rerender(
      <Theme style={long}>
        <IconButton aria-label="Probe">{icon}</IconButton>
        <Button>Rest</Button>
        <Button pending>Pending</Button>
        <Button errorFlash={1}>Error</Button>
        <Button disabled>Off</Button>
      </Theme>,
    )
    expect(error!.getAttribute('data-error-flash')).toBe('on')
    expect(pendingArcOf(error!)?.dataset.phase).toBe('error')
    expect(style(off!).color).toBe(
      token(host, '--tsr-comp-control-disabled-color', 'color'),
    )
  })

  test('UB4: the tooltip lives in the base — label and tooltip show on hover and keyboard focus; a disabled button shows it only with tooltipWhenDisabled and then stays focusable and unpressable', async () => {
    const pressed: string[] = []
    await render(
      <Theme>
        <IconButton label="Pin column" onClick={() => pressed.push('pin')}>
          {icon}
        </IconButton>
        <Button tooltip="Load the rows again">Retry</Button>
        <IconButton label="Locked" disabled>
          {icon}
        </IconButton>
        <IconButton
          label="Explained"
          disabled
          tooltipWhenDisabled
          onClick={() => pressed.push('explained')}
        >
          {icon}
        </IconButton>
      </Theme>,
    )
    const [pin, retry, locked, explained] = buttons()
    // Открытый тултип — попап Base UI с `data-side`.
    const tip = () =>
      document.querySelector<HTMLElement>('[data-side]')?.textContent ?? null
    // label — доступное имя кнопки-иконки.
    expect(pin!.getAttribute('aria-label')).toBe('Pin column')

    await userEvent.hover(pin!)
    await expect.poll(tip).toBe('Pin column')
    await userEvent.unhover(pin!)
    await expect.poll(tip).toBeNull()

    // Фокус с клавиатуры.
    pin!.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(retry)
    await expect.poll(tip).toBe('Load the rows again')
    retry!.blur()
    await expect.poll(tip).toBeNull()

    // Выключенная без признака — подсказки нет, кнопка выключена натурально.
    expect(locked!.disabled).toBe(true)
    await userEvent.hover(locked!, { force: true })
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(tip()).toBeNull()

    // С признаком — подсказка есть, кнопка в порядке фокуса и не нажимается.
    expect(explained!.disabled).toBe(false)
    expect(explained!.getAttribute('aria-disabled')).toBe('true')
    await userEvent.hover(explained!)
    await expect.poll(tip).toBe('Explained')
    await userEvent.click(explained!, { force: true })
    expect(pressed).toEqual([])
    retry!.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(explained)
  })

  test('UB7: buttons of the grid and plugins in the stories match the kit — size, icon, the radius of their shape, rest color and hover; panel and alert buttons are square, the rest are circles', async () => {
    /** Кнопка не из кита, которой можно быть: роль контрола или часть поля. */
    const allowed = (button: HTMLElement) =>
      [
        'checkbox',
        'radio',
        'switch',
        'combobox',
        'menuitem',
        'option',
      ].includes(button.getAttribute('role') ?? '') ||
      button.matches(
        [
          // «i» и крестик внутри поля поиска (ADR 0053).
          '[data-testid="quick-search-hint"]',
          '[data-testid="quick-search-clear"]',
          // Список размера страницы — триггер Select (ADR 0038).
          '[aria-haspopup="listbox"]',
        ].join(','),
      )
    const checked: string[] = []
    const check = async (label: string, hover: boolean) => {
      for (const button of buttons()) {
        const box = button.getBoundingClientRect()
        if (!box.width || allowed(button)) continue
        const name = `${label}: ${button.getAttribute('aria-label') ?? button.textContent}`
        const isIcon = button.classList.contains('data-grid__icon-button')
        const isText = button.classList.contains('data-grid__button')
        expect(isIcon || isText, `${name} — кнопка кита`).toBe(true)
        const t = kit(button.parentElement!)
        expect(style(button).height, `${name} высота`).toBe(t.size)
        if (isIcon) expect(`${box.width}px`, `${name} ширина`).toBe(t.size)
        const shape = isText ? 'square' : button.getAttribute('data-shape')
        // Кнопки панелей (тулбар, нижняя панель) и плашки — квадратные, остальные — круглые.
        if (isIcon) {
          const panel =
            !!button.closest(
              '[role="toolbar"], [data-testid="data-grid-status-bar"]',
            ) || button.matches('[data-alert-dismiss]')
          expect(shape, `${name} форма`).toBe(panel ? 'square' : 'circle')
        }
        expect(style(button).borderTopLeftRadius, `${name} скругление`).toBe(
          shape === 'square' ? t.square : t.circle,
        )
        if (iconSize(button) !== null) {
          expect(iconSize(button), `${name} иконка`).toBe(t.icon)
        }
        const resting =
          !button.matches(
            '[data-active], [data-popup-open], [data-disabled]',
          ) &&
          !button.disabled &&
          button.getAttribute('aria-disabled') !== 'true'
        if (resting) {
          expect(style(button).color, `${name} цвет покоя`).toBe(t.color)
          if (hover && button.getAttribute('data-variant') !== 'overlay') {
            // Скрытая до наведения кнопка ячейки проявляется наведением на рамку.
            const host = button.closest<HTMLElement>(
              '.data-grid__head-cell, .data-grid__body-cell',
            )
            if (host) await revealCellButtons(host)
            await userEvent.hover(button)
            await expect
              .poll(() => style(button).backgroundColor, { timeout: 5000 })
              .toBe(t.hover)
          }
        }
        checked.push(name)
      }
    }

    // Производные из историй UI — с наведением.
    const ui = {
      SortButton: composeStories(sortStories).SortButtonBasic,
      PinButton: composeStories(pinStories).PinButtonBasic,
      GroupButton: composeStories(groupStories).GroupButtonBasic,
      ExpandButton: composeStories(expandStories).ExpandButtonBasic,
      CellButton: composeStories(cellStories).CellButtonAlwaysVisible,
      RowButton: composeStories(rowStories).RowButtonVisible,
      ToolbarButton: composeStories(toolbarStories).ToolbarButtonBasic,
    }
    for (const [label, Story] of Object.entries(ui)) {
      const screen = await render(<Story />)
      await check(label, true)
      await screen.unmount()
    }

    // Кнопки грида и плагинов в историях каталога.
    const grids = [
      'ToolbarAllButtons',
      'Pagination',
      'HeaderMenuStateKebab',
      'LoadErrorRefresh',
      'LoadErrorFirstLoad',
      'FilteringStateOptions',
      'VisibilityStatePanel',
      'ExportStatePanel',
    ] as const
    for (const key of grids) {
      const Story = composed[key]
      const screen = await render(<Story />)
      await Story.play?.({ canvasElement: screen.container } as never)
      // В покое: кнопка, включившаяся с приходом данных, доигрывает переход цвета.
      await Promise.all(
        document
          .getAnimations()
          .filter(
            animation => animation.effect?.getTiming().iterations !== Infinity,
          )
          .map(animation => animation.finished.catch(() => undefined)),
      )
      await check(key, false)
      await screen.unmount()
    }
    expect(checked.length).toBeGreaterThan(20)
  })

  test('UB11: keyboard focus on IconButton of ghost and overlay variants, circle and square shapes, default and compact sizes is the outer focus ring; overlay keeps its own shadow under the ring', async () => {
    await render(
      <Theme>
        <IconButton aria-label="Ghost circle">{icon}</IconButton>
        <IconButton aria-label="Ghost square" shape="square">
          {icon}
        </IconButton>
        <IconButton aria-label="Overlay" variant="overlay">
          {icon}
        </IconButton>
        <IconButton aria-label="Overlay active" variant="overlay" active>
          {icon}
        </IconButton>
        <IconButton aria-label="Compact" shape="square" size="compact">
          {icon}
        </IconButton>
      </Theme>,
    )
    const host = buttons()[0]!.parentElement!
    const ring = `${token(host, '--tsr-comp-focus-ring', 'color')} 0px 0px 0px ${token(host, '--tsr-comp-focus-ring-width', 'width')}`
    const shadow = token(host, '--tsr-comp-shadow-action', 'box-shadow')
    for (const button of buttons()) {
      const name = button.getAttribute('aria-label')
      await userEvent.tab()
      expect(document.activeElement, name!).toBe(button)
      expect(button.matches(':focus-visible'), name!).toBe(true)
      const boxShadow = style(button).boxShadow
      // Кольцо — первым слоем, поверх остальных.
      expect(boxShadow.startsWith(ring), `${name}: ${boxShadow}`).toBe(true)
      if (button.getAttribute('data-variant') === 'overlay') {
        expect(boxShadow, name!).toContain(shadow)
      }
    }
  })
})

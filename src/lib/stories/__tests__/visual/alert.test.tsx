import type { CSSProperties } from 'react'

import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { Alert } from '../../../ui/Alert'
import { Button } from '../../../ui/Button'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Примитив кита `ui/Alert` (ADR 0096, §9, LE18): плашка вне грида. LE19 — история
// `UI/Alert`; плашка под шапкой грида — `load-error.test.tsx`.

const LONG = `Gateway timeout ${'while aggregating orders '.repeat(8)}`.trim()

const Harness = ({
  shown = true,
  title = "Couldn't refresh the data",
  description = 'Server responded 503',
  action = true,
  onAction,
  onDismiss = () => {},
  bare = false,
  style,
}: {
  shown?: boolean
  title?: string
  description?: string
  action?: boolean
  onAction?: () => void
  onDismiss?: () => void
  /** Без действия и закрытия: последним стоит текст. */
  bare?: boolean
  style?: CSSProperties
}) => (
  <div
    className={DATA_GRID_THEME_CLASS}
    style={{
      width: 420,
      padding: 16,
      background: 'var(--tsr-sys-surface)',
      ...style,
    }}
  >
    <Alert
      shown={shown}
      icon={<svg data-testid="alert-icon" width={16} height={16} />}
      title={title}
      description={description}
      action={
        bare || !action ? undefined : (
          <Button data-testid="alert-action" onClick={onAction}>
            Retry
          </Button>
        )
      }
      dismiss={bare ? undefined : { label: 'Dismiss', onClick: onDismiss }}
      data-testid="alert"
    />
  </div>
)

const alert = () => document.querySelector<HTMLElement>('[data-testid="alert"]')
const description = () =>
  alert()!.querySelector<HTMLElement>('[data-alert-description]')!
const dismiss = () =>
  alert()!.querySelector<HTMLButtonElement>('[data-alert-dismiss]')!
const tooltipShows = (text: string) =>
  [...document.querySelectorAll('[data-side]')].some(
    element => element.textContent?.trim() === text,
  )

describe('Плашка кита Alert (ADR 0096)', () => {
  test('LE24: уходя, плашка держит последний вид — заголовок, описание, действие и ширину, хотя потребитель уже снял их; действие и закрытие больше не срабатывают', async () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    const slow = {
      width: 'max-content',
      '--tsr-comp-motion-duration': '2000ms',
    } as CSSProperties
    const screen = await render(
      <Harness style={slow} onAction={onAction} onDismiss={onDismiss} />,
    )
    const box = () => alert()!.getBoundingClientRect()
    const shape = { width: box().width, left: box().left }
    const text = alert()!.textContent

    await screen.rerender(
      <Harness
        style={slow}
        shown={false}
        title="Refresh failed"
        description=""
        action={false}
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )
    expect(alert()!.hasAttribute('data-leaving')).toBe(true)
    expect(alert()!.textContent).toBe(text)
    expect(
      alert()!.querySelector('[data-testid="alert-action"]'),
    ).not.toBeNull()
    expect({ width: box().width, left: box().left }).toEqual(shape)
    alert()!.querySelector<HTMLElement>('[data-testid="alert-action"]')!.click()
    dismiss().click()
    expect(onAction).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
    await screen.unmount()
  })

  test('LE18: иконка, заголовок, описание одной строкой с … и тултипом, действие и квадратная кнопка закрытия с подписью; текст без кнопок отстоит от правого края, как иконка от левого; кнопки со скруглением кита, угол плашки больше на её отступ; вид — токены --tsr-comp-alert-*; появление и уход токенами движения, уходя держит описание и не откликается на указатель; axe в обеих темах', async () => {
    const onDismiss = vi.fn()
    const view = await render(
      <Harness
        description={LONG}
        onDismiss={onDismiss}
        style={
          {
            '--tsr-comp-alert-bg': 'rgb(1, 2, 3)',
            '--tsr-comp-alert-icon-color': 'rgb(200, 0, 0)',
            '--tsr-comp-alert-max-width': '300px',
          } as CSSProperties
        }
      />,
    )
    await expect.poll(alert).not.toBeNull()
    expect(alert()!.getAttribute('role')).toBe('group')
    const titleId = alert()!.getAttribute('aria-labelledby')!
    expect(document.getElementById(titleId)!.textContent).toBe(
      "Couldn't refresh the data",
    )
    const icon = alert()!.querySelector('[data-testid="alert-icon"]')!
    expect(getComputedStyle(icon).color).toBe('rgb(200, 0, 0)')
    expect(getComputedStyle(alert()!).backgroundColor).toBe('rgb(1, 2, 3)')
    expect(alert()!.getBoundingClientRect().width).toBeLessThanOrEqual(300)
    expect(getComputedStyle(alert()!).animationName).toContain('alert-in')

    // Длинное описание — одной строкой с многоточием, полный текст в тултипе.
    expect(description().textContent).toBe(LONG)
    expect(description().scrollWidth).toBeGreaterThan(description().clientWidth)
    expect(getComputedStyle(description()).textOverflow).toBe('ellipsis')
    await userEvent.hover(description())
    await expect.poll(() => tooltipShows(LONG), { timeout: 2000 }).toBe(true)

    expect(
      alert()!.querySelector('[data-testid="alert-action"]'),
    ).not.toBeNull()
    expect(dismiss().getAttribute('aria-label')).toBe('Dismiss')
    // Кнопки — со скруглением кита, угол плашки больше на её отступ: углы параллельны.
    expect(dismiss().getAttribute('data-shape')).toBe('square')
    const px = (value: string) => parseFloat(value)
    const probe = document.createElement('div')
    probe.style.borderRadius = 'var(--tsr-comp-button-radius-square)'
    alert()!.parentElement!.append(probe)
    const kitRadius = px(getComputedStyle(probe).borderTopLeftRadius)
    probe.remove()
    const action = alert()!.querySelector<HTMLElement>(
      '[data-testid="alert-action"]',
    )!
    for (const button of [dismiss(), action]) {
      expect(px(getComputedStyle(button).borderTopLeftRadius)).toBe(kitRadius)
    }
    expect(px(getComputedStyle(alert()!).borderTopLeftRadius)).toBe(
      kitRadius + px(getComputedStyle(alert()!).paddingTop),
    )
    await userEvent.click(dismiss())
    expect(onDismiss).toHaveBeenCalledTimes(1)

    // Без кнопок длинный текст обрезается на том же расстоянии от правого края, что иконка
    // от левого.
    await view.rerender(
      <Harness description={LONG} bare style={{ display: 'flex' }} />,
    )
    const box = alert()!.getBoundingClientRect()
    const iconInset =
      alert()!
        .querySelector('[data-testid="alert-icon"]')!
        .getBoundingClientRect().left - box.left
    expect(box.right - description().getBoundingClientRect().right).toBe(
      iconInset,
    )

    // axe — на токенах темы, без подменённых цветов.
    await view.rerender(<Harness description={LONG} />)
    await inBothThemes(async () => {
      const result = await axe.run(alert()!, {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })
      expect(result.violations).toEqual([])
    })

    // Уходя, держит последнее описание и не откликается на указатель. Уход длиннее
    // перерисовки: в WebKit она дольше 150 мс токена, и плашка ушла бы до проверки.
    const slow = { '--tsr-comp-motion-duration': '1000ms' } as CSSProperties
    await view.rerender(<Harness description={LONG} style={slow} />)
    await view.rerender(<Harness shown={false} description="" style={slow} />)
    expect(alert()!.getAttribute('data-leaving')).toBe('true')
    expect(description().textContent).toBe(LONG)
    expect(getComputedStyle(alert()!).pointerEvents).toBe('none')
    await expect.poll(alert, { timeout: 2000 }).toBeNull()
  })
  test('LE22: плашка шире своего содержимого — действие и закрытие у правого края, свободное место за текстом', async () => {
    // Плашку растягивает раскладка потребителя: сетка тянет её на всю ширину.
    await render(
      <Harness description="503" style={{ display: 'grid', width: 640 }} />,
    )
    const box = alert()!.getBoundingClientRect()
    const padding = parseFloat(getComputedStyle(alert()!).paddingRight)
    expect(box.width).toBeGreaterThan(560)
    expect(
      Math.abs(dismiss().getBoundingClientRect().right - (box.right - padding)),
    ).toBeLessThan(1)
    const action = alert()!.querySelector('[data-testid="alert-action"]')!
    const gap = parseFloat(getComputedStyle(alert()!).columnGap)
    expect(
      Math.abs(
        action.getBoundingClientRect().right +
          gap -
          dismiss().getBoundingClientRect().left,
      ),
    ).toBeLessThan(1)
  })
  test('LE23: у квадратных кнопок (скругление 0) угол плашки тоже квадратный, у скруглённых — их скругление плюс отступ', async () => {
    const square = await render(
      <Harness
        style={{ ['--tsr-comp-button-radius-square' as string]: '0px' }}
      />,
    )
    await expect.poll(() => alert()).not.toBeNull()
    expect(getComputedStyle(dismiss()).borderTopLeftRadius).toBe('0px')
    expect(getComputedStyle(alert()!).borderTopLeftRadius).toBe('0px')
    await square.unmount()

    const rounded = await render(
      <Harness
        style={{ ['--tsr-comp-button-radius-square' as string]: '10px' }}
      />,
    )
    await expect.poll(() => alert()).not.toBeNull()
    expect(getComputedStyle(alert()!).borderTopLeftRadius).toBe(
      `${10 + parseFloat(getComputedStyle(alert()!).paddingTop)}px`,
    )
    await rounded.unmount()
  })
})

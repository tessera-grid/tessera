import type { CSSProperties } from 'react'

import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../core/themeVariables'
import { Alert } from '../../../ui/Alert'
import { Button } from '../../../ui/Button'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Примитив кита `ui/Alert` (ADR 0096, §9, LE18): плашка вне грида. LE19 — история
// `UI/Alert`; плашка под шапкой грида — `load-error.test.tsx`.

const LONG = `Gateway timeout ${'while aggregating orders '.repeat(8)}`.trim()

const Harness = ({
  shown = true,
  description = 'Server responded 503',
  onDismiss = () => {},
  bare = false,
  style,
}: {
  shown?: boolean
  description?: string
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
      title="Couldn't refresh the data"
      description={description}
      action={
        bare ? undefined : <Button data-testid="alert-action">Retry</Button>
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

    // Уходя, держит последнее описание и не откликается на указатель.
    await view.rerender(<Harness shown={false} description="" />)
    expect(alert()!.getAttribute('data-leaving')).toBe('true')
    expect(description().textContent).toBe(LONG)
    expect(getComputedStyle(alert()!).pointerEvents).toBe('none')
    await expect.poll(alert, { timeout: 2000 }).toBeNull()
  })
})

import type { CSSProperties, ReactNode } from 'react'

import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { Alert, type AlertProps } from '../../../ui/Alert'
import { Button } from '../../../ui/Button'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'

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
  tone,
  icon = <svg data-testid="alert-icon" width={16} height={16} />,
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
  tone?: 'success' | 'neutral'
  icon?: ReactNode
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
      tone={tone}
      icon={icon}
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
  test('LE24: уходя, плашка держит последний вид — заголовок, описание, действие, тон с иконкой и ширину, хотя потребитель уже снял их; действие и закрытие больше не срабатывают', async () => {
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

    // Тон и иконка: потребитель снял тон и подставил иконку отказа — плашка уходит с прежними.
    const toned = await render(
      <Harness style={slow} tone="success" icon={null} />,
    )
    await toned.rerender(
      <Harness
        style={slow}
        shown={false}
        icon={<svg data-testid="other-icon" width={16} height={16} />}
      />,
    )
    expect(alert()!.hasAttribute('data-leaving')).toBe(true)
    expect(alert()!.getAttribute('data-tone')).toBe('success')
    expect(alert()!.querySelector('[data-icon="alertSuccess"]')).not.toBeNull()
    expect(alert()!.querySelector('[data-testid="other-icon"]')).toBeNull()
    await toned.unmount()
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
  test('AO19: tone="success" красит только иконку токеном успеха — зелёным, tone="neutral" — только иконку «информация» токеном нейтрального цвета не ниже 3:1 к фону; рамки нет, как у обычной плашки; hideAfter зовёт onHide через заданное время, отсчёт стоит под указателем и при фокусе внутри и после их ухода идёт заново; без пропов вид прежний', async () => {
    const Toned = (props: Partial<AlertProps>) => (
      <div
        className={DATA_GRID_THEME_CLASS}
        style={{ width: 420, padding: 16 }}
      >
        <button data-testid="outside">Outside</button>
        <Alert
          shown
          title="Saved 3 changes"
          action={<Button data-testid="alert-action">Undo</Button>}
          dismiss={{ label: 'Dismiss', onClick: () => {} }}
          data-testid="alert"
          {...props}
        />
      </div>
    )
    const token = (name: string) => {
      const probe = document.createElement('span')
      probe.style.color = `var(${name})`
      alert()!.parentElement!.append(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    }
    const iconColor = () =>
      getComputedStyle(alert()!.firstElementChild!.firstElementChild!).color

    // Без пропов — прежний вид: иконка потребителя цветом ошибки, рамки нет, сама не уходит.
    const onHideIdle = vi.fn()
    const view = await render(
      <Toned
        icon={<svg data-testid="alert-icon" width={16} height={16} />}
        onHide={onHideIdle}
      />,
    )
    await expect.poll(alert).not.toBeNull()
    expect(alert()!.hasAttribute('data-tone')).toBe(false)
    expect(iconColor()).toBe(token('--tsr-comp-alert-icon-color'))
    expect(getComputedStyle(alert()!).outlineStyle).toBe('none')

    // Тон успеха без своей иконки — иконка `alertSuccess` цветом успеха; рамки нет.
    await view.rerender(<Toned tone="success" />)
    const success = token('--tsr-comp-alert-success-color')
    expect(success).not.toBe(token('--tsr-comp-alert-icon-color'))
    expect(alert()!.firstElementChild!.querySelector('svg')).not.toBeNull()
    expect(iconColor()).toBe(success)
    expect(getComputedStyle(alert()!).outlineStyle).toBe('none')
    // Зелёный в обеих темах: оттенок HSL иконки — между жёлтым (60°) и бирюзовым (180°).
    await inBothThemes(async () => {
      const [r, g, b] = toRgba(iconColor()).map(c => c / 255)
      const max = Math.max(r!, g!, b!)
      const min = Math.min(r!, g!, b!)
      expect(max).toBe(g)
      const hue = 60 * (2 + (b! - r!) / (max - min))
      expect(hue).toBeGreaterThan(90)
      expect(hue).toBeLessThan(170)
    })

    // Нейтральный тон без своей иконки — иконка `alertNeutral` нейтральным цветом; рамки нет.
    await view.rerender(<Toned tone="neutral" />)
    expect(alert()!.getAttribute('data-tone')).toBe('neutral')
    const neutral = token('--tsr-comp-alert-neutral-color')
    expect(neutral).not.toBe(token('--tsr-comp-alert-icon-color'))
    expect(neutral).not.toBe(success)
    expect(
      alert()!.firstElementChild!.querySelector(
        'svg[data-icon="alertNeutral"]',
      ),
    ).not.toBeNull()
    expect(iconColor()).toBe(neutral)
    expect(getComputedStyle(alert()!).outlineStyle).toBe('none')
    // Значок — не ниже 3:1 к фону плашки в обеих темах.
    await inBothThemes(async () => {
      const ratio = contrast(toRgba(iconColor()), backgroundOf(alert()))
      expect(ratio).toBeGreaterThanOrEqual(3)
    })
    expect(onHideIdle).not.toHaveBeenCalled()
    await view.unmount()

    const advance = async (ms: number) => {
      await new Promise(resolve => requestAnimationFrame(resolve))
      await vi.advanceTimersByTimeAsync(ms)
    }
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const hideAfter = 300
      const onHide = vi.fn()
      const timed = await render(
        <Toned hideAfter={hideAfter} onHide={onHide} />,
      )
      const outside = () =>
        document.querySelector<HTMLElement>('[data-testid="outside"]')!
      const expectFullDelay = async () => {
        await advance(hideAfter - 1)
        expect(onHide).not.toHaveBeenCalled()
        await advance(1)
        expect(onHide).toHaveBeenCalledTimes(1)
      }
      await userEvent.hover(outside())
      await expectFullDelay()

      onHide.mockClear()
      await timed.rerender(
        <Toned key="hover" hideAfter={hideAfter} onHide={onHide} />,
      )
      await advance(100)
      await userEvent.hover(alert()!)
      await advance(700)
      expect(onHide).not.toHaveBeenCalled()
      await userEvent.hover(outside())
      await expectFullDelay()

      onHide.mockClear()
      await timed.rerender(
        <Toned key="focus" hideAfter={hideAfter} onHide={onHide} />,
      )
      outside().focus()
      await advance(100)
      await userEvent.tab()
      expect(alert()!.contains(document.activeElement)).toBe(true)
      await advance(400)
      // Фокус переходит между кнопками плашки — отсчёт так и стоит.
      await userEvent.tab()
      expect(alert()!.contains(document.activeElement)).toBe(true)
      await advance(400)
      expect(onHide).not.toHaveBeenCalled()
      await userEvent.tab({ shift: true })
      await userEvent.tab({ shift: true })
      expect(document.activeElement).toBe(outside())
      await expectFullDelay()
      await timed.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../Theming.stories'

// Каждое требование внешней темизации (TH1–TH4 из ADR 0018) — отдельный
// именованный тест (ADR 0001/0009). Витрина Theming рендерит грид с включённым
// лоадером; его полоса читает `--data-grid-loader-bar`, а это ПЛОСКИЙ токен
// (`var(--info, …)`, без color-mix), поэтому вычисленный `background-color`
// сравнивается с задаваемым rgb без хрупкой математики oklch.

const composed = composeStories(stories)

/** Полоса линейного прогресса — дочерний div контейнера `role="progressbar"`. */
const LOADER_BAR = '[role="progressbar"] > div'
const THEME_WRAPPER = `.${'data-grid-theme'}`

type Args = Partial<Parameters<typeof composed.Playground>[0]>

async function renderTheming(args: Args = {}) {
  const { container } = await render(<composed.Playground {...args} />)
  await expect
    .poll(() => container.querySelector(LOADER_BAR))
    .not.toBeNull()
  return container
}

const barColor = (container: HTMLElement) =>
  getComputedStyle(container.querySelector<HTMLElement>(LOADER_BAR)!)
    .backgroundColor

describe('Theming — external customization (ADR 0018)', () => {
  test('TH1: the wrapper carries the stable `data-grid-theme` anchor class', async () => {
    const container = await renderTheming()
    // Публичный якорь темы: по нему потребитель адресует `--data-grid-*` из CSS.
    expect(container.querySelector(THEME_WRAPPER)).not.toBeNull()
  })

  test('TH2: default token layer applies (loader bar is the default info blue)', async () => {
    // Дефолты токенов приходят из theme.css (слой `:where(.data-grid-theme)`).
    // Без него `--data-grid-loader-bar` был бы не задан и полоса осталась бы
    // без цвета — синий #0070f3 (rgb 0,112,243) доказывает, что слой поставлен.
    const container = await renderTheming()
    expect(barColor(container)).toBe('rgb(0, 112, 243)')
  })

  test('TH3: a direct `--data-grid-*` override wins over the layer default', async () => {
    // Инлайн-`style` обёртки (per-instance) бьёт дефолт слоя нулевой специфичности.
    const container = await renderTheming({ loaderBar: 'rgb(255, 0, 128)' })
    expect(barColor(container)).toBe('rgb(255, 0, 128)')
  })

  test('TH4: an upstream palette token cascades into derived grid tokens', async () => {
    // `--data-grid-loader-bar: var(--info)`, поэтому правка апстрим-палитры
    // (`--info`) согласованно меняет производный токен грида.
    const container = await renderTheming({ info: 'rgb(0, 128, 0)' })
    expect(barColor(container)).toBe('rgb(0, 128, 0)')
  })

  test('TH5: shadows are tokenized — `--data-grid-shadow-color` drives the header elevation', async () => {
    // Тени вынесены в токены (`--data-grid-shadow-*`): цвет основных теней —
    // единый `--data-grid-shadow-color`. Тень шапки `0 4px 8px var(...)` должна
    // подхватить переопределённый цвет.
    const container = await renderTheming({ shadowColor: 'rgb(255, 0, 0)' })
    const head = container.querySelector<HTMLElement>('.data-grid__head')!
    expect(getComputedStyle(head).boxShadow).toContain('rgb(255, 0, 0)')
  })
})

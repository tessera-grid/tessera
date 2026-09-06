import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../Theming.stories'

// Витрина «Палитра» (свотч-борд) — каждое требование отдельным именованным
// тестом (PL1–PL3), по правилу нейминга из ADR 0009. История рендерит две
// тематизированные колонки рядом, поэтому один и тот же токен резолвится в цвет
// своей темы — это и проверяем на плоском `--tsr-sys-bg` (без color-mix, чтобы
// сравнивать rgb напрямую): light neutral-50 = #fafafa, dark neutral-950 = #0a0a0a.

const composed = composeStories(stories)

/** Скоуп темы = колонка палитры. Второй с классом `dark` — тёмная. */
const THEME_COLUMN = `.${'data-grid-theme'}`
const DARK_COLUMN = `.${'data-grid-theme'}.dark`

async function renderPalette() {
  const { container } = await render(<composed.Palette />)
  await expect
    .poll(() => container.querySelectorAll(THEME_COLUMN).length)
    .toBeGreaterThan(0)
  return container
}

const bgOf = (el: Element | null) =>
  el ? getComputedStyle(el as HTMLElement).backgroundColor : ''

describe('Theming — палитра (свотч-борд, обе темы)', () => {
  test('PL1: борд рендерит ровно две тематизированные колонки — светлую и тёмную', async () => {
    const container = await renderPalette()
    expect(container.querySelectorAll(THEME_COLUMN)).toHaveLength(2)
    expect(container.querySelectorAll(DARK_COLUMN)).toHaveLength(1)
  })

  test('PL2: один и тот же токен `--tsr-sys-bg` даёт разный фон в light и dark', async () => {
    const container = await renderPalette()
    const [light, dark] = container.querySelectorAll(THEME_COLUMN)
    // Плоский primitive-слот роли: light neutral-50, dark neutral-950.
    expect(bgOf(light)).toBe('rgb(250, 250, 250)')
    expect(bgOf(dark)).toBe('rgb(10, 10, 10)')
  })

  test('PL3: каждый цвет снабжён свотчем-квадратом и подписью-значением', async () => {
    const container = await renderPalette()
    const swatches = container.querySelectorAll('figure')
    // Свотчей > 0, каждый несёт закруглённый превью-квадрат и figcaption-подпись.
    expect(swatches.length).toBeGreaterThan(0)
    swatches.forEach(fig => {
      const preview = fig.querySelector('div')
      expect(getComputedStyle(preview!).borderRadius).toBe('12px')
      expect(fig.querySelector('figcaption')?.textContent ?? '').not.toBe('')
    })
  })
})

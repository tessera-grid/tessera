import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../Theming.stories'

// Каждое требование темизации — отдельный именованный тест (ADR 0001/0009):
// TH1–TH8 (внешняя темизация + тёмный режим, ADR 0018), TK1–TK4 (уровни токенов
// --tsr-ref/sys/comp, ADR 0019). Витрина Theming рендерит грид с включённым
// лоадером; его полоса читает `--tsr-comp-loader-bar`, а это ПЛОСКИЙ токен
// (`var(--info, …)`, без color-mix), поэтому вычисленный `background-color`
// сравнивается с задаваемым rgb без хрупкой математики oklch.

const composed = composeStories(stories)

/** Полоса линейного прогресса — дочерний div контейнера `role="progressbar"`. */
const LOADER_BAR = '[role="progressbar"] > div'
const THEME_WRAPPER = `.${'data-grid-theme'}`

type Args = Partial<Parameters<typeof composed.Playground>[0]>

async function renderTheming(args: Args = {}) {
  const { container } = await render(<composed.Playground {...args} />)
  await expect.poll(() => container.querySelector(LOADER_BAR)).not.toBeNull()
  return container
}

const barColor = (container: HTMLElement) =>
  getComputedStyle(container.querySelector<HTMLElement>(LOADER_BAR)!)
    .backgroundColor

describe('Theming — external customization + token tiers (ADR 0018/0019)', () => {
  test('TH1: the wrapper carries the stable `data-grid-theme` anchor class', async () => {
    const container = await renderTheming()
    // Публичный якорь темы: по нему потребитель адресует `--tsr-comp-*` из CSS.
    expect(container.querySelector(THEME_WRAPPER)).not.toBeNull()
  })

  test('TH2: default token layer applies (loader bar is the default info blue)', async () => {
    // Дефолты токенов приходят из theme.css (слой `:where(.data-grid-theme)`).
    // Без него `--tsr-comp-loader-bar` был бы не задан и полоса осталась бы
    // без цвета — синий #0070f3 (rgb 0,112,243) доказывает, что слой поставлен.
    const container = await renderTheming()
    expect(barColor(container)).toBe('rgb(0, 112, 243)')
  })

  test('TH3: a direct `--tsr-comp-*` override wins over the layer default', async () => {
    // Инлайн-`style` обёртки (per-instance) бьёт дефолт слоя нулевой специфичности.
    const container = await renderTheming({ loaderBar: 'rgb(255, 0, 128)' })
    expect(barColor(container)).toBe('rgb(255, 0, 128)')
  })

  test('TH4: an upstream palette token cascades into derived grid tokens', async () => {
    // `--tsr-comp-loader-bar: var(--info)`, поэтому правка апстрим-палитры
    // (`--info`) согласованно меняет производный токен грида.
    const container = await renderTheming({ info: 'rgb(0, 128, 0)' })
    expect(barColor(container)).toBe('rgb(0, 128, 0)')
  })

  test('TH5: shadows are tokenized — `--tsr-comp-shadow-color` drives the header elevation', async () => {
    // Тени вынесены в токены (`--tsr-comp-shadow-*`): цвет основных теней —
    // единый `--tsr-comp-shadow-color`. Тень шапки `0 4px 8px var(...)` должна
    // подхватить переопределённый цвет.
    const container = await renderTheming({ shadowColor: 'rgb(255, 0, 0)' })
    const head = container.querySelector<HTMLElement>('.data-grid__head')!
    expect(getComputedStyle(head).boxShadow).toContain('rgb(255, 0, 0)')
  })

  // --- Тёмный режим + уровни токенов (ADR 0018 шиппинг / ADR 0019 уровни) ------
  // Читаем вычисленное значение переменной на пробнике с заданными классами и
  // (опц.) инлайн-переменными. `--tsr-ref/sys/*` — наш неймспейс, не задаётся
  // global.css, поэтому пробники проверяют именно наши уровни и цепочку.
  const readVar = (
    token: string,
    {
      className = 'data-grid-theme',
      vars = {},
    }: { className?: string; vars?: Record<string, string> } = {},
  ): string => {
    const el = document.createElement('div')
    el.className = className
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v))
    document.body.appendChild(el)
    const value = getComputedStyle(el).getPropertyValue(token).trim()
    el.remove()
    return value
  }

  test('TH6: a self-contained dark palette ships — semantic role flips under `.dark`', () => {
    // Ядро фикса: без shadcn (гасим `--card`) роль surface флипается классом
    // `.dark` на самой обёртке через primitive-дефолт.
    const vars = { '--card': 'initial' }
    expect(readVar('--tsr-sys-surface', { vars })).toBe('#ffffff')
    expect(
      readVar('--tsr-sys-surface', { className: 'data-grid-theme dark', vars }),
    ).toBe('#171717')
  })

  test('TH7: the dark layer also flips when `.dark` sits on an ancestor', () => {
    // Селектор `.dark .data-grid-theme` — глобальный тумблер приложения на предке.
    const ancestor = document.createElement('div')
    ancestor.className = 'dark'
    const wrapper = document.createElement('div')
    wrapper.className = 'data-grid-theme'
    wrapper.style.setProperty('--foreground', 'initial')
    ancestor.appendChild(wrapper)
    document.body.appendChild(ancestor)

    expect(
      getComputedStyle(wrapper).getPropertyValue('--tsr-sys-fg').trim(),
    ).toBe('#fafafa')

    ancestor.remove()
  })

  test('TH8: a derived component token falls back to the dark default when no shadcn upstream is set', () => {
    // Цепочка comp → sys → ref: без апстрим-токена (гасим `--card`) component-токен
    // берёт тёмный primitive-дефолт — грид имеет свою тёмную тему без shadcn.
    expect(
      readVar('--tsr-comp-row-bg', {
        className: 'data-grid-theme dark',
        vars: { '--card': 'initial' },
      }),
    ).toBe('#171717')
  })

  test('TH9: tooltip is tokenized and theme-aware (inverse surface flips light↔dark)', () => {
    // Тултип больше не хардкодит цвета (ADR 0019): фон/текст — инверсная
    // поверхность из semantic, поэтому цвет флипается с темой.
    expect(readVar('--tsr-comp-tooltip-bg')).not.toBe('')
    const fgLight = readVar('--tsr-comp-tooltip-fg')
    const fgDark = readVar('--tsr-comp-tooltip-fg', {
      className: 'data-grid-theme dark',
    })
    expect(fgLight).not.toBe('')
    expect(fgDark).not.toBe('')
    expect(fgLight).not.toBe(fgDark)
  })

  // --- Уровни токенов (ADR 0019) ----------------------------------------------

  test('TK1: primitive scale is mode-independent (`--tsr-ref-*` is not themed)', () => {
    // Primitive — сырые значения без light/dark: одинаковы в обоих режимах.
    expect(readVar('--tsr-ref-neutral-900')).toBe('#171717')
    expect(
      readVar('--tsr-ref-neutral-900', { className: 'data-grid-theme dark' }),
    ).toBe('#171717')
  })

  test('TK2: a semantic role flips light↔dark via the primitive fallback', () => {
    // Без shadcn (гасим `--foreground`) роль fg берёт разные primitive в light/dark.
    const vars = { '--foreground': 'initial' }
    expect(readVar('--tsr-sys-fg', { vars })).toBe('#171717')
    expect(
      readVar('--tsr-sys-fg', { className: 'data-grid-theme dark', vars }),
    ).toBe('#fafafa')
  })

  test('TK3: a component token references its semantic role (override sys → comp follows)', () => {
    // Однонаправленность comp → sys: переопределение роли меняет component-токен.
    expect(
      readVar('--tsr-comp-checkbox-checked-bg', {
        vars: { '--tsr-sys-accent': 'rgb(1, 2, 3)' },
      }),
    ).toBe('rgb(1, 2, 3)')
  })

  test('TK4: a shadcn upstream token wins over the primitive default in a semantic role', () => {
    // Мост в semantic: `--primary` потребителя побеждает primitive-дефолт.
    expect(
      readVar('--tsr-sys-accent', { vars: { '--primary': 'rgb(9, 9, 9)' } }),
    ).toBe('rgb(9, 9, 9)')
  })
})

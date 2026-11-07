import { composeStories } from '@storybook/react-vite'
import type { CSSProperties } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { rowSelection } from '../../../plugins'
import themeCss from '../../../ui/theme/theme.css?raw'
import * as stories from '../../Theming.stories'
import { contrast, effectiveBg, toRgba } from './a11y-helpers'

// Каждое требование темизации — отдельный именованный тест:
// TH1–TH8 (внешняя темизация + тёмный режим), TK1–TK4 (уровни токенов
// --tsr-ref/sys/comp). Витрина Theming рендерится с включённым
// лоадером (`loading: 'refresh'`); его полоса читает `--tsr-comp-loader-bar`, а это ПЛОСКИЙ токен
// (`var(--info, …)`, без color-mix), поэтому вычисленный `background-color`
// сравнивается с задаваемым rgb без хрупкой математики oklch.

const composed = composeStories(stories)

/** Бегущая линия индикатора загрузки (ADR 0094). */
const LOADER_BAR = '.data-grid__loader-line'
const THEME_WRAPPER = `.${'data-grid-theme'}`

type Args = Partial<Parameters<typeof composed.Playground>[0]>

async function renderTheming(args: Args = {}) {
  const { container } = await render(
    <composed.Playground loading="refresh" {...args} />,
  )
  await expect.poll(() => container.querySelector(LOADER_BAR)).not.toBeNull()
  return container
}

const barColor = (container: HTMLElement) =>
  getComputedStyle(container.querySelector<HTMLElement>(LOADER_BAR)!)
    .backgroundColor

describe('Theming — external customization + token tiers', () => {
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
    expect(barColor(container)).toBe('oklch(0.546 0.245 262.881)')
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

  // --- Тёмный режим + уровни токенов ------------------------------------------
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
    expect(readVar('--tsr-sys-surface', { vars })).toBe('#fff')
    expect(
      readVar('--tsr-sys-surface', { className: 'data-grid-theme dark', vars }),
    ).toBe('oklch(20.5% 0 none)')
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
    ).toBe('oklch(98.5% 0 none)')

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
    ).toBe('oklch(20.5% 0 none)')
  })

  test('TH9: tooltip is tokenized and theme-aware (inverse surface flips light↔dark)', () => {
    // Тултип не хардкодит цвета: фон/текст — инверсная
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

  test('TH10: the grid sets its own text color — cells and headers ignore the page color in both themes', async () => {
    // Страница без shadcn (гасим `--foreground`) со своим цветом текста: грид не
    // наследует его, а берёт `--tsr-comp-fg` своей темы.
    const Grid = ({ colorMode }: { colorMode: 'light' | 'dark' }) => {
      const table = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }],
        data: [{ id: '1', name: 'Ann' }],
        getRowId: (row: { id: string }) => row.id,
      })
      return (
        <div style={{ height: 200, color: 'rgb(1, 2, 3)' }}>
          <DataGrid
            table={table as never}
            colorMode={colorMode}
            style={{ '--foreground': 'initial' } as CSSProperties}
          />
        </div>
      )
    }
    for (const [colorMode, fg] of [
      ['light', 'oklch(0.145 0 none)'],
      ['dark', 'oklch(0.985 0 none)'],
    ] as const) {
      const { container, unmount } = await render(
        <Grid colorMode={colorMode} />,
      )
      const cell = container.querySelector('.data-grid__body-cell')
      const head = container.querySelector('.data-grid__head-cell')
      await expect.poll(() => cell && head).toBeTruthy()
      expect(getComputedStyle(cell!).color, `${colorMode} cell`).toBe(fg)
      expect(getComputedStyle(head!).color, `${colorMode} head`).toBe(fg)
      await unmount()
    }
  })

  test('TH11: the grid paints its own background — a selected and a hovered row stay readable on a page of the other theme', async () => {
    // Белая страница без shadcn, тёмный грид: полупрозрачные наведение и выбор строки
    // смешиваются с фоном темы, а не страницы.
    const Grid = ({ colorMode }: { colorMode: 'light' | 'dark' }) => {
      const table = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }],
        data: [
          { id: '1', name: 'Ann' },
          { id: '2', name: 'Bob' },
        ],
        getRowId: (row: { id: string }) => row.id,
        plugins: [rowSelection({ rowSelection: { '1': true } })] as never,
      })
      const page = colorMode === 'dark' ? '#ffffff' : '#000000'
      return (
        <div style={{ height: 200, background: page }}>
          <DataGrid
            table={table as never}
            colorMode={colorMode}
            style={
              {
                '--foreground': 'initial',
                '--background': 'initial',
                '--card': 'initial',
              } as CSSProperties
            }
          />
        </div>
      )
    }
    for (const colorMode of ['dark', 'light'] as const) {
      const { container, unmount } = await render(
        <Grid colorMode={colorMode} />,
      )
      const row = (id: string) =>
        container.querySelector<HTMLElement>(
          `.data-grid__body-row[data-row-id="${id}"]`,
        )
      await expect.poll(() => row('1') && row('2')).toBeTruthy()
      await userEvent.hover(row('2')!.querySelector('.data-grid__body-cell')!)
      for (const id of ['1', '2']) {
        const title = row(id)!.querySelector('.data-grid__cell-wrapper-title')!
        await expect
          .poll(
            () =>
              contrast(
                toRgba(getComputedStyle(title).color),
                effectiveBg(title),
              ),
            { message: `${colorMode} row ${id}` },
          )
          .toBeGreaterThanOrEqual(4.5)
      }
      await unmount()
    }
  })

  // --- Уровни токенов ---------------------------------------------------------

  test('TK1: primitive scale is mode-independent (`--tsr-ref-*` is not themed)', () => {
    // Primitive — сырые значения без light/dark: одинаковы в обоих режимах.
    expect(readVar('--tsr-ref-neutral-900')).toBe('oklch(20.5% 0 none)')
    expect(
      readVar('--tsr-ref-neutral-900', { className: 'data-grid-theme dark' }),
    ).toBe('oklch(20.5% 0 none)')
  })

  test('TK2: a semantic role flips light↔dark via the primitive fallback', () => {
    // Без shadcn (гасим `--foreground`) роль fg берёт разные primitive в light/dark.
    const vars = { '--foreground': 'initial' }
    expect(readVar('--tsr-sys-fg', { vars })).toBe('oklch(14.5% 0 none)')
    expect(
      readVar('--tsr-sys-fg', { className: 'data-grid-theme dark', vars }),
    ).toBe('oklch(98.5% 0 none)')
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

  test('TK7: сброс браузерных стилей — только под корнем темы, страница приложения без Tailwind не меняется', () => {
    // Своя страница: сброс Storybook из `global.css` сюда не доходит.
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const doc = frame.contentDocument!
    doc.head.innerHTML = `<style>${themeCss}</style>`
    doc.body.innerHTML = `
      <div class="data-grid-theme"><p data-at="in"></p><ul data-at="in"></ul><button data-at="in"></button></div>
      <p data-at="out"></p><ul data-at="out"></ul><button data-at="out"></button>`
    const styleOf = (at: string, tag: string) =>
      frame.contentWindow!.getComputedStyle(
        doc.querySelector(`${tag}[data-at="${at}"]`)!,
      )
    expect(styleOf('in', 'p').marginBlockStart).toBe('0px')
    expect(styleOf('in', 'ul').listStyleType).toBe('none')
    expect(styleOf('in', 'ul').paddingInlineStart).toBe('0px')
    expect(styleOf('in', 'button').borderTopWidth).toBe('0px')
    expect(styleOf('in', 'button').backgroundColor).toBe('rgba(0, 0, 0, 0)')

    expect(parseFloat(styleOf('out', 'p').marginBlockStart)).toBeGreaterThan(0)
    expect(styleOf('out', 'ul').listStyleType).toBe('disc')
    expect(parseFloat(styleOf('out', 'ul').paddingInlineStart)).toBeGreaterThan(
      0,
    )
    expect(parseFloat(styleOf('out', 'button').borderTopWidth)).toBeGreaterThan(
      0,
    )
    frame.remove()
  })

  test('TK6: --font-sans of the app is the font of the grid and its portals; without it — the system stack', () => {
    expect(
      readVar('--tsr-comp-font-family', {
        vars: { '--font-sans': 'Inter, sans-serif' },
      }),
    ).toBe('Inter, sans-serif')
    expect(
      readVar('--tsr-comp-font-family', { vars: { '--font-sans': 'initial' } }),
    ).toMatch(/^system-ui,/)
  })

  test('TK5: --radius-sm and --radius-lg of the app round popover items and the sticky block edge; without them — the primitive scale', () => {
    const radius = (token: string, vars: Record<string, string>) => {
      const el = document.createElement('div')
      el.className = 'data-grid-theme'
      Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v))
      el.style.borderTopLeftRadius = `var(${token})`
      document.body.appendChild(el)
      const value = getComputedStyle(el).borderTopLeftRadius
      el.remove()
      return value
    }
    const app = { '--radius-sm': '3px', '--radius-lg': '17px' }
    expect(radius('--tsr-comp-popup-item-radius', app)).toBe('3px')
    expect(radius('--tsr-comp-sticky-radius', app)).toBe('17px')
    const none = { '--radius-sm': 'initial', '--radius-lg': 'initial' }
    expect(radius('--tsr-comp-popup-item-radius', none)).toBe('6px')
    expect(radius('--tsr-comp-sticky-radius', none)).toBe('10px')
  })
})

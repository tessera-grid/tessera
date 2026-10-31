import axe from 'axe-core'
import { composeStories } from '@storybook/react-vite'
import { type CSSProperties, type ReactNode, useMemo } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { __resetLogger } from '../../../util/logger'

import type { ColorMode } from '../../../ui/theme'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnPinning,
  columnSorting,
  headerActionMenu,
  pagination,
  rowSelection,
} from '../../../plugins'
import * as themingStories from '../../Theming.stories'
import { rowState } from '../helpers'
import {
  contrast,
  effectiveBg,
  luminance,
  resolveColor,
  toRgba,
} from './a11y-helpers'
import { tableLabels } from '../labels'

// Источник темы и её смена (ADR 0090, TM1–TM10, TM12–TM13): проп `colorMode`, `.dark` у
// предка, переходы при смене, порталы, `color-scheme` и предупреждение о смеси палитр.
// Перф TM11 — `performance/theme-source`.

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const style = (el: Element) => getComputedStyle(el)

interface Item {
  id: string
  a: string
  b: string
  c: string
}

const COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', footer: 'Σ A', size: 120 },
  { id: 'b', accessorKey: 'b', header: 'B', footer: 'Σ B', size: 140 },
  { id: 'c', accessorKey: 'c', header: 'C', footer: 'Σ C', size: 120 },
]

const Grid = ({
  colorMode,
  style: gridStyle,
}: {
  colorMode?: ColorMode
  style?: CSSProperties
}) => {
  const data = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: `r${i}`,
        a: `A${i}`,
        b: `B${i}`,
        c: `C${i}`,
      })),
    [],
  )
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    enableFooter: true,
    state: { columnPinning: { start: ['a'] } } as never,
    plugins: [
      columnPinning(),
      columnSorting(),
      headerActionMenu({ mode: 'always' }),
      rowSelection(),
      pagination(),
    ] as never,
  })
  return (
    <div style={{ width: 560, height: 420 }}>
      <DataGrid
        table={table as never}
        colorMode={colorMode}
        style={gridStyle}
      />
    </div>
  )
}

/** Грид внутри контейнера; `dark` — класс `.dark` на контейнере, а не на `<html>`. */
const Scene = ({
  colorMode,
  dark = false,
  children,
}: {
  colorMode?: ColorMode
  dark?: boolean
  children?: ReactNode
}) => (
  <div className={dark ? 'dark' : undefined} data-testid="scene">
    <Grid colorMode={colorMode} />
    {children}
  </div>
)

const mount = async (props: Parameters<typeof Scene>[0] = {}) => {
  const screen = await render(<Scene {...props} />)
  await expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)
  await expect
    .poll(() => document.querySelector('nav[data-testid="pagination"]'))
    .not.toBeNull()
  await settle()
  return screen
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector)!
const wrapper = () => q('.data-grid-theme[class*="theme-wrapper"]')
const row = () => q('.data-grid__body-row[data-row-id="r1"]')
const pinnedCell = () =>
  row().querySelector<HTMLElement>('[data-column-id="a"]')!
const plainCell = () =>
  row().querySelector<HTMLElement>('[data-column-id="b"]')!
const textOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>('.data-grid__cell-wrapper-title') ?? cell

/** Ждать окончания переходов цвета. */
const settle = async () => {
  await frame()
  document
    .getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .forEach(animation => animation.finish())
  await frame()
}

/** Части грида, которые красит тема: фон, текст и рамка. */
const PARTS: Record<string, () => HTMLElement | null> = {
  head: () => q('.data-grid__head'),
  headCell: () => q('.data-grid__head-cell[data-column-id="b"]'),
  row,
  pinnedCell,
  plainCell,
  footer: () => q('.data-grid__footer'),
  footerCell: () => q('.data-grid__footer-cell'),
  statusBar: () => q('nav[data-testid="pagination"]').parentElement,
  checkbox: () => row().querySelector<HTMLElement>('[role="checkbox"]'),
}

const snapshot = () =>
  Object.fromEntries(
    Object.entries(PARTS).map(([name, get]) => {
      const el = get()
      if (!el) return [name, null]
      const s = style(el)
      return [name, `${s.backgroundColor} | ${s.color} | ${s.borderTopColor}`]
    }),
  )

/** Текст ячеек тела, шапки и футера к их видимому фону — порог AA. */
const textContrasts = () =>
  [
    textOf(plainCell()),
    textOf(pinnedCell()),
    q('.data-grid__head-cell[data-column-id="b"]'),
    q('.data-grid__footer-cell'),
  ].map(el => contrast(toRgba(style(el).color), effectiveBg(el)))

/**
 * Смена темы перекрашивает грид в одном кадре: каждый кадр после смены совпадает с
 * покоем, текст держит AA.
 */
const expectSwitchInOneFrame = async (
  change: () => unknown | Promise<unknown>,
  label: string,
) => {
  const before = snapshot()
  await change()
  const frames: Record<string, unknown>[] = []
  const ratios: number[][] = []
  for (let i = 0; i < 4; i++) {
    await frame()
    frames.push(snapshot())
    ratios.push(textContrasts())
  }
  await settle()
  const after = snapshot()
  expect(after, `${label}: тема сменилась`).not.toEqual(before)
  frames.forEach((shot, i) =>
    expect(shot, `${label}: кадр ${i + 1}`).toEqual(after),
  )
  ratios
    .flat()
    .forEach(ratio =>
      expect(ratio, `${label}: текст`).toBeGreaterThanOrEqual(4.5),
    )
}

const schemeOf = (el: Element) => style(el).colorScheme

/** Меню кебаба колонки «B» — в портале. */
const openMenu = async () => {
  const kebab = () =>
    document.querySelector<HTMLElement>(
      `.data-grid__head-cell[data-column-id="b"] [aria-label^="${tableLabels.headerMenu}"]`,
    )
  await expect.poll(kebab).not.toBeNull()
  kebab()!.focus()
  await userEvent.keyboard('{Enter}')
  await expect
    .poll(() => document.querySelector<HTMLElement>('[role="menu"]'))
    .not.toBeNull()
  await settle()
  return document.querySelector<HTMLElement>('[role="menu"]')!
}

const closeMenu = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
}

const isDarkSurface = (el: HTMLElement) =>
  luminance(effectiveBg(el)) < luminance(toRgba(style(el).color))

const composed = composeStories(themingStories)

describe('Источник темы и её смена (ADR 0090)', () => {
  test('TM1: смена colorMode перекрашивает шапку, тело, футер, панель, закреплённые ячейки и флажки в одном кадре; текст не ниже AA', async () => {
    const screen = await mount({ colorMode: 'auto' })
    await expectSwitchInOneFrame(
      () => screen.rerender(<Scene colorMode="dark" />),
      'auto → dark',
    )
    await expectSwitchInOneFrame(
      () => screen.rerender(<Scene colorMode="auto" />),
      'dark → auto',
    )
  })

  test('TM2: смена .dark у предка перекрашивает грид в одном кадре — на <html> и на контейнере', async () => {
    await mount()
    await expectSwitchInOneFrame(
      () => document.documentElement.classList.add('dark'),
      '<html>.dark',
    )
    await expectSwitchInOneFrame(
      () => document.documentElement.classList.remove('dark'),
      'без .dark',
    )
    const scene = q('[data-testid="scene"]')
    await expectSwitchInOneFrame(
      () => scene.classList.add('dark'),
      'контейнер .dark',
    )
  })

  test('TM3: наведение строки, закреплённой ячейки и ячейки шапки по-прежнему переходит плавно', async () => {
    await mount()
    const watch = {
      row,
      pinnedCell,
      headCell: () => q('.data-grid__head-cell[data-column-id="b"]'),
    }
    // Строка и закреплённая ячейка — слоем состояния строки поверх фона (ADR 0126).
    const fill = (name: string, el: HTMLElement) =>
      name === 'headCell' ? style(el).backgroundColor : rowState(el)
    for (const [name, get] of Object.entries(watch)) {
      const initial = fill(name, get())
      await userEvent.hover(name === 'headCell' ? get() : plainCell())
      const seen: string[] = []
      for (let i = 0; i < 8; i++) {
        await frame()
        seen.push(fill(name, get()))
      }
      await settle()
      const final = fill(name, get())
      expect(final, `${name}: наведение меняет фон`).not.toBe(initial)
      expect(
        seen.some(color => color !== initial && color !== final),
        `${name}: промежуточные кадры ${seen.join(', ')}`,
      ).toBe(true)
      await userEvent.unhover(get())
      await settle()
    }
  })

  test('TM4: colorMode по умолчанию — auto: без класса на обёртке грид следует .dark предка', async () => {
    const screen = await mount()
    expect(wrapper().classList.contains('dark')).toBe(false)
    expect(wrapper().hasAttribute('data-tsr-color-mode')).toBe(false)
    expect(schemeOf(wrapper())).toBe('light')
    expect(isDarkSurface(textOf(plainCell()))).toBe(false)

    await screen.rerender(<Scene dark />)
    await settle()
    expect(wrapper().classList.contains('dark')).toBe(false)
    expect(schemeOf(wrapper())).toBe('dark')
    expect(isDarkSurface(textOf(plainCell()))).toBe(true)
  })

  test('TM5: colorMode="dark" на светлой странице берёт тёмные значения палитры приложения', async () => {
    await mount({ colorMode: 'dark' })
    const probe = document.createElement('div')
    probe.className = 'dark'
    document.body.append(probe)
    const appDarkFg = resolveColor(probe, 'var(--foreground)')
    const appDarkBg = resolveColor(probe, 'var(--background)')
    probe.remove()
    expect(schemeOf(wrapper())).toBe('dark')
    expect(resolveColor(wrapper(), 'var(--tsr-sys-fg)')).toBe(appDarkFg)
    expect(resolveColor(wrapper(), 'var(--tsr-sys-bg)')).toBe(appDarkBg)
  })

  test('TM6: colorMode="light" под тёмным предком — светлый на запасных значениях грида; на светлой странице — палитра приложения', async () => {
    await mount({ colorMode: 'light' })
    const appLightFg = resolveColor(document.body, 'var(--foreground)')
    expect(resolveColor(wrapper(), 'var(--tsr-sys-fg)')).toBe(appLightFg)

    document.documentElement.classList.add('dark')
    await settle()
    expect(schemeOf(wrapper())).toBe('light')
    expect(wrapper().getAttribute('data-tsr-color-mode')).toBe('light')
    expect(resolveColor(wrapper(), 'var(--tsr-sys-fg)')).toBe(
      resolveColor(wrapper(), 'var(--tsr-ref-neutral-900)'),
    )
    expect(resolveColor(wrapper(), 'var(--tsr-sys-surface)')).toBe(
      resolveColor(wrapper(), 'var(--tsr-ref-neutral-0)'),
    )
    expect(isDarkSurface(textOf(plainCell()))).toBe(false)
    // Рамка — из рычага линий: видимый тёмный тон, а не пустое значение.
    const border = toRgba(resolveColor(wrapper(), 'var(--tsr-sys-border)'))
    expect(border[3], 'рамка видна').toBeGreaterThan(0.05)
    expect(luminance(border), 'рамка — тон текста').toBeLessThan(0.2)
  })

  test('TM7: меню в портале открывается в теме грида при любом источнике', async () => {
    const cases: {
      name: string
      props: Parameters<typeof Scene>[0]
      html?: boolean
      dark: boolean
    }[] = [
      { name: 'проп dark', props: { colorMode: 'dark' }, dark: true },
      { name: '<html>.dark', props: {}, html: true, dark: true },
      { name: 'контейнер .dark', props: { dark: true }, dark: true },
      {
        name: 'light под <html>.dark',
        props: { colorMode: 'light' },
        html: true,
        dark: false,
      },
    ]
    for (const { name, props, html, dark } of cases) {
      document.documentElement.classList.toggle('dark', !!html)
      const screen = await mount(props)
      expect(schemeOf(wrapper()), `${name}: грид`).toBe(dark ? 'dark' : 'light')
      const menu = await openMenu()
      expect(schemeOf(menu), `${name}: меню`).toBe(dark ? 'dark' : 'light')
      expect(isDarkSurface(menu), `${name}: фон меню`).toBe(dark)
      await closeMenu()
      await screen.unmount()
    }
  })

  test('TM8: color-scheme обёртки, области прокрутки и портала следует теме грида', async () => {
    const screen = await mount()
    const container = () => q('.data-grid__container')
    expect(schemeOf(wrapper())).toBe('light')
    expect(schemeOf(container())).toBe('light')

    await screen.rerender(<Scene colorMode="dark" />)
    await settle()
    expect(schemeOf(wrapper())).toBe('dark')
    expect(schemeOf(container())).toBe('dark')
    const menu = await openMenu()
    const positioner = menu.closest<HTMLElement>('.data-grid-theme')!
    expect(schemeOf(positioner)).toBe('dark')
    await closeMenu()
  })

  test('TM9: грид предупреждает один раз, когда фон и текст не сходятся с его темой, и молчит, когда сходятся', async () => {
    __resetLogger()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mismatch = () =>
      warn.mock.calls.filter(([message]) =>
        String(message).includes('does not match the grid color mode'),
      )
    try {
      const matching = await render(<Grid colorMode="dark" />)
      await settle()
      await matching.unmount()
      expect(mismatch(), 'палитра на .dark').toHaveLength(0)

      // Палитра приложения только на `html.dark`: у тёмного грида светлые роли.
      const light = {
        '--foreground': 'oklch(0.145 0 0)',
        '--background': 'oklch(1 0 0)',
      } as CSSProperties
      const first = await render(<Grid colorMode="dark" style={light} />)
      await settle()
      await first.unmount()
      const second = await render(<Grid colorMode="dark" style={light} />)
      await settle()
      await second.unmount()
      expect(mismatch(), 'светлая палитра в тёмном гриде').toHaveLength(1)
    } finally {
      warn.mockRestore()
    }
  })

  test('TM13: открытое меню перекрашивается в одном кадре при снятии .dark у предка и тогда, когда перерисовка темы порталов приходит позже кадров гашения', async () => {
    document.documentElement.classList.add('dark')
    const screen = await mount()
    const menu = await openMenu()
    const item = menu.querySelector<HTMLElement>('[role="menuitem"]')!
    const shot = () =>
      [menu, item]
        .map(el => `${style(el).backgroundColor} | ${style(el).color}`)
        .join(' / ')
    const before = shot()
    const frames: string[] = []
    // Перерисовку React ведёт задача планировщика через MessagePort: откладываем её.
    const post = MessagePort.prototype.postMessage
    MessagePort.prototype.postMessage = function (
      this: MessagePort,
      ...args: unknown[]
    ) {
      setTimeout(
        () => (post as (...a: unknown[]) => void).apply(this, args),
        120,
      )
    }
    try {
      document.documentElement.classList.remove('dark')
      for (const start = performance.now(); performance.now() - start < 300;) {
        await frame()
        frames.push(shot())
      }
    } finally {
      MessagePort.prototype.postMessage = post
    }
    await settle()
    const after = shot()
    expect(after).not.toEqual(before)
    expect(frames.filter(f => f !== before && f !== after)).toEqual([])
    await closeMenu()
    await screen.unmount()
  })

  test('TM10: axe color-contrast без нарушений при каждом colorMode на светлой и тёмной странице', async () => {
    for (const html of [false, true]) {
      for (const colorMode of ['auto', 'light', 'dark'] as const) {
        document.documentElement.classList.toggle('dark', html)
        const screen = await mount({ colorMode })
        const { violations } = await axe.run(wrapper(), {
          runOnly: ['color-contrast'],
        })
        expect(
          violations.flatMap(v => v.nodes.map(n => n.target.join(' '))),
          `${colorMode}, страница ${html ? 'тёмная' : 'светлая'}`,
        ).toEqual([])
        await screen.unmount()
      }
    }
  })
})

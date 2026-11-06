/**
 * Палитра темы (ADR 0191): значения `--tsr-ref-*` — из шкалы Tailwind v4 (PN1), запасные значения
 * ролей с мостом — стандартная тема shadcn (PN2). Значения shadcn — со страницы Theming его
 * документации; обновление Tailwind роняет PN1, пока токены не приведены к новой версии.
 * Запуск: npx vitest run --config vitest.node.config.ts palette
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..')
const theme = readFileSync(join(ROOT, 'src/lib/ui/theme/theme.css'), 'utf8')
const tailwind = readFileSync(
  join(ROOT, 'node_modules/tailwindcss/theme.css'),
  'utf8',
)

/** Значения `--tsr-ref-<тон>-<ступень>`: цветные, размерные шкалы не в счёт. */
const refs = new Map(
  [...theme.matchAll(/--tsr-ref-([a-z]+-\d+):\s*([^;]+);/g)]
    .filter(([, name]) => !/^(space|radius)-/.test(name!))
    .map(([, name, value]) => [name!, value!.trim()]),
)

const tailwindValue = (name: string) =>
  new RegExp(`--color-${name}:\\s*([^;]+);`).exec(tailwind)?.[1]?.trim()

/** Имя цвета в шкале Tailwind: нулевой ступени в ней нет, это белый. */
const tailwindName = (name: string) => (name === 'neutral-0' ? 'white' : name)

/** Токены вне шкалы Tailwind — с причиной; список только сокращается. */
const OUTSIDE_TAILWIND: Record<string, string> = {}

/** Роли стандартной темы shadcn: `oklch(L C H)`. */
const SHADCN = {
  light: {
    foreground: [0.145, 0, 0],
    background: [1, 0, 0],
    card: [1, 0, 0],
    muted: [0.97, 0, 0],
    primary: [0.205, 0, 0],
    'primary-foreground': [0.985, 0, 0],
    border: [0.922, 0, 0],
    destructive: [0.577, 0.245, 27.325],
  },
  dark: {
    foreground: [0.985, 0, 0],
    background: [0.145, 0, 0],
    card: [0.205, 0, 0],
    muted: [0.269, 0, 0],
    primary: [0.922, 0, 0],
    'primary-foreground': [0.205, 0, 0],
    destructive: [0.704, 0.191, 22.216],
  },
} as const

/** Запасное значение роли записано не примитивом — с причиной; список только сокращается. */
const OUTSIDE_SHADCN: Record<string, string> = {
  'dark:border':
    'белый 10 %, как `oklch(1 0 0 / 10%)` shadcn: смесь, отдельного примитива нет',
}

const lightBlock = theme.slice(
  theme.indexOf('--tsr-sys-fg: var(--foreground'),
  theme.indexOf('--tsr-sys-scheme: dark'),
)
const darkBlock = theme.slice(
  theme.indexOf('--tsr-sys-scheme: dark'),
  theme.indexOf('Tier 3 — COMPONENT'),
)

/** Запасное значение мостящейся роли: `--tsr-sys-x: var(--<роль>, <значение>)`. */
const fallbackOf = (block: string, role: string) =>
  new RegExp(`var\\(\\s*--${role},\\s*var\\(--tsr-ref-([a-z]+-\\d+)\\)`).exec(
    block,
  )?.[1]

const channels = (value: string | undefined): number[] | undefined => {
  if (value === '#fff') return [1, 0, 0]
  const match = /oklch\(([\d.]+)%? ([\d.]+) ([\d.a-z]+)\)/.exec(value ?? '')
  if (!match) return undefined
  const lightness = Number(match[1])
  return [
    value!.includes('%') ? lightness / 100 : lightness,
    Number(match[2]),
    match[3] === 'none' ? 0 : Number(match[3]),
  ]
}

const differs =
  (block: string, roles: Record<string, readonly number[]>) =>
  (mode: 'light' | 'dark') =>
    Object.entries(roles).flatMap(([role, stock]) => {
      if (`${mode}:${role}` in OUTSIDE_SHADCN) return []
      const ref = fallbackOf(block, role)
      const own = channels(ref ? refs.get(ref) : undefined)
      const same =
        own?.every((value, i) => Math.abs(value - stock[i]!) < 0.0006) ?? false
      return same ? [] : [`${mode}:${role} — ${ref ?? 'нет примитива'}`]
    })

/** Стандартная тема shadcn целиком: палитра историй (PN7). */
const SHADCN_THEME = {
  light: {
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
    card: 'oklch(1 0 0)',
    'card-foreground': 'oklch(0.145 0 0)',
    popover: 'oklch(1 0 0)',
    'popover-foreground': 'oklch(0.145 0 0)',
    primary: 'oklch(0.205 0 0)',
    'primary-foreground': 'oklch(0.985 0 0)',
    secondary: 'oklch(0.97 0 0)',
    'secondary-foreground': 'oklch(0.205 0 0)',
    muted: 'oklch(0.97 0 0)',
    'muted-foreground': 'oklch(0.556 0 0)',
    accent: 'oklch(0.97 0 0)',
    'accent-foreground': 'oklch(0.205 0 0)',
    destructive: 'oklch(0.577 0.245 27.325)',
    border: 'oklch(0.922 0 0)',
    input: 'oklch(0.922 0 0)',
    ring: 'oklch(0.708 0 0)',
    sidebar: 'oklch(0.985 0 0)',
    'sidebar-foreground': 'oklch(0.145 0 0)',
    'sidebar-primary': 'oklch(0.205 0 0)',
    'sidebar-primary-foreground': 'oklch(0.985 0 0)',
    'sidebar-accent': 'oklch(0.97 0 0)',
    'sidebar-accent-foreground': 'oklch(0.205 0 0)',
    'sidebar-border': 'oklch(0.922 0 0)',
    'sidebar-ring': 'oklch(0.708 0 0)',
  },
  dark: {
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.985 0 0)',
    card: 'oklch(0.205 0 0)',
    'card-foreground': 'oklch(0.985 0 0)',
    popover: 'oklch(0.205 0 0)',
    'popover-foreground': 'oklch(0.985 0 0)',
    primary: 'oklch(0.922 0 0)',
    'primary-foreground': 'oklch(0.205 0 0)',
    secondary: 'oklch(0.269 0 0)',
    'secondary-foreground': 'oklch(0.985 0 0)',
    muted: 'oklch(0.269 0 0)',
    'muted-foreground': 'oklch(0.708 0 0)',
    accent: 'oklch(0.269 0 0)',
    'accent-foreground': 'oklch(0.985 0 0)',
    destructive: 'oklch(0.704 0.191 22.216)',
    border: 'oklch(1 0 0 / 10%)',
    input: 'oklch(1 0 0 / 15%)',
    ring: 'oklch(0.556 0 0)',
    sidebar: 'oklch(0.205 0 0)',
    'sidebar-foreground': 'oklch(0.985 0 0)',
    'sidebar-primary': 'oklch(0.488 0.243 264.376)',
    'sidebar-primary-foreground': 'oklch(0.985 0 0)',
    'sidebar-accent': 'oklch(0.269 0 0)',
    'sidebar-accent-foreground': 'oklch(0.985 0 0)',
    'sidebar-border': 'oklch(1 0 0 / 10%)',
    'sidebar-ring': 'oklch(0.556 0 0)',
  },
} as const

const stories = readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8')
const storyBlock = (selector: string) => {
  const start = stories.indexOf(`\n${selector} {`)
  return stories.slice(start, stories.indexOf('\n}', start))
}
const storyValue = (block: string, role: string) =>
  new RegExp(`\\n\\s*--${role}:\\s*([^;]+);`).exec(block)?.[1]

describe('палитра темы', () => {
  it('PN1: каждый цветной --tsr-ref-* равен значению Tailwind v4, исключения — с причиной', () => {
    expect(refs.size).toBeGreaterThanOrEqual(20)
    const mismatched = [...refs].filter(
      ([name, value]) =>
        !(name in OUTSIDE_TAILWIND) &&
        value !== tailwindValue(tailwindName(name)),
    )
    expect(mismatched).toEqual([])
    // База без устаревших записей: токен есть и по-прежнему вне шкалы.
    expect(
      Object.keys(OUTSIDE_TAILWIND).filter(
        name =>
          !refs.has(name) ||
          refs.get(name) === tailwindValue(tailwindName(name)),
      ),
    ).toEqual([])
  })

  it('PN7: палитра историй равна стандартной теме shadcn, синий — запасному значению таблицы', () => {
    for (const [mode, selector] of [
      ['light', ':root'],
      ['dark', '.dark'],
    ] as const) {
      const block = storyBlock(selector)
      for (const [role, value] of Object.entries(SHADCN_THEME[mode])) {
        expect(storyValue(block, role), `${mode}: ${role}`).toBe(value)
      }
    }
    expect(storyValue(storyBlock(':root'), 'info')).toBe(refs.get('blue-600'))
    expect(storyValue(storyBlock('.dark'), 'info')).toBe(refs.get('blue-400'))
  })

  it('PN6: база нарушений матрицы контраста пуста на запасной палитре и стандартной теме shadcn', () => {
    expect(
      JSON.parse(
        readFileSync(
          join(ROOT, 'src/lib/stories/__tests__/visual/contrast-baseline.json'),
          'utf8',
        ),
      ),
    ).toEqual({})
  })

  it('PN2: запасные значения ролей с мостом равны стандартной теме shadcn в обеих темах', () => {
    expect([
      ...differs(lightBlock, SHADCN.light)('light'),
      ...differs(darkBlock, SHADCN.dark)('dark'),
    ]).toEqual([])
    // Светлая тема по атрибуту на тёмной странице — те же значения.
    const forcedLight = theme.slice(
      theme.indexOf(
        '--tsr-sys-fg: var(--tsr-ref-',
        theme.indexOf('Tier 3 — COMPONENT'),
      ),
    )
    for (const [role, property] of [
      ['foreground', 'fg'],
      ['background', 'bg'],
      ['card', 'surface'],
      ['muted', 'muted'],
      ['primary', 'accent'],
      ['primary-foreground', 'accent-fg'],
      ['destructive', 'danger'],
    ] as const) {
      expect(forcedLight, role).toContain(
        `--tsr-sys-${property}: var(--tsr-ref-${fallbackOf(lightBlock, role)});`,
      )
    }
  })
})

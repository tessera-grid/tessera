import { describe, expect, test } from 'vitest'

import themeCss from '../../../core/themeVariables/theme.css?raw'

// Статические инварианты токен-системы по ИСХОДНИКАМ. Дополняют
// dist-инварианты TI-01…04 (scripts/check-theme-dist.mjs, по артефакту сборки).
// Читают theme.css и все *.module.css как строки (?raw) — так тест ловит
// структурные баги (опечатки токенов, нарушение направления ссылок, забытый
// dark), которые рантайм-проверки цвета не видят.

// Все CSS-модули библиотеки как сырой текст.
const moduleCss = import.meta.glob('../../../**/*.module.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Рантайм-переменные: задаются инлайн в DataGrid/хуках, а не в theme.css.
const RUNTIME_ALLOWLIST = new Set([
  '--tsr-comp-head-height',
  '--tsr-comp-body-height',
  '--tsr-comp-scrollbar-actual-width',
])

const matchAll = (css: string, re: RegExp) =>
  [...css.matchAll(re)].map(m => m[1])

describe('Token architecture — static invariants', () => {
  test('TI-05: every `var(--tsr-comp-*)` used in CSS is defined in theme.css', () => {
    const defined = new Set(matchAll(themeCss, /(--tsr-comp-[a-z0-9-]+)\s*:/g))
    const used = new Set<string>()
    for (const css of Object.values(moduleCss)) {
      matchAll(css, /var\(\s*(--tsr-comp-[a-z0-9-]+)/g).forEach(t =>
        used.add(t),
      )
    }
    const orphans = [...used].filter(
      t => !defined.has(t) && !RUNTIME_ALLOWLIST.has(t),
    )
    // Пустой список = нет «висячих» токенов (опечатка → элемент молча без стиля).
    expect(orphans).toEqual([])
  })

  test('TI-06: component tokens reference only semantic (no shadcn / color-primitive)', () => {
    // Однонаправленность comp → sys (для ЦВЕТА): в значениях `--tsr-comp-*`
    // нет прямых shadcn-имён и цветовых примитивов. Размерные примитивы
    // (--tsr-ref-space/radius) разрешены.
    const forbidden =
      /var\(\s*--(foreground|background|card|muted|primary|primary-foreground|border|ring|destructive|info)\b|var\(\s*--tsr-ref-(neutral|blue|red)/
    const offending = [
      ...themeCss.matchAll(/(--tsr-comp-[a-z0-9-]+)\s*:\s*([\s\S]*?);/g),
    ]
      .filter(m => forbidden.test(m[2]))
      .map(m => m[1])
    expect(offending).toEqual([])
  })

  test('TI-06b: semantic tokens do not reference component (no upward refs)', () => {
    const offending = [
      ...themeCss.matchAll(/(--tsr-sys-[a-z0-9-]+)\s*:\s*([\s\S]*?);/g),
    ]
      .filter(m => /var\(\s*--tsr-comp-/.test(m[2]))
      .map(m => m[1])
    expect(offending).toEqual([])
  })

  test('TI-07: every theme-dependent semantic role is defined in the dark block', () => {
    const BASE_ROLES = [
      '--tsr-sys-fg',
      '--tsr-sys-bg',
      '--tsr-sys-surface',
      '--tsr-sys-muted',
      '--tsr-sys-accent',
      '--tsr-sys-accent-fg',
      '--tsr-sys-border',
      '--tsr-sys-ring',
      '--tsr-sys-danger',
      '--tsr-sys-info',
    ]
    const darkBlock = themeCss.match(
      /:where\(\.data-grid-theme\.dark\)[\s\S]*?\{([\s\S]*?)\}/,
    )?.[1]
    expect(darkBlock, 'dark block not found in theme.css').toBeTruthy()
    const missing = BASE_ROLES.filter(
      r => !new RegExp(`${r}\\s*:`).test(darkBlock!),
    )
    expect(missing).toEqual([])
  })
})

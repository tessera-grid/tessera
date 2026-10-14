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

// Все CSS библиотеки, включая глобальные (не модули), — для стража HC11.
const allCss = import.meta.glob('../../../**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const FORCED_COLORS = /@media\s*\(\s*forced-colors\s*:\s*active\s*\)/

/** CSS без комментариев и без блоков `@media (forced-colors: active)`. */
const outsideForcedColors = (css: string) => {
  let text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (;;) {
    const start = text.search(FORCED_COLORS)
    if (start < 0) return text
    let depth = 0
    let end = text.indexOf('{', start)
    for (; end < text.length; end++) {
      if (text[end] === '{') depth++
      else if (text[end] === '}' && --depth === 0) break
    }
    text = text.slice(0, start) + text.slice(end + 1)
  }
}

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
      /var\(\s*--(foreground|background|card|muted|primary|primary-foreground|border|ring|destructive|info|warning|success)\b|var\(\s*--tsr-ref-(neutral|blue|red|amber|green)/
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
      '--tsr-sys-warning',
      '--tsr-sys-success',
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

  test('HC11: системные цвета и `forced-color-adjust` — только под `@media (forced-colors: active)`', () => {
    // Высокая контрастность (ADR 0087): вне режима вид грида прежний.
    const SYSTEM =
      /(?<![-\w])(Canvas|CanvasText|Highlight|HighlightText|Mark|MarkText|GrayText|ButtonText|ButtonFace|ButtonBorder|forced-color-adjust)(?![-\w])/
    const offending = Object.entries(allCss)
      .filter(([, css]) => SYSTEM.test(outsideForcedColors(css)))
      .map(([file]) => file)
    expect(offending).toEqual([])
    // Правила режима есть: страж не проходит вхолостую.
    expect(Object.values(allCss).some(css => FORCED_COLORS.test(css))).toBe(
      true,
    )
  })

  test('HL22: highlight tokens reference only semantic roles; no built-in tone sits on --tsr-sys-info; the arrival tone is exactly the row arrival colour', () => {
    // Подсветка (ADR 0080): заливки тонов — от ролей темы, синий занят
    // выделением ячеек и приходом. Тон `arrival` — вспышка перенесённой колонки, тот же
    // приход, что у строки (ADR 0114, §4).
    const all = [
      ...themeCss.matchAll(
        /(--tsr-comp-highlight-[a-z0-9-]+)\s*:\s*([\s\S]*?);/g,
      ),
    ]
    const arrival = all.find(m => m[1] === '--tsr-comp-highlight-arrival-bg')
    expect(arrival?.[2]?.trim()).toBe('var(--tsr-comp-row-arrival-color)')
    const tokens = all.filter(m => m !== arrival)
    expect(tokens.map(m => m[1])).toEqual(
      expect.arrayContaining([
        '--tsr-comp-highlight-danger-bg',
        '--tsr-comp-highlight-warning-bg',
        '--tsr-comp-highlight-success-bg',
      ]),
    )
    const refs = tokens.flatMap(m =>
      [...m[2]!.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map(r => r[1]!),
    )
    expect(refs.filter(ref => !ref.startsWith('--tsr-sys-'))).toEqual([])
    expect(refs).not.toContain('--tsr-sys-info')
  })
})

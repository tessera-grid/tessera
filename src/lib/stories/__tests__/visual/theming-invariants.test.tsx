import { describe, expect, test } from 'vitest'

import themeCss from '../../../ui/theme/theme.css?raw'

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
  '--tsr-comp-grid-max-height',
])

// Исходники TS/TSX библиотеки без историй и тестов — стили в `style` (TI-08).
const librarySources = import.meta.glob(
  ['../../../**/*.{ts,tsx}', '!../../../stories/**', '!../../../__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Токен компонента в значении — с литералом-фолбэком или без. */
const COMP_VAR = /var\(\s*--tsr-comp-[a-z0-9-]+\s*(?:,[^()]*)?\)/g

/** Скругление без литерала длины: токены и `calc` над ними, `inherit`, `0`, круг `50%`. */
const isTokenRadius = (value: string) => {
  const v = value.trim()
  if (/^(0|50%|inherit)$/.test(v)) return true
  const rest = v.replace(COMP_VAR, '§').replace(/calc/g, '')
  return rest.includes('§') && /^[§\s()+\-*/]*$/.test(rest)
}

// Постоянные радиусы — формы и геометрия, а не скругление темы (T-R11).
const FIXED_RADII: Record<string, string> = {
  '--tsr-comp-radius-pill':
    'форма: пилюля переключателя, бабла и полосы прокрутки',
  '--tsr-comp-button-radius-circle': 'форма: круглая кнопка (ADR 0098)',
  '--tsr-comp-radio-radius': 'форма: кружок радио (ADR 0183)',
  '--tsr-comp-resize-handler-radius': 'форма: концы черты грипа (ADR 0017)',
  '--tsr-comp-checkbox-radius':
    'флажок 16px держит 4px при любом радиусе темы, как у shadcn (ADR 0017)',
  '--tsr-comp-skeleton-radius':
    'полоска скелета — штрих текста, а не контрол (ADR 0017, SK3)',
  '--tsr-comp-tree-line-radius':
    'геометрия: поворот ветки 10px (ADR 0102, ADR 0133)',
}

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

  test('HL22: highlight tokens reference only semantic roles; no built-in tone sits on --tsr-sys-info', () => {
    // Подсветка (ADR 0080): заливки тонов — от ролей темы, синий занят выделением
    // ячеек и вспышкой прихода (ADR 0134).
    const tokens = [
      ...themeCss.matchAll(
        /(--tsr-comp-highlight-[a-z0-9-]+)\s*:\s*([\s\S]*?);/g,
      ),
    ]
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

  test('TI-08: border-radius in library CSS and TSX styles is a token, inherit, 0 or 50% — no length literal', () => {
    const fromCss = Object.entries(allCss)
      .filter(([path]) => !path.includes('/stories/'))
      .flatMap(([path, css]) =>
        [
          ...stripComments(css).matchAll(
            /(?<![\w-])border(?:-[a-z]+)*-radius\s*:\s*([^;{}]+)/g,
          ),
        ].map(m => [path, m[1]!.trim()] as const),
      )
    const fromTsx = Object.entries(librarySources).flatMap(([path, source]) =>
      [...source.matchAll(/\bborderRadius\s*:\s*([^,\n}]+)/g)].map(m => {
        const quoted = /^(['"`])([^$]*)\1$/.exec(m[1]!.trim())
        return [path, quoted ? quoted[2]! : m[1]!.trim()] as const
      }),
    )
    // Страж видит скругления CSS и просматривает исходники TSX.
    expect(fromCss.length).toBeGreaterThan(10)
    expect(Object.keys(librarySources).length).toBeGreaterThan(100)
    expect(
      [...fromCss, ...fromTsx]
        .filter(([, value]) => !isTokenRadius(value))
        .map(([path, value]) => `${path}: ${value}`),
    ).toEqual([])
  })

  test('TI-10: font-size in library CSS is a --tsr-comp-* token or inherit — no literal', () => {
    const sizes = Object.entries(allCss)
      .filter(([path]) => !path.includes('/stories/'))
      .flatMap(([path, css]) =>
        [
          ...stripComments(css).matchAll(
            /(?<![\w-])font-size\s*:\s*([^;{}]+)/g,
          ),
        ].map(m => [path, m[1]!.trim()] as const),
      )
    expect(sizes.length).toBeGreaterThan(10)
    const tokenOnly = (value: string) => {
      if (value === 'inherit') return true
      const rest = value.replace(COMP_VAR, '§').replace(/calc/g, '')
      return rest.includes('§') && /^[§\s()+\-*/0-9.]*$/.test(rest)
    }
    expect(
      sizes
        .filter(([, value]) => !tokenOnly(value))
        .map(([path, value]) => `${path}: ${value}`),
    ).toEqual([])
  })

  test('TI-09: component radius tokens derive from a --tsr-sys-radius* role; fixed ones are listed with a reason', () => {
    const tokens = [
      ...stripComments(themeCss).matchAll(
        /(--tsr-comp-[a-z0-9-]*radius[a-z0-9-]*)\s*:\s*([^;]+);/g,
      ),
    ].map(m => [m[1]!, m[2]!] as const)
    const names = tokens.map(([name]) => name)
    expect(Object.keys(FIXED_RADII).filter(n => !names.includes(n))).toEqual([])

    // Токен следует за темой, если доходит ссылками до роли скругления `--tsr-sys-radius*`.
    const fromTheme = new Set(
      [...themeCss.matchAll(/(--tsr-sys-radius[a-z-]*)s*:/g)].map(m => m[1]!),
    )
    expect(fromTheme.size).toBeGreaterThanOrEqual(3)
    for (let grew = true; grew;) {
      grew = false
      for (const [name, value] of tokens) {
        if (fromTheme.has(name)) continue
        const refs = [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/g)]
        if (refs.some(r => fromTheme.has(r[1]!))) {
          fromTheme.add(name)
          grew = true
        }
      }
    }
    expect(names.filter(n => !fromTheme.has(n) && !(n in FIXED_RADII))).toEqual(
      [],
    )
    // Запись списка, ставшая производной от темы, — устаревшая.
    expect(Object.keys(FIXED_RADII).filter(n => fromTheme.has(n))).toEqual([])
  })
})

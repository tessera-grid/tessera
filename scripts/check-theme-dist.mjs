// Инварианты собранной темы (ADR 0018 T-R10 / ADR 0019). Запускать ПОСЛЕ
// `npm run build` — проверяет артефакт `dist/style.css`, который обычные
// (браузерные, по исходникам) тесты не видят. Ровно эти проверки поймали бы
// баг, ушедший в прод: хеширование классов темы CSS-модулями.
//
// TI-01 слой шиппится с рабочими (не захешированными) классами
// TI-02 нет старого префикса --data-grid-
// TI-03 нет засорения глобала дженерик-именами shadcn
// TI-04 все три уровня токенов присутствуют

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const distPath = fileURLToPath(new URL('../dist/style.css', import.meta.url))

let css
try {
  css = readFileSync(distPath, 'utf8')
} catch {
  console.error(
    '[check-theme-dist] dist/style.css не найден — сначала `npm run build`.',
  )
  process.exit(1)
}

const fails = []
const check = (id, ok, msg) => {
  if (!ok) fails.push(`${id}: ${msg}`)
}

// TI-01 — литеральный якорь темы присутствует и НЕ захеширован CSS-модулем.
check(
  'TI-01',
  css.includes(':where(.data-grid-theme)'),
  'нет литерального `:where(.data-grid-theme)` (слой темы не шиппится / переименован)',
)
check(
  'TI-01',
  !/_data-grid-theme_/.test(css),
  'найден захешированный `_data-grid-theme_` — тему затянуло в CSS-модуль (верни глобальный импорт theme.css)',
)

// TI-02 — старый префикс токенов вычищен.
check('TI-02', !css.includes('--data-grid-'), 'остался старый префикс `--data-grid-`')

// TI-03 — грид НЕ определяет дженерик-токены shadcn в глобале (только читает
// их через var). Ищем определения `--<name>:`, а не чтения `var(--<name>,`.
for (const name of [
  'foreground',
  'background',
  'card',
  'muted',
  'primary',
  'border',
  'ring',
  'destructive',
  'info',
]) {
  check(
    'TI-03',
    !new RegExp(`--${name}\\s*:`).test(css),
    `грид определяет дженерик-токен --${name} в глобале (засоряет чужой фреймворк)`,
  )
}

// TI-04 — все три уровня в бандле.
for (const tier of ['--tsr-ref-', '--tsr-sys-', '--tsr-comp-']) {
  check('TI-04', css.includes(tier), `в бандле нет уровня ${tier}*`)
}

if (fails.length) {
  console.error('[check-theme-dist] ПРОВАЛ инвариантов темы:\n  ' + fails.join('\n  '))
  process.exit(1)
}
console.log('[check-theme-dist] OK — TI-01…TI-04 зелёные (dist/style.css).')

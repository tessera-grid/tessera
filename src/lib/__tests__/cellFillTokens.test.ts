import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Страж ADR 0126, FP4: в `forced-colors` заливка состояния доходит до закреплённой ячейки
// токенами её фона, а не правилом, которое красит закреплённую ячейку напрямую.

const GRID = join(__dirname, '..', 'grid')
const MODULES = ['BodyRow/BodyRow.module.css', 'BodyCell/BodyCell.module.css']

/** Токены фона закреплённой ячейки: каждый читает своё правило закрепления. */
const PINNED_TOKENS = [
  '--tsr-comp-cell-pinned-left-bg',
  '--tsr-comp-cell-pinned-right-bg',
  '--tsr-comp-cell-odd-pinned-left-bg',
  '--tsr-comp-cell-odd-pinned-right-bg',
]

/** Заливки состояний; `Canvas` — фон палитры, а не состояние. */
const STATE_FILLS = /^(Highlight|Mark|SelectedItem|AccentColor|ButtonFace)$/

interface Rule {
  selector: string
  declarations: Map<string, string>
}

/** Тело блока с открывающей скобкой на `start`. */
const block = (css: string, start: number) => {
  let depth = 0
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i)
  }
  throw new Error('незакрытый блок')
}

/** Правила верхнего уровня внутри блоков `@media (forced-colors: active)`. */
export const forcedRules = (source: string): Rule[] => {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  for (const match of css.matchAll(
    /@media\s*\(forced-colors:\s*active\)\s*/g,
  )) {
    const body = block(css, match.index! + match[0].length)
    let depth = 0
    let start = 0
    let selector = ''
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '{') {
        if (depth === 0) {
          selector = body.slice(start, i).trim()
          start = i + 1
        }
        depth++
      } else if (body[i] === '}' && --depth === 0) {
        const declarations = new Map<string, string>()
        for (const part of body.slice(start, i).split(';')) {
          const colon = part.indexOf(':')
          if (colon < 0) continue
          declarations.set(
            part.slice(0, colon).trim(),
            part
              .slice(colon + 1)
              .replace('!important', '')
              .trim(),
          )
        }
        rules.push({ selector, declarations })
        start = i + 1
      }
    }
  }
  return rules
}

/** Нарушения FP4 в правилах режима. */
export const fillTokenProblems = (rules: Rule[]) => {
  const problems: string[] = []
  for (const { selector, declarations } of rules) {
    const fill = declarations.get('background-color')
    if (!fill) continue
    if (selector.includes('data-cell-pinned')) {
      problems.push(`${selector}: красит закреплённую ячейку напрямую`)
      continue
    }
    if (!STATE_FILLS.test(fill)) continue
    const missing = PINNED_TOKENS.filter(
      token => declarations.get(token) !== fill,
    )
    if (missing.length) {
      problems.push(`${selector}: ${fill} без ${missing.join(', ')}`)
    }
  }
  return problems
}

describe('Заливки ячейки в forced-colors (ADR 0126)', () => {
  it('FP4: правило, заливающее строку или ячейку системным цветом, задаёт им все токены фона закреплённой ячейки; прямой заливки закреплённой ячейки нет', () => {
    const rules = MODULES.flatMap(file =>
      forcedRules(readFileSync(join(GRID, file), 'utf8')),
    )
    // Холостой проход — не проверка: в модулях есть заливки состояний.
    expect(
      rules.filter(rule =>
        STATE_FILLS.test(rule.declarations.get('background-color') ?? ''),
      ).length,
    ).toBeGreaterThanOrEqual(3)
    expect(fillTokenProblems(rules)).toEqual([])
    // Страж ловит подсаженные нарушения: заливку без токенов и прямую заливку.
    const planted = forcedRules(`@media (forced-colors: active) {
      .row[data-x] { background-color: Mark; --tsr-comp-cell-pinned-bg: Mark; }
      .row > .cell:is([data-cell-pinned='left']) { background-color: Mark !important; }
    }`)
    expect(fillTokenProblems(planted)).toHaveLength(2)
  })
})

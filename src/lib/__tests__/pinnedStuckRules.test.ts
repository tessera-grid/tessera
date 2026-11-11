/**
 * Прилипание закреплённых колонок без пересчёта всего грида (ADR 0213, PZ1): правила с атрибутом
 * прилипания не задают переменных на самом контейнере — переменные наследуются, и смена атрибута
 * пересчитывала бы стили всех потомков грида.
 * Запуск: npx vitest run --project unit pinnedStuckRules
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const LIB = join(__dirname, '..')

const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return name === '__tests__' ? [] : cssFiles(path)
    return name.endsWith('.css') ? [path] : []
  })

interface Rule {
  selector: string
  /** Объявления самого правила, без вложенных. */
  own: string
}

/** Правила файла со вложенными; вложенный селектор с `&` раскрывается через родителя. */
const rulesOf = (css: string): Rule[] => {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const walk = (from: number, parent: string | null): number => {
    let i = from
    let start = from
    while (i < text.length) {
      const char = text[i]
      if (char === '{') {
        const head = text.slice(start, i).trim()
        const selector =
          parent && head.includes('&')
            ? head.replace(/&/g, parent)
            : parent && !head.startsWith('@')
              ? `${parent} ${head}`
              : head
        const rule: Rule = { selector, own: '' }
        rules.push(rule)
        i = walk(i + 1, head.startsWith('@') ? parent : selector)
        start = i
        continue
      }
      if (char === '}') {
        return i + 1
      }
      if (char === ';' && parent !== null) {
        for (let r = rules.length - 1; r >= 0; r--) {
          if (rules[r]!.selector === parent) {
            rules[r]!.own += text.slice(start, i + 1)
            break
          }
        }
        start = i + 1
      }
      i++
    }
    return i
  }
  walk(0, null)
  return rules
}

const STUCK = /\[data-pinned-(?:left|right)-stuck\]\)?$/

describe('Прилипание без пересчёта всего грида (ADR 0213)', () => {
  it('PZ1: правила с атрибутом прилипания не задают переменных на самом контейнере грида — только на ячейках и элементах внутри него', () => {
    const offenders: string[] = []
    for (const file of cssFiles(LIB)) {
      for (const rule of rulesOf(readFileSync(file, 'utf8'))) {
        const onContainer = rule.selector
          .split(',')
          .map(part => part.trim())
          .some(part => STUCK.test(part))
        if (onContainer && /(^|[\s;{])--[\w-]+\s*:/.test(rule.own)) {
          offenders.push(`${relative(LIB, file)}: ${rule.selector}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

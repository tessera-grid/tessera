/**
 * Страж CSS-модулей (ADR 0017, PP10): класс, который через `composes` берёт базовый,
 * не переобъявляет его свойства. У двух классов одной специфичности победил бы тот,
 * что позже в сборке, — а порядок модулей в `dist/style.css`, в Storybook и в тестах
 * разный. Базовый класс открывает такие свойства приватными переменными (`--_item-*`).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const LIB = fileURLToPath(new URL('..', import.meta.url))

const modules = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === 'node_modules' ? [] : modules(path)
    return entry.name.endsWith('.module.css') ? [path] : []
  })

const SIDES = ['top', 'right', 'bottom', 'left'] as const
const BLOCK = ['top', 'bottom']
const INLINE = ['left', 'right']

/** Стороны логического или физического суффикса: `-block`, `-inline-start`, `-top`… */
const sidesOf = (suffix: string): readonly string[] => {
  if (suffix === '') return SIDES
  if (suffix === '-block') return BLOCK
  if (suffix === '-inline') return INLINE
  const side =
    /^-(?:(top|right|bottom|left)|block-(start|end)|inline-(start|end))$/.exec(
      suffix,
    )
  if (!side) return []
  if (side[1]) return [side[1]]
  if (side[2]) return [side[2] === 'start' ? 'top' : 'bottom']
  return [side[3] === 'start' ? 'left' : 'right']
}

const SHORTHANDS: Record<string, readonly string[]> = {
  font: [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'font-variant',
    'font-stretch',
    'line-height',
  ],
  background: [
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
    'background-origin',
    'background-clip',
    'background-attachment',
  ],
  outline: ['outline-color', 'outline-style', 'outline-width'],
  transition: [
    'transition-property',
    'transition-duration',
    'transition-timing-function',
    'transition-delay',
  ],
  gap: ['row-gap', 'column-gap'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  overflow: ['overflow-x', 'overflow-y'],
  inset: SIDES,
}

/** Длинные свойства, которые задаёт объявление `prop`. */
const longhands = (prop: string): readonly string[] => {
  const box = /^(padding|margin)(.*)$/.exec(prop)
  if (box) return sidesOf(box[2]).map(side => `${box[1]}-${side}`)
  const border =
    /^border(-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-(width|style|color))?$/.exec(
      prop,
    )
  if (border) {
    const parts = border[2] ? [border[2]] : ['width', 'style', 'color']
    return sidesOf(border[1] ?? '').flatMap(side =>
      parts.map(part => `border-${side}-${part}`),
    )
  }
  return SHORTHANDS[prop] ?? [prop]
}

const overlaps = (a: string, b: string) => {
  const other = new Set(longhands(b))
  return longhands(a).some(prop => other.has(prop))
}

interface Rule {
  composes: { name: string; file: string }[]
  props: [string, string][]
}

/** Простые правила файла `.класс { … }` верхнего уровня, без вложенных блоков. */
const parse = (file: string) => {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = new Map<string, Rule>()
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open < 0) break
    let depth = 1
    let j = open + 1
    while (depth > 0 && j < css.length) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
      j++
    }
    const name = /^\.([\w-]+)$/.exec(css.slice(i, open).trim())?.[1]
    const body = css.slice(open + 1, j - 1)
    if (name && !body.includes('{')) {
      const rule = rules.get(name) ?? { composes: [], props: [] }
      for (const decl of body.split(';')) {
        const colon = decl.indexOf(':')
        if (colon < 0) continue
        const prop = decl.slice(0, colon).trim()
        const value = decl.slice(colon + 1).trim()
        if (prop !== 'composes') {
          rule.props.push([prop, value])
          continue
        }
        const from = /^(.+?)\s+from\s+['"](.+)['"]$/.exec(value)
        const target = from ? resolve(dirname(file), from[2]) : file
        for (const composed of (from?.[1] ?? value).split(/\s+/)) {
          rule.composes.push({ name: composed, file: target })
        }
      }
      rules.set(name, rule)
    }
    i = j
  }
  return rules
}

const parsed = new Map<string, Map<string, Rule>>()
const rulesOf = (file: string) => {
  if (!parsed.has(file)) parsed.set(file, parse(file))
  return parsed.get(file)!
}

/** Объявления, которые класс получает от базовых, с источником. */
const inherited = (
  file: string,
  name: string,
  seen = new Set<string>(),
): { prop: string; from: string }[] => {
  const key = `${file}#${name}`
  if (seen.has(key)) return []
  seen.add(key)
  const rule = rulesOf(file).get(name)
  if (!rule) return []
  const from = `${relative(LIB, file).replaceAll('\\', '/')} .${name}`
  return [
    ...rule.props.map(([prop]) => ({ prop, from })),
    ...rule.composes.flatMap(c => inherited(c.file, c.name, seen)),
  ]
}

describe('CSS-модули: composes без переобъявлений (ADR 0017)', () => {
  it('PP10: класс, наследующий базовый через composes, не переобъявляет его свойства — вид не зависит от порядка модулей в сборке', () => {
    const conflicts: string[] = []
    for (const file of modules(LIB)) {
      for (const [name, rule] of rulesOf(file)) {
        const base = rule.composes.flatMap(c => inherited(c.file, c.name))
        for (const [prop] of rule.props) {
          if (prop.startsWith('--')) continue
          for (const b of base) {
            if (overlaps(prop, b.prop)) {
              conflicts.push(
                `${relative(LIB, file).replaceAll('\\', '/')} .${name} { ${prop} } × ${b.from} { ${b.prop} }`,
              )
            }
          }
        }
      }
    }
    expect(conflicts).toEqual([])
  })
})

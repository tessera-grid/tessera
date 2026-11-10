/**
 * Одна раскладка шапки (ADR 0207, NV8): в гриде нет раскладки `grid` — ни атрибута
 * `data-layout`, ни правил по нему, ни пропа раскладки; строки шапки — свои боксы.
 * Запуск: npx vitest run --config vitest.node.config.ts oneHeadLayout
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const filesOf = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return name === '__tests__' || name === 'stories' ? [] : filesOf(path)
    return /\.(tsx?|css)$/.test(name) ? [path] : []
  })

describe('Одна раскладка шапки (ADR 0207)', () => {
  it('NV8: раскладки grid нет: нет атрибута data-layout и правил по нему, строки шапки — свои боксы с role="row", а не display: contents', () => {
    const offenders = filesOf(ROOT).filter(path => {
      const source = readFileSync(path, 'utf8')
      return (
        source.includes('data-layout') ||
        source.includes("'grid' | 'flex'") ||
        source.includes("layout === 'grid'")
      )
    })
    expect(offenders.map(path => path.slice(ROOT.length + 1))).toEqual([])

    const headRow = readFileSync(join(ROOT, 'grid/HeadRow.tsx'), 'utf8')
    expect(headRow).toContain('role="row"')
    expect(headRow).not.toMatch(/display:\s*'contents'/)
  })
})

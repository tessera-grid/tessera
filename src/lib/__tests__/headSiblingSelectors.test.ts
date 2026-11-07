/**
 * Страж CSS шапки (ADR 0111, GB13): правило не выбирает заголовок по соседнему заголовку через
 * `:has(+ …)` или `:has(~ …)`. При горизонтальной прокрутке заголовки монтируются и уходят, и
 * такой селектор пересчитывает стили соседей и их потомков на каждый монтаж; отметку
 * соседства ставит грид атрибутом (`data-before-right-pinned`).
 * Запуск: npx vitest run --config vitest.node.config.ts headSiblingSelectors
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const LIB = fileURLToPath(new URL('..', import.meta.url))

const stylesheets = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === 'node_modules' ? [] : stylesheets(path)
    return entry.name.endsWith('.css') ? [path] : []
  })

/** `:has(` с комбинатором соседа и заголовком шапки после него. */
const SIBLING_HEAD_HAS = /:has\(\s*[+~][^)]*head__cell/

describe('Селекторы шапки без соседей через :has (ADR 0111)', () => {
  it('GB13: правила CSS не выбирают заголовок по соседнему заголовку через :has — отметку соседства ставит грид атрибутом', () => {
    const found = stylesheets(LIB).flatMap(path =>
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => SIBLING_HEAD_HAS.test(line))
        .map(({ index }) => `${relative(LIB, path)}:${index + 1}`),
    )
    expect(found).toEqual([])
  })
})

/**
 * Страж полосы прокрутки (ADR 0183, PK17): её вид задаёт одно правило темы, CSS-модули своих
 * полос не объявляют.
 * Запуск: npx vitest run --config vitest.node.config.ts scrollbars
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const LIB = fileURLToPath(new URL('..', import.meta.url))
const THEME = 'ui/theme/theme.css'

const styles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return styles(path)
    return entry.name.endsWith('.css') ? [path] : []
  })

/** Объявление полосы: псевдоэлемент или стандартное свойство, но не токен `--tsr-comp-scrollbar-*`. */
const OWN_SCROLLBAR =
  /::-webkit-scrollbar|(?<![-\w])scrollbar-(width|color)\s*:/

describe('полоса прокрутки (ADR 0183)', () => {
  it('PK17: полоса прокрутки — одна на всё: её вид задаёт одно правило темы для любой области прокрутки внутри .data-grid-theme; ни один CSS-модуль не объявляет ::-webkit-scrollbar, scrollbar-width и scrollbar-color', () => {
    const files = styles(LIB).map(file =>
      relative(LIB, file).replaceAll('\\', '/'),
    )
    const own = files.filter(
      file =>
        file !== THEME &&
        OWN_SCROLLBAR.test(readFileSync(join(LIB, file), 'utf8')),
    )
    expect(own).toEqual([])
    const theme = readFileSync(join(LIB, THEME), 'utf8')
    expect(theme).toMatch(/:where\(\.data-grid-theme\) ::-webkit-scrollbar\b/)
    expect(theme).toMatch(/:where\(\.data-grid-theme\)::-webkit-scrollbar\b/)
  })
})

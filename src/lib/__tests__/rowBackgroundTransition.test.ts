/**
 * Фон строк и ячеек без перехода (ADR 0214, NF1): токен перехода строки и переходы строк, ячеек
 * тела и футера не включают `background-color` — смена прилипания и чётности не запускает анимаций.
 * Запуск: npx vitest run --project unit rowBackgroundTransition
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LIB = join(__dirname, '..')
const read = (path: string) =>
  readFileSync(join(LIB, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Значения объявлений свойства в тексте CSS. */
const values = (css: string, property: string) =>
  [
    ...css.matchAll(
      new RegExp(`(?:^|[;{\\s])${property}\\s*:([^;{}]+)[;}]`, 'g'),
    ),
  ].map(match => match[1]!.replace(/\s+/g, ' ').trim())

const animatesBackground = (value: string) =>
  /(^|[\s,])(background-color|background|all)(?=[\s,]|$)/.test(value)

describe('фон строк и ячеек без перехода (ADR 0214)', () => {
  it('NF1: токен `--tsr-comp-row-transition` и переходы строк, ячеек тела и футера не включают `background-color`', () => {
    const tokens = values(
      read('ui/theme/theme.css'),
      '--tsr-comp-row-transition',
    )
    expect(tokens.length).toBeGreaterThan(0)
    for (const token of tokens)
      expect(animatesBackground(token), token).toBe(false)

    for (const file of [
      'grid/BodyRow/BodyRow.module.css',
      'grid/BodyCell/BodyCell.module.css',
      'grid/FooterCell/FooterCell.module.css',
    ]) {
      const css = read(file)
      const transitions = [
        ...values(css, 'transition'),
        ...values(css, 'transition-property'),
      ]
      expect(transitions.length, file).toBeGreaterThan(0)
      for (const value of transitions)
        expect(animatesBackground(value), `${file}: ${value}`).toBe(false)
    }
  })
})

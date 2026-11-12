/**
 * Сочетания клавиш по коду клавиши (ADR 0220): имя клавиши сочетания и страж сравнений
 * `KeyboardEvent.key` с буквой. Запуск: npx vitest run --config vitest.node.config.ts keyCodes
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { keyComboOf } from '../core/keyboardActions'
import { findKeyboardAction } from '../core/keyboardNavigation/actions'

const LIB = join(__dirname, '..')

/** Исходники библиотеки и историй без тестов. */
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : sources(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })

const combo = (init: {
  key: string
  code?: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}) =>
  keyComboOf({
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...init,
  })

describe('сочетания клавиш по коду клавиши (ADR 0220)', () => {
  it("KC2: keyComboOf берёт букву и цифру сочетания из кода клавиши (KeyK — k, Digit1 и Numpad1 — 1), прочие клавиши — из key; действие с keys: ['Alt+Shift+K'] срабатывает на Alt+Shift+K с любой буквой", () => {
    // Русская раскладка, Option на macOS, Shift — одна и та же клавиша.
    expect(combo({ key: 'л', code: 'KeyK', altKey: true })).toBe('Alt+k')
    expect(combo({ key: '˚', code: 'KeyK', altKey: true })).toBe('Alt+k')
    expect(
      combo({ key: 'Л', code: 'KeyK', altKey: true, shiftKey: true }),
    ).toBe('Alt+Shift+k')
    // Цифра — по коду: на AZERTY без Shift верхний ряд даёт символ.
    expect(combo({ key: '&', code: 'Digit1', altKey: true })).toBe('Alt+1')
    expect(combo({ key: '1', code: 'Numpad1', altKey: true })).toBe('Alt+1')
    // Клавиши без буквы — как были.
    expect(
      combo({
        key: 'ArrowUp',
        code: 'ArrowUp',
        altKey: true,
        shiftKey: true,
      }),
    ).toBe('Alt+Shift+ArrowUp')
    expect(combo({ key: ' ', code: 'Space' })).toBe(' ')

    // Ключ действия с заглавной буквой совпадает с сочетанием любой раскладки.
    const action = {
      id: 'mark',
      scope: 'cell' as const,
      keys: ['Alt+Shift+K'],
      run: () => {},
    }
    const table = { getKeyboardActions: () => [action] } as never
    const target = { scope: 'cell' as const, ctx: {} }
    expect(
      findKeyboardAction(
        table,
        target,
        combo({ key: 'Л', code: 'KeyK', altKey: true, shiftKey: true }),
      ),
    ).toBe(action)
    expect(
      findKeyboardAction(
        table,
        target,
        combo({ key: 'K', code: 'KeyL', altKey: true, shiftKey: true }),
      ),
    ).toBeUndefined()
  })

  it('KC3: в коде библиотеки нет сравнения KeyboardEvent.key с буквой или цифрой и сравнения key.toLowerCase() / toUpperCase() события', () => {
    const compared =
      /\.key(?:\.to(?:Lower|Upper)Case\(\))?\s*[!=]==?\s*['"`][A-Za-z0-9]['"`]/
    // Сравнение — сочетание; показ набранного символа сравнением не является.
    const cased = /\.key\.to(?:Lower|Upper)Case\(\)\s*[!=]==?/
    const found = sources(LIB).flatMap(file =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          compared.test(line) || cased.test(line)
            ? [`${relative(LIB, file)}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    )
    expect(found).toEqual([])
  })
})

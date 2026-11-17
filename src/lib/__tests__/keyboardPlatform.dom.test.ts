// @vitest-environment happy-dom
/**
 * Платформа клавиатуры и основной модификатор (ADR 0232, KX11).
 * Запуск: npx vitest run --config vitest.node.config.ts keyboardPlatform
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import {
  detectKeyboardPlatform,
  keyboardPlatformOf,
  primaryModifier,
} from '../core/keyboardPlatform'
import { resolveNavigationKey } from '../core/keyboardNavigation/resolveKey'

const setPlatform = (platform: string, data?: string) => {
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    get: () => platform,
  })
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    get: () => (data === undefined ? undefined : { platform: data }),
  })
}

const key = (name: string, mods: Partial<Record<string, boolean>> = {}) => ({
  key: name,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})

const bounds = (platform: 'apple' | 'other') => ({
  rowCount: 10,
  columnCount: 5,
  pageRows: 3,
  platform,
})

/** Файлы `src/lib` вне тестов и историй. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return name === '__tests__' || name === 'stories' ? [] : sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

const EITHER = /ctrlKey\s*\|\|\s*[\w.]*metaKey|metaKey\s*\|\|\s*[\w.]*ctrlKey/

afterEach(() => setPlatform('Win32', 'Windows'))

describe('Платформа клавиатуры (ADR 0232)', () => {
  test('KX11: основной модификатор — `Cmd` на Apple, `Ctrl` на остальных; второй модификатор сочетание не запускает; платформа — сама и опцией `keyboardPlatform`; в коде нет проверки «`ctrlKey` или `metaKey`»', () => {
    // Сама: userAgentData, без него — navigator.platform.
    setPlatform('Win32', 'macOS')
    expect(detectKeyboardPlatform()).toBe('apple')
    setPlatform('MacIntel')
    expect(detectKeyboardPlatform()).toBe('apple')
    setPlatform('iPad')
    expect(detectKeyboardPlatform()).toBe('apple')
    setPlatform('Linux x86_64', 'Linux')
    expect(detectKeyboardPlatform()).toBe('other')
    setPlatform('Win32')
    expect(detectKeyboardPlatform()).toBe('other')

    // Опцией: явная платформа главнее браузера, `auto` — браузер.
    expect(keyboardPlatformOf({ options: { keyboardPlatform: 'apple' } })).toBe(
      'apple',
    )
    setPlatform('MacIntel')
    expect(keyboardPlatformOf({ options: { keyboardPlatform: 'other' } })).toBe(
      'other',
    )
    expect(keyboardPlatformOf({ options: { keyboardPlatform: 'auto' } })).toBe(
      'apple',
    )
    expect(keyboardPlatformOf({ options: {} })).toBe('apple')

    // Модификатор.
    const cmd = { metaKey: true, ctrlKey: false }
    const ctrl = { metaKey: false, ctrlKey: true }
    const both = { metaKey: true, ctrlKey: true }
    expect(primaryModifier(cmd, 'apple')).toBe(true)
    expect(primaryModifier(ctrl, 'apple')).toBe(false)
    expect(primaryModifier(both, 'apple')).toBe(false)
    expect(primaryModifier(ctrl, 'other')).toBe(true)
    expect(primaryModifier(cmd, 'other')).toBe(false)
    expect(primaryModifier(both, 'other')).toBe(false)

    // Навигация: основной модификатор — к краю, второй — не навигация.
    const at = { rowIndex: 4, columnIndex: 2 }
    expect(
      resolveNavigationKey(
        at,
        key('ArrowRight', { metaKey: true }),
        bounds('apple'),
      ),
    ).toEqual({ rowIndex: 4, columnIndex: 4 })
    expect(
      resolveNavigationKey(
        at,
        key('ArrowRight', { ctrlKey: true }),
        bounds('apple'),
      ),
    ).toBeNull()
    expect(
      resolveNavigationKey(
        at,
        key('ArrowRight', { ctrlKey: true }),
        bounds('other'),
      ),
    ).toEqual({ rowIndex: 4, columnIndex: 4 })
    expect(
      resolveNavigationKey(
        at,
        key('ArrowRight', { metaKey: true }),
        bounds('other'),
      ),
    ).toBeNull()

    // Страж: модификатор проверяется только через модуль платформы.
    const root = join(__dirname, '..')
    const offenders = sources(root)
      .filter(file => !file.endsWith('keyboardPlatform.ts'))
      .filter(file => EITHER.test(readFileSync(file, 'utf8')))
      .map(file => relative(root, file).replace(/\\/g, '/'))
    expect(offenders).toEqual([])
  })
})

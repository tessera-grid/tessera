/**
 * Тесты и истории находят элементы по семантике (ADR 0043, TQ12): роль, `aria-*`, `data-*`,
 * `data-testid` или публичный глобальный класс, а не внутреннее устройство компонента.
 * Запуск: npx vitest run --config vitest.node.config.ts testSelectors
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const LIB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STORIES = join(LIB, 'stories')

/** Исходники тестов, историй, их помощников и обвязки. */
const sources = (dir = STORIES): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === '__screenshots__' ? [] : sources(path)
    return /\.(tsx?|mts)$/.test(entry.name) ? [path] : []
  })

const rel = (path: string) => relative(LIB, path).replace(/\\/g, '/')

/**
 * Импорт CSS-модуля компонента для стенда с его настоящими стилями — только с причиной.
 * Список только сокращается.
 */
const MODULE_IMPORT_BASELINE: Record<string, string> = {
  'stories/__tests__/visual/compact-grid-buttons.test.tsx':
    'стенд обёртки ячейки без грида: кнопки внутри неё по стилям настоящей обёртки (ADR 0135)',
  'stories/UI.LoadingAnimations.stories.tsx':
    'витрина анимаций: статичная поверхность меню с пунктом в ожидании, без открытого Menu',
  'stories/UI.PopupEntry.stories.tsx':
    'список записей с прокруткой журнала: у прокрутки записей нет компонента кита',
  'stories/__tests__/visual/loading-light.test.tsx':
    'стенд дуги ожидания крупного размера на настоящем классе спиннера (ADR 0095, LL4)',
}

const matches = (re: RegExp) =>
  sources().flatMap(path => {
    const text = readFileSync(path, 'utf8')
    return [...text.matchAll(re)].map(m => `${rel(path)}: ${m[0]}`)
  })

describe('Селекторы тестов и историй', () => {
  it('TQ12: элементы находят по роли, aria-*, data-* или публичному классу — не по части имени CSS-модуля, не по классам библиотеки иконок и без импорта CSS-модулей компонентов, кроме базы с причиной', () => {
    expect(sources().length).toBeGreaterThan(100)

    // Часть хешированного имени класса CSS-модуля ломается при любой переделке компонента.
    expect(matches(/\[class\*=[^\]]*\]/g)).toEqual([])

    // Иконки переопределяются пропом `icons`: какая показана — по `data-icon`.
    expect(matches(/['"`]lucide-(?!react['"`])[a-z-]+['"`]/g)).toEqual([])

    const imports = sources().flatMap(path => {
      const text = readFileSync(path, 'utf8')
      return [
        ...text.matchAll(/from\s+['"]([^'"]+\.module\.css)['"]/g),
      ].flatMap(m => {
        const spec = m[1]!
        const target = spec.startsWith('@/lib/')
          ? join(LIB, spec.slice('@/lib/'.length))
          : resolve(dirname(path), spec)
        // Свои модули историй и обвязки — их устройство, не компонента.
        return target.startsWith(STORIES) ? [] : [rel(path)]
      })
    })
    expect(imports.filter(path => !(path in MODULE_IMPORT_BASELINE))).toEqual(
      [],
    )
    // Запись базы, ставшая лишней, — устаревшая.
    expect(
      Object.keys(MODULE_IMPORT_BASELINE).filter(
        path => !imports.includes(path),
      ),
    ).toEqual([])
  })
})

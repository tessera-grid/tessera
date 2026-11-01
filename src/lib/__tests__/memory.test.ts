/**
 * Память вне браузера (ADR 0092): страж кэшей уровня модуля (LK10) и прогон набора
 * утечек на прод-сборке (LK14).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import perfConfig from '../../../vitest.perf.config'

const ROOT = join(__dirname, '..', '..', '..')
const LIB = join(ROOT, 'src', 'lib')

/**
 * Сильные `Map`/`Set` уровня модуля, рост которых ограничен, — с причиной. Кэш по
 * объекту таблицы, данных или колонок — только `WeakMap`/`WeakSet`.
 */
const BOUNDED: Record<string, string> = {
  'core/inputModality.ts:MODIFIER_KEYS': 'константный набор клавиш',
  'core/keyboardNavigation/actions.ts:ACTION_KEYS': 'константный набор клавиш',
  'ui/Popup/useMenuLeave.ts:LEAVING': 'константный набор причин',
  'plugins/columnFiltering/describeFilter.ts:DATE_OPERATORS':
    'константный набор операторов',
  'plugins/columnFiltering/describeFilter.ts:OPTION_OPERATORS':
    'константный набор операторов',
  'util/logger.ts:emitted':
    'тексты выданных предупреждений: их набор конечен — по одному на место в коде',
  'core/dataTypeFormat.ts:partsFormatters':
    'форматтер частей даты на пояс: поясов конечное число',
  'core/dataTypes.ts:BUILT_IN': 'константный набор встроенных типов',
  'core/dataTypeFormat.ts:DATE_BASES': 'константный набор типов дат',
  'util/parseNumber.ts:separators':
    'знаки чисел на язык: языков конечное число',
  'plugins/columnSortingModel/typedSort.ts:collators':
    'сравнение текста на язык: языков конечное число',
  'core/wallTime.ts:formatters':
    'форматтер на часовой пояс: поясов конечное число',
  'core/localization/resolveLabels.ts:COUNT_KEYS':
    'константный набор подписей с параметром count',
  'core/localization/resolveLabels.ts:numberFormats':
    'форматтер чисел на язык: языков конечное число',
  'core/localization/resolveLabels.ts:listFormats':
    'форматтер списков на язык: языков конечное число',
  'core/localization/resolveLabels.ts:pluralRules':
    'правила форм слова на язык: языков конечное число',
}

const MODULE_COLLECTION =
  /^(?:export )?(?:const|let|var) (\w+)(?::[^=]+)? = new (WeakMap|WeakSet|Map|Set)\b/gm

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'stories'
        ? []
        : sources(path)
    }
    return /\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)
      ? [path]
      : []
  })

const strongCollections = () =>
  sources(LIB).flatMap(path => {
    const file = relative(LIB, path).split(sep).join('/')
    return [...readFileSync(path, 'utf8').matchAll(MODULE_COLLECTION)]
      .filter(match => match[2] === 'Map' || match[2] === 'Set')
      .map(match => `${file}:${match[1]}`)
  })

describe('Память', () => {
  it('LK10: каждая Map/Set уровня модуля в src/lib — WeakMap/WeakSet или записана в список ограниченных с причиной', () => {
    const found = strongCollections()
    // Страж видит коллекции уровня модуля — иначе он ничего не проверяет.
    expect(found).toContain('core/wallTime.ts:formatters')
    expect(found.filter(key => !(key in BOUNDED))).toEqual([])
    // Список только сокращается: запись без коллекции в коде — устаревшая.
    expect(Object.keys(BOUNDED).filter(key => !found.includes(key))).toEqual([])
    for (const reason of Object.values(BOUNDED)) {
      expect(reason.trim().length).toBeGreaterThan(10)
    }
  })

  it('LK14: набор memory/ идёт и на прод-сборке React — проект memory-prod в vitest.perf.config.ts', () => {
    const config = perfConfig as {
      mode?: string
      test: {
        projects: { test: { name?: string; include?: string[] } }[]
      }
    }
    expect(config.mode).toBe('production')
    const project = config.test.projects.find(
      item => item.test.name === 'memory-prod',
    )
    expect(project?.test.include).toEqual([
      'src/lib/stories/__tests__/memory/**/*.test.tsx',
    ])
  })
})

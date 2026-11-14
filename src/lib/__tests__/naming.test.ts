/**
 * Стражи правила имён (ADR 0106): аргументы фабрик плагинов, состояние загрузки ядра
 * и старые имена в коде и документации.
 * Запуск: npx vitest run --config vitest.node.config.ts naming
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { pluginFactoryNames } from './builtinPlugins'
import { ENTRY, exportNames, firstParamProps, typeProps } from './publicTypes'

const TYPES_TIMEOUT = 120_000

/** Объект предиката разрешения: `can<Глагол><Объект>`. */
const PREDICATE = /^can[A-Z][a-z]+(Cell|Row|Column|Header|Change)$/

describe('правило имён (ADR 0106)', () => {
  it(
    'FN1: в аргументах фабрик вкл/выкл — только `enabled`, других ключей `enable*` нет',
    () => {
      const factories = pluginFactoryNames()
      expect(factories.length).toBeGreaterThan(20)
      const wrong = factories.flatMap(name => {
        const keys = firstParamProps(ENTRY.plugins, name).map(p => p.name)
        return [
          ...keys
            .filter(key => /^enable/.test(key) && key !== 'enabled')
            .map(key => `${name}.${key}`),
          ...(keys.includes('enabled') ? [] : [`${name}: нет enabled`]),
        ]
      })
      expect(wrong).toEqual([])
    },
    TYPES_TIMEOUT,
  )

  it(
    'FN2: предикаты разрешения — `can<Глагол><Объект>`: canEditCell, canSelectCell, canDragRow',
    () => {
      const predicates = pluginFactoryNames().flatMap(name =>
        firstParamProps(ENTRY.plugins, name)
          .filter(prop => /^can[A-Z]/.test(prop.name))
          .map(prop => ({ ...prop, factory: name })),
      )
      expect(
        predicates
          .filter(prop => !PREDICATE.test(prop.name) || !prop.isFunction)
          .map(prop => `${prop.factory}.${prop.name}: ${prop.type}`),
      ).toEqual([])
      expect(
        Object.fromEntries(predicates.map(prop => [prop.factory, prop.name])),
      ).toMatchObject({
        cellEditing: 'canEditCell',
        cellSelection: 'canSelectCell',
        rowDragging: 'canDragRow',
      })
    },
    TYPES_TIMEOUT,
  )

  it(
    "FN3: состояние загрузки — один параметр `loading: 'initial' | 'refresh' | false`, без enableSkeleton и enableLoading",
    () => {
      const props = typeProps(ENTRY.useCreateTable, 'UseCreateTableParams')
      const names = props.map(prop => prop.name)
      expect(names).not.toContain('enableSkeleton')
      expect(names).not.toContain('enableLoading')
      const loading = props.find(prop => prop.name === 'loading')
      expect(loading?.type.split(' | ').sort()).toEqual([
        '"initial"',
        '"refresh"',
        'false',
      ])
    },
    TYPES_TIMEOUT,
  )

  it(
    'FN4: тайминги обновления — `refreshOptions` с типом `RefreshOptions` из корня пакета',
    () => {
      const names = typeProps(ENTRY.useCreateTable, 'UseCreateTableParams').map(
        prop => prop.name,
      )
      expect(names).toContain('refreshOptions')
      expect(names).not.toContain('loadingOptions')
      const rootExports = exportNames(ENTRY.index)
      expect(rootExports).toContain('RefreshOptions')
      expect(rootExports).not.toContain('LoadingOptions')
    },
    TYPES_TIMEOUT,
  )

  it('FN6: в src, README, docs/architecture и AGENTS.md нет старых имён', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url))
    const OLD =
      /\b(enableSkeleton|enableLoading|loadingOptions|LoadingOptions|canEdit|rowDraggingEnable|cellEditingCanEdit)\b/
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap(name => {
        const path = `${dir}/${name}`
        if (name === 'node_modules' || name === '__screenshots__') return []
        return statSync(path).isDirectory() ? files(path) : [path]
      })
    const scanned = [
      ...files(`${root}src`).filter(path => /\.(tsx?|css|mdx?)$/.test(path)),
      ...files(`${root}docs/architecture`),
      `${root}README.md`,
      `${root}AGENTS.md`,
    ].filter(path => !path.endsWith('__tests__/naming.test.ts'))
    const hits = scanned.flatMap(path =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          OLD.test(line)
            ? [`${path.slice(root.length)}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    )
    expect(hits).toEqual([])
  })
})

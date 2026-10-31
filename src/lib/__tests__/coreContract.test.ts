/**
 * Контракт ядра (ADR 0164): опции ядра одним типом, публичная запись плагина без служебных
 * полей, без хелперов состояния `use*State`.
 * Запуск: npx vitest run --config vitest.node.config.ts coreContract
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { TablePlugin } from '../core/features'
import { useCreateTable } from '../core/useCreateTable'
import { pluginFactories } from './builtinPlugins'
import {
  coreOptionKeys,
  ownTableOptionKeys,
  pluginOptionKeys,
  stockTableOptionKeys,
} from './layerRules'
import { ENTRY, exportNames, typeProps } from './publicTypes'
import { hostTable } from './tableHost'

/** Локальное состояние плагина `definePlugin`: опция `on<plugin:id>Change`. */
const PLUGIN_STATE_OPTION = /^onPlugin:.+Change$/

const TYPES_TIMEOUT = 120_000

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SELF = fileURLToPath(import.meta.url)

/** Поля записи, которые ставят ядро и `definePlugin` (ADR 0164, §3). */
const INTERNAL_FIELDS = [
  'args',
  'argsKey',
  'lifetimeArgs',
  'refreshArgs',
  'controlledState',
  'stateSlices',
  'includedBy',
  'inertReason',
  'configure',
]

const HELPERS = [
  'useColumnOrderState',
  'useColumnPinningState',
  'useRowSelectionState',
  'useColumnSizingState',
  'useExpandedState',
  'useSortingState',
  'useColumnVisibilityState',
  'useGroupingState',
]

const textFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return textFiles(path)
    return /\.(tsx?|md)$/.test(name) ? [path] : []
  })

// Компилируется, только если `useCreateTable` принимает публичные записи (CK3).
const acceptsTablePlugins = (plugins: readonly TablePlugin[]) => () =>
  useCreateTable({ columns: [], data: [] as { id: string }[], plugins })

describe('контракт ядра (ADR 0164)', () => {
  it(
    'CK1: опции ядра — один тип CoreOptions: его ключи есть в CommonOptions и в параметрах useCreateTable с теми же типами; CreateDataGridOptions нет',
    () => {
      const core = typeProps(ENTRY.contract, 'CoreOptions')
      expect(core.map(prop => prop.name)).toContain('loading')
      const sameAs = (
        props: { name: string; type: string; owner?: string }[],
      ) =>
        core.filter(option => {
          const prop = props.find(item => item.name === option.name)
          return !(prop?.type === option.type && prop.owner === 'CoreOptions')
        })
      expect(sameAs(typeProps(ENTRY.contract, 'CommonOptions'))).toEqual([])
      expect(
        sameAs(typeProps(ENTRY.useCreateTable, 'UseCreateTableParams')),
      ).toEqual([])
      expect(exportNames(ENTRY.useCreateTable)).not.toContain(
        'CreateDataGridOptions',
      )
    },
    TYPES_TIMEOUT,
  )

  it(
    'CK2: каждый ключ опций таблицы со всеми встроенными плагинами — стоковый TanStack, опция плагина или ключ CommonOptions; каналы сборки объявлены в CommonOptions',
    () => {
      const table = hostTable({
        columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }],
        plugins: pluginFactories().map(([, factory]) => factory()),
      })
      const keys = Object.keys(table.options)
      const declared = new Set([
        ...stockTableOptionKeys(),
        ...coreOptionKeys(),
        ...ownTableOptionKeys(),
        ...pluginOptionKeys(),
      ])
      for (const key of ['pluginRenderVersion', 'pluginStateListeners']) {
        expect(keys).toContain(key)
        expect(coreOptionKeys()).toContain(key)
      }
      expect(
        keys.filter(
          key => !declared.has(key) && !PLUGIN_STATE_OPTION.test(key),
        ),
      ).toEqual([])
    },
    TYPES_TIMEOUT,
  )

  it(
    'CK3: публичный TablePlugin без полей ядра и definePlugin; useCreateTable принимает TablePlugin[]',
    () => {
      const fields = typeProps(ENTRY.index, 'TablePlugin').map(
        prop => prop.name,
      )
      expect(fields).toEqual(
        expect.arrayContaining(['id', 'features', 'model']),
      )
      expect(INTERNAL_FIELDS.filter(field => fields.includes(field))).toEqual(
        [],
      )
      expect(typeof acceptsTablePlugins([])).toBe('function')
    },
    TYPES_TIMEOUT,
  )

  it(
    'CK4: хелперов use*State нет ни в экспортах пакета, ни в src, README и docs/architecture',
    () => {
      const exported = exportNames(ENTRY.index)
      expect(HELPERS.filter(name => exported.includes(name))).toEqual([])
      const sources = [
        ...textFiles(join(ROOT, 'src')),
        ...textFiles(join(ROOT, 'docs/architecture')),
        join(ROOT, 'README.md'),
        join(ROOT, 'README.ru.md'),
      ].filter(
        path => path !== SELF && statSync(path, { throwIfNoEntry: false }),
      )
      const mentions = sources.flatMap(path => {
        const text = readFileSync(path, 'utf8')
        return HELPERS.filter(name => text.includes(name)).map(
          name => `${relative(ROOT, path).split('\\').join('/')}: ${name}`,
        )
      })
      expect(mentions).toEqual([])
    },
    TYPES_TIMEOUT,
  )
})

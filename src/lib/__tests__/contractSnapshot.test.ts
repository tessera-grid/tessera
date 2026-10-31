/**
 * Стражи контракта (ADR 0163, §6): свои поля колонки не совпадают со стоковыми TanStack,
 * поля колонки, опции ядра и запись плагина совпадают со снимком `contract.snapshot.ts`.
 * Запуск: npx vitest run --config vitest.node.config.ts contractSnapshot
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  COLUMN_DEF_FIELDS,
  CORE_OPTIONS,
  INTERNAL_ENTRY_FIELDS,
  PLUGIN_ENTRY_FIELDS,
} from './contract.snapshot'
import {
  coreOptionKeys,
  internalEntryKeys,
  ownColumnDefFields,
  pluginEntryKeys,
  stockColumnDefFields,
} from './layerRules'

const TYPES_TIMEOUT = 120_000

const ADR_NUMBERS = new Set(
  readdirSync(
    fileURLToPath(new URL('../../../docs/decisions/', import.meta.url)),
  ).flatMap(name => /^(\d{4})-/.exec(name)?.[1] ?? []),
)

describe('контракт колонки и записи плагина (ADR 0163)', () => {
  it(
    'LB6: ни одно своё поле описания колонки не совпадает с полем ColumnDef стоковых фич TanStack',
    () => {
      const own = ownColumnDefFields()
      const stock = stockColumnDefFields()
      // Оба списка настоящие: иначе пересечение пусто всегда.
      expect(own).toContain('dataType')
      expect(stock).toEqual(expect.arrayContaining(['sortFn', 'enablePinning']))
      expect(own.filter(field => stock.includes(field))).toEqual([])
    },
    TYPES_TIMEOUT,
  )

  it(
    'LB8: поля колонки, ключи CommonOptions, поля публичной и внутренней записи плагина совпадают со снимком, у каждого ключа — существующий ADR',
    () => {
      expect({
        columnDef: ownColumnDefFields(),
        coreOptions: coreOptionKeys(),
        pluginEntry: pluginEntryKeys(),
        internalEntry: internalEntryKeys(),
      }).toEqual({
        columnDef: Object.keys(COLUMN_DEF_FIELDS).sort(),
        coreOptions: Object.keys(CORE_OPTIONS).sort(),
        pluginEntry: Object.keys(PLUGIN_ENTRY_FIELDS).sort(),
        internalEntry: Object.keys(INTERNAL_ENTRY_FIELDS).sort(),
      })
      const missing = Object.entries({
        ...COLUMN_DEF_FIELDS,
        ...CORE_OPTIONS,
        ...PLUGIN_ENTRY_FIELDS,
        ...INTERNAL_ENTRY_FIELDS,
      }).filter(([, adr]) => !ADR_NUMBERS.has(adr))
      expect(missing).toEqual([])
    },
    TYPES_TIMEOUT,
  )
})

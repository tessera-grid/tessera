/**
 * Опции плагинов в типах (ADR 0167): каждый ключ `options` объявлен, касты `….options`
 * уходят, владельцы ключей для LB5 и причины базы с шагом аудита.
 * Запуск: npx vitest run --config vitest.node.config.ts pluginOptions
 */
import { describe, expect, it } from 'vitest'

import { FOREIGN_OPTION_READS } from './architecture.baseline'
import {
  foreignOptionReads,
  optionCasts,
  optionOwners,
  sharedUsers,
  undeclaredOptionKeys,
} from './layerRules'

const TYPES_TIMEOUT = 120_000

describe('опции плагинов в типах (ADR 0167)', () => {
  it(
    'PO1: каждый ключ options встроенной записи плагина объявлен в карте фич его фичей или в CommonOptions',
    () => {
      expect(undeclaredOptionKeys()).toEqual([])
    },
    TYPES_TIMEOUT,
  )

  it('PO2: ни один модуль не приводит ….options к типу; база LB9 пуста', () => {
    expect(optionCasts()).toEqual({})
  })

  it(
    'PO4: стоковый ключ фичи — плагинов, которые её приносят, ключи фич ядра общие; модуль shared/ читает опции плагинов, которые его импортируют',
    () => {
      const owners = optionOwners()
      expect([...(owners.get('enableRowSelection') ?? [])].sort()).toEqual([
        'rowSelection',
        'rowSelectionModel',
      ])
      expect(owners.get('enableColumnPinning')).toBeUndefined()
      expect(owners.get('enableFooter')).toBeUndefined()
      expect(owners.get('enableRowDragging')?.has('rowDragging')).toBe(true)
      expect(owners.get('enableExpanding')?.has('rowExpandingModel')).toBe(true)

      const counter = 'lib/shared/filtering/FilteredRowsCount.tsx'
      expect([...(sharedUsers().get(counter) ?? [])].sort()).toEqual([
        'columnFiltering',
        'quickSearch',
      ])
      const reads = foreignOptionReads()
      expect(reads.filter(read => read.startsWith(counter))).toEqual([])
      expect(reads).toContain('lib/grid/DataGridTable.tsx: enableTreeLines')
    },
    TYPES_TIMEOUT,
  )

  it('PO6: причина каждой записи базы LB5 называет шаг аудита 5, 6 или 7', () => {
    expect(
      Object.entries(FOREIGN_OPTION_READS)
        .filter(([, reason]) => !/шаг [567]\b/.test(reason))
        .map(([read]) => read),
    ).toEqual([])
  })
})

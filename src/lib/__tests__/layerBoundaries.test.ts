/**
 * Стражи слоёв (ADR 0163): граф импортов, хозяин модуля ядра, собственные опции плагинов,
 * `ColumnMeta`, касты опций и строка «Слой» в ADR. Нарушения сверяются с базой
 * `architecture.baseline.ts`, которая только сокращается.
 * Запуск: npx vitest run --config vitest.node.config.ts layerBoundaries
 */
import { describe, expect, it } from 'vitest'

import {
  COLUMN_META_AUGMENTATIONS,
  CORE_PLUGIN_API,
  CORE_PLUGIN_ONLY,
  FOREIGN_OPTION_READS,
  LAYER_EDGES,
  OPTION_CASTS,
} from './architecture.baseline'
import {
  adrsWithoutLayer,
  columnMetaAugmentations,
  coreOptionKeys,
  corePluginOnlyModules,
  foreignOptionReads,
  layerViolations,
  optionCasts,
  stockTableOptionKeys,
} from './layerRules'

const TYPES_TIMEOUT = 120_000

/** Нарушения вне базы, записи базы без нарушения и записи без причины. */
const expectBaseline = (
  actual: readonly string[],
  baseline: Record<string, string>,
) => {
  const unlisted = actual.filter(key => !(key in baseline))
  const stale = Object.keys(baseline).filter(key => !actual.includes(key))
  const unexplained = Object.entries(baseline)
    .filter(([, reason]) => reason.length < 10)
    .map(([key]) => key)
  expect({ unlisted, stale, unexplained }).toEqual({
    unlisted: [],
    stale: [],
    unexplained: [],
  })
}

describe('границы слоёв (ADR 0163)', () => {
  it('LB1: ребро в запрещённый слой (и импорт только типов) — только из базы с причиной; запись базы без ребра роняет страж', () => {
    expectBaseline(layerViolations(), LAYER_EDGES)
  })

  it('LB2: модуль ядра, который импортируют только плагины или shared/, — только из базы долга или перечня «API ядра для плагинов» с причиной; модуль в обоих перечнях роняет страж', () => {
    expectBaseline(corePluginOnlyModules(), {
      ...CORE_PLUGIN_ONLY,
      ...CORE_PLUGIN_API,
    })
    expect(
      Object.keys(CORE_PLUGIN_ONLY).filter(path => path in CORE_PLUGIN_API),
    ).toEqual([])
  })

  it(
    'LB5: собственный ключ опций плагина читают только он и его цепочка entry.model; чтение в ядре, гриде и чужом плагине — только из базы',
    () => {
      const foreignKeys = new Set([
        ...stockTableOptionKeys(),
        ...coreOptionKeys(),
      ])
      // Стоковые и ядровые ключи на месте: иначе страж считал бы и их.
      expect(foreignKeys.has('manualFiltering')).toBe(true)
      expect(foreignKeys.has('enableFooter')).toBe(true)
      expect(foreignKeys.has('enableRowDragging')).toBe(false)
      expectBaseline(foreignOptionReads(foreignKeys), FOREIGN_OPTION_READS)
    },
    TYPES_TIMEOUT,
  )

  it('LB7: библиотека не дополняет ColumnMeta, кроме базы с причиной', () => {
    expectBaseline(columnMetaAugmentations(), COLUMN_META_AUGMENTATIONS)
  })

  it('LB9: приведений ….options к any, unknown as и литералу не больше и не меньше базы по модулю', () => {
    expect(optionCasts()).toEqual(
      Object.fromEntries(
        Object.entries(OPTION_CASTS).map(([path, { count }]) => [path, count]),
      ),
    )
    expect(
      Object.entries(OPTION_CASTS)
        .filter(([, { reason }]) => reason.length < 10)
        .map(([path]) => path),
    ).toEqual([])
  })

  it('LB10: ADR с номером больше 0163 несёт в шапке строку «Слой»', () => {
    expect(adrsWithoutLayer(163)).toEqual([])
  })
})

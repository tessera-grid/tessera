// @vitest-environment happy-dom
/**
 * Вспышка при смене значения извне (ADR 0221; VC6, VC12): равенство значения ячейки по типу
 * колонки и итоги смены во вспышке ядра с токенами темы. Поведение на гриде — в
 * `visual/value-change-flash`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { readFlashes } from '../core/flashes/flashFeature'
import { cellHighlightKey } from '../core/highlights/highlightFeature'
import { resolveDataType } from '../core/dataTypes'
import { sameCellValue } from '../shared/cellValues'

const table = {
  options: {
    dataTypes: {
      keyed: { extends: 'object', getKey: (v: { code: string }) => v.code },
    },
  },
}
/** Колонка с типом: тип разрешается так же, как у колонки грида. */
const typed = (dataType: string) => {
  const columnDef = { dataType }
  const column = {
    id: dataType,
    columnDef,
    getDataType: () => resolveDataType(table as never, column as never),
  }
  return column
}

describe('Вспышка при смене значения: равенство', () => {
  it('VC6: дата — по моменту, multiSelect — поэлементно, object — по ключу записи, прочее — Object.is', () => {
    const date = typed('date')
    expect(sameCellValue(table, date, new Date(1000), new Date(1000))).toBe(
      true,
    )
    expect(sameCellValue(table, date, new Date(1000), new Date(2000))).toBe(
      false,
    )
    const multi = typed('multiSelect')
    expect(sameCellValue(table, multi, ['a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameCellValue(table, multi, ['a', 'b'], ['b', 'a'])).toBe(false)
    expect(sameCellValue(table, multi, ['a'], ['a', 'b'])).toBe(false)
    const object = typed('object')
    expect(
      sameCellValue(
        table,
        object,
        { id: 1, label: 'A' },
        { id: 1, label: 'B' },
      ),
    ).toBe(true)
    expect(sameCellValue(table, object, { id: 1 }, { id: 2 })).toBe(false)
    const keyed = typed('keyed')
    expect(sameCellValue(table, keyed, { code: 'q' }, { code: 'q' })).toBe(true)
    const decimal = typed('numberString')
    expect(sameCellValue(table, decimal, '1.50', '1.5')).toBe(true)
    expect(sameCellValue(table, decimal, '1.50', '1.51')).toBe(false)
    const number = typed('number')
    expect(sameCellValue(table, number, 1, 1)).toBe(true)
    expect(sameCellValue(table, number, 1, 2)).toBe(false)
    const text = typed('text')
    expect(sameCellValue(table, text, 'a', 'a')).toBe(true)
    expect(sameCellValue(table, text, 'a', 'A')).toBe(false)
    expect(sameCellValue(table, text, { v: 1 }, { v: 1 })).toBe(false)
  })
})

const makeTable = () => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: [{ id: 'r1', a: 1 }],
    columns: [{ id: 'a', accessorKey: 'a' }],
    getRowId: (row: { id: string }) => row.id,
    ...folded.options,
  } as never) as unknown as {
    flashOutcome: (target: object, outcome: string) => void
  }
}

describe('Вспышка при смене значения: итоги и токены', () => {
  it('VC12: flashOutcome принимает changed, up и down; токены --tsr-comp-flash-changed-bg, -up-bg, -down-bg, -up-color, -down-color, -direction-size — в трёх уровнях темы', () => {
    const grid = makeTable()
    for (const outcome of ['changed', 'up', 'down']) {
      grid.flashOutcome({ cell: ['r1', 'a'] }, outcome)
      expect(readFlashes(grid)[cellHighlightKey('r1', 'a')]?.outcome).toBe(
        outcome,
      )
    }
    const css = readFileSync(
      join(process.cwd(), 'src/lib/ui/theme/theme.css'),
      'utf8',
    )
    const declared = new Map(
      [...css.matchAll(/(--tsr-comp-flash-[a-z-]+)\s*:\s*([^;]+);/g)].map(
        match => [match[1]!, match[2]!],
      ),
    )
    const added = [
      '--tsr-comp-flash-changed-bg',
      '--tsr-comp-flash-up-bg',
      '--tsr-comp-flash-down-bg',
      '--tsr-comp-flash-up-color',
      '--tsr-comp-flash-down-color',
      '--tsr-comp-flash-direction-size',
    ]
    expect([...declared.keys()]).toEqual(expect.arrayContaining(added))
    // Компонентный уровень ссылается на системный, системная роль — на опорный в обеих темах.
    const refs = added.flatMap(name =>
      [...declared.get(name)!.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map(
        match => match[1]!,
      ),
    )
    expect(refs.filter(ref => !ref.startsWith('--tsr-sys-'))).toEqual([])
    const roles = [
      ...css.matchAll(/--tsr-sys-changed:\s*var\((--tsr-ref-[a-z0-9-]+)\)/g),
    ].map(match => match[1])
    expect(roles.length).toBeGreaterThanOrEqual(2)
    expect(new Set(roles).size).toBeGreaterThanOrEqual(2)
  })
})

/**
 * Cutover — headless-проверка grid-хелперов ширин/sticky-offset (start/end).
 * Запуск: npx vitest run --config vitest.v9.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnPinning } from '../plugins/columnPinning'
import { columnSizing } from '../plugins/columnSizing'
import {
  buildColumnSizeVars,
  getColumnSizeVariable,
  getPinnedStartOffset,
} from '../grid/columnSizes'

const makeTable = () => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    columnPinning(),
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  const table = constructTable({
    features,
    data: [{ id: '1', a: 1, b: 2, c: 3 }],
    columns: [
      { id: 'a', accessorKey: 'a', size: 150 },
      { id: 'b', accessorKey: 'b', size: 100 },
      { id: 'c', accessorKey: 'c', size: 80 },
    ],
    getRowId: (row: any) => row.id,
    ...folded.options,
  } as never) as any
  return table
}

describe('Cutover — columnSizes (start/end sticky-offset)', () => {
  it('buildColumnSizeVars отдаёт --col-/-header- переменные', () => {
    const vars = buildColumnSizeVars(makeTable())
    expect(vars[getColumnSizeVariable('a')]).toBe('150px')
    expect(vars[getColumnSizeVariable('b')]).toBe('100px')
  })

  it('getPinnedStartOffset суммирует ширины закреплённых листьев до текущего', () => {
    const table = makeTable()
    table.setColumnPinning({ start: ['a', 'b'], end: [] })

    expect(table.getStartVisibleLeafColumns().map((c: any) => c.id)).toEqual(['a', 'b'])

    // Первая закреплённая — смещение 0.
    expect(getPinnedStartOffset(table, table.getColumn('a'))).toBe('0px')
    // Вторая — смещение на ширину первой.
    expect(getPinnedStartOffset(table, table.getColumn('b'))).toBe(
      'calc(var(--col-a-size))',
    )
  })
})

/**
 * Headless-проверка grid-хелперов ячейки: пиннинг-флаги (start/end) и отступ
 * вложенности. Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnPinning } from '../plugins/columnPinning'
import { columnSizing } from '../plugins/columnSizing'
import { rowExpanding } from '../plugins/rowExpanding'
import { getCellPinningParams } from '../grid/cellPinningParams'
import { getCellExpandingStyles } from '../grid/cellExpandingStyles'

const build = (entries: any[], userCols: any[]) => {
  const all = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...entries,
  ]
  const features = buildTesseraFeatures(all as never)
  const folded = foldEntries(all)
  const columns = injectServiceColumns(userCols, folded.serviceColumns)
  return constructTable({
    features,
    data: [{ id: '1', a: 1, b: 2, c: 3, d: 4, subRows: [] }],
    columns,
    getRowId: (row: any) => row.id,
    getSubRows: (row: any) => row.subRows,
    ...folded.options,
  } as never) as any
}

describe('getCellPinningParams (start/end)', () => {
  const cols = ['a', 'b', 'c', 'd'].map(id => ({
    id,
    accessorKey: id,
    size: 100,
  }))

  it('start-блок: первая и последняя закреплённые', () => {
    const table = build([columnPinning(), columnSizing()], cols)
    table.setColumnPinning({ start: ['a', 'b'], end: ['d'] })

    const a = getCellPinningParams(table, table.getColumn('a'))
    expect(a.isStartPinned).toBe(true)
    expect(a.isLastStartPinnedColumn).toBe(false)
    expect(a.startPinnedOffset).toBe('0px')

    const b = getCellPinningParams(table, table.getColumn('b'))
    expect(b.isLastStartPinnedColumn).toBe(true)
    expect(b.startPinnedOffset).toBe('calc(var(--col-a-size))')
  })

  it('end-блок: одиночная закреплённая справа', () => {
    const table = build([columnPinning(), columnSizing()], cols)
    table.setColumnPinning({ start: [], end: ['d'] })

    const d = getCellPinningParams(table, table.getColumn('d'))
    expect(d.isEndPinned).toBe(true)
    expect(d.isFirstEndPinnedColumn).toBe(true)
    expect(d.isLastEndPinnedColumn).toBe(true)
    expect(d.isAloneEndPinnedColumn).toBe(true)
  })

  it('незакреплённая колонка: все флаги false, смещения undefined', () => {
    const table = build([columnPinning(), columnSizing()], cols)
    table.setColumnPinning({ start: ['a'], end: [] })
    const c = getCellPinningParams(table, table.getColumn('c'))
    expect(c).toMatchObject({
      isStartPinned: false,
      isEndPinned: false,
      startPinnedOffset: undefined,
      endPinnedOffset: undefined,
    })
  })
})

describe('getCellExpandingStyles', () => {
  it('отступ вложенности на первой пользовательской колонке (не сервисной)', () => {
    const table = build(
      [rowExpanding()],
      [
        { id: 'a', accessorKey: 'a' },
        { id: 'b', accessorKey: 'b' },
      ],
    )

    const first = getCellExpandingStyles({
      column: table.getColumn('a'),
      rowDepth: 2,
      table,
    })
    expect(first.paddingLeft).toBe(64) // 32 * 2

    const second = getCellExpandingStyles({
      column: table.getColumn('b'),
      rowDepth: 2,
      table,
    })
    expect(second.paddingLeft).toBeUndefined()
  })
})

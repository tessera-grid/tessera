/**
 * Headless-проверка плагина columnDragging.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnDragging } from '../plugins/columnDragging'
import {
  neighboursOf,
  reconcileColumnMoves,
  restoreBlock,
  settleColumnMove,
} from '../plugins/columnDragging/commitColumnMove'
import { captureInertWarnings } from './inertWarnings'

const makeTable = (columns: any[], options: Record<string, unknown> = {}) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnDragging(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)

  const table = constructTable({
    features,
    data: [{ id: '1', a: 1, b: 2 }],
    columns,
    getRowId: (row: any) => row.id,
    ...folded.options,
    ...options,
  } as never) as any

  return { table, folded }
}

const flatCols = [
  { id: 'a', accessorKey: 'a', enableDragging: true },
  { id: 'b', accessorKey: 'b', enableDragging: false },
]

describe('columnDragging', () => {
  const warnings = captureInertWarnings()

  it('foldEntries: опция и слот-ручка в leftHeaderSlot', () => {
    const { folded } = makeTable(flatCols)
    expect(folded.options).toMatchObject({ enableColumnDragging: true })
    expect(folded.slots.leftHeaderSlot.map(s => s.id)).toContain(
      'columnDraggingPlugin',
    )
  })

  it('состояние: columnDraggingActiveId по умолчанию null, updater пишет в атом', () => {
    const { table } = makeTable(flatCols)
    expect(table.atoms.columnDraggingActiveId.get()).toBe(null)

    table.options.onColumnDraggingActiveIdChange('a')
    expect(table.atoms.columnDraggingActiveId.get()).toBe('a')
  })

  it('getCanDrag (плоская шапка): по флагу enableDragging колонки', () => {
    const { table } = makeTable(flatCols)
    const [a, b] = table.getAllLeafColumns()
    expect(a.getCanDrag()).toBe(true)
    expect(b.getCanDrag()).toBe(false)
    expect(a.getDraggableIndex()).toBe(0)
  })

  it('ND6: под вложенной шапкой перетаскиваемость узла — флаг enableDragging его columnDef; листья группы следуют своим флагам, без предупреждений', () => {
    const { table } = makeTable([
      {
        id: 'grp',
        header: 'G',
        enableDragging: true,
        columns: [
          { id: 'a', accessorKey: 'a', enableDragging: true },
          { id: 'c', accessorKey: 'c' },
        ],
      },
      {
        id: 'plain',
        header: 'P',
        columns: [{ id: 'd', accessorKey: 'd', enableDragging: true }],
      },
    ])
    expect(table.getHeaderGroups().length).toBeGreaterThan(1)
    const find = (id: string) => table.getColumn(id)
    expect(find('grp').getCanDrag()).toBe(true)
    expect(find('a').getCanDrag()).toBe(true)
    expect(find('c').getCanDrag()).toBe(false)
    expect(find('plain').getCanDrag()).toBe(false)
    expect(find('d').getCanDrag()).toBe(true)
    expect(warnings()).toHaveLength(0)
  })
})

describe('columnDragging — асинхронный перенос (ADR 0114)', () => {
  const columns = ['a', 'b', 'c', 'd'].map(id => ({
    id,
    accessorKey: id,
    enableDragging: true,
  }))
  const flush = () => new Promise(resolve => setTimeout(resolve, 0))

  it('CO4: откат идёт через setColumnOrder — контролируемое состояние получает его в onColumnOrderChange: узел у прежних соседей, другие переносы сохранены', async () => {
    const onColumnOrderChange = vi.fn()
    const { table } = makeTable(columns, { onColumnOrderChange })
    // Узел `a` перенесён за `c`; прежние соседи — справа `b`.
    let reject!: (reason: unknown) => void
    settleColumnMove(
      table,
      'a',
      { leaves: ['a'], ...neighboursOf(['a', 'b', 'c', 'd'], ['a']) },
      new Promise((_, fail) => (reject = fail)),
    )
    reject(new Error('no'))
    await flush()
    expect(onColumnOrderChange).toHaveBeenCalledTimes(1)
    const updater = onColumnOrderChange.mock.calls[0]![0] as (
      prev: string[],
    ) => string[]
    expect(updater(['b', 'c', 'a', 'd'])).toEqual(['a', 'b', 'c', 'd'])
    // Пока ждали, `c` встал перед `b` — этот перенос сохраняется.
    expect(updater(['c', 'b', 'a', 'd'])).toEqual(['c', 'a', 'b', 'd'])
    // Соседа справа больше нет — после соседа слева.
    expect(
      restoreBlock(['d', 'c'], { leaves: ['a', 'b'], after: 'd' }),
    ).toEqual(['d', 'a', 'b', 'c'])
  })

  it('CO5: узел, ушедший из модели, снимает ожидание; поздний итог промиса ничего не откатывает', async () => {
    const onColumnOrderChange = vi.fn()
    const { table } = makeTable(columns, { onColumnOrderChange })
    let reject!: (reason: unknown) => void
    settleColumnMove(
      table,
      'b',
      { leaves: ['b'], after: 'a', before: 'c' },
      new Promise((_, fail) => (reject = fail)),
    )
    expect(Object.keys(table.atoms.columnMoves.get())).toEqual(['b'])
    // Колонку скрыли — она ушла из модели.
    table.getColumn('b').toggleVisibility(false)
    reconcileColumnMoves(table)
    expect(table.atoms.columnMoves.get()).toEqual({})
    reject(new Error('late'))
    await flush()
    expect(onColumnOrderChange).not.toHaveBeenCalled()
    expect(table.atoms.columnMoveFailed.get()).toEqual({})
  })
})

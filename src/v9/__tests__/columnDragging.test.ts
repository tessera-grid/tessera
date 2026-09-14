/**
 * Фаза E — headless-проверка плагина columnDragging на v9-ядре.
 * Запуск: npx vitest run --config vitest.v9.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnDragging } from '../plugins/columnDragging'

const makeTable = (columns: any[]) => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
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
  } as never) as any

  return { table, folded }
}

const flatCols = [
  { id: 'a', accessorKey: 'a', enableDragging: true },
  { id: 'b', accessorKey: 'b', enableDragging: false },
]
const nestedCols = [
  { id: 'grp', header: 'G', columns: [{ id: 'a', accessorKey: 'a', enableDragging: true }] },
]

describe('Фаза E — columnDragging на v9', () => {
  it('foldEntries: опция и слот-ручка в leftHeaderSlot', () => {
    const { folded } = makeTable(flatCols)
    expect(folded.options).toMatchObject({ enableColumnDragging: true })
    expect(folded.slots.leftHeaderSlot.map(s => s.id)).toContain('columnDraggingPlugin')
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

  it('getCanDrag (вложенная шапка): перетаскивание отключено (ADR 0022)', () => {
    const { table } = makeTable(nestedCols)
    expect(table.getHeaderGroups().length).toBeGreaterThan(1)
    const leaf = table.getAllLeafColumns().find((c: any) => c.id === 'a')
    expect(leaf.getCanDrag()).toBe(false)
  })
})

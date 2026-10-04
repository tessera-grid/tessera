/**
 * Headless-проверка плагина columnDragging.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnDragging } from '../plugins/columnDragging'
import { captureInertWarnings } from './inertWarnings'

const makeTable = (columns: any[]) => {
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

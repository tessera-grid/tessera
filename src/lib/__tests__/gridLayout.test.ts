/**
 * Cutover — headless-проверка getGridLayout (CSS grid template) на v9-ядре.
 * Запуск: npx vitest run --config vitest.v9.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { rowActions } from '../plugins/rowActions'
import { getGridLayout } from '../grid/layout'

const makeTable = (withRowActions: boolean) => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    ...(withRowActions ? [rowActions()] : []),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  const columns = injectServiceColumns(
    [
      { id: 'a', accessorKey: 'a' },
      { id: 'b', accessorKey: 'b' },
    ],
    folded.serviceColumns,
  )
  return constructTable({
    features,
    data: [{ id: '1', a: 1, b: 2 }],
    columns,
    getRowId: (row: any) => row.id,
    ...folded.options,
  } as never) as any
}

describe('Cutover — getGridLayout', () => {
  it('flex → undefined', () => {
    const table = makeTable(false)
    expect(
      getGridLayout({
        layout: 'flex',
        headerGroups: table.getHeaderGroups(),
        leafColumns: table.getAllLeafColumns(),
      }),
    ).toBeUndefined()
  })

  it('grid без rowActions: все auto + хвостовой 1fr', () => {
    const table = makeTable(false)
    const layout = getGridLayout({
      layout: 'grid',
      headerGroups: table.getHeaderGroups(),
      leafColumns: table.getAllLeafColumns(),
    })
    expect(layout?.gridTemplateColumns).toBe('auto auto 1fr')
    expect(layout?.gridTemplateRows).toBe('repeat(1, auto)')
  })

  it('grid с rowActions (последняя колонка): rowActions=1fr, без доп. хвоста', () => {
    const table = makeTable(true)
    const layout = getGridLayout({
      layout: 'grid',
      headerGroups: table.getHeaderGroups(),
      leafColumns: table.getAllLeafColumns(),
    })
    // a, b → auto; rowActions (последняя) → 1fr; extra '1fr' не добавляется
    expect(layout?.gridTemplateColumns).toBe('auto auto 1fr')
  })
})

/**
 * Фаза E — headless-проверка плагина rowGrouping на v9-ядре.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { rowGrouping, groupHeaderAction } from '../plugins/rowGrouping'

interface Row {
  id: string
  cat: string
  val: number
}

const makeTable = () => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    rowGrouping(),
  ]

  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)

  const table = constructTable({
    features,
    data: [
      { id: '1', cat: 'a', val: 10 },
      { id: '2', cat: 'a', val: 5 },
      { id: '3', cat: 'b', val: 7 },
    ] as Row[],
    columns: [
      { id: 'cat', accessorKey: 'cat' },
      { id: 'val', accessorKey: 'val', aggregationFn: 'sum' },
    ],
    getRowId: (row: Row) => row.id,
    ...folded.options,
  } as never) as any

  return { table, folded }
}

const catHeaderCtx = (table: any) =>
  table
    .getHeaderGroups()[0]
    .headers.find((h: any) => h.column.id === 'cat')
    .getContext()

describe('Фаза E — rowGrouping на v9', () => {
  it('foldEntries даёт опции группировки и дескриптор в rightHeaderSlot', () => {
    const { folded } = makeTable()
    expect(folded.options).toMatchObject({
      enableGrouping: true,
      groupedColumnMode: false,
    })
    expect(folded.slotActions.rightHeaderSlot.map(a => a.id)).toContain('rowGrouping')
  })

  it('поведение: группировка строит группы, агрегация считает sum', () => {
    const { table } = makeTable()
    table.setGrouping(['cat'])

    const groups = table.getRowModel().rows
    expect(groups).toHaveLength(2)
    const groupA = groups.find((r: any) => r.groupingValue === 'a')
    expect(groupA.getValue('val')).toBe(15)
  })

  it('дескриптор: visible/active/onSelect тумблит группировку', () => {
    const { table } = makeTable()
    const ctx = catHeaderCtx(table)

    expect(groupHeaderAction.visible!(ctx)).toBe(true)
    expect(groupHeaderAction.active!(ctx)).toBe(false)

    groupHeaderAction.onSelect(ctx)
    expect(groupHeaderAction.active!(catHeaderCtx(table))).toBe(true)
    expect(table.atoms.grouping.get()).toEqual(['cat'])
  })
})

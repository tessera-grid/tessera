/**
 * Фаза E — headless-проверка плагина columnSizing на v9-ядре.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSizing } from '../plugins/columnSizing'

interface Person {
  id: string
  name: string
}

const makeTable = () => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    columnSizing(),
  ]

  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)

  const table = constructTable({
    features,
    data: [{ id: '1', name: 'A' }] as Person[],
    columns: [{ id: 'name', accessorKey: 'name', size: 150 }],
    getRowId: (row: Person) => row.id,
    slots: folded.slots,
    ...folded.options,
  } as never) as any

  return { table, folded }
}

describe('Фаза E — columnSizing на v9', () => {
  it('foldEntries даёт опции ресайза и слот-грип (не считается в пороге)', () => {
    const { folded } = makeTable()
    expect(folded.options).toMatchObject({
      enableColumnResizing: true,
      columnResizeMode: 'onChange',
    })
    const grip = folded.slots.rightHeaderSlot.find(s => s.id === 'columnSizingPlugin')
    expect(grip).toBeTruthy()
    expect(grip!.countsAsHeaderAction).toBe(false)
  })

  it('поведение: колонка ресайзима, setColumnSizing меняет размер, resetSize сбрасывает', () => {
    const { table } = makeTable()
    const [column] = table.getAllLeafColumns()

    expect(column.getCanResize()).toBe(true)
    expect(column.getSize()).toBe(150)

    table.setColumnSizing({ name: 220 })
    expect(column.getSize()).toBe(220)

    column.resetSize()
    expect(column.getSize()).toBe(150)
  })

  it('commonFeature.getIsAnyColumnResizing = false вне активного ресайза (фича ресайза есть)', () => {
    const { table } = makeTable()
    expect(table.getIsAnyColumnResizing()).toBe(false)
  })
})

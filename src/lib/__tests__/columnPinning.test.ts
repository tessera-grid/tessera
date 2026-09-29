/**
 * Headless-проверка плагина columnPinning (start/end).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnPinning, pinHeaderAction } from '../plugins/columnPinning'
import { captureInertWarnings } from './inertWarnings'

const makeTable = (columns: any[], opts = {}) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnPinning(opts),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)

  const table = constructTable({
    features,
    data: [{ id: '1', a: 1, b: 2, name: 'x', age: 3 }],
    columns,
    getRowId: (row: any) => row.id,
    hooks: { columnPinning: { onTogglePin: () => {} } },
    ...folded.options,
  } as never) as any

  return { table, folded }
}

const flatCols = [
  { id: 'name', accessorKey: 'name' },
  { id: 'age', accessorKey: 'age' },
]

const nestedCols = [
  {
    id: 'grp',
    header: 'G',
    columns: [
      { id: 'a', accessorKey: 'a' },
      { id: 'b', accessorKey: 'b' },
    ],
  },
]

const ctxOf = (table: any, groupIndex: number, headerIndex: number) =>
  table.getHeaderGroups()[groupIndex].headers[headerIndex].getContext()

describe('columnPinning', () => {
  const warnings = captureInertWarnings()

  it('foldEntries даёт опции пиннинга и дескриптор (order 0)', () => {
    const { folded } = makeTable(flatCols)
    expect(folded.options).toMatchObject({
      enableColumnPinning: true,
      enableLeafPinning: false,
    })
    const pin = folded.slotActions.rightHeaderSlot.find(
      a => a.id === 'columnPinning',
    )
    expect(pin).toBeTruthy()
    expect(pin!.order).toBe(0)
  })

  it('поведение (плоская шапка): onSelect закрепляет к start, повтор — открепляет', () => {
    const { table } = makeTable(flatCols)
    const ctx = ctxOf(table, 0, 0)

    expect(pinHeaderAction.visible!(ctx)).toBe(true)
    expect(pinHeaderAction.active!(ctx)).toBe(false)

    pinHeaderAction.onSelect(ctx)
    expect(table.atoms.columnPinning.get().start).toContain('name')
    expect(pinHeaderAction.active!(ctxOf(table, 0, 0))).toBe(true)

    pinHeaderAction.onSelect(ctxOf(table, 0, 0))
    expect(table.atoms.columnPinning.get().start).not.toContain('name')
  })

  it('PC2: под вложенной шапкой пиннится только группа верхнего уровня; явный enablePinning листа предупреждает', () => {
    const { table } = makeTable([
      {
        id: 'grp',
        header: 'G',
        columns: [
          { id: 'a', accessorKey: 'a', enablePinning: true },
          { id: 'b', accessorKey: 'b' },
        ],
      },
    ])
    expect(table.getHeaderGroups()).toHaveLength(2)

    expect(pinHeaderAction.visible!(ctxOf(table, 0, 0))).toBe(true) // grp
    // лист без явного enablePinning — инертен молча
    expect(pinHeaderAction.visible!(ctxOf(table, 1, 1))).toBe(false)
    expect(warnings()).toHaveLength(0)

    expect(pinHeaderAction.visible!(ctxOf(table, 1, 0))).toBe(false)
    pinHeaderAction.visible!(ctxOf(table, 1, 0))
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('columnPinning')
  })

  it('reorder-out (leafPinning): лист под вложенной шапкой закрепляем', () => {
    const { table } = makeTable(nestedCols, { leafPinning: true })
    const leafCtx = ctxOf(table, 1, 0)
    expect(pinHeaderAction.visible!(leafCtx)).toBe(true)
  })
})

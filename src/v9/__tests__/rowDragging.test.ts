/**
 * Фаза E — headless-проверка плагина rowDragging на v9-ядре, включая гейты
 * (многоуровневая шапка / сортировка / группировка, ADR 0022).
 * Запуск: npx vitest run --config vitest.v9.config.ts
 */
import { constructTable } from '@tanstack/table-v9'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-v9/node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSorting } from '../plugins/columnSorting'
import { rowGrouping } from '../plugins/rowGrouping'
import { COLUMN_DRAGGING_ID, rowDragging } from '../plugins/rowDragging'

const build = (extraEntries: any[], dragOpts = {}) => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    ...extraEntries,
    rowDragging(dragOpts),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  const columns = injectServiceColumns(
    [
      { id: 'cat', accessorKey: 'cat' },
      { id: 'name', accessorKey: 'name' },
    ],
    folded.serviceColumns,
  )
  const table = constructTable({
    features,
    data: [
      { id: '1', cat: 'a', name: 'X' },
      { id: '2', cat: 'a', name: 'Y' },
    ],
    columns,
    getRowId: (row: any) => row.id,
    ...folded.options,
  } as never) as any
  return { table, folded }
}

describe('Фаза E — rowDragging на v9', () => {
  it('foldEntries: опция + сервисная колонка-ручка (order 0)', () => {
    const { folded } = build([])
    expect(folded.options).toMatchObject({ enableRowDragging: true })
    expect(folded.serviceColumns.map(c => c.id)).toContain(COLUMN_DRAGGING_ID)
  })

  it('колонка-ручка инъектирована первой', () => {
    const { table } = build([])
    expect(table.getAllLeafColumns()[0].id).toBe(COLUMN_DRAGGING_ID)
  })

  it('состояние: rowDragging по умолчанию, updater пишет в атом', () => {
    const { table } = build([])
    expect(table.atoms.rowDragging.get()).toMatchObject({ activeId: null, acceptable: true })

    table.options.onRowDraggingChange({ activeId: '1', offsetLeft: 0, isExpanded: false, acceptable: true })
    expect(table.atoms.rowDragging.get().activeId).toBe('1')
  })

  it('getCanDrag: плоская шапка и enable=true → true; enable=false → false', () => {
    expect(build([]).table.getRowModel().rows[0].getCanDrag()).toBe(true)
    expect(build([], { enable: false }).table.getRowModel().rows[0].getCanDrag()).toBe(false)
  })

  it('гейт сортировки: активная сортировка отключает drag (ADR 0022)', () => {
    const { table } = build([columnSorting()])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(true)

    table.setSorting([{ id: 'name', desc: false }])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(false)
  })

  it('гейт группировки: активная группировка отключает drag (ADR 0022)', () => {
    const { table } = build([rowGrouping()])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(true)

    table.setGrouping(['cat'])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(false)
  })
})

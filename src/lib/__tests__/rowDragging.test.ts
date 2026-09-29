/**
 * Headless-проверка плагина rowDragging, включая гейты (многоуровневая шапка /
 * сортировка / группировка).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSorting } from '../plugins/columnSorting'
import { rowGrouping } from '../plugins/rowGrouping'
import { COLUMN_DRAGGING_ID, rowDragging } from '../plugins/rowDragging'
import { __resetLogger } from '../core/logger'
import { captureInertWarnings } from './inertWarnings'

const build = (
  extraEntries: any[],
  dragOpts = {},
  userColumns: any[] = [
    { id: 'cat', accessorKey: 'cat' },
    { id: 'name', accessorKey: 'name' },
  ],
) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...extraEntries,
    rowDragging(dragOpts),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  const columns = injectServiceColumns(userColumns, folded.serviceColumns)
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

describe('rowDragging', () => {
  const warnings = captureInertWarnings()

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
    expect(table.atoms.rowDragging.get()).toMatchObject({
      activeId: null,
      acceptable: true,
    })

    table.options.onRowDraggingChange({
      activeId: '1',
      offsetLeft: 0,
      isExpanded: false,
      acceptable: true,
    })
    expect(table.atoms.rowDragging.get().activeId).toBe('1')
  })

  it('getCanDrag: плоская шапка и enable=true → true; enable=false → false', () => {
    expect(build([]).table.getRowModel().rows[0].getCanDrag()).toBe(true)
    expect(
      build([], { enable: false }).table.getRowModel().rows[0].getCanDrag(),
    ).toBe(false)
  })

  it('PC3: многоуровневая шапка делает rowDragging инертным и предупреждает', () => {
    const nested = [
      {
        id: 'grp',
        header: 'G',
        columns: [
          { id: 'cat', accessorKey: 'cat' },
          { id: 'name', accessorKey: 'name' },
        ],
      },
    ]
    const { table } = build([], {}, nested)
    const [row] = table.getRowModel().rows
    expect(row.getCanDrag()).toBe(false)
    row.getCanDrag()
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('rowDragging')

    // drag не запрошен → тишина
    __resetLogger()
    build([], { enable: false }, nested)
      .table.getRowModel()
      .rows[0].getCanDrag()
    expect(warnings()).toHaveLength(1)
  })

  it('PC4: активная группировка делает rowDragging инертным и предупреждает', () => {
    const { table } = build([rowGrouping()])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(true)
    expect(warnings()).toHaveLength(0)

    table.setGrouping(['cat'])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(false)
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('rowGrouping')
  })

  it('PC6: активная сортировка делает rowDragging инертным и предупреждает', () => {
    const { table } = build([columnSorting()])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(true)
    expect(warnings()).toHaveLength(0)

    table.setSorting([{ id: 'name', desc: false }])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(false)
    table.getRowModel().rows[1].getCanDrag()
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('сортировк')
  })
})

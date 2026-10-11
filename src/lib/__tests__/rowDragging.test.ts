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
import { findDraggableRow, getSortableRowIds } from '../grid/DndBodyWrapper'
import { reorderRows } from '../plugins/rowDragging/reorderRows'

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

describe('rowDragging — поиск перетаскиваемой строки', () => {
  it('D33: без активного перетаскивания тело не обходит строки в поисках перетаскиваемой', () => {
    let reads = 0
    const rows = new Proxy([{ id: 'a' }, { id: 'b' }], {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads++
        return Reflect.get(target, key, receiver)
      },
    })
    expect(findDraggableRow(rows, null)).toBeUndefined()
    expect(reads).toBe(0)
    expect(findDraggableRow(rows, 'b')).toEqual({ id: 'b' })
  })
})

describe('rowDragging — id для SortableContext', () => {
  it('D34: items SortableContext тела — id строк окна виртуализатора в порядке индекса, а не все строки модели', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}` }))
    // Окно 10–14 и закреплённая перетаскиваемая строка 500 (rangeExtractor).
    const virtualRows = [10, 11, 12, 13, 14, 500].map(index => ({ index }))
    expect(getSortableRowIds(rows, virtualRows)).toEqual([
      'r10',
      'r11',
      'r12',
      'r13',
      'r14',
      'r500',
    ])
  })
})

describe('reorderRows — чистый обновитель (ADR 0091)', () => {
  const tree = () => [
    {
      id: 'a',
      subRows: [
        { id: 'a1', parentId: 'a', subRows: [] },
        { id: 'a2', parentId: 'a', subRows: [] },
        { id: 'a3', parentId: 'a', subRows: [] },
      ],
    },
    { id: 'b', subRows: [{ id: 'b1', parentId: 'b', subRows: [] }] },
    { id: 'c', subRows: [] },
  ]
  const target = (id: string, index: number, parentId?: string) =>
    ({
      id,
      index,
      parentId,
      getIsLastSubRow: () => false,
      getParentRow: () => undefined,
    }) as never

  it('EV10: перенос подстроки и строки не меняет prev, повторный вызов даёт тот же результат', () => {
    const moves = [
      // В своей группе: a1 за a2.
      {
        activeParentId: 'a',
        overParentId: 'a',
        activeOriginalIndex: 0,
        overOriginalIndex: 1,
        targetItem: target('a2', 1, 'a'),
        isDownMove: true,
        currentDepth: 1,
      },
      // Из группы a в группу b.
      {
        activeParentId: 'a',
        overParentId: 'b',
        activeOriginalIndex: 1,
        overOriginalIndex: 0,
        targetItem: target('b1', 0, 'b'),
        isDownMove: true,
        currentDepth: 1,
      },
      // Из корня в группу b.
      {
        overParentId: 'b',
        activeOriginalIndex: 2,
        overOriginalIndex: 0,
        targetItem: target('b1', 0, 'b'),
        isDownMove: false,
        currentDepth: 1,
      },
    ]
    for (const move of moves) {
      const prev = tree()
      const snapshot = structuredClone(prev)
      const first = reorderRows(prev, move)
      const second = reorderRows(prev, move)
      expect(prev, JSON.stringify(move)).toEqual(snapshot)
      expect(second).toEqual(first)
    }
    const within = reorderRows(tree(), moves[0]!)
    expect(within[0].subRows.map((row: { id: string }) => row.id)).toEqual([
      'a2',
      'a1',
      'a3',
    ])
  })
})

/**
 * Спаны вложенной шапки из TanStack v9 (ADR 0049): позиция ячейки, полная высота,
 * отсутствие `columnDef.rowSpan`, `make` служебной колонки без глубины шапки.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import type { CommonColumnDef } from '../core/commonFeature.types'
import { definePlugin } from '../core/definePlugin'
import { buildTesseraFeatures } from '../core/features'
import { getHeaderPlacement } from '../grid/layout'

// Мелкий лист `country`, группа `name` над листьями глубины 1, ветка `info` глубины 3.
const makeTable = () => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
  ]
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data: [],
    columns: [
      { id: 'country', accessorKey: 'country', header: 'Country' },
      {
        id: 'name',
        header: 'Name',
        rowSpan: 7,
        columns: [
          { id: 'firstName', accessorKey: 'firstName' },
          { id: 'lastName', accessorKey: 'lastName' },
        ],
      },
      {
        id: 'info',
        header: 'Info',
        columns: [
          { id: 'more', columns: [{ id: 'age', accessorKey: 'age' }] },
          { id: 'visits', accessorKey: 'visits' },
        ],
      },
    ],
  } as never) as any
}

/** Видимые ячейки шапки: `column.id` → grid-позиция. */
const visiblePositions = (table: any) => {
  const positions: Record<string, unknown> = {}
  for (const group of table.getHeaderGroups()) {
    for (const header of group.headers) {
      const position = getHeaderPlacement(header)
      if (position) positions[header.column.id] = position
    }
  }
  return positions
}

const visibleHeader = (table: any, columnId: string) =>
  table
    .getHeaderGroups()
    .flatMap((group: any) => group.headers)
    .find((header: any) => header.column.id === columnId && header.rowSpan > 0)

describe('Спаны вложенной шапки (v9)', () => {
  it('HS1: место ячейки шапки — из header.rowSpan v9: строка, число строк и колонок; покрытые не рисуются, columnDef не читается', () => {
    const table = makeTable()
    expect(visiblePositions(table)).toEqual({
      country: { row: 1, rowSpan: 3, colSpan: 1 },
      name: { row: 1, rowSpan: 1, colSpan: 2 },
      info: { row: 1, rowSpan: 1, colSpan: 2 },
      firstName: { row: 2, rowSpan: 2, colSpan: 1 },
      lastName: { row: 2, rowSpan: 2, colSpan: 1 },
      more: { row: 2, rowSpan: 1, colSpan: 1 },
      visits: { row: 2, rowSpan: 2, colSpan: 1 },
      age: { row: 3, rowSpan: 1, colSpan: 1 },
    })
    // Настоящий заголовок мелкого листа покрыт вершиной своей цепочки.
    const covered = table
      .getHeaderGroups()
      .at(-1)
      .headers.find((header: any) => header.column.id === 'country')
    expect(covered.rowSpan).toBe(0)
    expect(getHeaderPlacement(covered)).toBeNull()
  })

  it('HS7: columnDef.rowSpan отсутствует в типе определения колонки', () => {
    const def: CommonColumnDef = {
      // @ts-expect-error HS7: поле удалено, спаны считает TanStack v9
      rowSpan: 2,
    }
    expect(def).toBeDefined()
  })

  it('HS8: getIsFullHeightHeader истинно только для заголовка на всю высоту шапки', () => {
    const table = makeTable()
    expect(visibleHeader(table, 'country').getIsFullHeightHeader()).toBe(true)
    expect(visibleHeader(table, 'name').getIsFullHeightHeader()).toBe(false)
    expect(visibleHeader(table, 'firstName').getIsFullHeightHeader()).toBe(
      false,
    )
    const covered = table
      .getHeaderGroups()
      .at(-1)
      .headers.find((header: any) => header.column.id === 'country')
    expect(covered.getIsFullHeightHeader()).toBe(false)
  })

  it('HS14: make служебной колонки получает только компоненты, без глубины шапки, и вызывается один раз', () => {
    const calls: unknown[][] = []
    const Cell = () => null
    const probe = definePlugin<{ enabled?: boolean }>()({
      id: 'probe',
      column: {
        id: 'probe-column',
        side: 'leading',
        order: 0,
        cell: Cell,
        make: (...args) => {
          calls.push(args)
          return { id: 'probe-column', cell: args[0].cell }
        },
      },
    })
    const column = probe().column!
    expect(column.make()).toBe(column.make())
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveLength(1)
    expect(Object.keys(calls[0][0] as object).sort()).toEqual([
      'cell',
      'header',
    ])

    definePlugin<{ enabled?: boolean }>()({
      id: 'probe-depth',
      column: {
        id: 'probe-depth-column',
        side: 'leading',
        order: 0,
        // @ts-expect-error HS14: глубины шапки в сигнатуре make нет
        make: (_depth: number, _parts: object) => ({
          id: 'probe-depth-column',
        }),
      },
    })
  })
})

// @vitest-environment happy-dom
/**
 * Выбор при клиентской группировке (ADR 0185; CG4–CG7, CG9, CG11): срез из строк данных, он
 * переживает смену группировки, флажки по `subRows`, счётчик и охват, выгрузка, канал действий.
 * Запуск: npx vitest run --config vitest.node.config.ts clientGroupSelection
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { dataExport, rowExpanding, rowGrouping, rowSelection } from '../plugins'
import { collectExportData } from '../plugins/dataExportModel/exportData'
import { toggleRowSelection } from '../plugins/rowSelection/keyboardActions'
import {
  scopeRowsOf,
  setScopeSelected,
} from '../plugins/rowSelection/selectAllScope'
import { selectionSummaryOf } from '../plugins/rowSelectionModel/selectionCount'
import {
  groupKeysOfRow,
  isSelectableInList,
} from '../plugins/rowSelectionModel/selectionHelpers'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  country: string
  city: string
}

const ITEMS: Item[] = [
  { id: 'a', country: 'US', city: 'NY' },
  { id: 'b', country: 'US', city: 'LA' },
  { id: 'c', country: 'DE', city: 'Berlin' },
]
const COLUMNS = [
  { id: 'id', accessorKey: 'id' },
  { id: 'country', accessorKey: 'country' },
  { id: 'city', accessorKey: 'city' },
]

let root: Root
let table: any

const mount = (plugins: readonly unknown[], data = ITEMS) => {
  const Grid = () => {
    table = useCreateTable({
      columns: COLUMNS as never,
      data,
      getRowId: (row: Item) => row.id,
      plugins: [rowExpanding({ initialExpanded: true }), ...plugins] as never,
    })
    return null
  }
  act(() => root.render(<Grid />))
}

const rowOf = (id: string) => table.getRow(id, true)
const groupOf = (index = 0) => table.getRowModel().rows[index]
const selected = () => table.atoms.rowSelection.get()
const press = (row: unknown) =>
  act(() => toggleRowSelection(row as never, {}, {}))

beforeEach(() => {
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('выбор при клиентской группировке (ADR 0185)', () => {
  it('CG4: срез — только id строк данных, групп в нём нет', () => {
    mount([
      rowGrouping({ initialGrouping: ['country'] }),
      rowSelection({ subRows: true }),
    ])
    const group = groupOf()
    expect(group.getIsGrouped()).toBe(true)
    press(group)
    expect(selected()).toEqual({ a: true, b: true })
    press(groupOf())
    expect(selected()).toEqual({})
  })

  it('CG5: смена и снятие группировки выбор сохраняют', () => {
    mount([
      rowGrouping({ initialGrouping: ['country'] }),
      rowSelection({ subRows: true }),
    ])
    press(groupOf())
    act(() => table.setGrouping(['city']))
    expect(selected()).toEqual({ a: true, b: true })
    act(() => table.setGrouping([]))
    expect(selected()).toEqual({ a: true, b: true })
  })

  it("CG6: флажок группы есть при subRows: false и true, при 'self' его нет; у строк данных он есть всегда", () => {
    for (const subRows of [false, 'self', true] as const) {
      mount([
        rowGrouping({ initialGrouping: ['country'] }),
        rowSelection({ subRows }),
      ])
      expect(isSelectableInList(groupOf())).toBe(subRows !== 'self')
      expect(isSelectableInList(rowOf('a'))).toBe(true)
    }
  })

  it("CG7: счётчик и охват selectAll считают строки данных, в том числе 'currentPage'", () => {
    mount([
      rowGrouping({ initialGrouping: ['country'] }),
      rowSelection({ subRows: true }),
    ])
    const ids = (scope: 'all' | 'filtered' | 'currentPage') =>
      scopeRowsOf(table, scope)
        .map(row => row.id)
        .sort()
    for (const scope of ['all', 'filtered', 'currentPage'] as const) {
      expect(ids(scope)).toEqual(['a', 'b', 'c'])
    }
    press(groupOf())
    expect(selectionSummaryOf(table, selected())).toEqual({ count: 2 })
    act(() => setScopeSelected(table, scopeRowsOf(table, 'all'), true))
    expect(selectionSummaryOf(table, selected())).toEqual({ count: 3 })
  })

  it('CG9: выгрузка выбранных при группировке даёт выбранные строки данных', () => {
    mount([
      rowGrouping({ initialGrouping: ['country'] }),
      rowSelection({ subRows: true }),
      dataExport(),
    ])
    press(groupOf())
    const { rows } = collectExportData(table, {
      rows: 'selected',
      columns: 'all',
    })
    expect(rows.map(row => row[0])).toEqual(['a', 'b'])
  })

  it('CG11: канал действий сообщает выбор группы с её путём', () => {
    mount([
      rowGrouping({ initialGrouping: ['country', 'city'] }),
      rowSelection({ subRows: true }),
    ])
    const nested = groupOf().subRows[0]
    expect(nested.getIsGrouped()).toBe(true)
    expect(groupKeysOfRow(nested)).toEqual(['US', 'NY'])
    expect(groupKeysOfRow(rowOf('a'))).toEqual([])
  })
})

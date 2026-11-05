// @vitest-environment happy-dom
/**
 * Число строк группы в источнике строк (ADR 0184; GC2–GC3).
 * Запуск: npx vitest run --config vitest.node.config.ts groupRowCount
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  quickSearchModel,
  rowExpanding,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
} from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  city: string
  team: string
  name: string
}

const ROWS: Item[] = [
  { id: 'r1', city: 'Paris', team: 'A', name: 'Ann' },
  { id: 'r2', city: 'Paris', team: 'A', name: 'Bob' },
  { id: 'r3', city: 'Paris', team: 'B', name: 'Cy' },
  { id: 'r4', city: 'Rome', team: 'A', name: 'Dan' },
]
const COLUMNS = [
  { id: 'city', accessorKey: 'city' },
  { id: 'team', accessorKey: 'team' },
  { id: 'name', accessorKey: 'name' },
]
const NO_ROWS: Item[] = []

let root: Root
let table: any

const Grid = (params: Record<string, unknown>) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: Item) => row.id,
    ...params,
  } as never)
  return null
}

type GroupRow = { getValue: (id: string) => unknown; id: string }
const source = () => table.getRowSource() as RowSource<GroupRow>

beforeEach(() => {
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('число строк группы (ADR 0184)', () => {
  it('GC2: при вложенных группах верхний уровень считает все строки данных, а не подгруппы', () => {
    act(() =>
      root.render(
        <Grid
          plugins={[
            rowGrouping({ initialGrouping: ['city', 'team'] }),
            rowExpanding(),
            quickSearchModel(),
          ]}
        />,
      ),
    )
    const paris = () =>
      table
        .getRowModel()
        .rows.find((row: GroupRow) => row.getValue('city') === 'Paris')
    expect(paris().subRows).toHaveLength(2)
    expect(source().groupRowCount?.(paris())).toBe(3)
    expect(source().groupRowCount?.(paris().subRows[0])).toBe(2)

    act(() => table.setGlobalFilter('Ann'))
    expect(source().groupRowCount?.(paris())).toBe(1)
  })

  it('GC3: SSRM — необязательный getGroupRowCount даёт подпись, без него прямые дети; getGroupChildCount по-прежнему задаёт размер ветки', async () => {
    const getRows = (request: ServerRowsRequest) =>
      Promise.resolve({
        rows: request.groupKeys.length
          ? [{ id: 'x', city: 'Paris', team: 'A', name: '' }]
          : [{ id: '', city: 'Paris', team: '', name: '', rows: 120, kids: 3 }],
        rowCount: 1,
      })
    const mount = async (hooks: Record<string, unknown>) => {
      act(() =>
        root.render(
          <Grid
            data={NO_ROWS}
            rowCount={1}
            plugins={[
              rowGrouping({ initialGrouping: ['city', 'team'] }),
              rowExpanding(),
              serverRowModel({
                getRows: getRows as never,
                getGroupChildCount: (row: { kids: number }) => row.kids,
                ...hooks,
              } as never),
            ]}
          />,
        ),
      )
      await act(async () => {
        source().observe!({ first: 0, last: 3, fast: false })
        await Promise.resolve()
      })
    }
    await mount({})
    const group = () => source().at(0)!
    expect(source().groupRowCount?.(group())).toBe(3)

    await mount({
      getGroupRowCount: (row: { rows: number }) => row.rows,
    })
    expect(source().groupRowCount?.(group())).toBe(120)
    // Размер ветки — по-прежнему прямые дети, а не строки данных.
    expect(source().groupChildCount?.(group())).toBe(3)
  })
})

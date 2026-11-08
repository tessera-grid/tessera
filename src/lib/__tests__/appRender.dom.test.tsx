// @vitest-environment happy-dom
import { act, createElement, useState } from 'react'
import type { RowSelectionValue } from '../core/rowSelectionAll'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import {
  columnSortingModel,
  rowExpandingModel,
  rowSelectionModel,
} from '../plugins'

// Перерисовка приложения не доходит до грида (ADR 0196; HR1, HR2, HR8): приложение не подписано
// на срезы, ссылка `table` меняется только по входам отрисовки, поля `state` нет.

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const ROWS: Item[] = [
  { id: 'r1', name: 'B' },
  { id: 'r2', name: 'A' },
]

let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})
const mount = (element: ReturnType<typeof createElement>) => {
  root = createRoot(document.createElement('div'))
  act(() => root!.render(element))
}

describe('Перерисовка приложения не доходит до грида (ADR 0196)', () => {
  it('HR1: смена среза, которым владеет таблица, — выбора строк, сортировки, раскрытия — не перерисовывает компонент приложения', async () => {
    let renders = 0
    let table: any
    const App = () => {
      renders++
      table = useCreateTable({
        columns: COLUMNS as never,
        data: ROWS,
        plugins: [
          rowSelectionModel(),
          columnSortingModel(),
          rowExpandingModel(),
        ],
      })
      return null
    }
    mount(createElement(App))
    const before = renders
    act(() => table.getRow('r1').toggleSelected(true))
    act(() => table.getColumn('name').toggleSorting(false))
    act(() => table.setExpanded({ r1: true }))
    await act(async () => {})
    const state = table.store.get()
    expect(state.rowSelection).toEqual({ r1: true })
    expect(state.sorting).toEqual([{ id: 'name', desc: false }])
    expect(state.expanded).toEqual({ r1: true })
    expect(renders).toBe(before)
  })

  it('HR2: ссылка table держится при смене значения контролируемого среза и ссылок колбэков; новые columns, data, аргументы плагинов и другая опция дают новую ссылку', () => {
    let table: unknown
    let select: (value: RowSelectionValue) => void = () => {}
    let rerender: () => void = () => {}
    let setInputs: (inputs: Partial<Inputs>) => void = () => {}
    interface Inputs {
      columns: typeof COLUMNS
      data: Item[]
      subRows: boolean | 'self'
      rowHeight: number | undefined
    }
    const App = () => {
      const [selection, setSelection] = useState<RowSelectionValue>({})
      const [, setTick] = useState(0)
      const [inputs, setAll] = useState<Inputs>({
        columns: COLUMNS,
        data: ROWS,
        subRows: true,
        rowHeight: undefined,
      })
      select = setSelection
      rerender = () => setTick(tick => tick + 1)
      setInputs = next => setAll(all => ({ ...all, ...next }))
      table = useCreateTable({
        columns: inputs.columns as never,
        data: inputs.data,
        rowHeight: inputs.rowHeight,
        onDataChange: () => {},
        handlers: { onColumnVisibilityChange: () => {} },
        plugins: [
          rowSelectionModel({
            subRows: inputs.subRows,
            rowSelection: selection,
            onRowSelectionChange: setSelection,
          }),
        ],
      })
      return null
    }
    mount(createElement(App))
    const first = table as { store: { get: () => { rowSelection: unknown } } }

    act(() => select({ r2: true }))
    expect(table).toBe(first)
    expect(first.store.get().rowSelection).toEqual({ r2: true })
    act(() => rerender())
    expect(table).toBe(first)

    const renewedBy = (inputs: Partial<Inputs>) => {
      const before = table
      act(() => setInputs(inputs))
      return table !== before
    }
    expect(renewedBy({ columns: [...COLUMNS] })).toBe(true)
    expect(renewedBy({ data: [...ROWS] })).toBe(true)
    expect(renewedBy({ subRows: 'self' })).toBe(true)
    expect(renewedBy({ rowHeight: 40 })).toBe(true)
  })

  it('HR8: в типе результата useCreateTable нет поля state', () => {
    const useTypedTable = () =>
      useCreateTable({ columns: COLUMNS as never, data: ROWS })
    expectTypeOf<ReturnType<typeof useTypedTable>>().not.toHaveProperty('state')
    let table: object | undefined
    const App = () => {
      table = useTypedTable()
      return null
    }
    mount(createElement(App))
    expect('state' in table!).toBe(false)
  })
})

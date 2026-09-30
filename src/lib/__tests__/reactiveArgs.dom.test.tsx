// @vitest-environment happy-dom
/**
 * Живые аргументы фабрик плагинов (ADR 0039, RX1–RX3): смена значения применяется
 * без пересоздания таблицы, функции живые при стабильной ссылке, новый объект с теми
 * же значениями — не смена.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { cellSelection, columnSorting, rowSelection } from '../plugins'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [{ id: 'name', accessorKey: 'name' }]
const data = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
]

type CellPredicate = (cell: unknown) => boolean

interface HostProps {
  selectedCount?: boolean
  multiRange?: boolean
  canSelectCell?: CellPredicate
  maxSort?: number
}

let captured: any
let root: Root | undefined

// Плагины — инлайн-массивом: каждый рендер новые записи и новые объекты аргументов.
const Host = ({
  selectedCount,
  multiRange,
  canSelectCell,
  maxSort,
}: HostProps) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    plugins: [
      rowSelection({ selectedCount }),
      cellSelection({ multiRange, canSelectCell }),
      columnSorting({ multiSort: { max: maxSort ?? 3 } }),
    ],
  })
  return null
}

const mount = (props: HostProps) => {
  root = createRoot(document.createElement('div'))
  act(() => root!.render(<Host {...props} />))
}
const rerender = (props: HostProps) =>
  act(() => root!.render(<Host {...props} />))

const statusBarIds = () =>
  captured.getRenderSlots().statusBarSlot.map((slot: { id: string }) => slot.id)

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

describe('живые аргументы фабрик', () => {
  it('RX1: смена значения аргумента после монтирования применяется без пересоздания таблицы', () => {
    mount({ selectedCount: false, multiRange: true })
    const store = captured.store
    expect(statusBarIds()).toEqual([])
    expect(captured.options.enableMultiCellRangeSelection).toBe(true)

    rerender({ selectedCount: true, multiRange: false })
    expect(captured.store).toBe(store)
    expect(statusBarIds()).toEqual(['selectedRowsCount'])
    expect(captured.options.enableMultiCellRangeSelection).toBe(false)

    rerender({ selectedCount: false, multiRange: false })
    expect(statusBarIds()).toEqual([])
  })

  it('RX2: смена функции-аргумента действует со следующего вызова при стабильной ссылке; инлайн-массив с теми же значениями не пересчитывает модели', () => {
    const cell = { column: { getIsActionsColumn: () => false } }
    mount({ canSelectCell: () => true })
    const predicate = captured.options.enableCellSelection
    const rows = captured.getRowModel()
    const leaves = captured.getAllLeafColumns()
    expect(predicate(cell)).toBe(true)

    rerender({ canSelectCell: () => false })
    expect(captured.options.enableCellSelection).toBe(predicate)
    expect(predicate(cell)).toBe(false)
    expect(captured.getRowModel()).toBe(rows)
    expect(captured.getAllLeafColumns()).toBe(leaves)
  })

  it('RX3: новый объект-аргумент с теми же значениями — не смена: настройка не пересобирается', () => {
    mount({ maxSort: 3 })
    const slots = captured.getRenderSlots()

    rerender({ maxSort: 3 })
    expect(captured.getRenderSlots()).toBe(slots)
    expect(captured.options.maxMultiSortColCount).toBe(3)

    rerender({ maxSort: 2 })
    expect(captured.getRenderSlots()).not.toBe(slots)
    expect(captured.options.maxMultiSortColCount).toBe(2)
  })
})

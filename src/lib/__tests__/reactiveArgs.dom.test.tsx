// @vitest-environment happy-dom
/**
 * Живые аргументы фабрик плагинов (ADR 0039, RX1–RX3, RX21, RX24): смена значения
 * применяется без пересоздания таблицы, функции живые при стабильной ссылке, новый
 * объект с теми же значениями — не смена; политика сортировки меняется на лету;
 * `setup` — раз на значение аргументов.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { definePlugin } from '../core/definePlugin'
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
    const cell = {
      column: {
        getIsActionsColumn: () => false,
      },
    }
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

const sortColumns = [
  { id: 'name', accessorKey: 'name' },
  { id: 'rank', accessorKey: 'rank' },
]
const sortData = [
  { id: '1', name: 'A', rank: 2 },
  { id: '2', name: 'B', rank: 1 },
]

const SortHost = ({
  removal,
  multiSort,
}: {
  removal: boolean
  multiSort: boolean
}) => {
  captured = useCreateTable({
    columns: sortColumns as never,
    data: sortData,
    plugins: [columnSorting({ removal, multiSort })],
  })
  return null
}

describe('политика сортировки на лету', () => {
  it('RX21: removal и multiSort у columnSorting на лету действуют со следующего клика', () => {
    root = createRoot(document.createElement('div'))
    const renderSort = (removal: boolean, multiSort: boolean) =>
      act(() =>
        root!.render(<SortHost removal={removal} multiSort={multiSort} />),
      )
    const sorting = () => captured.atoms.sorting.get()
    const toggle = (id: string, multi = false) =>
      act(() => captured.getColumn(id).toggleSorting(undefined, multi))

    renderSort(true, true)
    toggle('name')
    toggle('name')
    toggle('name')
    // С removal третий клик снимает сортировку.
    expect(sorting()).toEqual([])

    renderSort(false, true)
    toggle('name')
    toggle('name')
    toggle('name')
    expect(sorting()).toHaveLength(1)

    toggle('rank', true)
    expect(sorting().map((sort: { id: string }) => sort.id)).toEqual([
      'name',
      'rank',
    ])

    renderSort(false, false)
    toggle('name', true)
    expect(sorting().map((sort: { id: string }) => sort.id)).toEqual(['name'])
  })
})

describe('живые хуки (ADR 0027)', () => {
  it('H5: колбэк, пересозданный на рендере, актуален в table.getHooks()', () => {
    const HooksHost = ({ onSelectRow }: { onSelectRow: () => void }) => {
      captured = useCreateTable({
        columns: columns as never,
        data,
        plugins: [rowSelection({ onSelectRow })],
      })
      return null
    }
    const first = vi.fn()
    const second = vi.fn()
    root = createRoot(document.createElement('div'))
    act(() => root!.render(<HooksHost onSelectRow={first} />))
    expect(captured.getHooks().rowSelection.onSelectRow).toBe(first)
    act(() => root!.render(<HooksHost onSelectRow={second} />))
    expect(captured.getHooks().rowSelection.onSelectRow).toBe(second)
  })
})

describe('перезапуск setup', () => {
  it('RX24: setup выполняется раз на значение аргументов — перерисовка не перезапускает, смена значения перезапускает после cleanup', () => {
    const setup = vi.fn()
    const cleanup = vi.fn()
    const probe = definePlugin<{ enabled?: boolean; level?: number }>()({
      id: 'setupProbe',
      setup: opts => () => {
        setup(opts.level)
        return cleanup
      },
    })
    const SetupHost = ({ level, tick }: { level: number; tick: number }) => {
      captured = useCreateTable({
        columns: columns as never,
        data: tick >= 0 ? data : [],
        plugins: [probe({ level })],
      })
      return null
    }
    root = createRoot(document.createElement('div'))
    act(() => root!.render(<SetupHost level={1} tick={0} />))
    act(() => root!.render(<SetupHost level={1} tick={1} />))
    act(() => root!.render(<SetupHost level={1} tick={2} />))
    expect(setup.mock.calls).toEqual([[1]])
    expect(cleanup).not.toHaveBeenCalled()

    act(() => root!.render(<SetupHost level={2} tick={3} />))
    expect(setup.mock.calls).toEqual([[1], [2]])
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(cleanup.mock.invocationCallOrder[0]).toBeLessThan(
      setup.mock.invocationCallOrder[1],
    )
  })
})

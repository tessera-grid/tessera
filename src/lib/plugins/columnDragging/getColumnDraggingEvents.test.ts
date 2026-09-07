import { Table } from '@tanstack/react-table'
import { describe, expect, it, vi } from 'vitest'

import { getColumnDraggingEvents } from './getColumnDraggingEvents'

type ColumnStub = {
  id: string
  index: number
  draggableIndex: number
  canDrag?: boolean
  pinned?: false | 'left' | 'right'
}

type TableStubOptions = {
  activeId: string | null
  columns: ColumnStub[]
  onColumnOrderChange?: ReturnType<typeof vi.fn>
  onColumnDraggingActiveIdChange?: ReturnType<typeof vi.fn>
  onColumnDragEnd?: ReturnType<typeof vi.fn>
}

const createTable = ({
  activeId,
  columns,
  onColumnOrderChange = vi.fn(),
  onColumnDraggingActiveIdChange = vi.fn(),
  onColumnDragEnd = vi.fn(),
}: TableStubOptions) => {
  const headers = columns.map(column => ({
    column: {
      id: column.id,
      getIndex: () => column.index,
      getDraggableIndex: () => column.draggableIndex,
      getCanDrag: () => column.canDrag ?? true,
      getIsPinned: () => column.pinned ?? false,
    },
  }))

  const table = {
    options: { onColumnOrderChange, onColumnDraggingActiveIdChange },
    getHooks: () => ({ columnDragging: { onColumnDragEnd } }),
    getFlatHeaders: () => headers,
    getState: () => ({ columnDraggingActiveId: activeId }),
  } as unknown as Table

  return {
    table,
    onColumnOrderChange,
    onColumnDraggingActiveIdChange,
    onColumnDragEnd,
  }
}

const columns: ColumnStub[] = [
  { id: 'a', index: 0, draggableIndex: 0 },
  { id: 'b', index: 1, draggableIndex: 1 },
  { id: 'c', index: 2, draggableIndex: 2 },
  { id: 'd', index: 3, draggableIndex: 3 },
]

const overTarget = (id: string, current: Record<string, unknown> | undefined) =>
  ({ over: { id, data: { current } } }) as never

describe('getColumnDraggingEvents · onColumnDragEnd', () => {
  it('A1: дроп мимо цели (over=null) не меняет порядок и сбрасывает active id', () => {
    const { table, onColumnOrderChange, onColumnDraggingActiveIdChange } =
      createTable({ activeId: 'a', columns })

    getColumnDraggingEvents(table).onColumnDragEnd!({ over: null } as never)

    expect(onColumnOrderChange).not.toHaveBeenCalled()
    expect(onColumnDraggingActiveIdChange).toHaveBeenCalledWith(null)
  })

  it('A1: отсутствующий orderIndex на цели трактуется как null и не двигает колонки', () => {
    const { table, onColumnOrderChange } = createTable({
      activeId: 'a',
      columns,
    })

    // over есть, но data.current без orderIndex/draggableIndex → раньше это
    // был undefined и проскакивал мимо гварда `=== null`.
    getColumnDraggingEvents(table).onColumnDragEnd!(overTarget('b', {}))

    expect(onColumnOrderChange).not.toHaveBeenCalled()
  })

  it('A2: пользовательский хук вызывается один раз, updater остаётся чистым', () => {
    const { table, onColumnOrderChange, onColumnDragEnd } = createTable({
      activeId: 'a',
      columns,
    })

    getColumnDraggingEvents(table).onColumnDragEnd!(
      overTarget('c', { orderIndex: 2, draggableIndex: 2 }),
    )

    expect(onColumnDragEnd).toHaveBeenCalledTimes(1)
    expect(onColumnDragEnd).toHaveBeenCalledWith({
      dragIndex: 0,
      hoverIndex: 2,
    })

    expect(onColumnOrderChange).toHaveBeenCalledTimes(1)
    const updater = onColumnOrderChange.mock.calls[0][0] as (
      prev: string[],
    ) => string[]

    // arrayMove(['a','b','c','d'], 0, 2)
    expect(updater(['a', 'b', 'c', 'd'])).toEqual(['b', 'c', 'a', 'd'])

    // Повторный прогон updater'а (StrictMode/конкурентный рендер) не должен
    // повторно дёргать побочный эффект.
    updater(['a', 'b', 'c', 'd'])
    expect(onColumnDragEnd).toHaveBeenCalledTimes(1)
  })
})

// @vitest-environment happy-dom
/**
 * Колбэки перетаскивания узлов под вложенной шапкой (ADR 0052, ND8–ND9).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { columnDragging } from '../plugins'
import { getColumnDraggingEvents } from '../plugins/columnDragging/getColumnDraggingEvents'
import { moveColumn } from '../plugins/columnDragging/moveColumn'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const leaf = (id: string) => ({ id, accessorKey: id, enableDragging: true })
const columns = [
  leaf('a'),
  {
    id: 'grp',
    header: 'G',
    enableDragging: true,
    columns: [leaf('b'), leaf('c')],
  },
  leaf('d'),
]

const mount = (hooks: Parameters<typeof columnDragging>[0]) => {
  const Host = () => {
    captured = useCreateTable({
      columns: columns as never,
      data: [{ id: '1', a: 1, b: 2, c: 3, d: 4 }],
      plugins: [columnDragging(hooks)],
    })
    return null
  }
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(<Host />))
}

const headerOf = (id: string) =>
  captured
    .getHeaderGroups()
    .flatMap((group: { headers: unknown[] }) => group.headers)
    .find(
      (header: { column: { id: string }; rowSpan: number }) =>
        header.column.id === id && header.rowSpan > 0,
    )

describe('колбэки перетаскивания узлов', () => {
  it('ND8: onColumnDragEnd получает columnId узла и новый columnOrder; для листа dragIndex / hoverIndex прежние', () => {
    const onColumnDragEnd = vi.fn()
    mount({ onColumnDragEnd })

    act(() => moveColumn(captured, headerOf('grp'), 1))
    expect(onColumnDragEnd).toHaveBeenLastCalledWith({
      dragIndex: 1,
      hoverIndex: 3,
      columnId: 'grp',
      columnOrder: ['a', 'd', 'b', 'c'],
    })

    act(() => moveColumn(captured, headerOf('a'), 1))
    expect(onColumnDragEnd).toHaveBeenLastCalledWith({
      dragIndex: 0,
      hoverIndex: 1,
      columnId: 'a',
      columnOrder: ['d', 'a', 'b', 'c'],
    })
  })

  it('ND9: onColumnDragCancel получает columnId узла — группы, а не id её заголовка — и причину', () => {
    const onColumnDragCancel = vi.fn()
    mount({ onColumnDragCancel })
    const group = headerOf('grp')
    expect(group.id).not.toBe('grp')

    const events = getColumnDraggingEvents(captured)
    act(() => events.onColumnDragStart({ active: { id: group.id } }))
    act(() => getColumnDraggingEvents(captured).onColumnDragCancel())
    expect(onColumnDragCancel).toHaveBeenCalledWith({
      columnId: 'grp',
      reason: 'cancel',
    })
  })
})

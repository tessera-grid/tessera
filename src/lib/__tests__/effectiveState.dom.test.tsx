// @vitest-environment happy-dom
/**
 * Эффективное состояние при сужении параметров (ADR 0039, §4, RX9–RX10, RX12–RX13):
 * TanStack видит «сохранённое ∩ допустимое», сохранённое не переписывается —
 * вернули параметр, вернулось прежнее. Смена смысла состояния — сброс.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import {
  columnPinning,
  columnSorting,
  rowExpanding,
  rowSelection,
} from '../plugins'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const mount = (node: React.ReactNode) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(node))
}

const flatColumns = [
  { id: 'name', accessorKey: 'name' },
  { id: 'rank', accessorKey: 'rank' },
]
const flatData = [
  { id: '1', name: 'A', rank: 2 },
  { id: '2', name: 'B', rank: 1 },
  { id: '3', name: 'A', rank: 1 },
]

const SortHost = ({ max }: { max: number }) => {
  captured = useCreateTable({
    columns: flatColumns as never,
    data: flatData,
    plugins: [columnSorting({ multiSort: { max } })],
  })
  return null
}

const nestedColumns = [
  {
    id: 'group',
    header: 'Group',
    columns: [
      { id: 'name', accessorKey: 'name' },
      { id: 'rank', accessorKey: 'rank' },
    ],
  },
  { id: 'other', accessorKey: 'other' },
]

const PinHost = ({ leafPinning }: { leafPinning: boolean }) => {
  captured = useCreateTable({
    columns: nestedColumns as never,
    data: flatData,
    plugins: [columnPinning({ leafPinning })],
  })
  return null
}

const tree = [
  {
    id: 'p',
    name: 'P',
    subRows: [{ id: 'c', name: 'C', subRows: [{ id: 'g', name: 'G' }] }],
  },
]

describe('эффективное состояние при сужении', () => {
  it('RX9: multiSort max ↓ — модель сортирует по первым N, срез sorting не меняется; вернули — порядок прежний', () => {
    mount(<SortHost max={3} />)
    act(() => {
      captured.getColumn('name').toggleSorting(false, false)
      captured.getColumn('rank').toggleSorting(false, true)
    })
    const ids = () =>
      captured.getRowModel().rows.map((row: { id: string }) => row.id)
    expect(ids()).toEqual(['3', '1', '2'])

    mount(<SortHost max={1} />)
    expect(captured.options.state.sorting).toEqual([
      { id: 'name', desc: false },
    ])
    expect(ids()).toEqual(['1', '3', '2'])

    mount(<SortHost max={3} />)
    expect(
      captured.options.state.sorting.map((sort: { id: string }) => sort.id),
    ).toEqual(['name', 'rank'])
    expect(ids()).toEqual(['3', '1', '2'])
  })

  it('RX10: leafPinning выкл — листья под группой показаны незакреплёнными, срез не меняется; вернули — снова закреплены', () => {
    mount(<PinHost leafPinning />)
    act(() => captured.getColumn('name').pin('start'))
    expect(captured.getColumn('name').getIsPinned()).toBe('start')

    mount(<PinHost leafPinning={false} />)
    expect(captured.getColumn('name').getIsPinned()).toBe(false)

    mount(<PinHost leafPinning />)
    expect(captured.getColumn('name').getIsPinned()).toBe('start')
  })

  it('RX12: сужение не вызывает on*Change у контролируемого потребителя', () => {
    const onExpandedChange = vi.fn()
    const Host = ({ maxDepth }: { maxDepth: number }) => {
      captured = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name' }] as never,
        data: tree,
        plugins: [rowExpanding({ maxDepth })],
        state: { expanded: { p: true, c: true } },
        handlers: { onExpandedChange },
      })
      return null
    }
    mount(<Host maxDepth={3} />)
    expect(captured.getRowModel().rows).toHaveLength(3)

    mount(<Host maxDepth={1} />)
    expect(captured.getRowModel().rows).toHaveLength(2)
    expect(onExpandedChange).not.toHaveBeenCalled()
  })

  it('RX13: смена subRows у rowSelection сбрасывает выбор (смена смысла состояния)', () => {
    const Host = ({ subRows }: { subRows: boolean }) => {
      const [selection, setSelection] = useState({})
      captured = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name' }] as never,
        data: flatData,
        plugins: [rowSelection({ subRows })],
        state: { rowSelection: selection },
        handlers: { onRowSelectionChange: setSelection },
      })
      return null
    }
    mount(<Host subRows={false} />)
    act(() => captured.getRow('1').toggleSelected(true))
    expect(captured.options.state.rowSelection).toEqual({ '1': true })

    mount(<Host subRows />)
    expect(captured.options.state.rowSelection).toEqual({})
  })
})

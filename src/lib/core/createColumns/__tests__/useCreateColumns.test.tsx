import type { AccessorKeyColumnDef } from '@tanstack/react-table'
import { renderHook } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { COLUMN_DRAGGING_ID, rowDragging } from '../../../plugins/rowDragging'
import { COLUMN_EXPANDING_ID, rowExpanding } from '../../../plugins/rowExpanding'
import { COLUMN_SELECTION_ID, rowSelection } from '../../../plugins/rowSelection'
import { ServiceColumn } from '../../../plugins/types'
import { ROW_ACTIONS_COLUMN_ID, getRowActionsColumn } from '../createRowActionsColumn'
import { useCreateColumns } from '../useCreateColumns'

// Сеть безопасности под инверсию ядра (docs/decisions/0010-invert-core-plugins-registry.md).
// После инверсии (Фаза 2) `useCreateColumns` обобщён: принимает pluginColumns
// (ServiceColumn[]) вместо enable*-флагов. Ассерты — прежний оракул паритета для
// R6 (порядок по side/order) и R8 (гейт наличием записи); поменялась только
// сборка входа. Один инвариант — один тест.

const cols = [
  { id: 'a', accessorKey: 'a' },
  { id: 'b', accessorKey: 'b' },
] as unknown as AccessorKeyColumnDef<any>[]

// Колонка действий — ядровая (не плагин): подаётся как trailing ServiceColumn.
const rowActionsColumn: ServiceColumn = {
  id: ROW_ACTIONS_COLUMN_ID,
  make: getRowActionsColumn as ServiceColumn['make'],
  side: 'trailing',
  order: 0,
}

const col = (entry: { column?: ServiceColumn }): ServiceColumn => entry.column!

const build = (pluginColumns: ServiceColumn[], initial = cols) =>
  renderHook(() =>
    useCreateColumns({ initialColumns: initial, pluginColumns } as any),
  )

const idsOf = (result: { current: any }): (string | undefined)[] =>
  result.current.map((c: { id?: string }) => c.id)

describe('useCreateColumns — гейт наличием записи (R8)', () => {
  test('пустой список колонок даёт пустой результат', async () => {
    const { result } = await build([], [])
    expect(result.current).toEqual([])
  })

  test('без сервисных колонок возвращает исходные в исходном порядке', async () => {
    const { result } = await build([])
    expect(idsOf(result)).toEqual(['a', 'b'])
  })

  test('колонка выбора добавляется только при наличии её записи', async () => {
    const { result } = await build([col(rowSelection())])
    expect(idsOf(result)).toContain(COLUMN_SELECTION_ID)
    expect(idsOf(result)[0]).toBe(COLUMN_SELECTION_ID)
  })
})

describe('useCreateColumns — порядок сервисных колонок (R6)', () => {
  test('лидирующие сортируются по order (dragging → selection → expanding) независимо от порядка в списке', async () => {
    // Подаём в перемешанном порядке — результат детерминирован полем order.
    const { result } = await build([
      col(rowExpanding()),
      col(rowSelection()),
      col(rowDragging()),
    ])
    expect(idsOf(result).slice(0, 3)).toEqual([
      COLUMN_DRAGGING_ID,
      COLUMN_SELECTION_ID,
      COLUMN_EXPANDING_ID,
    ])
  })

  test('колонка действий добавляется в конец (trailing)', async () => {
    const { result } = await build([rowActionsColumn])
    expect(idsOf(result).at(-1)).toBe(ROW_ACTIONS_COLUMN_ID)
  })

  test('лидирующие в начале, колонка действий — в конце одновременно', async () => {
    const { result } = await build([
      col(rowDragging()),
      col(rowSelection()),
      col(rowExpanding()),
      rowActionsColumn,
    ])
    const ids = idsOf(result)
    expect(ids.slice(0, 3)).toEqual([
      COLUMN_DRAGGING_ID,
      COLUMN_SELECTION_ID,
      COLUMN_EXPANDING_ID,
    ])
    expect(ids.at(-1)).toBe(ROW_ACTIONS_COLUMN_ID)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
  })
})

describe('useCreateColumns — дедупликация по id', () => {
  test('повторяющиеся id схлопываются в одну колонку', async () => {
    const withDup = [
      { id: 'a', accessorKey: 'a' },
      { id: 'a', accessorKey: 'a' },
      { id: 'b', accessorKey: 'b' },
    ] as unknown as AccessorKeyColumnDef<any>[]

    const { result } = await build([], withDup)
    expect(idsOf(result)).toEqual(['a', 'b'])
  })
})

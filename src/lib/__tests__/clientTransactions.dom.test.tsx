// @vitest-environment happy-dom
/**
 * Клиентская транзакция строк (ADR 0194, §4; IU11, IU15): следующий `data` с прежними
 * объектами нетронутых строк уходит в `onDataChange`, без обработчика — отказ с
 * предупреждением; транзакция — действие ядра в канале действий.
 * Запуск: npx vitest run --config vitest.node.config.ts clientTransactions
 */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { rowModelChangeOf } from '../core/dataChanges'
import type { DebugAction } from '../core/debugActions'
import type { RowTransaction } from '../core/rowTransactions'
import { useCreateTable } from '../core/useCreateTable'
import { captureInertWarnings } from './inertWarnings'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  subRows?: Item[]
}

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const DATA: Item[] = Array.from({ length: 10 }, (_, i) => ({
  id: `r${i}`,
  name: `n${i}`,
  ...(i === 2
    ? {
        subRows: [
          { id: 'r2.0', name: 'k0', subRows: [{ id: 'r2.0.0', name: 'g' }] },
          { id: 'r2.1', name: 'k1' },
        ],
      }
    : {}),
}))

let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const host = ({
  handler = true,
  onDebugAction,
}: {
  handler?: boolean
  onDebugAction?: (action: DebugAction) => void
} = {}) => {
  let table: any
  const changes: [Item[], RowTransaction<Item>][] = []
  const Host = () => {
    const [data, setData] = useState(DATA)
    table = useCreateTable({
      columns: COLUMNS as never,
      data,
      onDebugAction,
      ...(handler && {
        onDataChange: (next: Item[], transaction: RowTransaction<Item>) => {
          changes.push([next, transaction])
          setData(next)
        },
      }),
    })
    return null
  }
  root = createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host)))
  table.getCoreRowModel()
  return {
    table: () => table,
    changes,
    apply: (transaction: RowTransaction<Item>) => {
      let result: unknown
      act(() => {
        result = table.applyRowTransaction(transaction)
      })
      return result
    },
  }
}

describe('Клиентская транзакция (ADR 0194)', () => {
  const warnings = captureInertWarnings()

  it("IU11: applyRowTransaction в клиентском режиме строит следующий data с прежними объектами нетронутых строк и отдаёт его в onDataChange, итог 'applied'; без обработчика — 'unavailable' и предупреждение", () => {
    const grid = host()
    const before = grid.table().getCoreRowModel()
    const updated = { id: 'r5', name: 'n5*' }
    const added = { id: 'x', name: 'x' }
    expect(
      grid.apply({ update: [updated], remove: ['r7'], add: [added], index: 1 }),
    ).toBe('applied')
    const [next, transaction] = grid.changes[0]!
    expect(transaction.remove).toEqual(['r7'])
    expect(next.map(item => item.id)).toEqual([
      'r0',
      'x',
      'r1',
      'r2',
      'r3',
      'r4',
      'r5',
      'r6',
      'r8',
      'r9',
    ])
    expect(next[6]).toBe(updated)
    for (const item of next) {
      if (item !== updated && item !== added) {
        expect(DATA).toContain(item)
      }
    }
    // Приложение положило data: модель собрана из прежней.
    const model = grid.table().getCoreRowModel()
    expect(rowModelChangeOf(model)?.prev).toBe(before)
    expect(model.rowsById.r9).not.toBe(undefined)

    // Ветка: новые объекты — у ветки и её предков, прочие строки прежние.
    expect(
      grid.apply({
        parentId: 'r2.0',
        add: [{ id: 'r2.0.1', name: 'g1' }],
      }),
    ).toBe('applied')
    const [nested] = grid.changes[1]!
    const branch = nested.find(item => item.id === 'r2')!
    expect(branch).not.toBe(DATA[2])
    expect(branch.subRows![0]!.subRows!.map(item => item.id)).toEqual([
      'r2.0.0',
      'r2.0.1',
    ])
    expect(branch.subRows![1]).toBe(DATA[2]!.subRows![1])
    expect(nested[0]).toBe(next[0])
    expect(grid.table().getCoreRowModel().rowsById['r2.0.1']).toBeDefined()
    expect(grid.apply({ parentId: 'none', add: [added] })).toBe(
      'branchNotLoaded',
    )

    act(() => root!.unmount())
    root = undefined
    const bare = host({ handler: false })
    expect(bare.apply({ remove: ['r1'] })).toBe('unavailable')
    expect(bare.table().getCoreRowModel().rowsById.r1).toBeDefined()
    expect(
      warnings().filter(text => text.includes('onDataChange')).length,
    ).toBeGreaterThan(0)
  })

  it('IU15: клиентская транзакция — действие ядра rowTransaction в канале действий с числами строк и источником api; подпись — из словаря ядра', () => {
    const reports: DebugAction[] = []
    const grid = host({ onDebugAction: report => reports.push(report) })
    grid.apply({ add: [{ id: 'x', name: 'x' }], remove: ['r1', 'r2'] })
    expect(
      reports.find(report => report.action === 'rowTransaction'),
    ).toMatchObject({
      plugin: 'core',
      source: 'api',
      detail: { add: 1, update: 0, remove: 2 },
    })
    expect(
      grid.table().getActionLabel({ plugin: 'core', action: 'rowTransaction' }),
    ).toBe('Change rows')
  })
})

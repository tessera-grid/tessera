// @vitest-environment happy-dom
/**
 * Сторож итога колонки в футере (ADR 0221, §9; VC23): равенство по значению, направление и
 * новая выборка серверной модели.
 * Запуск: npx vitest run --config vitest.node.config.ts footerTotalFlash
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ColumnTotalWatch } from '../core/commonFeature.types'
import { footerFlashKey } from '../core/flashes/flashFeature'
import { useCreateTable } from '../core/useCreateTable'
import { columnTotals, valueChangeFlash } from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let table: any

const Grid = ({ columnDefault }: { columnDefault: boolean | 'direction' }) => {
  table = useCreateTable({
    columns: [
      { id: 'amount', accessorKey: 'amount', aggregationFn: 'sum' },
    ] as never,
    data: [{ id: 'r1', amount: 1 }],
    getRowId: (row: { id: string }) => row.id,
    plugins: [columnTotals(), valueChangeFlash({ columnDefault })] as never,
  })
  return null
}

const element = () => document.createElement('div')
const frame = () =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, 20)))
const flash = () => table.store.get().flashes?.[footerFlashKey('amount')]

/** Сторож видит итог `previous`, затем `total`; итог — исход вспышки или `undefined`. */
const change = async (
  previous: unknown,
  total: unknown,
  host: unknown = table,
) => {
  const watch = table.options.watchColumnTotal as (
    watch: ColumnTotalWatch,
  ) => void
  act(() => table.setFlashes({}))
  const base = { table: host, columnId: 'amount', element: element() }
  watch({ ...base, total: previous, previous: undefined, mounted: true })
  watch({ ...base, total, previous, mounted: false })
  await frame()
  return flash()?.outcome as string | undefined
}

beforeEach(() => {
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('сторож итога колонки в футере (ADR 0221, §9)', () => {
  it('VC23: равенство итогов по значению — даты по моменту, списки и объекты по элементам; направление только у конечных чисел; новая выборка серверной модели без вспышки, новые итоги той же выборки — со вспышкой', async () => {
    act(() => root.render(<Grid columnDefault="direction" />))

    expect(await change(new Date(5), new Date(5))).toBeUndefined()
    expect(await change([1, 9], [1, 9])).toBeUndefined()
    expect(await change({ sum: 3, max: 2 }, { sum: 3, max: 2 })).toBeUndefined()
    expect(await change([1, 9], [1, 10])).toBe('changed')
    expect(await change({ sum: 3 }, { sum: 4 })).toBe('changed')

    expect(await change(10, 12)).toBe('up')
    expect(await change(10, 8)).toBe('down')
    expect(await change('a', 'b')).toBe('changed')
    expect(await change(10, Number.POSITIVE_INFINITY)).toBe('changed')
    expect(await change(Number.NEGATIVE_INFINITY, 10)).toBe('changed')
    expect(await change(new Date(5), new Date(9))).toBe('changed')

    // Серверная модель: номер выборки в наборе строк итога.
    let epoch = 1
    const server = Object.create(table, {
      getRowSource: { value: () => ({ epoch: () => epoch }) },
    })
    const watch = table.options.watchColumnTotal as (
      watch: ColumnTotalWatch,
    ) => void
    const base = { table: server, columnId: 'amount', element: element() }
    act(() => table.setFlashes({}))
    watch({ ...base, total: 100, previous: undefined, mounted: true })
    epoch = 2
    watch({ ...base, total: 200, previous: 100, mounted: false })
    await frame()
    expect(flash()).toBeUndefined()
    watch({ ...base, total: 300, previous: 200, mounted: false })
    await frame()
    expect(flash()?.outcome).toBe('up')
  })
})

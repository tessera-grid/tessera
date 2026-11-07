// @vitest-environment happy-dom
/**
 * CSS-переменные ширин колонок (ADR 0013, CR22): перерисовка хоста без смены колонок и ширин
 * отдаёт прежний объект переменных — грид не перекладывает их на контейнер.
 * Запуск: npx vitest run --config vitest.node.config.ts columnSizeVars
 */
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { useCalculateColumnSizes } from '../grid/useCalculateColumnSizes'
import { columnSizing } from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const COLUMNS = ['a', 'b', 'c'].map(id => ({ id, accessorKey: id, size: 100 }))
const DATA = [{ id: 'r0', a: 1, b: 2, c: 3 }]

describe('CSS-переменные ширин колонок (ADR 0013)', () => {
  it('CR22: перерисовка хоста без смены колонок и ширин отдаёт прежний объект переменных; смена ширины — новый', () => {
    const seen: Record<string, string>[] = []
    let rerender: () => void = () => {}
    let table: any
    const Host = () => {
      const [, setTick] = useState(0)
      rerender = () => setTick(tick => tick + 1)
      table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: row => row.id,
        plugins: [columnSizing()] as never,
      })
      seen.push(useCalculateColumnSizes({ table }))
      return null
    }
    const root = createRoot(document.createElement('div'))
    act(() => root.render(createElement(Host)))
    const mounted = seen.at(-1)!
    act(() => rerender())
    expect(seen.at(-1)).toBe(mounted)

    act(() => table.setColumnSizing({ a: 180 }))
    const resized = seen.at(-1)!
    expect(resized).not.toBe(mounted)
    expect(Object.values(resized)).toContain('180px')
    act(() => root.unmount())
  })
})

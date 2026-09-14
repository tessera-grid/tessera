// @vitest-environment happy-dom
/**
 * Cutover — render-тест v9 контейнеров Body/Head (happy-dom): rowgroup + строки/
 * заголовки. Виртуализация подаётся мок-элементами (реальный virtualizer — DataGrid,
 * браузер на cutover). Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSizing } from '../plugins/columnSizing'
import { Body } from '../grid/Body'
import { Head } from '../grid/Head'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const vRow = (index: number) =>
  ({ index, start: index * 40, size: 40, end: (index + 1) * 40, key: index, lane: 0 } as any)

const makeTable = () => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: [
      { id: '1', a: 'A1' },
      { id: '2', a: 'A2' },
    ],
    columns: [{ id: 'a', accessorKey: 'a', header: 'A', cell: (i: any) => String(i.getValue()) }],
    getRowId: (row: any) => row.id,
    ...folded.options,
  } as never) as any
}

let container: HTMLElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Cutover — Body/Head контейнеры (v9, happy-dom)', () => {
  it('Body: rowgroup + строка на каждый virtualRow', () => {
    const table = makeTable()
    const rows = table.getRowModel().rows
    act(() => {
      root.render(
        <Body
          layout="flex"
          rows={rows}
          virtualRows={[vRow(0), vRow(1)]}
          virtualColumns={[]}
          leafColumns={table.getAllLeafColumns()}
          headerRowCount={1}
          isResizingColumns={false}
          isVirtualColumns={false}
        />,
      )
    })
    const group = container.querySelector('[role="rowgroup"]') as HTMLElement
    expect(group).toBeTruthy()
    expect(group.querySelectorAll('[role="row"]').length).toBe(2)
    expect(group.textContent).toContain('A1')
    expect(group.textContent).toContain('A2')
  })

  it('Head: rowgroup + columnheader на каждую колонку', () => {
    const table = makeTable()
    act(() => {
      root.render(
        <Head
          layout="flex"
          headerGroups={table.getHeaderGroups()}
          virtualColumns={[]}
          isResizingColumns={false}
          isVirtualColumns={false}
        />,
      )
    })
    const group = container.querySelector('[role="rowgroup"]') as HTMLElement
    expect(group).toBeTruthy()
    expect(group.querySelectorAll('[role="columnheader"]').length).toBe(1)
    expect(group.textContent).toContain('A')
  })
})

// @vitest-environment happy-dom
/**
 * Render-тест BodyRow (happy-dom, без drag): role=row, aria-rowindex, ячейки
 * строки, data-last-row. Виртуализация приходит пропсом (мок virtualRow).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSizing } from '../plugins/columnSizing'
import { BodyRow } from '../grid/BodyRow'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const virtualRow = {
  index: 0,
  start: 0,
  size: 40,
  end: 40,
  key: 0,
  lane: 0,
} as any

const makeTable = () => {
  const entries = [
    {
      id: 'reactivity',
      slot: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: [{ id: '1', a: 'A', b: 'B' }],
    columns: [
      {
        id: 'a',
        accessorKey: 'a',
        size: 100,
        cell: (i: any) => String(i.getValue()),
      },
      {
        id: 'b',
        accessorKey: 'b',
        size: 100,
        cell: (i: any) => String(i.getValue()),
      },
    ],
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

describe('BodyRow (happy-dom)', () => {
  it('DOM-контракт: role=row, aria-rowindex, ячейки, last-row', () => {
    const table = makeTable()
    const row = table.getRowModel().rows[0]

    act(() => {
      root.render(
        <BodyRow
          layout="flex"
          row={row}
          visibleCells={row.getVisibleCells()}
          virtualRow={virtualRow}
          virtualColumns={[]}
          leafColumns={table.getAllLeafColumns()}
          headerRowCount={1}
          isVirtualColumns={false}
        />,
      )
    })

    const rowEl = container.querySelector('[role="row"]') as HTMLElement
    expect(rowEl).toBeTruthy()
    expect(rowEl.getAttribute('aria-rowindex')).toBe('2')
    expect(rowEl.getAttribute('data-index')).toBe('0')
    expect(rowEl.getAttribute('data-last-row')).toBe('true')

    // Две ячейки строки.
    expect(rowEl.querySelectorAll('[role="cell"]').length).toBe(2)
    expect(rowEl.textContent).toContain('A')
    expect(rowEl.textContent).toContain('B')
  })
})

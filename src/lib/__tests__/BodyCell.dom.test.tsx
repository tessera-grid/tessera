// @vitest-environment happy-dom
/**
 * Render-тест BodyCell (happy-dom): DOM-контракт ячейки — role, размеры через
 * CSS-переменные, пиннинг-атрибуты (start), контент через flexRender.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnPinning } from '../plugins/columnPinning'
import { columnSizing } from '../plugins/columnSizing'
import { BodyCell } from '../grid/BodyCell'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const makeTable = () => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnPinning(),
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: [{ id: '1', name: 'Xenia' }],
    columns: [
      {
        id: 'name',
        accessorKey: 'name',
        size: 120,
        cell: (info: any) => String(info.getValue()),
      },
    ],
    getRowId: (row: any) => row.id,
    ...folded.options,
  } as never) as any
}

const cellOf = (table: any) =>
  table
    .getRowModel()
    .rows[0].getAllCells()
    .find((c: any) => c.column.id === 'name')

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

describe('BodyCell (happy-dom)', () => {
  it('DOM-контракт: role, aria-colindex, размер-переменная, контент', () => {
    const table = makeTable()
    act(() => {
      root.render(<BodyCell layout="flex" cell={cellOf(table)} rowIndex={0} />)
    })

    const cellEl = container.querySelector('[role="cell"]') as HTMLElement
    expect(cellEl).toBeTruthy()
    expect(cellEl.getAttribute('data-column-id')).toBe('name')
    expect(cellEl.getAttribute('aria-colindex')).toBe('1')
    expect(cellEl.style.width).toBe('var(--col-name-size)')
    expect(cellEl.textContent).toContain('Xenia')
    // Не закреплена → data-cell-pinned пустой/false.
    expect(cellEl.getAttribute('data-cell-pinned')).toBe('false')
  })

  it('пиннинг start отражается в data-cell-pinned и left-offset', () => {
    const table = makeTable()
    table.setColumnPinning({ start: ['name'], end: [] })

    act(() => {
      root.render(<BodyCell layout="flex" cell={cellOf(table)} rowIndex={0} />)
    })

    const cellEl = container.querySelector('[role="cell"]') as HTMLElement
    // DOM-контракт грида остался left/right (CSS/тесты/бейзлайны), хотя v9
    // getIsPinned даёт start/end — маппинг pinnedSideToDom.
    expect(cellEl.getAttribute('data-cell-pinned')).toBe('left')
    // Первая закреплённая слева → смещение 0px.
    expect(cellEl.style.left).toBe('0px')
  })
})

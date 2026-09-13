// @vitest-environment happy-dom
/**
 * Cutover — render-тест v9 HeadCell (happy-dom): columnheader, aria-sort, контент
 * заголовка через flexRender, действия слота (pin+sort), пиннинг start.
 * Запуск: npx vitest run --config vitest.v9.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { constructTable } from '@tanstack/table-v9'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-v9/node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSorting } from '../plugins/columnSorting'
import { columnPinning } from '../plugins/columnPinning'
import { columnSizing } from '../plugins/columnSizing'
import { HeadCell } from '../grid/HeadCell'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const makeTable = () => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    columnSorting(),
    columnPinning(),
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: [{ id: '1', name: 'X' }],
    columns: [{ id: 'name', accessorKey: 'name', header: 'Имя' }],
    getRowId: (row: any) => row.id,
    hooks: {
      columnSorting: { onToggleColumnSort: () => {} },
      columnPinning: { onTogglePin: () => {} },
    },
    slots: folded.slots,
    slotActions: folded.slotActions,
    actionMenu: folded.actionMenu,
    ...folded.options,
  } as never) as any
}

const headerOf = (table: any) => table.getHeaderGroups()[0].headers[0]

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

describe('Cutover — HeadCell (v9, happy-dom)', () => {
  it('DOM-контракт: columnheader, aria-sort none, контент, действия слота', () => {
    const table = makeTable()
    act(() => {
      root.render(<HeadCell layout="flex" header={headerOf(table)} />)
    })

    const head = container.querySelector('[role="columnheader"]') as HTMLElement
    expect(head).toBeTruthy()
    expect(head.getAttribute('data-column-id')).toBe('name')
    expect(head.getAttribute('aria-sort')).toBe('none')
    expect(head.textContent).toContain('Имя')
    // Действия правого слота: pin + sort инлайн.
    expect(head.querySelectorAll('button[aria-label]').length).toBe(2)
  })

  it('пиннинг start отражается в data-cell-pinned', () => {
    const table = makeTable()
    table.setColumnPinning({ start: ['name'], end: [] })
    act(() => {
      root.render(<HeadCell layout="flex" header={headerOf(table)} />)
    })
    const head = container.querySelector('[role="columnheader"]') as HTMLElement
    expect(head.getAttribute('data-cell-pinned')).toBe('start')
  })
})

// @vitest-environment happy-dom
/**
 * Cutover — render-тест v9 HeadRow (happy-dom): заголовки группы → HeadCell.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSizing } from '../plugins/columnSizing'
import { HeadRow } from '../grid/HeadRow'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const makeTable = () => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: [{ id: '1', a: 'A', b: 'B' }],
    columns: [
      { id: 'a', accessorKey: 'a', header: 'Колонка A' },
      { id: 'b', accessorKey: 'b', header: 'Колонка B' },
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

describe('Cutover — HeadRow (v9, happy-dom)', () => {
  it('рисует HeadCell на каждый заголовок группы', () => {
    const table = makeTable()
    act(() => {
      root.render(
        <HeadRow
          layout="flex"
          lastGroup
          headerGroup={table.getHeaderGroups()[0]}
          virtualColumns={[]}
          isVirtualColumns={false}
        />,
      )
    })

    const heads = container.querySelectorAll('[role="columnheader"]')
    expect(heads.length).toBe(2)
    expect(container.textContent).toContain('Колонка A')
    expect(container.textContent).toContain('Колонка B')
  })
})

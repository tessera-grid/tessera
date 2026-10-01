// @vitest-environment happy-dom
/**
 * ДОКАЗАТЕЛЬСТВО гранулярных ре-рендеров: `useSlice(table, key)` перерисовывает
 * компонент только при изменении СВОЕГО среза. Это React-уровень поверх
 * store-гранулярности.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  columnVisibilityFeature,
  constructTable,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { commonFeature } from '../core/commonFeature'
import { useSlice } from '../core/reactivity'

// act без предупреждений.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const makeTable = () => {
  const features = tableFeatures({
    coreReactivityFeature: storeReactivityBindings(),
    commonFeature,
    rowSortingFeature,
    columnVisibilityFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { alphanumeric: sortFn_alphanumeric },
  })
  return constructTable({
    features,
    data: [{ id: '1', name: 'A' }],
    columns: [{ id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' }],
    getRowId: (row: { id: string }) => row.id,
  } as never) as any
}

let sortingRenders = 0
let visibilityRenders = 0

const SortingView = ({ table }: { table: any }) => {
  useSlice(table, 'sorting' as never)
  sortingRenders++
  return null
}
const VisibilityView = ({ table }: { table: any }) => {
  useSlice(table, 'columnVisibility' as never)
  visibilityRenders++
  return null
}

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  sortingRenders = 0
  visibilityRenders = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Гранулярные ре-рендеры на table.atoms', () => {
  it('ST1: useSlice перерисовывает подписчика своего среза и не трогает подписчика чужого', () => {
    const table = makeTable()
    act(() => {
      root.render(
        <>
          <SortingView table={table} />
          <VisibilityView table={table} />
        </>,
      )
    })

    let sortingBase = sortingRenders
    let visibilityBase = visibilityRenders
    act(() => table.setSorting([{ id: 'name', desc: false }]))
    expect(sortingRenders).toBeGreaterThan(sortingBase)
    expect(visibilityRenders).toBe(visibilityBase)

    sortingBase = sortingRenders
    visibilityBase = visibilityRenders
    act(() => table.setColumnVisibility({ name: false }))
    expect(visibilityRenders).toBeGreaterThan(visibilityBase)
    expect(sortingRenders).toBe(sortingBase)
  })
})

// @vitest-environment happy-dom
/**
 * Контракт встроенного плагина: ядро предупреждает о статической инертности при
 * монтировании (ADR 0036, PQ2).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import {
  columnSorting,
  columnVisibility,
  headerActionMenu,
  rowDragging,
} from '../plugins'
import { captureInertWarnings } from './inertWarnings'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const DATA = [{ id: '1', name: 'A' }]

const Grid = ({
  plugins,
  enableToolbar,
}: {
  plugins: readonly any[]
  enableToolbar?: boolean
}) => {
  useCreateTable({
    columns: COLUMNS,
    data: DATA,
    plugins,
    enableToolbar,
  } as never)
  return null
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('контракт встроенного плагина — dev-warn при монтировании', () => {
  const warnings = captureInertWarnings()

  it('PQ2: ядро предупреждает об инертных записях один раз на <id>:<reason>; disabled и работающие молчат', () => {
    const plugins = [
      columnSorting(),
      rowDragging(),
      columnVisibility(),
      headerActionMenu({ enabled: false }),
    ] as const
    act(() => root.render(<Grid plugins={plugins} enableToolbar={false} />))

    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('columnVisibility')

    act(() => root.render(<Grid plugins={plugins} enableToolbar={false} />))
    expect(warnings()).toHaveLength(1)
  })
})

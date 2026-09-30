// @vitest-environment happy-dom
/**
 * Выбираемость ячеек по колонке (ADR 0029, CRS11): `enableCellSelection: false` в
 * определении колонки делает её ячейки невыбираемыми.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { cellSelection } from '../plugins'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe('выбираемость ячеек по колонке', () => {
  it('CRS11: колонка с enableCellSelection: false не выделяется', () => {
    let table: any
    const Host = () => {
      table = useCreateTable({
        columns: [
          { id: 'name', accessorKey: 'name' },
          { id: 'rank', accessorKey: 'rank', enableCellSelection: false },
        ],
        data: [{ id: '1', name: 'A', rank: 1 }],
        plugins: [cellSelection()],
      } as never)
      return null
    }
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Host />))

    const [name, rank] = table.getRow('1').getAllCells()
    expect(name.getCanSelect()).toBe(true)
    expect(rank.getCanSelect()).toBe(false)
    act(() => root.unmount())
  })
})

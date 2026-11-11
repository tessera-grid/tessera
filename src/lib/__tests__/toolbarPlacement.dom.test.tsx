// @vitest-environment happy-dom
/**
 * Живой аргумент `toolbar` (ADR 0205, TO4; ADR 0039): смена на лету переставляет кнопку без
 * пересоздания таблицы.
 * Запуск: npx vitest run --config vitest.node.config.ts toolbarPlacement
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import {
  columnVisibility,
  dataExport,
  quickSearch,
  type ToolbarPlacement,
} from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | undefined
let table: any

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const DATA = [{ id: 'r1', name: 'Alice' }]
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

const Host = ({ toolbar }: { toolbar?: ToolbarPlacement | false }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: { id: string }) => row.id,
    plugins: [
      quickSearch(),
      columnVisibility(),
      dataExport({ toolbar }),
    ] as never,
  })
  return null
}

const exportSlot = () =>
  (
    table.getRenderSlots().toolbarSlot as {
      id: string
      group?: string
      order?: number | 'last'
      align?: string
    }[]
  ).find(slot => slot.id === 'exportButton')

describe('Живой аргумент toolbar (ADR 0205)', () => {
  it('TO4: смена аргумента на лету переставляет кнопку без пересоздания таблицы', () => {
    const host = document.createElement('div')
    root = createRoot(host)
    act(() => root!.render(<Host />))
    // Таблица та же — её хранилище не пересоздаётся (как RX1, ADR 0039).
    const store = table.store
    expect(exportSlot()).toMatchObject({ group: 'data' })
    expect(exportSlot()?.align).toBeUndefined()

    act(() =>
      root!.render(
        <Host toolbar={{ group: 'search', align: 'start', order: 'last' }} />,
      ),
    )
    expect(table.store).toBe(store)
    expect(exportSlot()).toMatchObject({
      group: 'search',
      align: 'start',
      order: 'last',
    })

    act(() => root!.render(<Host toolbar={false} />))
    expect(table.store).toBe(store)
    expect(exportSlot()).toBeUndefined()

    act(() => root!.render(<Host />))
    expect(table.store).toBe(store)
    expect(exportSlot()).toMatchObject({ group: 'data' })
  })
})

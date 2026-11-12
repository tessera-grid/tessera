// @vitest-environment happy-dom
/**
 * «Настройки вида» в таблице без отрисовки (ADR 0215): раздел «Поиск» (VW10), серверный режим и SSRM
 * (VW15). VW1, VW8, VW9 — `viewSettings`.
 * Запуск: npx vitest run --project unit viewSettings
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { readServerAction } from '../core/serverActions'
import { useCreateTable } from '../core/useCreateTable'
import {
  type ViewSettingsSection,
  shownViewSettingsSections,
  viewSettingsSectionsOf,
} from '../core/viewSettings'
import {
  columnFiltering,
  columnSorting,
  columnVisibility,
  quickSearch,
  rowGrouping,
  serverRowModel,
} from '../plugins'
import { tableLabels } from '../stories/__tests__/labels'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const COLUMNS = [
  { id: 'name', accessorKey: 'name' },
  { id: 'city', accessorKey: 'city' },
]
const DATA = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  city: 'Rome',
}))

let table: any
let unmount: (() => void) | undefined

const Host = ({ options }: { options: Record<string, unknown> }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: { id: string }) => row.id,
    ...options,
  } as never)
  return null
}

const mount = (options: Record<string, unknown>) => {
  const root = createRoot(document.createElement('div'))
  act(() => root.render(<Host options={options} />))
  unmount = () => act(() => root.unmount())
}

afterEach(() => {
  unmount?.()
  unmount = undefined
})

const ids = (sections: readonly ViewSettingsSection[]) =>
  sections.map(section => section.id)

const BUILT_IN = ['filter', 'sorting', 'grouping', 'columns']

describe('«Настройки вида» без отрисовки (ADR 0215)', () => {
  it('VW10: раздел «Поиск» есть, только когда поиск активен и поля поиска в тулбаре нет', () => {
    const shown = () => ids(shownViewSettingsSections(table))
    mount({ plugins: [quickSearch({ toolbar: false })] })
    expect(shown()).toEqual([])
    act(() => table.setGlobalFilter('Name'))
    expect(shown()).toEqual(['search'])
    unmount!()

    // Поле поиска в тулбаре: текст виден в нём — раздела нет.
    mount({ plugins: [quickSearch()] })
    act(() => table.setGlobalFilter('Name'))
    expect(shown()).toEqual([])
  })

  it('VW15: в серверном режиме и SSRM разделы те же; снятие уровня — серверное действие с откатом и плашкой при отказе', async () => {
    const plugins = (onToggleColumnSort?: () => Promise<void>) => [
      columnFiltering(),
      columnSorting({ onToggleColumnSort }),
      rowGrouping(),
      columnVisibility(),
    ]
    mount({ plugins: plugins() })
    const client = ids(viewSettingsSectionsOf(table))
    expect(client).toEqual(BUILT_IN)
    unmount!()

    mount({
      data: [],
      plugins: [
        serverRowModel({ getRows: () => new Promise(() => {}) }),
        ...plugins(),
      ],
    })
    expect(ids(viewSettingsSectionsOf(table))).toEqual(client)
    unmount!()

    let reject!: (error: unknown) => void
    mount({
      dataMode: 'server',
      rowCount: 100,
      plugins: plugins(
        () =>
          new Promise<void>((_, fail) => {
            reject = fail
          }),
      ),
    })
    expect(ids(viewSettingsSectionsOf(table))).toEqual(client)
    act(() => table.setSorting([{ id: 'name', desc: false }]))
    const sorting = viewSettingsSectionsOf(table).find(
      section => section.id === 'sorting',
    )!
    act(() => sorting.levels!(table, tableLabels)[0]!.remove('pointer'))
    expect(table.atoms.sorting.get()).toEqual([])
    expect(readServerAction(table).pending?.kind).toBe('sorting')
    await act(async () => {
      reject(new Error('Server error'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    // Откат к состоянию до снятия, отказ — плашкой под шапкой.
    expect(table.atoms.sorting.get()).toEqual([{ id: 'name', desc: false }])
    expect(readServerAction(table).failed?.kind).toBe('sorting')
  })
})

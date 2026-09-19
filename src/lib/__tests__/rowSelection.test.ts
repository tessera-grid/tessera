/**
 * Headless-проверка плагина rowSelection.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { COLUMN_SELECTION_ID, rowSelection } from '../plugins/rowSelection'
import { getCanSomeRowsSelect } from '../plugins/rowSelection/selectionHelpers'

interface Person {
  id: string
  name: string
}

const makeTable = (opts = {}) => {
  const entries = [
    {
      id: 'reactivity',
      slot: { coreReactivityFeature: storeReactivityBindings() },
    },
    rowSelection(opts),
  ]

  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)

  const columns = injectServiceColumns(
    [{ id: 'name', accessorKey: 'name' }],
    folded.serviceColumns,
  )

  const table = constructTable({
    features,
    data: [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ] as Person[],
    columns,
    getRowId: (row: Person) => row.id,
    ...folded.options,
  } as never) as any

  return { table, folded, columns }
}

describe('rowSelection', () => {
  it('foldEntries даёт опции выбора и сервисную колонку', () => {
    const { folded } = makeTable({ subRows: true })
    expect(folded.options).toMatchObject({
      enableSubRowSelection: true,
      enableRowRangeSelection: false,
    })
    expect(typeof (folded.options as any).enableRowSelection).toBe('function')
    expect(folded.serviceColumns.map(c => c.id)).toContain(COLUMN_SELECTION_ID)
  })

  it('колонка выбора инъектирована первой (order 1)', () => {
    const { columns } = makeTable()
    expect((columns[0] as any).id).toBe(COLUMN_SELECTION_ID)
  })

  it('поведение: выбор строки и «выбрать все»', () => {
    const { table } = makeTable()
    const [first] = table.getRowModel().rows

    first.toggleSelected(true)
    expect(first.getIsSelected()).toBe(true)
    expect(table.getIsSomePageRowsSelected()).toBe(true)
    expect(table.getIsAllPageRowsSelected()).toBe(false)

    table.toggleAllPageRowsSelected(true)
    expect(table.getIsAllPageRowsSelected()).toBe(true)
  })

  it('getCanSomeRowsSelect: строки выбираемы вне группировки', () => {
    const { table } = makeTable()
    expect(getCanSomeRowsSelect(table)).toBe(true)
  })

  it('гейт группировки: enableRowSelection false при активной группировке (ADR 0022)', () => {
    const { folded } = makeTable()
    const enableRowSelection = (folded.options as any).enableRowSelection

    // Активная группировка → выбор недоступен.
    expect(
      enableRowSelection({
        table: { atoms: { grouping: { get: () => ['name'] } } },
      }),
    ).toBe(false)
    // Без группировки (атома нет) → доступен.
    expect(enableRowSelection({ table: { atoms: {} } })).toBe(true)
  })
})

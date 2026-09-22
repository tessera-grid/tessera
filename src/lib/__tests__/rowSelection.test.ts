/**
 * Headless-проверка плагина rowSelection.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { resolveHooks } from '../core/createHooks'
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
      features: { coreReactivityFeature: storeReactivityBindings() },
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
    // Живая свёртка бизнес-хуков из аргументов фабрик (как в useCreateTable).
    hooks: resolveHooks(foldHooks(entries)),
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

  it('бизнес-колбэки из аргументов фабрики попадают в hook-слайс записи', () => {
    const onSelectRow = vi.fn()
    const entry = rowSelection({ onSelectRow })
    expect(entry.hooks?.rowSelection).toMatchObject({ onSelectRow })
  })

  it('foldHooks + resolveHooks: колбэк доступен, отсутствующие ключи — no-op дефолты', () => {
    const onSelectRow = vi.fn()
    const resolved = resolveHooks(
      foldHooks([rowSelection({ onSelectRow })] as never),
    ) as any
    expect(resolved.rowSelection.onSelectRow).toBe(onSelectRow)
    // Незаданные ключи scope дополнены дефолтами, а не затёрты частичным слайсом.
    expect(typeof resolved.rowSelection.onSelectAllRowsOnPage).toBe('function')
    expect(resolved.rowSelection.isAllRowsSelected).toBe(false)
  })

  it('table.getHooks() читает колбэк, заданный в аргументах фабрики, живо', () => {
    const onSelectRow = vi.fn()
    const { table } = makeTable({ onSelectRow })
    const hooks = table.getHooks() as any
    expect(hooks.rowSelection.onSelectRow).toBe(onSelectRow)
    // Дефолты остального scope на месте.
    expect(typeof hooks.rowSelection.onSelectAllRowsOnPage).toBe('function')
  })

  it('foldHooks игнорирует отключённые записи (enabled: false)', () => {
    const onSelectRow = vi.fn()
    const folded = foldHooks([
      rowSelection({ onSelectRow, enabled: false }),
    ] as never)
    expect(folded).toEqual({})
  })

  it('гейт группировки: enableRowSelection false при активной группировке', () => {
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

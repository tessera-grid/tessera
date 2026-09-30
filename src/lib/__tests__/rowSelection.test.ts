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
import { countSelectedRows } from '../plugins/rowSelection/SelectedRowsCount'
import { captureInertWarnings } from './inertWarnings'

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
  const warnings = captureInertWarnings()

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

  it('H2: частичный слайс хуков дополняется no-op дефолтами scope, не затирая заданный колбэк', () => {
    const onSelectRow = vi.fn()
    const resolved = resolveHooks(
      foldHooks([rowSelection({ onSelectRow })] as never),
    ) as any
    expect(resolved.rowSelection.onSelectRow).toBe(onSelectRow)
    // Незаданные ключи scope дополнены дефолтами, а не затёрты частичным слайсом.
    expect(typeof resolved.rowSelection.onSelectAllRowsOnPage).toBe('function')
    expect(resolved.rowSelection.isAllRowsSelected).toBe(false)
  })

  it('H1: колбэк из аргументов фабрики доступен через table.getHooks()', () => {
    const onSelectRow = vi.fn()
    const { table } = makeTable({ onSelectRow })
    const hooks = table.getHooks() as any
    expect(hooks.rowSelection.onSelectRow).toBe(onSelectRow)
    // Дефолты остального scope на месте.
    expect(typeof hooks.rowSelection.onSelectAllRowsOnPage).toBe('function')
  })

  it('H3: отключённый плагин (enabled: false) не вносит хуков', () => {
    const onSelectRow = vi.fn()
    const folded = foldHooks([
      rowSelection({ onSelectRow, enabled: false }),
    ] as never)
    expect(folded).toEqual({})
  })

  it('PC11: активная группировка делает rowSelection инертным и предупреждает', () => {
    const { folded } = makeTable()
    const enableRowSelection = (folded.options as any).enableRowSelection

    // Без активной группировки (атома нет / пустая) → доступен, тишина.
    expect(enableRowSelection({ table: { atoms: {} } })).toBe(true)
    expect(
      enableRowSelection({ table: { atoms: { grouping: { get: () => [] } } } }),
    ).toBe(true)
    expect(warnings()).toHaveLength(0)

    const grouped = { table: { atoms: { grouping: { get: () => ['name'] } } } }
    expect(enableRowSelection(grouped)).toBe(false)
    enableRowSelection(grouped)
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('rowSelection')

    // Плагин отключён → опция жёстко false, гейт с варном не вызывается.
    expect(makeTable({ enabled: false }).folded.options).toMatchObject({
      enableRowSelection: false,
    })
  })
})

describe('rowSelection — счётчик выбранных строк', () => {
  it('RS20: число — id со значением true в срезе rowSelection: выбор на других страницах тоже считается', () => {
    // `off-page` нет в текущей странице данных — выбор всё равно учитывается.
    expect(countSelectedRows({ '1': true, '2': true, 'off-page': true })).toBe(
      3,
    )
    expect(countSelectedRows({})).toBe(0)
    expect(countSelectedRows(undefined)).toBe(0)
  })
})

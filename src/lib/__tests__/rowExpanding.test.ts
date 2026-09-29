/**
 * Headless-проверка инъекции сервисных колонок и плагина rowExpanding.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { COLUMN_EXPANDING_ID, rowExpanding } from '../plugins/rowExpanding'
import { rowGrouping } from '../plugins/rowGrouping'
import { captureInertWarnings } from './inertWarnings'

interface Person {
  id: string
  name: string
  subRows?: Person[]
}

const makeTable = (opts = {}, extraEntries: any[] = []) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...extraEntries,
    rowExpanding(opts),
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
      { id: '1', name: 'A', subRows: [{ id: '1a', name: 'A1' }] },
      { id: '2', name: 'B' },
    ] as Person[],
    columns,
    getRowId: (row: Person) => row.id,
    getSubRows: (row: Person) => row.subRows,
    ...folded.options,
  } as never) as any

  return { table, folded, columns }
}

describe('injectServiceColumns', () => {
  it('leading сервисная колонка встаёт первой, пользовательские следом', () => {
    const columns = injectServiceColumns(
      [{ id: 'name' }, { id: 'age' }],
      [
        {
          id: 'svc',
          make: () => ({ id: 'svc' }) as never,
          side: 'leading',
          order: 2,
        },
      ],
    )
    expect(columns.map((c: any) => c.id)).toEqual(['svc', 'name', 'age'])
  })

  it('пустой набор пользовательских колонок → пусто', () => {
    expect(
      injectServiceColumns(
        [],
        [
          {
            id: 'svc',
            make: () => ({ id: 'svc' }) as never,
            side: 'leading',
            order: 0,
          },
        ],
      ),
    ).toEqual([])
  })
})

describe('rowExpanding', () => {
  const warnings = captureInertWarnings()

  it('foldEntries даёт опции раскрытия и сервисную колонку', () => {
    const { folded } = makeTable()
    expect(folded.options).toMatchObject({
      enableExpanding: true,
      autoResetExpanded: false,
    })
    expect(typeof (folded.options as any).getRowCanExpand).toBe('function')
    expect(folded.serviceColumns.map(c => c.id)).toContain(COLUMN_EXPANDING_ID)
  })

  it('колонка раскрытия инъектирована первой', () => {
    const { columns } = makeTable()
    expect((columns[0] as any).id).toBe(COLUMN_EXPANDING_ID)
  })

  it('getRowCanExpand: корень с детьми раскрываем, дети — нет (maxDepth 1)', () => {
    const { table } = makeTable()
    const [root] = table.getRowModel().rows
    expect(root.getCanExpand()).toBe(true)

    root.toggleExpanded(true)
    const child = table.getRowModel().rows.find((r: any) => r.id === '1a')
    expect(child).toBeTruthy()
    expect(child.getCanExpand()).toBe(false)
  })

  it('лист без детей не раскрываем', () => {
    const { table } = makeTable()
    const leaf = table.getRowModel().rows.find((r: any) => r.id === '2')
    expect(leaf.getCanExpand()).toBe(false)
  })

  it('PC5: при активной группировке раскрытием владеет rowGrouping, maxDepth игнорируется, предупреждает', () => {
    const { table } = makeTable({ maxDepth: 0 }, [rowGrouping()])

    // Без группировки — своя семантика: maxDepth 0 гасит раскрытие, тишина.
    expect(table.getRowModel().rows[0].getCanExpand()).toBe(false)
    expect(warnings()).toHaveLength(0)

    table.setGrouping(['name'])
    const [groupRow] = table.getRowModel().rows
    expect(groupRow.getIsGrouped()).toBe(true)
    expect(groupRow.getCanExpand()).toBe(true)
    groupRow.getCanExpand()
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('rowExpanding')
  })

  it('expandedRowModel: раскрытие корня добавляет детей в модель', () => {
    const { table } = makeTable()
    expect(table.getRowModel().rows.map((r: any) => r.id)).toEqual(['1', '2'])
    table.getRowModel().rows[0].toggleExpanded(true)
    expect(table.getRowModel().rows.map((r: any) => r.id)).toContain('1a')
  })
})

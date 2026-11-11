/**
 * Линейная сборка групп шапки (ADR 0209, HG1–HG4): паритет с `buildHeaderGroups` TanStack, пересборка
 * по срезам колонок, страж зависимостей мемо TanStack и число созданных заголовков.
 * Запуск: npx vitest run --config vitest.node.config.ts headerGroups
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildHeaderGroups } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'

import { buildHeaderGroupsLinear } from '../core/headerGroups'
import { columnPinning, columnVisibility } from '../plugins'
import { hostTable } from './tableHost'

const leaf = (id: string) => ({ id, accessorKey: id, header: id })

const FLAT = Array.from({ length: 30 }, (_, k) => leaf(`c${k}`))

/** Мелкий лист, группа над листьями, ветка глубины 3 — как у фикстуры вложенной шапки. */
const NESTED = [
  leaf('country'),
  {
    id: 'name',
    header: 'Name',
    columns: [leaf('firstName'), leaf('lastName')],
  },
  {
    id: 'info',
    header: 'Info',
    columns: [
      leaf('age'),
      {
        id: 'more',
        header: 'More',
        columns: [leaf('visits'), leaf('status'), leaf('progress')],
      },
    ],
  },
  leaf('total'),
]

const tableOf = (columns: unknown[]) =>
  hostTable({
    columns,
    data: [],
    getRowId: (row: { id: string }) => row.id,
    plugins: [columnPinning(), columnVisibility()],
  }) as any

const orderedLeaves = (table: any) => {
  const leaves = table.getVisibleLeafColumns()
  return (
    table._orderByColumnPinning?.(leaves, (column: any) => column.id) ?? leaves
  )
}

/** Форма групп шапки: всё, что читают шапка, футер, навигация и спаны. */
const shapeOf = (groups: any[]) =>
  groups.map(group => ({
    id: group.id,
    depth: group.depth,
    headers: group.headers.map((header: any) => ({
      id: header.id,
      column: header.column.id,
      colSpan: header.colSpan,
      rowSpan: header.rowSpan,
      isPlaceholder: header.isPlaceholder,
      placeholderId: header.placeholderId,
      index: header.index,
      depth: header.depth,
      group: header.headerGroup?.id,
      sub: header.subHeaders.map((child: any) => child.id),
    })),
  }))

const stockOf = (table: any) =>
  shapeOf(buildHeaderGroups(table.getAllColumns(), orderedLeaves(table), table))

describe('Линейная сборка групп шапки (ADR 0209)', () => {
  it('HG1: группы шапки совпадают с buildHeaderGroups TanStack — плоская и вложенная шапка, закрепление групп и листьев, скрытые колонки', () => {
    for (const columns of [FLAT, NESTED]) {
      const table = tableOf(columns)
      expect(shapeOf(table.getHeaderGroups())).toEqual(stockOf(table))
    }
    const table = tableOf(NESTED)
    // Лист закреплён отдельно от своей группы: группа делится на части.
    table.setColumnPinning({ start: ['firstName'], end: ['visits'] })
    expect(shapeOf(table.getHeaderGroups())).toEqual(stockOf(table))
    table.setColumnVisibility({ lastName: false, status: false })
    expect(shapeOf(table.getHeaderGroups())).toEqual(stockOf(table))
  })

  it('HG2: группы шапки пересобираются при смене колонок, их порядка, закрепления и видимости — паритет после каждой смены', () => {
    const table = tableOf(NESTED)
    const before = table.getHeaderGroups()
    table.setColumnOrder(['total', 'info', 'country', 'name'])
    expect(table.getHeaderGroups()).not.toBe(before)
    expect(shapeOf(table.getHeaderGroups())).toEqual(stockOf(table))
    table.setColumnPinning({ start: ['country'], end: [] })
    expect(shapeOf(table.getHeaderGroups())).toEqual(stockOf(table))
    table.setColumnVisibility({ age: false })
    expect(shapeOf(table.getHeaderGroups())).toEqual(stockOf(table))
    table.setOptions((prev: any) => ({ ...prev, columns: FLAT }))
    expect(shapeOf(table.getHeaderGroups())).toEqual(stockOf(table))
  })

  it('HG3: зависимости мемо table_getHeaderGroups у coreHeadersFeature TanStack — те же, что у сборки Tessera', () => {
    const source = readFileSync(
      join(
        __dirname,
        '../../../node_modules/@tanstack/table-core/dist/core/headers/coreHeadersFeature.js',
      ),
      'utf8',
    )
    const block =
      /table_getHeaderGroups:\s*\{[\s\S]*?memoDeps:\s*\(\)\s*=>\s*\[([\s\S]*?)\]/.exec(
        source,
      )?.[1]
    const deps = (block ?? '')
      .split(',')
      .map(dep => dep.trim())
      .filter(Boolean)
    // Смена списка в TanStack — пересмотреть зависимости в `commonFeature` (ADR 0209, §2).
    expect(deps).toEqual([
      'table.options.columns',
      'table.atoms.columnOrder?.get()',
      'table.atoms.grouping?.get()',
      'table.atoms.columnPinning?.get()',
      'table.atoms.columnVisibility?.get()',
      'table.options.groupedColumnMode',
    ])
  })

  it('HG4: сборка создаёт по заголовку на каждое место шапки — без верхнего уровня, который TanStack строит и выбрасывает', () => {
    const table = tableOf(FLAT)
    let created = 0
    const count = () => {
      created++
    }
    table._headerInstanceInitFns.push(count)
    try {
      created = 0
      const groups = buildHeaderGroupsLinear(
        table.getAllColumns(),
        orderedLeaves(table),
        table,
      )
      expect(created).toBe(groups.flatMap(group => group.headers).length)
      expect(created).toBe(FLAT.length)
      created = 0
      buildHeaderGroups(table.getAllColumns(), orderedLeaves(table), table)
      expect(created).toBe(2 * FLAT.length)
    } finally {
      table._headerInstanceInitFns.splice(
        table._headerInstanceInitFns.indexOf(count),
        1,
      )
    }
  })
})

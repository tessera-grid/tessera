/**
 * Фаза B — запускаемая проверка v9-ядра: presence-based сборка
 * (`buildTesseraFeatures`) + рантайм `commonFeature` на headless-инстансе
 * (`constructTable` + `storeReactivityBindings`, без React).
 *
 * Запуск:  npx vitest run --config vitest.v9.config.ts
 */
import {
  constructTable,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
} from '@tanstack/react-table'
// storeReactivityBindings не реэкспортится react-адаптером — прямой файловый путь
// во вложенный core (приём тестов v9-слоя; в рантайме ядро даёт свой биндинг).
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { buildTesseraFeatures } from '../core/features'

interface Person {
  id: string
  name: string
}

const makeTable = () => {
  const features = buildTesseraFeatures([
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    {
      id: 'columnSorting',
      slot: {
        rowSortingFeature,
        sortedRowModel: createSortedRowModel(),
        sortFns: { alphanumeric: sortFn_alphanumeric },
      },
    },
  ])

  return constructTable({
    features,
    data: [
      { id: '1', name: 'Борис' },
      { id: '2', name: 'Анна' },
    ] as Person[],
    columns: [{ id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' }],
    getRowId: (row: Person) => row.id,
    hooks: { marker: true },
  } as never) as any
}

describe('v9 ядро: presence-based сборка + commonFeature', () => {
  it('commonFeature отдаёт table API (getHooks из опций)', () => {
    const table = makeTable()
    expect(table.getHooks()).toEqual({ marker: true })
  })

  it('getIsAnyColumnResizing гардит отсутствие columnResizingFeature', () => {
    const table = makeTable()
    expect(table.getIsAnyColumnResizing()).toBe(false)
  })

  it('column API commonFeature: обычная колонка не является колонкой действий', () => {
    const table = makeTable()
    const [column] = table.getAllLeafColumns()
    expect(column.getIsActionsColumn()).toBe(false)
    expect(column.getIsRowActionsColumn()).toBe(false)
  })

  it('row API commonFeature: первая/последняя строка после сортировки', () => {
    const table = makeTable()
    table.setSorting([{ id: 'name', desc: false }])

    const rows = table.getRowModel().rows
    expect(rows.map((r: any) => r.original.name)).toEqual(['Анна', 'Борис'])
    expect(rows[0].getIsFirstRow()).toBe(true)
    expect(rows[0].getIsLastRow()).toBe(false)
    expect(rows.at(-1).getIsLastRow()).toBe(true)
  })

  it('headerGroup API commonFeature: флаги первой/последней группы', () => {
    const table = makeTable()
    const groups = table.getHeaderGroups()
    expect(groups[0].getIsFirstGroup()).toBe(true)
    expect(groups.at(-1).getIsLastGroup()).toBe(true)
  })
})

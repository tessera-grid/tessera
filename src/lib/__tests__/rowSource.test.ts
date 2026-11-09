/**
 * Источник строк ядра (ADR 0138, этап 1; SD1–SD2): клиентский источник совпадает с
 * моделью строк TanStack, а модели строк библиотека читает только в модулях списка
 * стража с причиной.
 * Запуск: npx vitest run --config vitest.node.config.ts rowSource
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import type { RowSource } from '../core/rowSource'
import {
  columnFiltering,
  columnSorting,
  pagination,
  quickSearch,
  rowExpanding,
  rowGrouping,
} from '../plugins'

interface Item {
  id: string
  name: string
  city: string
  subRows?: Item[]
}

const item = (id: string, city: string, subRows?: Item[]): Item => ({
  id,
  name: `Name ${id}`,
  city,
  ...(subRows ? { subRows } : {}),
})
const DATA: Item[] = [
  item('a', 'Paris', [item('a1', 'Lima'), item('a2', 'Oslo')]),
  item('b', 'Rome'),
  item('c', 'Paris', [item('c1', 'Rome')]),
  item('d', 'Oslo'),
  item('e', 'Rome'),
  item('f', 'Oslo'),
]
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]

const build = () => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnSorting(),
    columnFiltering(),
    quickSearch(),
    rowGrouping(),
    rowExpanding(),
    pagination({ initialPageSize: 4 }),
  ]
  const folded = foldEntries(entries as never)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data: DATA,
    columns: injectServiceColumns(COLUMNS as any[], folded.serviceColumns),
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    ...folded.options,
    hooks: resolveHooks(foldHooks(entries as never)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
  } as never) as any
}

/** Источник совпадает с `getRowModel()` и с `getRow(id, true)` TanStack. */
const expectParity = (table: any) => {
  const source = table.getRowSource() as RowSource<{ id: string }>
  const { rows } = table.getRowModel()
  expect(source.count()).toBe(rows.length)
  rows.forEach((row: { id: string }, index: number) => {
    expect(source.at(index)?.id).toBe(row.id)
    expect(source.indexOf(row.id)).toBe(index)
  })
  expect(source.at(rows.length)).toBeUndefined()
  expect(source.at(-1)).toBeUndefined()
  const shown = new Set(rows.map((row: { id: string }) => row.id))
  const ids = [
    ...Object.keys(table.getCoreRowModel().rowsById),
    ...Object.keys(table.getPrePaginatedRowModel().rowsById),
  ]
  for (const id of ids) {
    // Источник отдаёт строки движка, getRow — стоковый вид: сверка по id (ADR 0200, §6).
    expect(source.byId(id)?.id).toBe(table.getRow(id, true)?.id)
    if (!shown.has(id)) expect(source.indexOf(id)).toBe(-1)
  }
  expect(source.byId('missing')).toBeUndefined()
  expect(source.indexOf('missing')).toBe(-1)
}

describe('Источник строк ядра (ADR 0138)', () => {
  it('SD1: count, at, byId и indexOf клиентского источника совпадают с моделью TanStack при сортировке, фильтре, группировке, раскрытии и странице', () => {
    const table = build()
    expectParity(table)

    table.setSorting([{ id: 'name', desc: true }])
    expectParity(table)

    table.setExpanded({ c: true })
    expectParity(table)

    table.setPageIndex(1)
    expectParity(table)
    table.setPageIndex(0)

    table.setColumnFilters([
      { id: 'city', value: { operator: 'contains', value: 'o' } },
    ])
    expectParity(table)
    table.setColumnFilters([])

    table.setGlobalFilter('Name b')
    expectParity(table)
    table.setGlobalFilter('')

    table.setGrouping(['city'])
    table.setExpanded(true)
    expectParity(table)
    table.setExpanded({})
    expectParity(table)
  })

  it('SD2: модели строк TanStack библиотека читает только в модулях списка стража с причиной; запись без чтения моделей роняет страж', () => {
    const root = join(__dirname, '..')
    const readers = sourceFiles(root)
      .filter(file => MODEL_READ.test(readFileSync(file, 'utf8')))
      .map(file => relative(root, file).replace(/\\/g, '/'))
      .sort()
    const unlisted = readers.filter(file => !(file in MODEL_READERS))
    const stale = Object.keys(MODEL_READERS).filter(
      file => !readers.includes(file),
    )
    const listed = THROUGH_SOURCE.filter(file => file in MODEL_READERS)
    expect({ unlisted, stale, listed }).toEqual({
      unlisted: [],
      stale: [],
      listed: [],
    })
    for (const reason of Object.values(MODEL_READERS)) {
      expect(reason.length).toBeGreaterThan(10)
    }
  })
})

/** Модули, которые читают строки только через источник (ADR 0138, §2). */
const THROUGH_SOURCE = [
  'core/virtualization/rowVirtualizer.ts',
  'core/keyboardNavigation/actions.ts',
  'plugins/cellSelection/keys.ts',
  'core/keyboardNavigation/focus.ts',
  'core/keyboardNavigation/gridKeyDown.ts',
  'core/keyboardNavigation/model.ts',
  'plugins/cellEditing/session.ts',
  'plugins/rowSelectionModel/selectionHelpers.ts',
  'core/skeletonOptions.ts',
  'plugins/backToTop/model.ts',
  'grid/FooterCell.tsx',
  'grid/DataGrid.tsx',
  'core/useTableEffects.ts',
  'core/commonFeature.ts',
]

/**
 * Чтение моделей строк TanStack: вызов метода модели и обращение к словарю `rowsById`. Описание
 * типа (`getCoreRowModel: () => …`) — не чтение; фасеты (`getFacetedRowModel`) — стоковая фича
 * поверх ленивых видов движка (ADR 0200, §6).
 */
const MODEL_READ =
  /\.get(?:Pre)?(?:Core|Filtered|Grouped|Sorted|Expanded|Paginated)?RowModel\??\.?\(|\.rowsById\b/

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return ['__tests__', 'stories', '__mocks__'].includes(name)
        ? []
        : sourceFiles(path)
    }
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })

/**
 * Кто читает модели строк мимо источника и почему. Список только сокращается: модуль,
 * переведённый на источник, уходит из списка.
 */
const MODEL_READERS: Record<string, string> = {
  'core/rowEngine/engine.ts':
    'каркас движка: вход стадии — модель ядра или выход прежней стадии (ADR 0200, §2)',
  'core/rowEngine/rows.ts':
    'чтение строк движка для ядра, грида и плагинов — место конвейера по виду (ADR 0200, §6)',
  'core/rowEngine/stockView.ts':
    'стоковый вид выхода стадии для table.get*RowModel() (ADR 0200, §6)',
  'core/rowEngine/rowDict.ts':
    'словарь хранилища с версиями: модель версии отдаёт словарь своей версии (ADR 0200, §2)',
  'core/rowSource.ts':
    'источник строк клиентского режима — выход движка (ADR 0200, §2)',
  'core/dataChanges.ts':
    'хранилище: смена data из прежней модели ядра (ADR 0194, ADR 0200, §7)',
  'plugins/rowExpanding/lazyCoreRowModel.ts':
    'хранилище: модель ядра ленивого дерева (ADR 0054, ADR 0200, §2)',
  'shared/rowModels/filteredRowModel.ts':
    'стадия фильтра и поиска движка (ADR 0200, §3)',
  'plugins/rowGroupingModel/groupStage.ts':
    'стадия группировки движка (ADR 0200, §3)',
  'plugins/columnSortingModel/sortedRowModel.ts':
    'стадия сортировки движка (ADR 0200, §3)',
  'shared/rowModels/expandedRowModel.ts':
    'стадия раскрытия движка (ADR 0200, §3)',
  'plugins/paginationModel/pageStage.ts':
    'стадия страницы движка (ADR 0200, §3)',
}

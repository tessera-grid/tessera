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
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'city', accessorKey: 'city', header: 'City', filter: 'text' },
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
    expect(source.at(index)).toBe(row)
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
    expect(source.byId(id)).toBe(table.getRow(id, true))
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
  'core/keyboardNavigation/cellSelectionSync.ts',
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

/** Чтение моделей строк TanStack: методы моделей и словарь `rowsById`. */
const MODEL_READ =
  /\bget(?:Pre)?(?:Core|Filtered|Grouped|Sorted|Expanded|Paginated|Faceted)?RowModel\b|\browsById\b/

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
  'core/rowSource.ts': 'клиентский источник строк — над моделью TanStack',
  'shared/rowModels/expandedRowModel.ts':
    'фабрика модели раскрытия клиентского режима (ADR 0070)',
  'shared/rowModels/filteredRowModel.ts':
    'фабрика модели фильтрации клиентского режима (ADR 0045, 0068)',
  'shared/rowModels/rowsByIdHandover.ts':
    'передача словаря между моделями клиентского режима (ADR 0069)',
  'plugins/columnSortingModel/sortedRowModel.ts':
    'фабрика модели сортировки клиентского режима (ADR 0064, 0072)',
  'plugins/rowExpanding/lazyCoreRowModel.ts':
    'фабрика исходной модели ленивого дерева (ADR 0067)',
  'plugins/rowExpanding/ExpandAllComponent.tsx':
    'свёрнутые раскрываемые строки клиентского режима — подпись кнопки «Раскрыть всё»; в SSRM — срез (ADR 0160)',
  'plugins/rowGroupingModel/groupedRowModel.ts':
    'фабрика модели группировки клиентского режима (ADR 0068)',
  'plugins/columnFilteringModel/options.ts':
    'варианты и счётчики фильтра из данных клиентского режима (ADR 0048)',
  'core/scrollToRow/scrollToRowFeature.ts':
    'путь до строки в дереве и страница по корню (ADR 0104); незагруженные строки SSRM — этап 3',
  'core/servicePresence.ts':
    'есть ли подстроки в данных — показ служебной колонки (ADR 0050)',
  'plugins/rowDragging/BodyBoundary.tsx':
    'строки модели для перетаскивания клиентского режима; в SSRM — источник через dragRows (ADR 0159)',
  'plugins/rowDragging/dragRows.ts':
    'строки перетаскивания клиентского режима — модель TanStack; в SSRM — источник (ADR 0159)',
  'plugins/rowDragging/getRowDraggingEvents.ts':
    'раскрытие групп и сёстры для отката клиентского режима; в SSRM — транзакция источника (ADR 0159)',
  'plugins/rowDragging/moveRow.ts':
    'перестановка в порядке данных клиентского режима; в SSRM — транзакция источника (ADR 0159)',
  'plugins/rowDragging/reconcileRowMoves.ts':
    'согласование переносов с данными клиентского режима; в SSRM — кэш источника (ADR 0159)',
  'grid/LiveRegion.tsx':
    'объявление числа строк после фильтра клиентского режима (ADR 0045)',
  'shared/filtering/FilteredRowsCount.tsx':
    'счётчик «показано N из M» по данным клиентского режима (ADR 0045)',
  'plugins/rowSelection/SelectedRowsCount.tsx':
    'выбранные строки, скрытые фильтром, по данным клиентского режима (ADR 0045)',
  'plugins/dataExport/ExportPanel.tsx':
    'число строк данных для подписи выгрузки; в SSRM выгрузка серверная (SD30)',
  'plugins/dataExportModel/exportData.ts':
    'обход данных для выгрузки всех и выбранных строк; в SSRM выгрузка серверная (SD30)',
  'plugins/infiniteScroll/InfiniteTail.tsx':
    'лента считает строки в data приложения (ADR 0081); в SSRM инертна (SD26)',
  'plugins/infiniteScroll/LoadedRowsCount.tsx':
    'лента считает строки в data приложения (ADR 0081); в SSRM инертна (SD26)',
  'plugins/rowExpanding/answerBatch.ts':
    'ленивые дети клиентского режима (ADR 0066); в SSRM — этап 5',
  'plugins/rowExpanding/narrowExpanded.ts':
    'сужение раскрытия по дереву данных (ADR 0039); в SSRM — этап 5',
  'plugins/rowExpanding/reconcileLoadedChildren.ts':
    'согласование ответов ленивых детей с данными (ADR 0054); в SSRM — этап 5',
  'plugins/rowExpanding/registry.ts':
    'ленивые дети клиентского режима (ADR 0054); в SSRM — этап 5',
}

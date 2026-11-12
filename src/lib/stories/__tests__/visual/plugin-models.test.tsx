import axe from 'axe-core'
import type { RowSelectionState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import type { TesseraFeatureEntry } from '../../../core/features'
import { DataGrid } from '../../../grid/DataGrid'
import { BodyRowCells } from '../../../grid/BodyRow'
import { HeadCellView } from '../../../grid/HeadCell'
import {
  cellEditing,
  cellSelection,
  cellSelectionModel,
  columnFiltering,
  columnFilteringModel,
  columnSorting,
  columnSortingModel,
  dataExport,
  dataExportModel,
  pagination,
  paginationModel,
  quickSearch,
  quickSearchModel,
  rowExpanding,
  rowExpandingModel,
  rowGrouping,
  rowGroupingModel,
  rowSelection,
  rowSelectionModel,
} from '../../../plugins'
import { COLUMN_EXPANDING_ID } from '../../../plugins/rowExpanding/rowExpandingColumn'
import { COLUMN_SELECTION_ID } from '../../../plugins/rowSelection/rowSelectionColumn'
import { Stories } from '../helpers'
import { columns as mockColumns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import { describeWork, measureWork, renders } from '../work.helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Плагины модели без интерфейса (ADR 0120): видимое состояние модели без контролов.

type Args = Partial<Parameters<typeof Stories.DataGridPlayground>[0]>

const BASE: Args = {
  containerHeight: 600,
  height: 500,
  columnCount: 5,
  dataCount: 30,
}

const SELECTED = 'item-id-1'
const OTHER = 'item-id-2'

const cellEl = (row: string, column: string) =>
  rowEl(row)!.querySelector<HTMLElement>(`[data-column-id="${column}"]`)!
const selectedCells = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      ".data-grid__body-cell[data-cell-selected='true']",
    ),
  ].map(
    cell =>
      `${cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}/${cell.dataset.columnId}`,
  )

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )

describe('Плагины модели без интерфейса (ADR 0120)', () => {
  test('MP13: rowSelectionModel без колонки флажков — выбранная строка залита выбором и несёт aria-selected; axe с color-contrast в обеих темах', async () => {
    const screen = await render(
      <Stories.DataGridPlayground
        {...BASE}
        enableRowSelectionModel
        enableKeyboardNavigation
        rowSelectionModelRowSelection={{ [SELECTED]: true }}
      />,
    )
    await expect.poll(() => rowEl(SELECTED)).not.toBeNull()
    expect(
      document.querySelector(`[data-column-id="${COLUMN_SELECTION_ID}"]`),
    ).toBeNull()

    const selected = rowEl(SELECTED)!
    const other = rowEl(OTHER)!
    expect(selected.getAttribute('data-selected')).toBe('true')
    expect(selected.getAttribute('aria-selected')).toBe('true')
    expect(other.getAttribute('aria-selected')).toBe('false')
    expect(getComputedStyle(selected).backgroundColor).not.toBe(
      getComputedStyle(other).backgroundColor,
    )

    const grid = document.querySelector<HTMLElement>('[role="grid"]')!
    expect(grid).not.toBeNull()
    await inBothThemes(async () => {
      const result = await axe.run(grid, {
        ...AXE_OPTIONS,
        rules: {
          ...AXE_OPTIONS.rules,
          'color-contrast': { enabled: true },
        },
      })
      expect(result.violations).toEqual([])
    })
    await screen.unmount()
  })

  test('MP14: cellSelectionModel подсвечивает диапазоны из среза; мышь, клавиши и копирование выделение не меняют и не копируют', async () => {
    const range = [
      {
        anchorRowId: 'item-id-1',
        anchorColumnId: 'firstName',
        focusRowId: 'item-id-2',
        focusColumnId: 'lastName',
      },
    ]
    const screen = await render(
      <Stories.DataGridPlayground
        {...BASE}
        enableCellSelectionModel
        enableKeyboardNavigation
        cellSelectionModelInitialCellSelection={range}
      />,
    )
    const highlighted = [
      'item-id-1/firstName',
      'item-id-1/lastName',
      'item-id-2/firstName',
      'item-id-2/lastName',
    ]
    await expect.poll(() => selectedCells().sort()).toEqual(highlighted)

    await userEvent.click(cellEl('item-id-5', 'country'))
    await expect
      .poll(() => cellEl('item-id-5', 'country').hasAttribute('data-kn-active'))
      .toBe(true)
    await userEvent.keyboard(
      '{ArrowDown}{Shift>}{ArrowDown}{ArrowRight}{/Shift}',
    )
    expect(selectedCells().sort()).toEqual(highlighted)

    const data = new DataTransfer()
    const copy = new ClipboardEvent('copy', {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    })
    cellEl('item-id-1', 'firstName').dispatchEvent(copy)
    expect(copy.defaultPrevented).toBe(false)
    expect(data.getData('text/plain')).toBe('')
    await screen.unmount()
  })
})

// --- MP1, MP3: каждая пара «модель — интерфейс» на своём гриде ------------------------

interface Item {
  id: string
  name: string
  age: number
  gender: string
  subRows?: Item[]
}

const NAMES = ['Ann', 'Bob', 'Cid', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal']
const ITEMS: Item[] = NAMES.map((name, i) => ({
  id: `r${i}`,
  name,
  age: 20 + ((i * 7) % 30),
  gender: i % 2 ? 'f' : 'm',
}))
const TREE: Item[] = [
  { ...ITEMS[0]!, subRows: [{ ...ITEMS[1]!, id: 'r0-0' }] },
  ...ITEMS.slice(2),
]
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age', dataType: 'number' },
  { id: 'gender', accessorKey: 'gender', header: 'Gender' },
]

let host: any
const Host = ({
  plugins,
  data,
}: {
  plugins: TesseraFeatureEntry[]
  data: Item[]
}) => {
  host = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: plugins as never,
  })
  return (
    <div style={{ width: 640, height: 480 }}>
      <DataGrid table={host} />
    </div>
  )
}

const shownIds = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row:not(.data-grid__body-row--skeleton)',
    ),
  ]
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .map(row => row.dataset.rowId!)
const ageOf = (id: string) =>
  [...ITEMS, ...TREE.flatMap(item => item.subRows ?? [])].find(
    item => item.id === id,
  )!.age
const exists = (selector: string) => document.querySelector(selector) !== null

interface Pair {
  name: string
  data?: Item[]
  /** Модель со срезом в аргументах. */
  model: (enabled?: boolean) => TesseraFeatureEntry
  /** Интерфейс с тем же срезом: он передаёт его своей модели. */
  ui: (enabled: boolean) => TesseraFeatureEntry
  /** Срез применён: строки, их порядок или вид выбора. */
  applied: () => boolean
  /** Контролы интерфейса на экране. */
  controls: string
  /** API модели на таблице. */
  api?: string
}

const SORTING = [{ id: 'age', desc: true }]
const PAGE = { pageIndex: 1, pageSize: 3 }
const FILTERS = [{ id: 'age', value: { operator: 'greaterThan', value: 35 } }]
const RANGE = [
  {
    anchorRowId: 'r1',
    anchorColumnId: 'name',
    focusRowId: 'r2',
    focusColumnId: 'age',
  },
]

const PAIRS: Pair[] = [
  {
    name: 'rowExpanding',
    data: TREE,
    model: enabled => rowExpandingModel({ enabled, expanded: true }),
    ui: enabled => rowExpanding({ enabled, expanded: true }),
    applied: () => shownIds().includes('r0-0'),
    controls: `[data-column-id="${COLUMN_EXPANDING_ID}"]`,
  },
  {
    name: 'columnSorting',
    model: enabled => columnSortingModel({ enabled, sorting: SORTING }),
    ui: enabled => columnSorting({ enabled, sorting: SORTING }),
    applied: () => {
      const ages = shownIds().map(ageOf)
      return (
        ages.length > 1 &&
        ages.every((age, i) => i === 0 || ages[i - 1]! >= age) &&
        ages[0]! > ages.at(-1)!
      )
    },
    controls: '.column-sort__button',
  },
  {
    name: 'pagination',
    model: enabled => paginationModel({ enabled, pagination: PAGE }),
    ui: enabled => pagination({ enabled, pagination: PAGE }),
    applied: () => shownIds().join() === 'r3,r4,r5',
    controls: '[data-testid="pagination"]',
  },
  {
    name: 'columnFiltering',
    model: enabled =>
      columnFilteringModel({ enabled, columnFilters: FILTERS as never }),
    ui: enabled =>
      columnFiltering({ enabled, columnFilters: FILTERS as never }),
    applied: () =>
      shownIds().length > 0 &&
      shownIds().length < ITEMS.length &&
      shownIds().every(id => ageOf(id) > 35),
    controls: '.column-filter__button, [data-testid="view-settings-button"]',
  },
  {
    name: 'quickSearch',
    model: enabled => quickSearchModel({ enabled, globalFilter: 'Bob' }),
    ui: enabled => quickSearch({ enabled, globalFilter: 'Bob' }),
    applied: () => shownIds().join() === 'r1',
    controls: '[data-testid="quick-search"]',
  },
  {
    name: 'rowGrouping',
    model: enabled => rowGroupingModel({ enabled, grouping: ['gender'] }),
    ui: enabled => rowGrouping({ enabled, grouping: ['gender'] }),
    applied: () =>
      shownIds().length > 0 && shownIds().every(id => id.startsWith('gender:')),
    controls: '.column-group__button',
  },
  {
    name: 'rowSelection',
    model: enabled =>
      rowSelectionModel({ enabled, rowSelection: { r1: true } }),
    ui: enabled => rowSelection({ enabled, rowSelection: { r1: true } }),
    applied: () =>
      exists('.data-grid__body-row[data-row-id="r1"][data-selected="true"]'),
    controls: `[data-column-id="${COLUMN_SELECTION_ID}"]`,
  },
  {
    name: 'cellSelection',
    model: enabled => cellSelectionModel({ enabled, cellSelection: RANGE }),
    ui: enabled => cellSelection({ enabled, cellSelection: RANGE }),
    applied: () =>
      document.querySelectorAll(
        ".data-grid__body-cell[data-cell-selected='true']",
      ).length === 4,
    // Жесты не видны в DOM: их отсутствие без интерфейса доказывает MP14.
    controls: '[data-tessera-never]',
  },
  {
    name: 'dataExport',
    model: enabled => dataExportModel({ enabled }),
    ui: enabled => dataExport({ enabled }),
    applied: () => typeof host.exportData === 'function',
    controls: '[data-testid="export-button"]',
    api: 'exportData',
  },
]

const mountPair = async (pair: Pair, plugins: TesseraFeatureEntry[]) =>
  render(<Host plugins={plugins} data={pair.data ?? ITEMS} />)

describe('Пары «модель — интерфейс» (ADR 0120)', () => {
  test('MP1: каждая модель без своего интерфейса применяет свой срез и даёт API TanStack, а грид не рисует контролов интерфейса', async () => {
    for (const pair of PAIRS) {
      const screen = await mountPair(pair, [pair.model()])
      await expect.poll(pair.applied, { message: pair.name }).toBe(true)
      expect(exists(pair.controls), pair.name).toBe(false)
      expect(exists('[data-testid="data-grid-toolbar"]'), pair.name).toBe(false)
      if (pair.api) expect(typeof host[pair.api], pair.name).toBe('function')
      await screen.unmount()
    }
  })

  test('MP3: enabled: false у интерфейса при явной модели убирает контролы, модель применяет срез; без явной модели выключенный интерфейс гасит и модель', async () => {
    for (const pair of PAIRS) {
      const withModel = await mountPair(pair, [pair.model(), pair.ui(false)])
      await expect.poll(pair.applied, { message: pair.name }).toBe(true)
      expect(exists(pair.controls), pair.name).toBe(false)
      await withModel.unmount()

      // API выгрузки фича даёт и выключенной: гасить в ней нечего.
      if (pair.api) continue
      const alone = await mountPair(pair, [pair.ui(false)])
      await expect.poll(() => shownIds().length > 0).toBe(true)
      expect(pair.applied(), pair.name).toBe(false)
      expect(exists(pair.controls), pair.name).toBe(false)
      await alone.unmount()

      const on = await mountPair(pair, [pair.ui(true)])
      await expect.poll(pair.applied, { message: pair.name }).toBe(true)
      await on.unmount()
    }
  })
})

const ControlledSelection = () => {
  const [selection, setSelection] = useState<RowSelectionState>({})
  const columns = useMemo(() => mockColumns.slice(0, 5), [])
  const data = useMemo(() => getData(20), [])
  const table = useCreateTable({
    columns: columns as never,
    data,
    plugins: [
      rowSelection({
        rowSelection: selection,
        onRowSelectionChange: setSelection as never,
      }),
      cellEditing(),
    ] as never,
  })
  return (
    <div style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
      <DataGrid table={table as never} height={560} />
    </div>
  )
}

describe('Контролируемый срез модели (ADR 0120)', () => {
  test('MP20: приложение ведёт выбор строк аргументом интерфейса — выбор строки перерисовывает только её, шапку и остальные строки — нет', async () => {
    const screen = await render(<ControlledSelection />)
    await expect
      .poll(() => document.querySelectorAll('.data-grid__body-row').length)
      .toBeGreaterThan(5)
    const checkbox = () =>
      document.querySelector<HTMLElement>(
        ".data-grid__body-row[data-row-id='item-id-1'] .row-select-checkbox",
      )!
    const work = await measureWork(
      document.querySelector('.data-grid__body-row')!,
      () => checkbox().click(),
    )
    expect(
      document
        .querySelector(".data-grid__body-row[data-row-id='item-id-1']")
        ?.getAttribute('data-selected'),
    ).toBe('true')
    expect(renders(work, BodyRowCells), describeWork(work)).toBe(1)
    expect(renders(work, HeadCellView), describeWork(work)).toBe(0)
    await screen.unmount()
  })
})

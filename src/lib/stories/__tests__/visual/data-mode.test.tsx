import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import type { DataMode } from '../../../core/dataMode'
import { foldEntries, type TesseraFeatureEntry } from '../../../core/features'
import { collectExportData } from '../../../plugins/dataExportModel/exportData'
import { expandIncludedModels } from '../../../core/pluginModels'
import { firstChangedIndex } from '../../../core/rowChanges'
import { isServerAction } from '../../../core/serverActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnSorting,
  dataExport,
  infiniteScroll,
  pagination,
  quickSearch,
} from '../../../plugins'
import { pluginFactories } from '../../../__tests__/builtinPlugins'
import { tableLabels } from '../labels'
import { waitForGrid } from './core-helpers'

// Режим операции у ядра (ADR 0169, MD3): серверные действия, объявления числа строк и
// подсказка виртуализатору; язык и пояс таблицы (MD7). Остальные — модульные (`dataMode.dom`).

interface Item {
  id: string
  name: string
  city: string
}

const DATA: Item[] = [
  { id: '1', name: 'Alice', city: 'Paris' },
  { id: '2', name: 'Bob', city: 'Oslo' },
  { id: '3', name: 'Alina', city: 'Oslo' },
  { id: '4', name: 'Carl', city: 'Paris' },
]

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'city', accessorKey: 'city', header: 'City', filter: 'text' },
]

let table: any

const Grid = ({
  dataMode,
  plugins,
  data = DATA,
}: {
  dataMode: DataMode
  plugins: readonly unknown[]
  data?: Item[]
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    enableToolbar: true,
    dataMode,
    plugins: plugins as never,
  })
  return (
    <div style={{ height: 400, width: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const liveMessages = () => {
  const region = document.querySelector<HTMLElement>(
    '[role="status"][aria-live="polite"]',
  )!
  const messages: string[] = []
  const observer = new MutationObserver(() => {
    const text = region.textContent ?? ''
    if (text) messages.push(text)
  })
  observer.observe(region, {
    childList: true,
    characterData: true,
    subtree: true,
  })
  return { messages, stop: () => observer.disconnect() }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 300))

describe('режим данных у ядра (ADR 0169)', () => {
  test('MD3: серверные действия, объявления и подсказка виртуализатору узнают режим операции у ядра (dataModeOf); аргументов server у моделей и их интерфейсов и опций columnFilteringServer, quickSearchServer нет', async () => {
    // Фильтры колонок на сервере, поиск по загруженным строкам.
    const screen = await render(
      <Grid
        dataMode={{ filtering: 'server', search: 'client' }}
        plugins={[
          columnSorting(),
          columnFiltering({ debounceMs: 0, onFilterChange: () => {} }),
          quickSearch(),
        ]}
      />,
    )
    await waitForGrid()
    expect(
      ['sorting', 'filtering', 'search'].map(kind =>
        isServerAction(table, kind as never),
      ),
    ).toEqual([false, true, false])

    const live = liveMessages()
    table.setColumnFilters([
      { id: 'city', value: { operator: 'contains', value: 'Paris' } },
    ])
    await settle()
    // Фильтр ушёл на сервер: числа строк ещё нет.
    expect(live.messages).toEqual([])

    const search = document.querySelector<HTMLInputElement>(
      '[data-testid="quick-search"]',
    )!
    // Дебаунс поиска по умолчанию: объявляется результат, а не каждая буква.
    await userEvent.type(search, 'Ali')
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(live.messages).toEqual([tableLabels.announceFilteredRows(2)])
    live.stop()
    await screen.unmount()

    // Лента дописывает строки: сортировка на сервере порядок не меняет — подсказка есть.
    const hintWith = async (dataMode: DataMode) => {
      const feed = await render(
        <Grid
          dataMode={dataMode}
          plugins={[columnSorting(), infiniteScroll({ hasMore: true })]}
        />,
      )
      await waitForGrid()
      table.setSorting([{ id: 'name', desc: true }])
      const hint = firstChangedIndex(
        table,
        { data: DATA.slice(0, 2), count: 2, keyByIndex: false },
        { data: DATA, count: 4, keyByIndex: false },
      )
      await feed.unmount()
      return hint
    }
    expect(await hintWith({ sorting: 'server' })).toBe(2)
    expect(await hintWith({ sorting: 'client' })).toBeUndefined()

    // Аргумент `server` фабрик ничего не меняет, режимных опций у плагинов нет.
    const optionsOf = (entry: TesseraFeatureEntry) =>
      JSON.stringify(foldEntries(expandIncludedModels([entry]).entries).options)
    for (const [name, factory] of pluginFactories()) {
      const plain = factory({}) as TesseraFeatureEntry
      const server = factory({ server: true }) as TesseraFeatureEntry
      expect(optionsOf(server), name).toBe(optionsOf(plain))
      const lifetime = expandIncludedModels([server]).entries.flatMap(
        entry => entry.lifetimeArgs ?? [],
      )
      expect(lifetime, name).not.toContain('server')
      expect(optionsOf(server), name).not.toMatch(
        /columnFilteringServer|quickSearchServer/,
      )
    }
  })

  test('MD7: locale и timeZone в useCreateTable: подписи и числа, фильтр дат и выгрузка следуют им; пропа locale у DataGrid и аргументов timeZone нет; dateLocale — аргумент columnFiltering', async () => {
    const MANY = Array.from({ length: 2000 }, (_, index) => ({
      id: String(index),
      name: `Row ${index}`,
      created: index === 0 ? '2026-10-03T23:30:00Z' : '2026-10-01T12:00:00Z',
    }))
    const DateGrid = ({
      locale,
      timeZone,
      gridLocale,
    }: {
      locale?: string
      timeZone?: string
      gridLocale?: string
    }) => {
      table = useCreateTable({
        columns: [
          { id: 'name', accessorKey: 'name', header: 'Name' },
          {
            id: 'created',
            accessorKey: 'created',
            header: 'Created',
            filter: 'datetime',
          },
        ] as never,
        data: MANY,
        getRowId: (row: (typeof MANY)[number]) => row.id,
        enableToolbar: true,
        locale,
        timeZone,
        plugins: [
          pagination({ initialPageSize: 25 }),
          columnFiltering({ debounceMs: 0 }),
          dataExport(),
        ] as never,
      })
      return (
        <div style={{ height: 400, width: 600 }}>
          <DataGrid
            table={table as never}
            {...(gridLocale ? ({ locale: gridLocale } as object) : {})}
          />
        </div>
      )
    }
    const statusText = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="data-grid-status-bar"]',
      )?.textContent ?? ''

    // Числа подписей — по языку таблицы, смена на лету без пересоздания.
    const screen = await render(<DateGrid locale="de-DE" />)
    await waitForGrid()
    await expect.poll(statusText).toContain('2.000')
    await screen.rerender(<DateGrid locale="en-US" />)
    await expect.poll(statusText).toContain('2,000')
    await screen.unmount()

    // Проп locale у DataGrid не действует.
    const ignored = await render(<DateGrid gridLocale="de-DE" />)
    await waitForGrid()
    await expect.poll(statusText).toContain('2,000')
    await ignored.unmount()

    // Фильтр дат и выгрузка — в поясе таблицы.
    const onThird = async (timeZone: string) => {
      const grid = await render(<DateGrid timeZone={timeZone} />)
      await waitForGrid()
      table.setColumnFilters([
        { id: 'created', value: { operator: 'on', value: '2026-10-03' } },
      ])
      const rows = (table.getRowModel().rows as { id: string }[]).map(
        row => row.id,
      )
      const exported = collectExportData(table).timeZone
      await grid.unmount()
      return { rows, exported }
    }
    expect(await onThird('UTC')).toEqual({ rows: ['0'], exported: 'UTC' })
    expect(await onThird('Asia/Tokyo')).toEqual({
      rows: [],
      exported: 'Asia/Tokyo',
    })

    // Аргумента timeZone у фильтра нет, dateLocale — аргумент columnFiltering.
    const optionsOf = (entry: TesseraFeatureEntry) =>
      foldEntries(expandIncludedModels([entry]).entries).options
    expect(
      JSON.stringify(
        optionsOf(
          columnFiltering({
            timeZone: 'Asia/Tokyo',
          } as never) as TesseraFeatureEntry,
        ),
      ),
    ).toBe(JSON.stringify(optionsOf(columnFiltering() as TesseraFeatureEntry)))
    const dateLocale = { code: 'ru' } as never
    expect(
      optionsOf(columnFiltering({ dateLocale }) as TesseraFeatureEntry),
    ).toMatchObject({ columnFilteringDateLocale: dateLocale })
  })
})

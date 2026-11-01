import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  dataExport,
  pagination,
  quickSearch,
  rowSelection,
} from '../../../plugins'
import { bodyRows, getScroller } from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'

// Включение тулбара и нижней панели (ADR 0046, PB1–PB5, PB10–PB11): без флага —
// по наличию слотов, флаг переопределяет. PB6 — `toolbar-chunk.test.tsx`, PB7–PB9 —
// модульные. Показ панели читается по `data-toolbar` / `data-status-bar` рамки:
// атрибут ставится синхронно, ленивый чанк тулбара ждать не нужно.

const DATA = Array.from({ length: 40 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
}))
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

type Plugins = readonly unknown[]

interface GridProps {
  plugins: Plugins
  enableToolbar?: boolean
  enableStatusBar?: boolean
  onTable?: (table: any) => void
}

const Grid = ({
  plugins,
  enableToolbar,
  enableStatusBar,
  onTable,
}: GridProps) => {
  const table = useCreateTable({
    columns: COLUMNS,
    data: DATA,
    enableToolbar,
    enableStatusBar,
    plugins: plugins as never,
  })
  onTable?.(table)
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const frame = () => getScroller().parentElement!
const hasToolbar = () => frame().hasAttribute('data-toolbar')
const hasStatusBar = () => frame().hasAttribute('data-status-bar')
const toolbar = () => document.querySelector<HTMLElement>('[role="toolbar"]')
const statusBar = () =>
  document.querySelector<HTMLElement>('[data-testid="data-grid-status-bar"]')
const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const rowIds = () => bodyRows().map(row => row.dataset.rowId)

const mount = async (props: GridProps) => {
  const screen = await render(<Grid {...props} />)
  await waitForGrid()
  return screen
}

describe('Panels', () => {
  test('PB1: without enableToolbar the toolbar shows when an active toolbarSlot exists, and is absent without slots', async () => {
    const bare = await mount({ plugins: [rowSelection()] })
    await nextFrame()
    expect(hasToolbar()).toBe(false)
    expect(toolbar()).toBeNull()
    await bare.unmount()

    await mount({ plugins: [quickSearch()] })
    expect(hasToolbar()).toBe(true)
    await expect.poll(toolbar).not.toBeNull()
    expect(byTestId('quick-search')).not.toBeNull()
  })

  test('PB2: enableToolbar: true shows the toolbar without slots; false hides it despite slots', async () => {
    const forced = await mount({ plugins: [], enableToolbar: true })
    expect(hasToolbar()).toBe(true)
    await expect.poll(toolbar).not.toBeNull()
    expect(toolbar()!.querySelectorAll('button')).toHaveLength(0)
    await forced.unmount()

    await mount({
      plugins: [quickSearch(), dataExport()],
      enableToolbar: false,
    })
    await nextFrame()
    expect(hasToolbar()).toBe(false)
    expect(toolbar()).toBeNull()
    expect(byTestId('quick-search')).toBeNull()
  })

  test('PB3: enableStatusBar: true shows the status bar without slots; false hides it despite slots', async () => {
    const forced = await mount({ plugins: [], enableStatusBar: true })
    expect(hasStatusBar()).toBe(true)
    expect(statusBar()).not.toBeNull()
    expect(statusBar()!.textContent).toBe('')
    await forced.unmount()

    await mount({
      plugins: [pagination(), rowSelection({ selectedCount: true })],
      enableStatusBar: false,
    })
    expect(hasStatusBar()).toBe(false)
    expect(statusBar()).toBeNull()
    expect(byTestId('pagination')).toBeNull()
  })

  test('PB4: while a plugin is active its slot stays — an empty search result and cleared selection keep both panels', async () => {
    await mount({
      plugins: [
        quickSearch({ debounceMs: 0 }),
        rowSelection({ selectedCount: true }),
      ],
    })
    await expect.poll(toolbar).not.toBeNull()
    expect(hasStatusBar()).toBe(true)

    const checkbox = () =>
      bodyRows()[0].querySelector<HTMLElement>('.row-select-checkbox')!
    await userEvent.click(checkbox())
    await expect
      .poll(() => byTestId('selected-rows-count')!.textContent)
      .not.toBe('')
    await userEvent.click(checkbox())
    await expect
      .poll(() => byTestId('selected-rows-count')!.textContent)
      .toBe('')
    expect(hasStatusBar()).toBe(true)

    await userEvent.type(byTestId('quick-search')!, 'zzz')
    await expect.poll(rowIds).toEqual([])
    expect(hasToolbar()).toBe(true)
    expect(hasStatusBar()).toBe(true)
    expect(toolbar()).not.toBeNull()
    expect(statusBar()).not.toBeNull()
  })

  test('PB5: toggling enabled of the only slot owner at runtime shows and removes the toolbar and the status bar', async () => {
    const Toggled = ({ on }: { on: boolean }) => (
      <Grid
        plugins={[dataExport({ enabled: on }), pagination({ enabled: on })]}
      />
    )
    const screen = await render(<Toggled on />)
    await waitForGrid()
    expect(hasToolbar()).toBe(true)
    expect(hasStatusBar()).toBe(true)

    await screen.rerender(<Toggled on={false} />)
    await expect.poll(hasToolbar).toBe(false)
    await expect.poll(hasStatusBar).toBe(false)
    expect(toolbar()).toBeNull()
    expect(statusBar()).toBeNull()

    await screen.rerender(<Toggled on />)
    await expect.poll(hasToolbar).toBe(true)
    await expect.poll(hasStatusBar).toBe(true)
    await expect.poll(toolbar).not.toBeNull()
  })

  test('PB10: with enableStatusBar: false pagination pages rows without a switcher; setPageIndex and setPageSize change visible rows', async () => {
    let table: any
    await mount({
      plugins: [pagination({ initialPageSize: 10 })],
      enableStatusBar: false,
      onTable: t => (table = t),
    })
    expect(byTestId('pagination')).toBeNull()
    await expect.poll(rowIds).toEqual(DATA.slice(0, 10).map(row => row.id))

    table.setPageIndex(1)
    await expect.poll(rowIds).toEqual(DATA.slice(10, 20).map(row => row.id))

    table.setPageSize(5)
    await expect.poll(() => rowIds().length).toBe(5)
  })

  test('PB11: with enableStatusBar: false the selected and filtered counters are not drawn while rowSelection and columnFiltering stay active', async () => {
    let table: any
    await mount({
      plugins: [
        rowSelection({ selectedCount: true }),
        columnFiltering({ filteredCount: true }),
      ],
      enableStatusBar: false,
      onTable: t => (table = t),
    })
    table.setRowSelection({ '1': true })
    table.setColumnFilters([
      { id: 'name', value: { operator: 'contains', value: 'Name 1' } },
    ])
    await expect.poll(() => rowIds().length).toBe(11)
    expect(byTestId('selected-rows-count')).toBeNull()
    expect(byTestId('filtered-rows-count')).toBeNull()
    expect(statusBar()).toBeNull()

    const diagnostics = table.getPluginDiagnostics() as {
      id: string
      status: string
    }[]
    const statusOf = (id: string) => diagnostics.find(d => d.id === id)?.status
    expect(statusOf('rowSelection')).toBe('active')
    expect(statusOf('columnFiltering')).toBe('active')
  })
})

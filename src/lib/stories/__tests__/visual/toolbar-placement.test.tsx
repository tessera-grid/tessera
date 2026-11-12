import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnSorting,
  columnVisibility,
  dataExport,
  quickSearch,
} from '../../../plugins'
import { waitForGrid } from './core-helpers'

// Размещение встроенных кнопок тулбара аргументом фабрики (ADR 0205, TO5): клавиатура и узкая
// ширина в новом порядке. TO1–TO4, TO6 — модульные (`toolbarPlacement`, `toolbarPlacement.dom`).

const DATA = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  city: ['Paris', 'Oslo'][i % 2]!,
}))

const Grid = ({ width }: { width: number }) => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
      { id: 'city', accessorKey: 'city', header: 'City', size: 200 },
    ] as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      quickSearch(),
      columnFiltering(),
      // «Экспорт» — слева, после поля поиска.
      columnSorting({ initialSorting: [{ id: 'name', desc: false }] }),
      columnVisibility(),
      dataExport({
        toolbar: { group: 'search', align: 'start', order: 'last' },
      }),
    ] as never,
  })
  return (
    <div style={{ width, height: 420 }}>
      <DataGrid table={table as never} height={380} />
    </div>
  )
}

const toolbar = () => document.querySelector<HTMLElement>('[role="toolbar"]')!
const byTestId = (id: string) =>
  toolbar().querySelector<HTMLElement>(`[data-testid="${id}"]`)
const rect = (el: Element) => el.getBoundingClientRect()
const focused = () => document.activeElement?.getAttribute('data-testid')

const ORDER = ['quick-search', 'export-button', 'view-settings-button']

const mount = async (width: number) => {
  const screen = await render(<Grid width={width} />)
  await waitForGrid()
  // Клавиатура — по пришедшим кнопкам: смена заглушки посреди нажатий — предмет LZ25 (ADR 0061).
  for (const id of ['export-button', 'view-settings-button'])
    await expect
      .poll(() => byTestId(id)?.hasAttribute('data-base-ui-click-trigger'))
      .toBe(true)
  return screen
}

describe('Размещение кнопок тулбара (ADR 0205)', () => {
  test('TO5: ←/→ и Home/End проходят кнопки в новом порядке; узкий тулбар сжимает поле поиска, стороны не наезжают', async () => {
    const wide = await mount(900)
    expect(byTestId('sorting-summary-button')).toBeNull()
    const wideRects = ORDER.map(id => rect(byTestId(id)!))
    for (let i = 1; i < wideRects.length; i++)
      expect(wideRects[i]!.left, ORDER[i]).toBeGreaterThan(
        wideRects[i - 1]!.right,
      )
    // «Экспорт» — слева, вплотную к полю поиска; «Настройки вида» — справа.
    const gap = parseFloat(getComputedStyle(toolbar()).columnGap)
    expect(wideRects[1]!.left - wideRects[0]!.right).toBeCloseTo(gap, 0)
    const bar = rect(toolbar())
    expect(wideRects[1]!.right).toBeLessThan(bar.left + bar.width / 2)
    expect(wideRects[2]!.left).toBeGreaterThan(bar.left + bar.width / 2)

    byTestId('export-button')!.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(focused()).toBe('view-settings-button')
    await userEvent.keyboard('{ArrowLeft}')
    expect(focused()).toBe('export-button')
    await userEvent.keyboard('{Home}')
    expect(focused()).toBe('quick-search')
    byTestId('export-button')!.focus()
    await userEvent.keyboard('{End}')
    expect(focused()).toBe('view-settings-button')
    await wide.unmount()

    // Узко: сжимается поле поиска, кнопки целиком, стороны не наезжают.
    const narrow = await mount(320)
    const narrowRects = ORDER.map(id => rect(byTestId(id)!))
    expect(narrowRects[0]!.width).toBeLessThan(wideRects[0]!.width)
    for (let i = 1; i < narrowRects.length; i++) {
      expect(narrowRects[i]!.width, ORDER[i]).toBeCloseTo(
        wideRects[i]!.width,
        0,
      )
      expect(narrowRects[i]!.left, ORDER[i]).toBeGreaterThan(
        narrowRects[i - 1]!.right,
      )
    }
    expect(narrowRects[2]!.right).toBeLessThanOrEqual(rect(toolbar()).right)
    await narrow.unmount()
  })
})

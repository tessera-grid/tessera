import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import { definePlugin } from '../../../core/definePlugin'
import { neverInert } from '../../../core/pluginDiagnostics'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellSelection,
  rowExpanding,
  rowGroupingModel,
  rowSelection,
} from '../../../plugins'
import { __resetLogger, __setLoggerProduction } from '../../../util/logger'
import { humanClick } from '../helpers'

// Подписки узла по объявленным срезам на гриде (ADR 0195; CD5–CD7): встроенные вкладчики
// обновляют свои цели, выбор строки не будит ячейки, строка-группа следует за выбором
// своих строк.

interface Item {
  id: string
  name: string
  team: string
  subRows?: Item[]
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'team', accessorKey: 'team', header: 'Team' },
]
const ROWS: Item[] = Array.from({ length: 12 }, (_, k) => ({
  id: `r${k}`,
  name: `N${k}`,
  team: k % 2 ? 'Odd' : 'Even',
}))

const Grid = ({
  plugins,
  data = ROWS,
  keyboard = false,
}: {
  plugins: unknown[]
  data?: Item[]
  keyboard?: boolean
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    enableKeyboardNavigation: keyboard,
    plugins: plugins as never,
  })
  return (
    <div style={{ width: 600, height: 460 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const rowById = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
const checkbox = (id: string) =>
  rowById(id)!.querySelector<HTMLElement>('[role="checkbox"]')!
const cell = (id: string, column: string) =>
  rowById(id)!.querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  __resetLogger()
  warn = vi.spyOn(console, 'warn')
})
afterEach(() => {
  warn.mockRestore()
  __setLoggerProduction(undefined)
  __resetLogger()
})
const undeclared = () =>
  warn.mock.calls.filter(([text]: unknown[]) =>
    String(text).includes('which is not in its slices'),
  )

describe('Подписки узла по объявленным срезам (ADR 0195)', () => {
  test('CD5: встроенные вкладчики обновляют свои цели по своим срезам — выбор строк aria-selected строки, выделение ячеек data-cell-selected — без предупреждений о необъявленных срезах', async () => {
    __setLoggerProduction(false)
    const screen = await render(
      <Grid keyboard plugins={[rowSelection(), cellSelection()]} />,
    )
    try {
      await expect.poll(() => rowById('r2')).not.toBeNull()
      await humanClick(checkbox('r2'))
      await expect
        .poll(() => rowById('r2')!.getAttribute('aria-selected'))
        .toBe('true')
      expect(rowById('r3')!.getAttribute('aria-selected')).toBe('false')
      await humanClick(cell('r4', 'name'))
      await userEvent.click(cell('r6', 'team'), { modifiers: ['Shift'] })
      await expect
        .poll(() => cell('r5', 'team').getAttribute('data-cell-selected'))
        .toBe('true')
      expect(cell('r7', 'name').hasAttribute('data-cell-selected')).toBe(false)
      expect(undeclared()).toEqual([])
    } finally {
      await screen.unmount()
    }
  })

  test('CD6: клик выбора строки не вызывает выборов узлов ячеек; выбранной отмечается только своя строка', async () => {
    __setLoggerProduction(true)
    const calls = { cells: 0 }
    const counted = definePlugin<{ enabled?: boolean }>()({
      id: 'counted',
      diagnose: neverInert,
      body: () => ({
        cell: {
          slices: [],
          select: () => {
            calls.cells++
            return null
          },
          render: () => null,
        },
        row: {
          slices: [],
          select: () => null,
          render: () => null,
        },
      }),
    })
    const screen = await render(<Grid plugins={[rowSelection(), counted()]} />)
    try {
      await expect.poll(() => rowById('r2')).not.toBeNull()
      calls.cells = 0
      await humanClick(checkbox('r2'))
      await expect
        .poll(() => rowById('r2')!.getAttribute('data-selected'))
        .toBe('true')
      expect(calls.cells).toBe(0)
      expect(
        [
          ...document.querySelectorAll(
            '.data-grid__body-row[data-selected="true"]',
          ),
        ].map(row => (row as HTMLElement).dataset.rowId),
      ).toEqual(['r2'])
    } finally {
      await screen.unmount()
    }
  })

  test('CD7: строка-группа клиентской группировки отмечается выбранной, когда выбраны все её строки', async () => {
    const grouped = await render(
      <Grid
        plugins={[
          rowGroupingModel({ initialGrouping: ['team'] }),
          rowExpanding({ initialExpanded: true }),
          rowSelection(),
        ]}
      />,
    )
    try {
      const group = () => q('.data-grid__body-row[data-row-id="team:Odd"]')!
      await expect.poll(() => rowById('r1')).not.toBeNull()
      for (const id of ['r1', 'r3', 'r5', 'r7', 'r9', 'r11']) {
        await humanClick(checkbox(id))
      }
      await expect
        .poll(() => group().getAttribute('data-selected'))
        .toBe('true')
    } finally {
      await grouped.unmount()
    }
  })
})

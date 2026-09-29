import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'

// PE1–PE2: падение рендера плагина изолировано (ADR 0037). Компоненты плагина бросают
// исключение для одной колонки/строки; грид и остальные ячейки обязаны отрисоваться.

const COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A' },
  { id: 'b', accessorKey: 'b', header: 'B' },
]
const DATA = [
  { id: '1', a: 'a1', b: 'b1' },
  { id: '2', a: 'a2', b: 'b2' },
]

const boom = (): never => {
  throw new Error('plugin render failed')
}

const HeaderBadge = ({ column }: { column: { id: string } }) =>
  column.id === 'a' ? boom() : <span data-testid={`badge-${column.id}`} />

const slotPlugin = {
  id: 'brokenSlot',
  slots: [{ id: 'badge', slot: 'rightHeaderSlot', component: HeaderBadge }],
}

const MarkCell = ({ row }: { row: { id: string } }) =>
  row.id === '1' ? boom() : <span data-testid={`mark-${row.id}`} />

const columnPlugin = {
  id: 'brokenColumn',
  column: {
    id: 'mark',
    side: 'leading',
    order: 0,
    make: () => ({ id: 'mark', header: 'M', size: 40, cell: MarkCell }),
  },
}

const Grid = ({ plugins }: { plugins: readonly any[] }) => {
  const table = useCreateTable({
    columns: COLUMNS,
    data: DATA,
    plugins,
  } as never)
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const bodyText = () =>
  [...document.querySelectorAll('.data-grid__body-cell')].map(
    cell => cell.textContent,
  )

describe('Изоляция падений плагинов (ADR 0037)', () => {
  test('PE1: исключение в компоненте слота не роняет грид; остальные слоты и ячейки на месте', async () => {
    const plugins = [slotPlugin] as const
    const view = await render(<Grid plugins={plugins} />)

    await expect.poll(() => bodyText()).toContain('a1')
    expect(bodyText()).toContain('b2')
    expect(document.querySelector('[data-testid="badge-b"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="badge-a"]')).toBeNull()
    await view.unmount()
  })

  test('PE2: исключение в cell сервисной колонки не роняет грид; её прочие ячейки и колонка на месте', async () => {
    const plugins = [columnPlugin] as const
    const view = await render(<Grid plugins={plugins} />)

    await expect.poll(() => bodyText()).toContain('a1')
    expect(
      document.querySelector('.data-grid__head-cell[data-column-id="mark"]'),
    ).not.toBeNull()
    expect(document.querySelector('[data-testid="mark-2"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="mark-1"]')).toBeNull()
    await view.unmount()
  })
})

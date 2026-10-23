import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { keyboardNavigation } from '../../../plugins/keyboardNavigation'
import { rowDragging } from '../../../plugins/rowDragging'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'

// PE1–PE2: падение рендера плагина изолировано (ADR 0037). Компоненты плагина бросают
// исключение для одной колонки/строки; грид и остальные ячейки обязаны отрисоваться.
// PE7: граница не перемонтирует служебные ячейки при новой ссылке `columns`.

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

const HANDLE_DATA = Array.from({ length: 20 }, (_, i) => ({
  id: String(i),
  a: `a${i}`,
  b: `b${i}`,
}))

// Колонки — литералом: каждая перерисовка хоста даёт новую ссылку `columns`.
const HandleGrid = ({
  keyboard,
  pass,
}: {
  keyboard: boolean
  pass: number
}) => {
  const [data, setData] = useState(HANDLE_DATA)
  const [, setPresses] = useState(0)
  const table = useCreateTable({
    columns: [
      { id: 'a', accessorKey: 'a', header: `A${pass}` },
      { id: 'b', accessorKey: 'b', header: 'B' },
    ],
    data,
    getRowId: (row: (typeof HANDLE_DATA)[number]) => row.id,
    plugins: [
      keyboardNavigation({ enabled: keyboard }),
      rowDragging({ onRowOrderChange: setData as never }),
    ],
  } as never)
  return (
    <div
      style={{ height: 300 }}
      onPointerDownCapture={() => setPresses(count => count + 1)}
    >
      <DataGrid table={table as never} />
    </div>
  )
}

const handleOf = (rowId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .drag__handler--column`,
  )

const menuItem = (label: string) =>
  [...document.querySelectorAll('[role="menuitem"]')].find(
    item =>
      (
        item.querySelector('[class*="itemLabel"]') ?? item
      ).textContent?.trim() === label,
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

  test('PE7: новая ссылка columns не перемонтирует ячейки служебной колонки — узел ручки и фокус на нём сохраняются, нажатие с перерисовкой открывает меню ручки с первого раза', async () => {
    for (const keyboard of [false, true]) {
      const view = await render(<HandleGrid keyboard={keyboard} pass={0} />)
      await expect.poll(() => handleOf('3')).not.toBeNull()

      const handle = handleOf('3')!
      handle.focus()
      expect(document.activeElement).toBe(handle)
      await view.rerender(<HandleGrid keyboard={keyboard} pass={1} />)
      expect(handleOf('3')).toBe(handle)
      expect(document.activeElement).toBe(handle)

      // Хост перерисовывается на pointerdown — новые колонки посреди нажатия.
      await userEvent.hover(handle.closest('.data-grid__body-cell')!)
      await humanClick(handle)
      await expect.poll(() => menuItem(tableLabels.moveDown)).toBeTruthy()
      expect(handleOf('3')).toBe(handle)
      await view.unmount()
    }
  })
})

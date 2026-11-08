/**
 * Сдвиг строк окна в dev-сборке React (ADR 0199, MS12): журнал отрисовки React 19 сравнивает
 * пропсы перерисованных компонент, и большой объект в пропсах обходится целиком. Вставка в окно
 * не должна стоить на порядок дороже вставки вне окна. Браузерные тесты идут в dev-сборке.
 */
import { cleanup, render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'
import { useState } from 'react'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnSortingModel, rowDragging } from '../../../plugins'
import { waitForGrid } from './core-helpers'

interface Row {
  id: string
  a: string
  b: number
}
const rowsOf = (from: number, count: number): Row[] =>
  Array.from({ length: count }, (_, k) => ({
    id: `r${from + k}`,
    a: `Name ${from + k}`,
    b: (from + k) % 997,
  }))

const COUNT = 100_000
let table: { applyRowTransaction: (transaction: object) => unknown }

const Grid = ({ plugins }: { plugins: () => unknown[] }) => {
  const [rows, setRows] = useState(() => rowsOf(0, COUNT))
  const [entries] = useState(plugins)
  table = useCreateTable({
    columns: [
      { id: 'a', accessorKey: 'a', size: 200 },
      { id: 'b', accessorKey: 'b', size: 120 },
    ] as never,
    data: rows,
    getRowId: (row: Row) => row.id,
    onDataChange: (next: Row[]) => setRows(next),
    enableKeyboardNavigation: true,
    plugins: entries as never,
  }) as never
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const frames = () =>
  new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  )

/** Время до кадра у вставки трёх строк на место `at`: медиана трёх. */
const insertCost = async (plugins: () => unknown[], at: number) => {
  await render(<Grid plugins={plugins} />)
  await waitForGrid()
  const times: number[] = []
  for (let n = 0; n < 3; n++) {
    const start = performance.now()
    table.applyRowTransaction({ add: rowsOf(COUNT * 3 + n * 3, 3), index: at })
    await frames()
    times.push(performance.now() - start)
  }
  await cleanup()
  return times.sort((a, b) => a - b)[1]!
}

afterEach(() => cleanup())

describe('Сдвиг строк окна в dev-сборке (ADR 0199)', () => {
  test('MS12: вставка в окно на 100 000 строк в dev-сборке не дороже вставки вне окна больше чем в 3 раза или на 150 мс — без плагинов, с сортировкой и перетаскиванием строк', async () => {
    const setups: [string, () => unknown[]][] = [
      ['без плагинов', () => []],
      [
        'сортировка и перетаскивание',
        () => [columnSortingModel(), rowDragging()],
      ],
    ]
    for (const [name, plugins] of setups) {
      const outside = await insertCost(plugins, 50_000)
      const inside = await insertCost(plugins, 2)
      expect(
        inside,
        `${name}: в окне ${inside.toFixed(0)} мс, вне окна ${outside.toFixed(0)} мс`,
      ).toBeLessThanOrEqual(Math.max(outside * 3, outside + 150))
    }
  }, 120_000)
})

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { humanClick } from '../helpers'

// Вход в грид с клавиатуры снаружи (ADR 0021, KN32). Набор зависит от движка: Firefox
// держит прокручиваемые области в порядке Tab — идёт и в `npm run test:browsers`.

const DATA = Array.from({ length: 300 }, (_, i) => ({
  id: `r${i}`,
  a: `A${i}`,
  b: `B${i}`,
}))
const COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', size: 160 },
  { id: 'b', accessorKey: 'b', header: 'B', size: 160 },
]

const Grid = () => {
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
  })
  return (
    <div>
      <button type="button" data-testid="before">
        before
      </button>
      <div style={{ width: 480, height: 400 }}>
        <DataGrid table={table as never} />
      </div>
      <button type="button" data-testid="after">
        after
      </button>
    </div>
  )
}

const frames = async (count = 5) => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame)
}
const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!

describe('Клавиатура — вход в грид снаружи', () => {
  test('KN32: Tab и Shift+Tab снаружи — сразу на активную ячейку, без остановки на контейнере и обёртках ячеек и без прокрутки тела', async () => {
    await render(<Grid />)
    await expect
      .poll(() => document.querySelectorAll('.data-grid__body-row').length)
      .toBeGreaterThan(0)
    const active = document.querySelector<HTMLElement>(
      '.data-grid__body-row[data-row-id="r0"] [data-column-id="b"]',
    )!
    await humanClick(active)
    await frames()
    expect(document.activeElement).toBe(active)

    const stops: Element[] = []
    document.addEventListener('focusin', event =>
      stops.push(event.target as Element),
    )

    byTestId('after').focus()
    stops.length = 0
    await userEvent.tab({ shift: true })
    await frames()
    expect(document.activeElement).toBe(active)
    expect(stops).toEqual([active])
    expect(scroller().scrollTop).toBe(0)

    byTestId('before').focus()
    stops.length = 0
    await userEvent.tab()
    await frames()
    expect(document.activeElement).toBe(active)
    expect(stops).toEqual([active])
    expect(scroller().scrollTop).toBe(0)
  })
})

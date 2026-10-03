import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { quickSearch, rowSelection } from '../../../plugins'
import { nextFrame, waitForGrid } from './core-helpers'

// Ленивый модуль тулбара (ADR 0046, PB6). Отдельный файл: модуль грузится один раз
// на документ, а каждый файл набора идёт в своём iframe. Загрузку видно по стилю
// CSS-модуля тулбара — dev-сервер Vite вставляет его вместе с модулем.

const DATA = [{ id: '1', name: 'Alice' }]
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

const Grid = ({ plugins }: { plugins: readonly unknown[] }) => {
  const table = useCreateTable({
    columns: COLUMNS,
    data: DATA,
    plugins: plugins as never,
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const toolbarModuleLoaded = () =>
  !!document.querySelector('style[data-vite-dev-id*="Toolbar.module.css"]')

describe('Toolbar chunk', () => {
  test('PB6: the toolbar module loads only when the toolbar shows — not without slots and without true', async () => {
    const bare = await render(<Grid plugins={[rowSelection()]} />)
    await waitForGrid()
    await nextFrame()
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(toolbarModuleLoaded()).toBe(false)
    await bare.unmount()

    await render(<Grid plugins={[quickSearch()]} />)
    await waitForGrid()
    await expect.poll(toolbarModuleLoaded).toBe(true)
    await expect
      .poll(() => document.querySelector('[role="toolbar"]'))
      .not.toBeNull()
  })
})

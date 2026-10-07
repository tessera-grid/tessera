import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { announce } from '../../../core/announcer'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { waitForGrid } from './core-helpers'
import { recordAnnouncements, sleep } from './lazy-helpers'

// Повтор того же объявления (ADR 0061, LZ20): повторная ошибка загрузки контекстного
// меню слышна только повтором текста.

let table: unknown

const Grid = () => {
  table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: [{ id: '1', name: 'Alice' }],
  })
  return (
    <div style={{ height: 200 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Live-область — повтор объявления', () => {
  test('LZ20: повторное объявление того же текста снова попадает в live-область грида', async () => {
    await render(<Grid />)
    await waitForGrid()
    const announcements = recordAnnouncements()

    announce(table, 'Context menu failed to load. Try again.')
    await sleep(50)
    announce(table, 'Context menu failed to load. Try again.')
    await expect
      .poll(() => announcements.messages)
      .toEqual([
        'Context menu failed to load. Try again.',
        'Context menu failed to load. Try again.',
      ])
    announcements.stop()
  })
})

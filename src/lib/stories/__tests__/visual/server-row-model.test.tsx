import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { type ServerRowsRequest, serverRowModel } from '../../../plugins'

// Серверная модель строк на гриде (ADR 0138, этап 2): блоки по окну прокрутки, во время
// быстрой прокрутки (ADR 0008) не запрашиваются.

interface Item {
  id: string
  name: string
  city: string
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const NO_DATA: Item[] = []
const BLOCK = 100

const itemAt = (index: number): Item => ({
  id: `r${index}`,
  name: `N${index}`,
  city: `C${index % 7}`,
})

/** Сервер отвечает сразу: строки диапазона; `seen` — начала запрошенных блоков. */
const server =
  (seen: { start: number; fast: boolean }[]) =>
  ({ start, end }: ServerRowsRequest) => {
    seen.push({
      start,
      fast:
        document
          .querySelector('.data-grid__container')
          ?.hasAttribute('data-fast-scrolling') ?? false,
    })
    return {
      rows: Array.from({ length: end - start }, (_, i) => itemAt(start + i)),
    }
  }

const Grid = ({ getRows }: { getRows: ReturnType<typeof server> }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, rowCount: 100_000, blockSize: BLOCK }),
    ] as never,
  })
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const nextFrame = () => new Promise(requestAnimationFrame)
/** Строки тела с данными по порядку на экране: индекс в списке. */
const shownIndexes = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-index]',
    ),
  ]
    .filter(row => row.dataset.rowId)
    .map(row => Number(row.dataset.index))
    .sort((a, b) => a - b)

describe('Серверная модель строк (ADR 0138)', () => {
  test('SD6: во время быстрой прокрутки блоки не запрашиваются; после неё — блоки окна', async () => {
    const seen: { start: number; fast: boolean }[] = []
    const screen = await render(<Grid getRows={server(seen)} />)
    try {
      await expect.poll(shownIndexes).toContain(0)
      expect(seen.map(call => call.start)).toEqual([0])

      // Рывок далеко вниз: быстрее порога входа (2000 px/s) — сотни строк за кадр.
      const el = scroller()
      for (let i = 0; i < 12; i++) {
        el.scrollTop += 3000
        await nextFrame()
      }
      expect(el.hasAttribute('data-fast-scrolling')).toBe(true)
      expect(seen.filter(call => call.fast)).toEqual([])
      expect(seen.map(call => call.start)).toEqual([0])

      // Прокрутка улеглась — запрошены блоки нового окна, промежуточные — нет.
      await expect
        .poll(() => el.hasAttribute('data-fast-scrolling'), { timeout: 3000 })
        .toBe(false)
      await expect.poll(() => shownIndexes().length).toBeGreaterThan(3)
      const shown = shownIndexes()
      const windowBlocks = new Set(
        shown.map(index => Math.floor(index / BLOCK) * BLOCK),
      )
      const after = seen.slice(1).map(call => call.start)
      expect(after.length).toBeGreaterThan(0)
      expect(after.every(start => windowBlocks.has(start))).toBe(true)
      expect(shown[0]).toBeGreaterThan(BLOCK * 3)
    } finally {
      await screen.unmount()
    }
  })
})

import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { applyAllDrafts } from '../../../core/drafts/drafts'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, serverRowModel, unsavedChanges } from '../../../plugins'
import type { CellEditBatch } from '../../../plugins/cellEditing/types'
import { humanClick, settleRowMotion } from '../helpers'
import { waitForGrid } from './core-helpers'

// Id новой строки задаёт таблица (ADR 0181; NI5): сохранённая под тем же id строка встаёт без
// движения строк, фокус остаётся на её ячейке. NI1–NI4 — модульные (`newRowId.dom`).

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
  { id: 'age', accessorKey: 'age', header: 'Age', size: 200 },
]
type Row = { id: string; name: string; age: number }
const DATA: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
}))

let api: any

/** Ответ «сервера» пакета: новые строки сохранены под id, который выдала таблица. */
const savedAnswer = (batch: CellEditBatch) => ({
  saved: (batch.inserts ?? []).map(item => ({
    rowId: item.rowId,
    row: { ...item.values, id: item.rowId },
  })),
})

/** Клиентский режим: приложение вставляет сохранённую строку на место новой. */
const ClientGrid = () => {
  const [data, setData] = useState(DATA)
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Row) => row.id,
    enableKeyboardNavigation: true,
    plugins: [
      cellEditing({
        saveMode: 'manual',
        onCommitEdits: (batch: CellEditBatch) => {
          const answer = savedAnswer(batch)
          setData(prev => {
            const next = [...prev]
            for (const item of batch.inserts ?? []) {
              const at = item.after
                ? next.findIndex(row => row.id === item.after) + 1
                : 0
              const saved = answer.saved.find(row => row.rowId === item.rowId)
              next.splice(at, 0, saved!.row as Row)
            }
            return next
          })
          return answer
        },
      } as never),
      unsavedChanges(),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 760, height: 560 }}>
      <DataGrid table={table as never} height={520} />
    </div>
  )
}

/** Серверная модель: сохранённая строка ложится в кэш транзакцией на место новой. */
const ServerGrid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: [],
    getRowId: (row: Row) => row.id,
    enableKeyboardNavigation: true,
    plugins: [
      serverRowModel({
        blockSize: 20,
        getRows: ({ start, end }: { start: number; end: number }) => ({
          rows: DATA.slice(start, end),
          rowCount: DATA.length,
        }),
      }),
      cellEditing({ saveMode: 'manual', onCommitEdits: savedAnswer } as never),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 760, height: 560 }}>
      <DataGrid table={table as never} height={520} />
    </div>
  )
}

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const cellOf = (id: string, column = 'name') =>
  rowOf(id)?.querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  ) ?? null

/** Что сделало движение строк после сохранения: призраки и анимации вида сохранённой строки. */
const watchMotion = (savedId: string) => {
  const seen = { ghosts: 0, motion: [] as string[] }
  const observer = new MutationObserver(() => {
    seen.ghosts += document.querySelectorAll('[data-row-ghost]').length
    for (const animation of rowOf(savedId)?.getAnimations() ?? []) {
      const frames = (animation.effect as KeyframeEffect).getKeyframes()
      if (frames.some(frame => 'opacity' in frame || 'transform' in frame))
        seen.motion.push(
          frames.map(frame => frame.opacity ?? frame.transform).join(' → '),
        )
    }
  })
  observer.observe(document.body, { subtree: true, childList: true })
  return { seen, stop: () => observer.disconnect() }
}

/** Добавить новую строку за второй, поставить фокус на её ячейку и дождаться покоя. */
const addFocusedRow = async () => {
  const id = api.addRow({ name: 'Ada', age: 36 }, { index: 2 }) as string
  await expect.poll(() => cellOf(id)).not.toBeNull()
  await settleRowMotion()
  await humanClick(cellOf(id)!)
  await expect.poll(() => document.activeElement).toBe(cellOf(id))
  return id
}

describe('id новой строки задаёт таблица (ADR 0181)', () => {
  test('NI5: сохранённая строка встаёт без движения строк — без призрака и без проявления, со вспышкой «принято»; фокус клавиатуры остаётся на её ячейке; в клиентском режиме и в серверной модели', async () => {
    for (const Grid of [ClientGrid, ServerGrid]) {
      const screen = await render(<Grid />)
      try {
        await waitForGrid()
        await expect.poll(() => rowOf('3')).not.toBeNull()
        const id = await addFocusedRow()
        const top = rowOf(id)!.getBoundingClientRect().top
        const saved = id
        const { seen, stop } = watchMotion(saved)
        applyAllDrafts(api)
        await expect.poll(() => rowOf(saved)).not.toBeNull()
        await settleRowMotion()
        stop()
        expect(rowOf(saved)!.getBoundingClientRect().top, Grid.name).toBe(top)
        expect(seen.ghosts, Grid.name).toBe(0)
        expect(seen.motion, Grid.name).toEqual([])
        expect(rowOf(saved)!.getAttribute('data-flash'), Grid.name).toBe(
          'accepted',
        )
        const active = document.activeElement as HTMLElement
        expect(
          active?.closest('.data-grid__body-row')?.getAttribute('data-row-id') +
            '/' +
            active?.getAttribute('data-column-id'),
          Grid.name,
        ).toBe(saved + '/name')
      } finally {
        await screen.unmount()
      }
    }
  })
})

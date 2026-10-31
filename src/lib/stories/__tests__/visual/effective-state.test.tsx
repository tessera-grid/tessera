import { useLayoutEffect, useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { rowExpanding } from '../../../plugins'
import { waitForGrid } from './core-helpers'

// Эффективное состояние в атомах (ADR 0171, §1): сужение следит за тем, что читает, —
// ответ ленивой строки виден сразу, — и не требует перерисовок хоста ради строк.

interface Item {
  id: string
  name: string
  subRows?: Item[]
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )

describe('эффективное состояние (ADR 0171)', () => {
  test('EF3: ответ ленивой строки, которая уже числится раскрытой, виден после прихода детей без смены данных; опции refreshNarrowing нет', async () => {
    const data: Item[] = [
      { id: 'p', name: 'Parent' },
      { id: 'q', name: 'Other' },
    ]
    let options: Record<string, unknown> = {}
    const Grid = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data,
        getRowId: (row: Item) => row.id,
        plugins: [
          rowExpanding({
            // Строка в сохранённом раскрытии с первого рендера, детей у неё ещё нет.
            initialExpanded: { p: true },
            hasChildren: row => row.id === 'p',
            loadChildren: () =>
              new Promise(resolve =>
                setTimeout(() => resolve([{ id: 'c', name: 'Child' }]), 50),
              ),
          }),
        ] as never,
      })
      options = table.options as unknown as Record<string, unknown>
      return (
        <div style={{ width: 400, height: 300 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    await render(<Grid />)
    await waitForGrid()
    expect(rowOf('p')!.getAttribute('data-expanded')).toBe('false')
    expect(rowOf('c')).toBeNull()

    // Нажатие на шеврон грузит детей; данные приложения прежние.
    await userEvent.click(rowOf('p')!.querySelector('.row-expand-button')!)
    await expect.poll(() => rowOf('c')).not.toBeNull()
    expect(rowOf('p')!.getAttribute('data-expanded')).toBe('true')
    expect('refreshNarrowing' in options).toBe(false)
  })

  test('EF4: сужению, которому нужны строки, не нужны принудительные перерисовки: при монтировании и смене данных у хоста useCreateTable один коммит — по счётчикам работы', async () => {
    // Закоммиченные рендеры хоста: номер рендера в его layout-эффекте; повтор эффектов
    // StrictMode при монтировании номер не меняет.
    let renders = 0
    const committed = new Set<number>()
    let setData: ((next: Item[]) => void) | undefined
    let table: any
    const tree = (depth: number): Item[] => [
      {
        id: 'p',
        name: 'P',
        subRows:
          depth > 0
            ? [{ id: 'c', name: 'C', subRows: [{ id: 'g', name: 'G' }] }]
            : [],
      },
    ]
    const Host = ({ initial }: { initial: Item[] }) => {
      const render = ++renders
      useLayoutEffect(() => {
        committed.add(render)
      })
      const [data, set] = useState(initial)
      setData = set
      // Сужение раскрытия читает строки ядра: глубина ограничена.
      table = useCreateTable({
        columns: COLUMNS as never,
        data,
        getRowId: (row: Item) => row.id,
        plugins: [rowExpanding({ maxDepth: 1, initialExpanded: true })],
      })
      // Без грида: его эффекты монтирования пишут своё состояние и будят хост.
      return null
    }
    const ids = () =>
      table.getRowModel().rows.map((row: { id: string }) => row.id)
    await render(<Host initial={tree(0)} />)
    await settle()
    expect(committed.size).toBe(1)

    setData!(tree(1))
    await expect.poll(ids).toEqual(['p', 'c'])
    await settle()
    expect(committed.size).toBe(2)
  })
})

const settle = () =>
  new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  )

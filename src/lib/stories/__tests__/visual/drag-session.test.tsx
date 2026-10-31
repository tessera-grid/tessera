import { act } from 'react'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  ROW_DRAG_SESSION,
  COLUMN_DRAG_SESSION,
} from '../../../core/dragSession'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { rowExpandingModel } from '../../../plugins'
import { waitForGrid } from './core-helpers'

// Сессия перетаскивания — срез ядра (ADR 0168, DM8): свой плагин, который пишет срез, получает
// ту же отрисовку, что встроенный, — без dnd-kit и без плагинов перетаскивания.

const data = [
  { id: 'a', name: 'A', subRows: [{ id: 'a1', name: 'A1' }] },
  { id: 'b', name: 'B' },
]

/** Свой плагин: сессия идёт с самого начала, строка `b` — слот на уровне 1 под `a`. */
const ownSession = {
  id: 'ownSession',
  features: {
    ownSessionFeature: {
      getInitialState: (state: Record<string, unknown>) => ({
        ...state,
        [ROW_DRAG_SESSION]: {
          activeId: 'b',
          acceptable: true,
          offsetLeft: 0,
          fromIndex: 2,
          overIndex: 2,
          depth: 1,
        },
        [COLUMN_DRAG_SESSION]: 'name',
      }),
    },
  },
}

let captured: any

const Grid = () => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data,
    getRowId: (row: { id: string }) => row.id,
    plugins: [
      rowExpandingModel({ initialExpanded: true }),
      ownSession,
    ] as never,
  })
  captured = table
  return (
    <div style={{ width: 400, height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const rowById = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )

describe('сессия перетаскивания (ADR 0168)', () => {
  test('DM8: свой плагин, который пишет срез сессии, получает ту же отрисовку: атрибуты контейнера, слот на уровне броска и будущего родителя рисует BodyRow, облако отказа — грид', async () => {
    await render(<Grid />)
    await waitForGrid()
    const container = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    expect(container.dataset.rowDragging).toBe('true')
    expect(container.dataset.columnDragging).toBe('true')
    expect(container.dataset.rowDropInvalid).toBeUndefined()

    // Слот — сама строка `b`, нарисованная полосками скелета.
    await expect
      .poll(() => rowById('b')?.querySelector('[class*="skeleton"]'))
      .not.toBeNull()
    expect(rowById('a')?.querySelector('[class*="skeleton"]')).toBeNull()
    // Будущий родитель слота — `a`; dnd-kit на странице нет.
    expect(rowById('a')?.dataset.rowDropParent).toBe('true')
    expect(rowById('a1')?.dataset.rowDropParent).toBeUndefined()
    expect(document.querySelector('[data-row-draggable]')).toBeNull()

    // Место стало недопустимым: облако отказа — тон ошибки у контейнера (ADR 0137), родителя нет.
    act(() =>
      captured.baseAtoms[ROW_DRAG_SESSION].set((prev: object) => ({
        ...prev,
        acceptable: false,
      })),
    )
    await expect.poll(() => container.dataset.rowDropInvalid).toBe('true')
    expect(rowById('a')?.dataset.rowDropParent).toBeUndefined()
  })
})

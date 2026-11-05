import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { isSkeletonParentRow } from '../../../core/skeletonOptions'
import { Stories } from '../helpers'

// Вид ячейки скелета `'toggle'` (ADR 0165, SX3): переключатель на строках плана с детьми,
// пусто на прочих; колонка раскрытия объявляет его сама, грид не ищет её по подписи.

type Args = Partial<Parameters<typeof Stories.DataGridPlayground>[0]>

const SKELETON_ROW = '.data-grid__body-row--skeleton'
const SKELETON_CELL = '.data-grid__body-cell--skeleton'

const skeletonRows = () =>
  Array.from(document.querySelectorAll<HTMLElement>(SKELETON_ROW))

/** Есть ли в ячейке колонки строки фигура скелета. */
const shapes = (match: (columnId: string) => boolean) =>
  skeletonRows().map(
    row =>
      !!Array.from(row.querySelectorAll<HTMLElement>(SKELETON_CELL))
        .find(cell => match(cell.dataset.columnId ?? ''))!
        .querySelector('[data-skeleton]'),
  )

const COLUMNS = [
  { id: 'flag', accessorKey: 'name', header: 'Flag', skeletonCell: 'toggle' },
  { id: 'mark', accessorKey: 'name', header: 'Mark', skeletonCell: 'control' },
  { id: 'name', accessorKey: 'name', header: 'Name' },
]

describe('вид ячейки скелета toggle (ADR 0165)', () => {
  test("SX3: колонка с skeletonCell: 'toggle' рисует в скелете дерева переключатель на строках с детьми и пустую ячейку на прочих; колонка раскрытия объявляет его сама", async () => {
    const noRows: never[] = []
    const props: Args = {
      containerHeight: 600,
      height: 500,
      dataCount: 40,
      enableRowExpanding: true,
      loading: 'initial',
      dataOverride: noRows,
      columnsOverride: COLUMNS as never,
    }
    await render(<Stories.DataGridPlayground {...props} />)
    await expect.poll(() => skeletonRows().length).toBeGreaterThan(0)

    const parents = skeletonRows().map((_, index) => isSkeletonParentRow(index))
    expect(new Set(parents)).toEqual(new Set([true, false]))
    expect(shapes(id => id === 'flag')).toEqual(parents)
    expect(shapes(id => id.includes('rowExpanding'))).toEqual(parents)
    expect(new Set(shapes(id => id === 'mark'))).toEqual(new Set([true]))
  })
})

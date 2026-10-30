import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { ENGLISH_LABELS } from '../../../core/localization'
import { scrollLayer } from '../../../core/scrollStretch'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  rowDragging,
  type RowDragEnd,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import {
  HANDLE,
  container,
  dragOver,
  nextFrame,
  pointer,
  release,
  rowById,
  sleep,
  slot,
} from './row-drop-helpers'

// Перетаскивание строк в серверной модели настоящей мышью (ADR 0159): бросок на месте в
// кэше (MV2), промис и откат (MV3), незагруженные строки (MV4), автопрокрутка (MV5).

interface Item {
  id: string
  name: string
}

// Уровень броска помощники меряют по колонке `country`.
const COLUMNS = [{ id: 'country', accessorKey: 'name', header: 'Name' }]
const NO_DATA: Item[] = []

/** «Сервер»: блоки по запросу теста или сразу. */
const server = ({
  total = 1000,
  hold = () => false,
}: {
  total?: number
  hold?: (start: number) => boolean
} = {}) => {
  const starts: number[] = []
  const held = new Map<number, () => void>()
  const getRows = ({ start, end }: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>(resolve => {
      starts.push(start)
      const answer = () =>
        resolve({
          rows: Array.from(
            { length: Math.max(0, Math.min(end, total) - start) },
            (_, k) => ({ id: `r${start + k}`, name: `N${start + k}` }),
          ),
          rowCount: total,
        })
      if (hold(start)) held.set(start, answer)
      else answer()
    })
  const reply = (start: number) => {
    held.get(start)?.()
    held.delete(start)
  }
  return { getRows, starts, reply }
}

const Grid = ({
  getRows,
  rowCount = 1000,
  blockSize = 20,
  onRowDragEnd,
}: {
  getRows: (request: ServerRowsRequest) => Promise<ServerRowsResponse<Item>>
  rowCount?: number
  blockSize?: number
  onRowDragEnd?: (end: RowDragEnd) => void | PromiseLike<unknown>
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, rowCount, blockSize }),
      rowDragging({ onRowDragEnd }),
    ] as never,
  })
  return (
    <div style={{ width: 400, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const indexOf = (id: string) => Number(rowById(id)?.dataset.index ?? -1)
const rowCount = () =>
  document.querySelector('.data-grid__table')!.getAttribute('aria-rowcount')
const announced = () =>
  [...document.querySelectorAll('[aria-live]')]
    .map(region => region.textContent)
    .join('|')
const rowHeight = () =>
  Number.parseFloat(
    getComputedStyle(container()).getPropertyValue('--tsr-comp-row-height'),
  )

describe('перетаскивание строк в серверной модели (ADR 0159)', () => {
  test('MV2: бросок мышью — строка сразу на новом месте в кэше, onRowDragEnd получает { parentId, previousParentId, index }, итог не меняется, getRows не зовётся', async () => {
    const { getRows, starts } = server()
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid getRows={getRows} onRowDragEnd={end => void ends.push(end)} />,
    )
    try {
      await expect.poll(() => rowById('r4')).not.toBeNull()
      const total = rowCount()
      const requested = starts.length
      await dragOver('r1', 'r4', 0)
      await release()
      expect(indexOf('r1')).toBe(4)
      expect(indexOf('r4')).toBe(3)
      expect(ends).toEqual([
        expect.objectContaining({
          rowId: 'r1',
          parentId: undefined,
          previousParentId: undefined,
          index: 4,
        }),
      ])
      expect(rowCount()).toBe(total)
      expect(starts.length).toBe(requested)
    } finally {
      await screen.unmount()
    }
  })

  test('MV3: промис onRowDragEnd — ожидание на ручке; отказ — строка обратно, вспышка reverted, объявление; успех — строка остаётся', async () => {
    const { getRows } = server()
    const moves: { resolve: () => void; reject: (error: Error) => void }[] = []
    const screen = await render(
      <Grid
        getRows={getRows}
        onRowDragEnd={() =>
          new Promise<void>((resolve, reject) =>
            moves.push({ resolve, reject }),
          )
        }
      />,
    )
    try {
      await expect.poll(() => rowById('r4')).not.toBeNull()
      await dragOver('r1', 'r4', 0)
      await release()
      expect(indexOf('r1')).toBe(4)
      await expect
        .poll(() => rowById('r1')!.getAttribute('aria-busy'))
        .toBe('true')

      moves.shift()!.reject(new Error('Order is locked'))
      await expect.poll(() => indexOf('r1')).toBe(1)
      expect(rowById('r1')!.getAttribute('data-flash')).toBe('reverted')
      expect(rowById('r1')!.hasAttribute('aria-busy')).toBe(false)
      await expect
        .poll(announced)
        .toContain(ENGLISH_LABELS.announceMoveFailed('Order is locked'))

      await dragOver('r2', 'r5', 0)
      await release()
      moves.shift()!.resolve()
      await expect
        .poll(() => rowById('r2')!.getAttribute('data-flash'))
        .toBe('accepted')
      expect(indexOf('r2')).toBe(5)
    } finally {
      await screen.unmount()
    }
  })

  test('MV4: над незагруженными строками слот скрыт, бросок недоступен; пришёл блок под указателем — бросок доступен', async () => {
    const { getRows, starts, reply } = server({
      hold: start => start === 20,
    })
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid getRows={getRows} onRowDragEnd={end => void ends.push(end)} />,
    )
    try {
      await expect.poll(() => rowById('r0')).not.toBeNull()
      // На экране — конец первого блока и начало второго, ещё не пришедшего.
      container().scrollTop = 14 * rowHeight()
      await expect.poll(() => rowById('r16')).not.toBeNull()
      const pending = () =>
        document.querySelector<HTMLElement>(
          '[data-pending-row][data-index="21"]',
        )
      await expect.poll(pending).not.toBeNull()
      expect(starts).toContain(20)

      await userEvent.hover(rowById('r16')!)
      const handle = rowById('r16')!
        .querySelector<HTMLElement>(HANDLE)!
        .getBoundingClientRect()
      const from = {
        x: handle.left + handle.width / 2,
        y: handle.top + handle.height / 2,
      }
      const over = pending()!.getBoundingClientRect()
      await pointer.realDragHold(from, {
        x: from.x,
        y: over.top + over.height / 2 + 6,
      })
      await expect
        .poll(() => slot()?.hasAttribute('data-row-slot-hidden'))
        .toBe(true)
      await pointer.realMouseUp()
      await expect.poll(slot).toBeNull()
      expect(indexOf('r16')).toBe(16)
      expect(ends).toEqual([])

      reply(20)
      // Цель — в середине окна: у края автопрокрутка увела бы место броска.
      container().scrollTop = 15 * rowHeight()
      await expect.poll(() => rowById('r20')).not.toBeNull()
      await dragOver('r17', 'r20', 0)
      await release()
      expect(indexOf('r17')).toBe(20)
      expect(ends.at(-1)).toMatchObject({ rowId: 'r17', index: 20 })
    } finally {
      await screen.unmount()
    }
  })

  test('MV5: автопрокрутка у края во время перетаскивания идёт по всему итогу, в том числе в растянутой области', async () => {
    const MILLION = 1_000_000
    const { getRows } = server({ total: MILLION })
    const screen = await render(
      <Grid getRows={getRows} rowCount={MILLION} blockSize={100} />,
    )
    try {
      await expect.poll(() => rowById('r2')).not.toBeNull()
      const layer = scrollLayer(container())
      expect(layer.stretched).toBe(true)
      // Середина итога — за пределом браузера без растяжки.
      container().scrollTop = container().scrollHeight / 2
      for (let i = 0; i < 4; i++) await nextFrame()
      const box = container().getBoundingClientRect()
      /** Загруженная строка в середине видимой области. */
      const middle = () =>
        document
          .elementFromPoint(box.left + 100, box.top + box.height / 2)
          ?.closest<HTMLElement>('.data-grid__body-row[data-row-id]')
      await expect.poll(middle).toBeTruthy()
      const first = middle()!
      await userEvent.hover(first)
      await expect.poll(() => first.querySelector(HANDLE)).not.toBeNull()
      const handle = first
        .querySelector<HTMLElement>(HANDLE)!
        .getBoundingClientRect()
      const from = {
        x: handle.left + handle.width / 2,
        y: handle.top + handle.height / 2,
      }
      const start = layer.top()
      await pointer.realDragHold(from, { x: from.x, y: box.bottom - 6 })
      await sleep(800)
      const passed = layer.top() - start
      await pointer.realMouseUp()
      await sleep(300)
      expect(passed).toBeGreaterThan(rowHeight() * 5)
      expect(start).toBeGreaterThan(8_000_000)
    } finally {
      await screen.unmount()
    }
  })
})

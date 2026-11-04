import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { ENGLISH_LABELS } from '../../../core/localization'
import { scrollLayer } from '../../../core/scrollStretch'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  rowDragging,
  type RowDragEnd,
  rowExpanding,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import {
  HANDLE,
  container,
  depthOf,
  dragOver,
  nextFrame,
  pointer,
  release,
  rowById,
  settleSlotAfter,
  sleep,
  slot,
} from './row-drop-helpers'
import { rowDraggingLabels } from '../../../plugins/rowDragging/labels'

// Перетаскивание строк в серверной модели настоящей мышью (ADR 0159): бросок на месте в
// кэше (MV2), промис и откат (MV3), незагруженные строки (MV4), автопрокрутка (MV5), ветки
// (MV6).

interface Item {
  id: string
  name: string
  city?: string
  /** Строк в группе — у строки-группы. */
  count?: number
}

// Уровень броска помощники меряют по колонке `country`.
const COLUMNS = [{ id: 'country', accessorKey: 'name', header: 'Name' }]
const GROUP_COLUMNS = [
  ...COLUMNS,
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const NO_DATA: Item[] = []

/** Города групп: строка `r<i>` — в городе `CITIES[i % 3]`. */
const CITIES = ['A', 'B', 'C']
const groupId = (city: string) => `group:${JSON.stringify([city])}`

/** «Сервер» с группировкой по городу: города или строки одного города. */
const groupedRows = ({ start, end, groupKeys }: ServerRowsRequest) => {
  const items: Item[] = Array.from({ length: 9 }, (_, i) => ({
    id: `r${i}`,
    name: `N${i}`,
    city: CITIES[i % 3],
  }))
  const rows: Item[] =
    groupKeys.length === 0
      ? CITIES.map(city => ({ id: '', name: '', city, count: 3 }))
      : items.filter(item => item.city === groupKeys[0])
  return Promise.resolve({
    rows: rows.slice(start, end),
    rowCount: rows.length,
  })
}

/** «Сервер»: блоки по запросу теста или сразу. */
const server = ({
  total = 1000,
  hold = () => false,
  holdChildren = () => false,
}: {
  total?: number
  hold?: (start: number) => boolean
  /** Держать ответ с вложенными строками ветки до `replyChildren`. */
  holdChildren?: (parentId: string) => boolean
} = {}) => {
  const starts: number[] = []
  const held = new Map<number, () => void>()
  const heldChildren: (() => void)[] = []
  const getRows = ({ start, end, parentId }: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>(resolve => {
      if (parentId) {
        const children = () =>
          resolve({
            rows: Array.from(
              { length: Math.max(0, Math.min(end, CHILDREN) - start) },
              (_, k) => ({
                id: `${parentId}.${start + k}`,
                name: `${parentId}.${start + k}`,
              }),
            ),
            rowCount: CHILDREN,
          })
        if (holdChildren(parentId)) heldChildren.push(children)
        else children()
        return
      }
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
  const replyChildren = () => {
    for (const answer of heldChildren.splice(0)) answer()
  }
  return { getRows, starts, reply, replyChildren }
}

/** Вложенных строк у ветки. */
const CHILDREN = 2
/** Ветки — строки верхнего уровня r3 и r5. */
const isBranch = (row: { id: string; depth: number }) =>
  row.depth === 0 && (row.id === 'r3' || row.id === 'r5')

const Grid = ({
  getRows,
  rowCount = 1000,
  blockSize = 20,
  onRowDragEnd,
  tree = false,
  groups = false,
  height = 420,
}: {
  getRows: (request: ServerRowsRequest) => Promise<ServerRowsResponse<Item>>
  rowCount?: number
  blockSize?: number
  onRowDragEnd?: (end: RowDragEnd) => void | PromiseLike<unknown>
  /** У строк r3 и r5 — вложенные строки. */
  tree?: boolean
  /** Строки сгруппированы «сервером» по городу. */
  groups?: boolean
  height?: number
}) => {
  const table = useCreateTable({
    rowCount: groups ? undefined : rowCount,
    columns: (groups ? GROUP_COLUMNS : COLUMNS) as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({
        getRows,
        blockSize,
        getGroupChildCount: (row: Item) => row.count,
      }),
      rowDragging({ onRowDragEnd }),
      ...(tree ? [rowExpanding({ hasChildren: isBranch as never })] : []),
      ...(groups
        ? [rowGrouping({ initialGrouping: ['city'] }), rowExpanding()]
        : []),
    ] as never,
  })
  return (
    <div style={{ width: 400, height }}>
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
        .toContain(
          rowDraggingLabels(ENGLISH_LABELS).announceMoveFailed(
            'Order is locked',
          ),
        )

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

  test('MV6: ветки — пауза раскрывает свёрнутую ветку, бросок — после прихода её строк; перенос внутрь ветки и между ветками', async () => {
    let holding = true
    const { getRows, replyChildren } = server({
      holdChildren: () => holding,
    })
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid
        getRows={getRows}
        tree
        height={640}
        onRowDragEnd={end => void ends.push(end)}
      />,
    )
    const invalid = () => container().hasAttribute('data-row-drop-invalid')
    const expanded = (id: string) =>
      rowById(id)
        ?.querySelector('.row-expand-button')
        ?.getAttribute('aria-expanded')
    try {
      await expect.poll(() => rowById('r5')).not.toBeNull()

      // Строки ветки в пути: пауза раскрыла её, место недоступно, бросок ничего не меняет.
      let { at } = await dragOver('r1', 'r3', 1)
      await settleSlotAfter('r3', at)
      await expect.poll(() => expanded('r3')).toBe('true')
      await expect.poll(invalid).toBe(true)
      await release()
      expect(ends).toEqual([])
      expect(indexOf('r1')).toBe(1)

      // Строки пришли, пока строку держат неподвижно: место доступно, бросок — первой
      // вложенной строкой.
      ;({ at } = await dragOver('r1', 'r3', 1))
      at = await settleSlotAfter('r3', at)
      await expect.poll(invalid).toBe(true)
      holding = false
      replyChildren()
      await expect.poll(() => rowById('r3.0')).not.toBeNull()
      await expect.poll(invalid).toBe(false)
      at = await settleSlotAfter('r3', at)
      await expect
        .poll(() => rowById('r3')!.hasAttribute('data-row-drop-parent'))
        .toBe(true)
      await release()
      expect(ends.at(-1)).toMatchObject({
        rowId: 'r1',
        parentId: 'r3',
        previousParentId: undefined,
        index: 0,
      })
      expect(indexOf('r1')).toBe(indexOf('r3') + 1)
      expect(depthOf(rowById('r1')!)).toBe(1)
      expect(indexOf('r3.0')).toBe(indexOf('r1') + 1)

      // Между ветками: вложенная строка r3 уходит первой в раскрытую r5.
      rowById('r5')!.querySelector<HTMLElement>('.row-expand-button')!.click()
      await expect.poll(() => rowById('r5.0')).not.toBeNull()
      ;({ at } = await dragOver('r3.0', 'r5', 1))
      await settleSlotAfter('r5', at)
      await release()
      expect(ends.at(-1)).toMatchObject({
        rowId: 'r3.0',
        parentId: 'r5',
        previousParentId: 'r3',
        index: 0,
      })
      expect(indexOf('r3.0')).toBe(indexOf('r5') + 1)
      expect(depthOf(rowById('r3.0')!)).toBe(1)
    } finally {
      await screen.unmount()
    }
  })

  test('MV7: серверные группы — лист переносится в другую группу того же уровня, onRowDragEnd получает id и значения колонок группировки обеих групп; строки-группы не переносятся', async () => {
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid
        getRows={groupedRows}
        groups
        height={640}
        onRowDragEnd={end => void ends.push(end)}
      />,
    )
    const toggle = (city: string) =>
      rowById(groupId(city))!.querySelector<HTMLElement>('.row-expand-button')!
    try {
      await expect.poll(() => rowById(groupId('C'))).not.toBeNull()
      toggle('A').click()
      await expect.poll(() => rowById('r0')).not.toBeNull()
      toggle('B').click()
      await expect.poll(() => rowById('r1')).not.toBeNull()

      // У строки-группы ручки нет.
      await userEvent.hover(rowById(groupId('B'))!)
      await nextFrame()
      expect(rowById(groupId('B'))!.querySelector(HANDLE)).toBeNull()

      // Лист группы A — первым в группу B.
      let { at } = await dragOver('r0', groupId('B'), 1)
      await settleSlotAfter(groupId('B'), at)
      await release()
      expect(ends.at(-1)).toEqual(
        expect.objectContaining({
          rowId: 'r0',
          parentId: groupId('B'),
          previousParentId: groupId('A'),
          index: 0,
          groupValues: { city: 'B' },
          previousGroupValues: { city: 'A' },
        }),
      )
      expect(indexOf('r0')).toBe(indexOf(groupId('B')) + 1)
      expect(depthOf(rowById('r0')!)).toBe(1)

      // Уровень групп листу недоступен: бросок на уровень групп кладёт его последним в B.
      ;({ at } = await dragOver('r3', 'r7', 0))
      await settleSlotAfter('r7', at)
      await release()
      expect(ends.at(-1)).toMatchObject({
        rowId: 'r3',
        parentId: groupId('B'),
        previousParentId: groupId('A'),
      })
      expect(depthOf(rowById('r3')!)).toBe(1)
      expect(indexOf('r3')).toBe(indexOf('r7') + 1)
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

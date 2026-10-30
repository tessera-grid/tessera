import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { getTreeLines } from '../../../grid/treeBranches'
import {
  rowDragging,
  rowExpanding,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
  treeLines,
} from '../../../plugins'
import { settleRowMotion } from '../helpers'
import {
  INDENT,
  container,
  depthOf,
  dragOver,
  release,
  rowById,
  rowsInOrder,
  slot,
} from './row-drop-helpers'

// Линии дерева в серверной модели (ADR 0161): незагруженные строки ветки с линиями, приход
// блока их не сдвигает (TL10); неизвестный размер ветки — продолжение вниз, короткий блок —
// конец ветки (TL11); серверные группы (TL12); превью броска и место после броска (TL13).
// TL9 — модульный serverTreeLines, TL14 — в work-counters, TL15 — перф в scroll.

interface Item {
  id: string
  name: string
  city?: string
  count?: number
}

const COLUMNS = [{ id: 'country', accessorKey: 'name', header: 'Name' }]
const GROUP_COLUMNS = [
  ...COLUMNS,
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const NO_DATA: Item[] = []
const ROOTS = 30
const BLOCK = 10

/**
 * «Сервер»: корни `r<i>`, у ветки — `size` детей `<родитель>.<i>`; итог ветки в ответе, если
 * `known`. Блок детей с началом из `held` ждёт `reply`.
 */
const server = ({
  size,
  known = true,
  held = [] as number[],
}: {
  size: number
  known?: boolean
  held?: number[]
}) => {
  const waiting = new Map<number, () => void>()
  const getRows = ({ start, end, parentId }: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>(resolve => {
      const total = parentId ? size : ROOTS
      const answer = () =>
        resolve({
          rows: Array.from(
            { length: Math.max(0, Math.min(end, total) - start) },
            (_, k) => {
              const id = parentId ? `${parentId}.${start + k}` : `r${start + k}`
              return { id, name: id }
            },
          ),
          ...(parentId && !known ? {} : { rowCount: total }),
        })
      if (parentId && held.includes(start)) waiting.set(start, answer)
      else answer()
    })
  const reply = (start: number) => {
    waiting.get(start)?.()
    waiting.delete(start)
  }
  return { getRows, reply }
}

const Tree = ({
  getRows,
  drag = false,
}: {
  getRows: (request: ServerRowsRequest) => Promise<ServerRowsResponse<Item>>
  drag?: boolean
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, rowCount: ROOTS, blockSize: BLOCK }),
      rowExpanding({
        hasChildren: (row: { id: string; depth: number }) =>
          row.depth === 0 && row.id === 'r2',
      } as never),
      treeLines(),
      ...(drag ? [rowDragging()] : []),
    ] as never,
  })
  return (
    <div style={{ width: 400, height: 520 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** Строка или незагруженная строка на месте `index`. */
const atIndex = (index: number) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"], [data-pending-row][data-index="${index}"]`,
  )
/** Части линий строки: вид и уровень, например `elbow1 stub1`. */
const linesOf = (row: HTMLElement) =>
  [
    ...row.querySelectorAll<HTMLElement>(
      '[data-tree-depth] [aria-hidden] > span:not([data-leaving])',
    ),
  ]
    .map(span => {
      const kind = /joinedElbow/.test(span.className)
        ? 'joined'
        : /elbow/.test(span.className)
          ? 'elbow'
          : /rail/.test(span.className)
            ? 'rail'
            : 'stub'
      return kind + span.style.getPropertyValue('--tsr-tree-level')
    })
    .sort()
    .join(' ')
/** Левые края частей линий строки. */
const lineEdges = (row: HTMLElement) =>
  [
    ...row.querySelectorAll<HTMLElement>(
      '[data-tree-depth] [aria-hidden] > span:not([data-leaving])',
    ),
  ]
    .map(span => Math.round(span.getBoundingClientRect().left))
    .join(',')

/** Строка ветки: продолжение вниз, последняя — поворот без продолжения. */
const CHILD = 'joined1 rail1'
const LAST_CHILD = 'elbow1'

const expandBranch = async () => {
  await expect.poll(() => rowById('r2')).not.toBeNull()
  await userEvent.click(
    rowById('r2')!.querySelector<HTMLElement>('.row-expand-button')!,
  )
  await expect.poll(() => rowById('r2.0')).not.toBeNull()
}

describe('линии дерева в серверной модели (ADR 0161)', () => {
  test('TL10: незагруженные строки ветки — с линиями дерева; приход блока линии не меняет и не сдвигает', async () => {
    // Ветка r2 — 25 детей: строки с 10 — незагруженные, пока тест не ответит.
    const { getRows, reply } = server({ size: 25, held: [10, 20] })
    const screen = await render(<Tree getRows={getRows} />)
    try {
      await expandBranch()
      // r2 — место 2, её дети — 3…27, r3 — 28.
      expect(linesOf(atIndex(2)!)).toBe('stub1')
      expect(linesOf(atIndex(3)!)).toBe(CHILD)
      await expect
        .poll(() => atIndex(13)?.hasAttribute('data-pending-row'))
        .toBe(true)
      const pending = [13, 14, 15].map(index => atIndex(index)!)
      const before = pending.map(row => [linesOf(row), lineEdges(row)])
      for (const [lines] of before) expect(lines).toBe(CHILD)

      reply(10)
      await expect.poll(() => rowById('r2.10')).not.toBeNull()
      const after = [13, 14, 15].map(index => {
        const row = atIndex(index)!
        expect(row.hasAttribute('data-pending-row')).toBe(false)
        return [linesOf(row), lineEdges(row)]
      })
      expect(after).toEqual(before)
    } finally {
      await screen.unmount()
    }
  })

  test('TL11: размер ветки неизвестен — у последнего загруженного ребёнка линия идёт вниз к скелетам; короткий блок ставит конец ветки', async () => {
    // 13 детей без итога: первый блок полный, второй — короткий, ждёт ответа.
    const { getRows, reply } = server({ size: 13, known: false, held: [10] })
    const screen = await render(<Tree getRows={getRows} />)
    try {
      await expandBranch()
      await expect.poll(() => rowById('r2.9')).not.toBeNull()
      // Последний загруженный ребёнок — продолжение вниз, за ним скелеты ветки с линиями.
      expect(linesOf(rowById('r2.9')!)).toBe(CHILD)
      const next = Number(rowById('r2.9')!.dataset.index) + 1
      expect(atIndex(next)!.hasAttribute('data-pending-row')).toBe(true)
      expect(linesOf(atIndex(next)!)).toBe(CHILD)

      reply(10)
      await expect.poll(() => rowById('r2.12')).not.toBeNull()
      expect(linesOf(rowById('r2.9')!)).toBe(CHILD)
      expect(linesOf(rowById('r2.11')!)).toBe(CHILD)
      // Короткий блок — конец ветки: за последним ребёнком — следующий корень.
      expect(linesOf(rowById('r2.12')!)).toBe(LAST_CHILD)
    } finally {
      await screen.unmount()
    }
  })

  test('TL12: серверные группы — с линиями, как клиентские: строки группы ведут к ней, последняя — конец ветки', async () => {
    const CITIES = ['A', 'B', 'C']
    const groupId = (city: string) => `group:${JSON.stringify([city])}`
    const getRows = ({ start, end, groupKeys }: ServerRowsRequest) => {
      const items: Item[] = Array.from({ length: 12 }, (_, i) => ({
        id: `r${i}`,
        name: `N${i}`,
        city: CITIES[i % 3],
      }))
      const rows: Item[] =
        groupKeys.length === 0
          ? CITIES.map(city => ({ id: '', name: '', city, count: 4 }))
          : items.filter(item => item.city === groupKeys[0])
      return Promise.resolve({
        rows: rows.slice(start, end),
        rowCount: rows.length,
      })
    }
    const Groups = () => {
      const table = useCreateTable({
        columns: GROUP_COLUMNS as never,
        data: NO_DATA,
        getRowId: (row: Item) => row.id,
        plugins: [
          serverRowModel({
            getRows,
            blockSize: BLOCK,
            getGroupChildCount: (row: Item) => row.count,
          }),
          rowGrouping({ initialGrouping: ['city'] }),
          rowExpanding({ initialExpanded: true } as never),
          treeLines(),
        ] as never,
      })
      return (
        <div style={{ width: 400, height: 520 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    const screen = await render(<Groups />)
    try {
      await expect.poll(() => rowById('r9')).not.toBeNull()
      // Группа A: строки r0, r3, r6, r9 — у последней конец ветки.
      expect(linesOf(rowById(groupId('A'))!)).toBe('stub1')
      for (const id of ['r0', 'r3', 'r6'])
        expect(linesOf(rowById(id)!)).toBe(CHILD)
      expect(linesOf(rowById('r9')!)).toBe(LAST_CHILD)
      // Паритет с клиентским проходом по строкам окна.
      const rows = rowsInOrder()
      const lines = getTreeLines(rows.map(row => ({ depth: depthOf(row) })))
      rows.forEach((row, index) => {
        const depth = depthOf(row)
        const branch = lines.branch(index)
        const want = [
          ...(depth > 0
            ? branch[depth - 1] === '1'
              ? [`joined${depth}`, `rail${depth}`]
              : [`elbow${depth}`]
            : []),
          ...(lines.open(index) ? [`stub${depth + 1}`] : []),
        ]
          .sort()
          .join(' ')
        expect(linesOf(row), row.dataset.rowId).toBe(want)
      })
    } finally {
      await screen.unmount()
    }
  })

  test('TL13: превью броска в серверной модели — линии окна по проекции, как после броска; после броска — линии нового места', async () => {
    const { getRows } = server({ size: 4 })
    const screen = await render(<Tree getRows={getRows} drag />)
    /** Линии окна по порядку строк — как их дал бы проход по этому порядку. */
    const mismatches = () => {
      const rows = rowsInOrder().filter(row => row.querySelector(INDENT))
      const depths = rows.map(row => ({ depth: depthOf(row) }))
      const lines = getTreeLines(depths)
      const wrong: string[] = []
      rows.forEach((row, index) => {
        const depth = depths[index]!.depth
        if (index === rows.length - 1) return
        const branch = lines.branch(index)
        const want = [
          ...(depth > 0
            ? branch[depth - 1] === '1'
              ? [`joined${depth}`, `rail${depth}`]
              : [`elbow${depth}`]
            : []),
          ...(lines.open(index) ? [`stub${depth + 1}`] : []),
        ]
          .sort()
          .join(' ')
        if (row === slot()) return
        const got = linesOf(row)
        if (got !== want) wrong.push(`${row.dataset.rowId}: ${got} ≠ ${want}`)
      })
      return wrong
    }
    try {
      await expandBranch()
      await expect.poll(() => rowById('r2.3')).not.toBeNull()
      // Строки ветки доехали: ручка — на своём месте.
      await settleRowMotion()
      // Последний ребёнок ветки встаёт первым: линии окна — по проекции.
      await dragOver('r2.3', 'r2.0', 1)
      await expect.poll(() => slot()).not.toBeNull()
      await expect.poll(mismatches).toEqual([])
      await release()
      // После броска r2.3 уже не последняя в ветке: последний ребёнок — с концом ветки,
      // остальные — с продолжением.
      const children = () =>
        rowsInOrder()
          .map(row => row.dataset.rowId!)
          .filter(id => id.startsWith('r2.'))
      await expect.poll(() => children().at(-1)).not.toBe('r2.3')
      const order = children()
      expect(order).toHaveLength(4)
      for (const id of order.slice(0, -1))
        expect(linesOf(rowById(id)!), id).toBe(CHILD)
      expect(linesOf(rowById(order.at(-1)!)!)).toBe(LAST_CHILD)
      expect(mismatches()).toEqual([])
    } finally {
      await screen.unmount()
    }
  })
})

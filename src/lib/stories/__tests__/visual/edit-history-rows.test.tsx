import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  editHistory,
  rowDragging,
  type RowDragEnd,
  rowExpanding,
  rowGrouping,
  serverRowModel,
} from '../../../plugins'
import type {
  ServerRowsRequest,
  ServerRowsResponse,
} from '../../../plugins/serverRowModel/types'
import { rowDraggingLabels } from '../../../plugins/rowDragging/labels'
import { ENGLISH_LABELS } from '../../../core/localization'
import { humanClick, settleRowMotion } from '../helpers'
import {
  dragOver,
  HANDLE,
  release,
  rowById,
  rowsInOrder,
  settleSlotAfter,
} from './row-drop-helpers'

// История правок: перенос строк (ADR 0222, этап 2) — UD28, UD29, UD32. Строки до сохранения и
// конфликт переноса — модульный `editHistory.dom` (UD26, UD27, UD31).

type Item = {
  id: string
  name: string
  country?: string
  childCount?: number
  subRows?: Item[]
}

const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  name: `Name ${id}`,
  ...extra,
})

const FLAT = Array.from({ length: 8 }, (_, i) => item(`r${i}`))
const TREE = [
  item('p0', { subRows: [item('c0'), item('c1'), item('c2')] }),
  item('p1', { subRows: [item('d0')] }),
  item('r2'),
]
const LAZY = [item('g0', { childCount: 3 }), item('g1'), item('g2')]
const LAZY_CHILDREN = [item('g0-0'), item('g0-1'), item('g0-2')]
const GROUPED = [
  item('a', { country: 'US' }),
  item('b', { country: 'US' }),
  item('c', { country: 'DE' }),
  item('d', { country: 'DE' }),
]
const DE = 'country:DE'

// Первая колонка — `country`: по её отступу помощники перетаскивания считают уровень.
const COLUMNS = [{ id: 'country', accessorKey: 'name', header: 'Name' }]
const GROUP_COLUMNS = [
  { id: 'country', accessorKey: 'country', header: 'Country' },
  { id: 'name', accessorKey: 'name', header: 'Name' },
]

const drag = rowDraggingLabels(ENGLISH_LABELS)
let api: any

type Mode = 'flat' | 'tree' | 'lazy' | 'groups'

const DATA: Record<Mode, Item[]> = {
  flat: FLAT,
  tree: TREE,
  lazy: LAZY,
  groups: GROUPED,
}

const pluginsOf = (
  mode: Mode,
  setData: (update: (prev: Item[]) => Item[]) => void,
  onRowDragEnd: (end: RowDragEnd) => void | PromiseLike<unknown>,
) => {
  if (mode === 'groups')
    return [
      rowExpanding({ initialExpanded: true }),
      rowGrouping({ initialGrouping: ['country'] }),
      rowDragging({
        onRowDragEnd: (end: RowDragEnd) => {
          const country = (end.groupValues as { country?: string } | undefined)
            ?.country
          setData(rows =>
            rows.map(row => (row.id === end.rowId ? { ...row, country } : row)),
          )
          return onRowDragEnd(end)
        },
      }),
    ]
  return [
    ...(mode === 'tree' ? [rowExpanding({ initialExpanded: true })] : []),
    ...(mode === 'lazy'
      ? [
          rowExpanding({
            hasChildren: (row: { original: Item }) =>
              (row.original.childCount ?? 0) > 0,
            loadChildren: () => LAZY_CHILDREN,
          } as never),
        ]
      : []),
    rowDragging({
      onRowOrderChange: (update: unknown) =>
        setData(update as (prev: Item[]) => Item[]),
      onRowDragEnd,
    } as never),
  ]
}

const Grid = ({
  mode,
  onRowDragEnd,
}: {
  mode: Mode
  onRowDragEnd: (end: RowDragEnd) => void | PromiseLike<unknown>
}) => {
  const [data, setData] = useState(DATA[mode])
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    columns: (mode === 'groups' ? GROUP_COLUMNS : COLUMNS) as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: [...pluginsOf(mode, setData, onRowDragEnd), editHistory()],
  } as never)
  api = table
  return (
    <div style={{ width: 420, height: 480 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const order = () => rowsInOrder().map(row => row.dataset.rowId)
const handleOf = (id: string) =>
  rowById(id)!.querySelector<HTMLElement>(HANDLE)!
const cellOf = (id: string) =>
  rowById(id)!.querySelector<HTMLElement>('[data-column-id="country"]')!

/** Ctrl+Z или Ctrl+Y из ячейки строки `at` — настоящими клавишами. */
const press = async (key: 'z' | 'y', at: string) => {
  await humanClick(cellOf(at))
  await userEvent.keyboard(`{Control>}${key}{/Control}`)
  await settleRowMotion()
}

const fromHandleMenu = async (id: string, label: string) => {
  await userEvent.hover(rowById(id)!)
  await humanClick(handleOf(id))
  const menuItem = () =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      entry => entry.textContent?.trim() === label,
    )
  await expect.poll(menuItem).toBeTruthy()
  await humanClick(menuItem()!)
  await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
  await settleRowMotion()
}

const deferred = () => {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

/** «Сервер» серверной модели: 1000 плоских строк сразу. */
const getRows = ({ start, end }: ServerRowsRequest) =>
  Promise.resolve<ServerRowsResponse<Item>>({
    rows: Array.from({ length: Math.min(end, 1000) - start }, (_, k) =>
      item(`r${start + k}`),
    ),
    rowCount: 1000,
  })

const ServerGrid = ({
  onRowDragEnd,
}: {
  onRowDragEnd: (end: RowDragEnd) => void
}) => {
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    rowCount: 1000,
    columns: COLUMNS as never,
    data: [],
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize: 20 }),
      rowDragging({ onRowDragEnd }),
      editHistory(),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 420, height: 480 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('история правок: перенос строк (ADR 0222, §13)', () => {
  test("UD28: RowDragEnd.previousIndex — место среди сестёр до переноса; перенос в плоском списке и в дереве даёт запись после успеха onRowDragEnd; отмена и повтор — перенос на прежнее и новое место с source 'undo' и 'redo' в RowDragEnd", async () => {
    // Плоский список.
    let ends: RowDragEnd[] = []
    let screen = await render(
      <Grid mode="flat" onRowDragEnd={end => void ends.push(end)} />,
    )
    await expect.poll(() => rowById('r7')).not.toBeNull()
    const { at } = await dragOver('r1', 'r3', 0)
    await settleSlotAfter('r3', at)
    await release()
    expect(ends.at(-1)).toMatchObject({ rowId: 'r1', previousIndex: 1 })
    expect(ends.at(-1)!.source).toBeUndefined()
    await expect
      .poll(order)
      .toEqual(['r0', 'r2', 'r3', 'r1', 'r4', 'r5', 'r6', 'r7'])
    expect(api.getHistory().entries).toHaveLength(1)
    await press('z', 'r0')
    await expect
      .poll(() => order().slice(0, 4))
      .toEqual(['r0', 'r1', 'r2', 'r3'])
    expect(ends.at(-1)).toMatchObject({
      rowId: 'r1',
      index: 1,
      previousIndex: 3,
      source: 'undo',
    })
    await press('y', 'r0')
    await expect
      .poll(() => order().slice(0, 4))
      .toEqual(['r0', 'r2', 'r3', 'r1'])
    expect(ends.at(-1)).toMatchObject({
      rowId: 'r1',
      index: 3,
      previousIndex: 1,
      source: 'redo',
    })
    expect(api.getHistory().entries).toHaveLength(1)
    await screen.unmount()

    // Дерево: ребёнок уходит в другую ветку.
    ends = []
    screen = await render(
      <Grid mode="tree" onRowDragEnd={end => void ends.push(end)} />,
    )
    await expect.poll(() => rowById('d0')).not.toBeNull()
    const tree = await dragOver('c0', 'd0', 1)
    await settleSlotAfter('d0', tree.at)
    await release()
    expect(ends.at(-1)).toMatchObject({
      rowId: 'c0',
      parentId: 'p1',
      previousParentId: 'p0',
      index: 1,
      previousIndex: 0,
    })
    await expect
      .poll(() => order().indexOf('c0'))
      .toBe(order().indexOf('d0') + 1)
    await press('z', 'r2')
    await expect.poll(() => order().slice(0, 3)).toEqual(['p0', 'c0', 'c1'])
    expect(ends.at(-1)).toMatchObject({
      rowId: 'c0',
      parentId: 'p0',
      previousParentId: 'p1',
      index: 0,
      previousIndex: 1,
      source: 'undo',
    })
    await press('y', 'r2')
    await expect
      .poll(() => order().indexOf('c0'))
      .toBe(order().indexOf('d0') + 1)
    expect(ends.at(-1)).toMatchObject({ parentId: 'p1', source: 'redo' })
    await screen.unmount()
  })

  test('UD29: отмена и повтор переноса в ленивом дереве (стадия модели), между клиентскими группами (значения групп) и в серверной модели (кэш)', async () => {
    // Ленивое дерево: дети группы пришли ответом.
    let ends: RowDragEnd[] = []
    let screen = await render(
      <Grid mode="lazy" onRowDragEnd={end => void ends.push(end)} />,
    )
    await expect.poll(() => rowById('g2')).not.toBeNull()
    await humanClick(
      rowById('g0')!.querySelector<HTMLElement>('.row-expand-button')!,
    )
    await expect.poll(() => rowById('g0-2')).not.toBeNull()
    await settleRowMotion()
    await fromHandleMenu('g0-0', drag.moveDown)
    await expect
      .poll(() => order().slice(1, 4))
      .toEqual(['g0-1', 'g0-0', 'g0-2'])
    await press('z', 'g1')
    await expect
      .poll(() => order().slice(1, 4))
      .toEqual(['g0-0', 'g0-1', 'g0-2'])
    expect(ends.at(-1)).toMatchObject({
      rowId: 'g0-0',
      index: 0,
      source: 'undo',
    })
    await press('y', 'g1')
    await expect
      .poll(() => order().slice(1, 4))
      .toEqual(['g0-1', 'g0-0', 'g0-2'])
    expect(ends.at(-1)).toMatchObject({ rowId: 'g0-0', source: 'redo' })
    await screen.unmount()

    // Клиентские группы: отмена возвращает значения прежней группы.
    ends = []
    screen = await render(
      <Grid mode="groups" onRowDragEnd={end => void ends.push(end)} />,
    )
    await expect.poll(() => rowById('a')).not.toBeNull()
    const groups = await dragOver('a', DE, 1)
    await settleSlotAfter(DE, groups.at)
    await release()
    expect(ends.at(-1)).toMatchObject({
      rowId: 'a',
      groupValues: { country: 'DE' },
    })
    const countryOf = (id: string) =>
      rowById(id)!.querySelector('[data-column-id="country"]')!.textContent
    await expect.poll(() => countryOf('a')).toContain('DE')
    await press('z', 'b')
    await expect.poll(() => countryOf('a')).toContain('US')
    expect(ends.at(-1)).toMatchObject({
      rowId: 'a',
      groupValues: { country: 'US' },
      previousGroupValues: { country: 'DE' },
      source: 'undo',
    })
    await press('y', 'b')
    await expect.poll(() => countryOf('a')).toContain('DE')
    expect(ends.at(-1)).toMatchObject({ source: 'redo' })
    await screen.unmount()

    // Серверная модель: перенос и обратный перенос — в кэше.
    ends = []
    screen = await render(
      <ServerGrid onRowDragEnd={end => void ends.push(end)} />,
    )
    await expect.poll(() => rowById('r3')).not.toBeNull()
    await fromHandleMenu('r1', drag.moveDown)
    await expect.poll(() => order().slice(0, 3)).toEqual(['r0', 'r2', 'r1'])
    await press('z', 'r0')
    await expect.poll(() => order().slice(0, 3)).toEqual(['r0', 'r1', 'r2'])
    expect(ends.at(-1)).toMatchObject({ rowId: 'r1', index: 1, source: 'undo' })
    await press('y', 'r0')
    await expect.poll(() => order().slice(0, 3)).toEqual(['r0', 'r2', 'r1'])
    expect(ends.at(-1)).toMatchObject({ rowId: 'r1', source: 'redo' })
    await screen.unmount()
  })

  test('UD32: отмена переноса ждёт промиса onRowDragEnd: ожидание на строке; отказ — перенос откатывается, запись остаётся', async () => {
    let gate: ReturnType<typeof deferred> | undefined
    const screen = await render(
      <Grid mode="flat" onRowDragEnd={() => gate?.promise} />,
    )
    await expect.poll(() => rowById('r7')).not.toBeNull()
    await fromHandleMenu('r1', drag.moveDown)
    await expect.poll(() => order().slice(0, 3)).toEqual(['r0', 'r2', 'r1'])
    gate = deferred()
    await press('z', 'r0')
    // Строка уже на прежнем месте и ждёт ответа.
    await expect.poll(() => order().slice(0, 3)).toEqual(['r0', 'r1', 'r2'])
    await expect
      .poll(() => rowById('r1')!.getAttribute('aria-busy'))
      .toBe('true')
    expect(api.getHistory().busy).toBe(true)
    gate.reject(new Error('Locked'))
    await expect.poll(() => api.getHistory().busy).toBe(false)
    await settleRowMotion()
    await expect.poll(() => order().slice(0, 3)).toEqual(['r0', 'r2', 'r1'])
    expect(rowById('r1')!.hasAttribute('aria-busy')).toBe(false)
    expect(api.getHistory()).toMatchObject({ position: 1 })
    expect(api.getHistory().entries).toHaveLength(1)
    // Следующая отмена пробует снова.
    gate = undefined
    await press('z', 'r0')
    await expect.poll(() => order().slice(0, 3)).toEqual(['r0', 'r1', 'r2'])
    expect(api.getHistory().position).toBe(0)
    await screen.unmount()
  })
})

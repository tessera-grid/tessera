import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnSortingModel,
  rowDragging,
  type RowDragEnd,
  rowExpanding,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { rowDraggingLabels } from '../../../plugins/rowDragging/labels'
import { humanClick, settleRowMotion } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { depthOf, HANDLE } from './row-drop-helpers'

// Вложение, вынос и соседние группы на гриде (ADR 0189): свёрнутая цель (NT4), отказ ветки (NT5),
// фокус за строкой (NT8), перенос в соседнюю группу (NT9), доступность меню и ожидания (NT12).

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

interface Item {
  id: string
  name: string
  city?: string
  count?: number
}

const COLUMNS = [
  { id: 'country', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const NO_DATA: Item[] = []
const CITIES = ['A', 'B', 'C']
const labels = rowDraggingLabels(tableLabels)
const groupId = (city: string) => `group:${JSON.stringify([city])}`

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const rowById = (id: string) =>
  q(`.data-grid__body-row[data-row-id="${CSS.escape(id)}"]`)
const handleOf = (id: string) =>
  rowById(id)?.querySelector<HTMLElement>(HANDLE) ?? null
const levelOf = (id: string) => rowById(id)?.getAttribute('aria-level')
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item =>
    item.textContent?.includes(label),
  )

interface ShiftTable {
  setSorting: (sorting: { id: string; desc: boolean }[]) => void
  applyRowTransaction: (transaction: { remove: readonly string[] }) => unknown
}

interface Held {
  go: (fail?: Error) => void
}

const server = (holdChildren: () => boolean) => {
  const held: Held[] = []
  const moved = new Set<string>()
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
      const { start, end, parentId, grouping, groupKeys } = request
      if (groupKeys.length < grouping.length) {
        resolve({
          rows: CITIES.map(city => ({ id: '', name: '', city, count: 3 })),
          rowCount: 3,
        })
        return
      }
      if (parentId) {
        const prefix = String(groupKeys[0] ?? parentId)
        const go = (fail?: Error) =>
          fail
            ? reject(fail)
            : resolve({
                rows: Array.from({ length: 3 }, (_, k) => ({
                  id: `${prefix}.${k}`,
                  name: `${prefix}.${k}`,
                })).slice(start, end),
                rowCount: 3,
              })
        if (holdChildren()) held.push({ go })
        else go()
        return
      }
      const rows = Array.from({ length: 40 }, (_, k) => ({
        id: `r${k}`,
        name: `N${k}.`,
      })).filter(row => !moved.has(row.id))
      resolve({ rows: rows.slice(start, end), rowCount: rows.length })
    })
  return { getRows, held, moved }
}

const Grid = ({
  getRows,
  grouped = false,
  keyboard = true,
  onRowDragEnd,
  onTable,
}: {
  getRows: (request: ServerRowsRequest) => Promise<ServerRowsResponse<Item>>
  grouped?: boolean
  keyboard?: boolean
  onRowDragEnd?: (end: RowDragEnd) => void | PromiseLike<unknown>
  onTable?: (table: ShiftTable) => void
}) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    rowCount: grouped ? undefined : 40,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({
        getRows,
        blockSize: 4,
        getGroupChildCount: (row: Item) => row.count,
      }),
      columnSortingModel(),
      rowDragging({ onRowDragEnd }),
      ...(grouped
        ? [rowGrouping({ initialGrouping: ['city'] }), rowExpanding()]
        : [
            rowExpanding({
              hasChildren: row =>
                (row as { depth: number }).depth === 0 &&
                ['r1', 'r3', 'r5', 'r7'].includes((row as { id: string }).id),
            }),
          ]),
    ] as never,
  })
  onTable?.(table as unknown as ShiftTable)
  return (
    <div style={{ width: 500, height: 760 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const openMenu = async (id: string) => {
  await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
  await expect.poll(() => handleOf(id)).not.toBeNull()
  await settleRowMotion()
  await humanClick(handleOf(id)!)
  await expect
    .poll(() => document.querySelector('[role="menu"]'))
    .not.toBeNull()
}

describe('вложение и вынос на гриде (ADR 0189)', () => {
  test('NT4: свёрнутая цель раскрывается, строка ждёт, после прихода строк идёт перенос; уход строки, смена выборки и новый перенос отменяют ожидание', async () => {
    let holding = true
    const { getRows, held, moved } = server(() => holding)
    const ends: RowDragEnd[] = []
    let table: ShiftTable | undefined
    const screen = await render(
      <Grid
        getRows={getRows}
        onRowDragEnd={end => {
          ends.push(end)
          moved.add(end.rowId)
        }}
        onTable={value => {
          table = value
        }}
      />,
    )
    const busy = (id: string) => rowById(id)?.getAttribute('aria-busy')
    try {
      await expect.poll(() => handleOf('r2')).not.toBeNull()
      await openMenu('r2')
      await humanClick(menuItem(labels.indentRow)!)
      await expect.poll(() => held.length).toBe(1)
      await expect
        .poll(() =>
          rowById('r1')
            ?.querySelector('.row-expand-button')
            ?.getAttribute('aria-expanded'),
        )
        .toBe('true')
      await expect
        .poll(() => rowById('r2')?.getAttribute('aria-busy'))
        .toBe('true')
      expect(ends).toEqual([])

      holding = false
      held.splice(0)[0]!.go()
      await expect.poll(() => levelOf('r2')).toBe('2')
      expect(ends[0]).toMatchObject({ rowId: 'r2', parentId: 'r1', index: 3 })
      await expect
        .poll(() => rowById('r2')?.getAttribute('aria-busy'))
        .not.toBe('true')

      // Новый перенос той же строки ждёт следующую ветку; сворачивание её отменяет.
      holding = true
      await openMenu('r4')
      await humanClick(menuItem(labels.indentRow)!)
      await expect.poll(() => held.length).toBe(1)
      const expand = () => rowById('r3')!.querySelector('.row-expand-button')!
      await expect
        .poll(() => expand().hasAttribute('data-cancel-armed'))
        .toBe(true)
      await humanClick(expand())
      await expect
        .poll(() => expand().getAttribute('aria-expanded'))
        .toBe('false')
      await expect.poll(() => busy('r4')).toBeNull()
      expect(ends).toHaveLength(1)

      // Новый перенос снимает прежнее ожидание.
      held.length = 0
      await openMenu('r4')
      await humanClick(menuItem(labels.indentRow)!)
      await expect.poll(() => busy('r4')).toBe('true')
      await openMenu('r6')
      await humanClick(menuItem(labels.indentRow)!)
      await expect.poll(() => busy('r6')).toBe('true')
      await expect.poll(() => busy('r4')).toBeNull()

      // Строка ушла из списка.
      table!.applyRowTransaction({ remove: ['r6'] })
      await expect.poll(() => rowById('r6')).toBeNull()
      for (const { go } of held.splice(0)) go()
      await settleRowMotion()
      expect(ends).toHaveLength(1)

      // Новая выборка: ждать нечего.
      await openMenu('r8')
      await humanClick(menuItem(labels.indentRow)!)
      await expect.poll(() => busy('r8')).toBe('true')
      table!.setSorting([{ id: 'country', desc: false }])
      await expect.poll(() => busy('r8')).toBeNull()
      holding = false
      for (const { go } of held.splice(0)) go()
      await settleRowMotion()
      expect(ends).toHaveLength(1)
    } finally {
      await screen.unmount()
    }
  })

  test('NT5: отказ загрузки ветки — перенос отменён, вспышка danger и объявление на строке', async () => {
    const { getRows, held } = server(() => true)
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid getRows={getRows} onRowDragEnd={end => void ends.push(end)} />,
    )
    try {
      await expect.poll(() => handleOf('r2')).not.toBeNull()
      await openMenu('r2')
      await humanClick(menuItem(labels.indentRow)!)
      await expect.poll(() => held.length).toBe(1)
      held.splice(0)[0]!.go(new Error('Ветка недоступна'))
      await expect
        .poll(() => rowById('r2')?.getAttribute('data-flash'))
        .toBe('reverted')
      await expect
        .poll(() => q('[aria-live]')?.textContent ?? '')
        .toContain('Ветка недоступна')
      expect(ends).toEqual([])
      expect(levelOf('r2')).toBe('1')
      await expect
        .poll(() => rowById('r2')?.getAttribute('aria-busy'))
        .not.toBe('true')
    } finally {
      await screen.unmount()
    }
  })

  test('NT8: фокус следует за строкой при включённой и выключенной клавиатурной навигации, с мыши и с клавиатуры', async () => {
    const { getRows, moved } = server(() => false)
    const screen = await render(
      <Grid
        getRows={getRows}
        onRowDragEnd={end => {
          if (end.parentId) moved.add(end.rowId)
          else moved.delete(end.rowId)
        }}
      />,
    )
    const activeRowId = () =>
      (document.activeElement as HTMLElement)
        .closest('.data-grid__body-row')
        ?.getAttribute('data-row-id')
    try {
      await expect.poll(() => rowById('r2')).not.toBeNull()
      rowById('r2')!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
      await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
      await expect.poll(() => levelOf('r2')).toBe('2')
      await expect.poll(activeRowId).toBe('r2')
      await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}')
      await expect.poll(() => levelOf('r2')).toBe('1')
      await expect.poll(activeRowId).toBe('r2')
    } finally {
      await screen.unmount()
    }

    const pointer = server(() => false)
    const again = await render(
      <Grid
        getRows={pointer.getRows}
        keyboard={false}
        onRowDragEnd={end => {
          if (end.parentId) pointer.moved.add(end.rowId)
          else pointer.moved.delete(end.rowId)
        }}
      />,
    )
    try {
      await expect.poll(() => handleOf('r2')).not.toBeNull()
      await openMenu('r2')
      await humanClick(menuItem(labels.indentRow)!)
      await expect.poll(() => depthOf(rowById('r2')!)).toBe(1)
      await openMenu('r2')
      await humanClick(menuItem(labels.outdentRow)!)
      await expect.poll(() => depthOf(rowById('r2')!)).toBe(0)
      await expect.poll(() => document.activeElement).not.toBe(document.body)
    } finally {
      await again.unmount()
    }
  })

  test('NT9: серверные группы — пункты и клавиши переносят лист в соседнюю группу того же уровня и родителя, с groupValues', async () => {
    const { getRows } = server(() => false)
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid
        getRows={getRows}
        grouped
        onRowDragEnd={end => void ends.push(end)}
      />,
    )
    try {
      await expect.poll(() => rowById(groupId('A'))).not.toBeNull()
      await humanClick(
        rowById(groupId('A'))!.querySelector('.row-expand-button')!,
      )
      await expect.poll(() => handleOf('A.0')).not.toBeNull()
      await openMenu('A.0')
      expect(menuItem(labels.indentRow)).toBeUndefined()
      await humanClick(menuItem(labels.moveToNextGroup)!)
      await expect.poll(() => ends.length).toBe(1)
      expect(ends[0]).toMatchObject({
        rowId: 'A.0',
        parentId: groupId('B'),
        previousParentId: groupId('A'),
        groupValues: { city: 'B' },
        previousGroupValues: { city: 'A' },
      })
      await expect.poll(() => rowById('A.0')).not.toBeNull()
      rowById('A.0')!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
      await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}')
      await expect.poll(() => ends.length).toBe(2)
      expect(ends[1]).toMatchObject({
        parentId: groupId('A'),
        groupValues: { city: 'A' },
      })
    } finally {
      await screen.unmount()
    }
  })

  test('NT12: меню с новыми пунктами и ожидание на ручке — axe с color-contrast в обеих темах и вид в forced-colors', async () => {
    const { getRows, held } = server(() => true)
    const screen = await render(<Grid getRows={getRows} />)
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const check = async (element: () => HTMLElement) => {
      await inBothThemes(async () => {
        expect((await axe.run(element(), options)).violations).toEqual([])
      })
      await fc.forcedColors(true)
      try {
        expect((await axe.run(element(), options)).violations).toEqual([])
      } finally {
        await fc.forcedColors(false)
      }
    }
    try {
      await expect.poll(() => handleOf('r2')).not.toBeNull()
      await openMenu('r2')
      await check(() => q('[role="menu"]')!)
      await humanClick(menuItem(labels.indentRow)!)
      await expect.poll(() => held.length).toBe(1)
      await check(() => q('.data-grid-theme')!)
      held.splice(0)[0]!.go()
    } finally {
      await screen.unmount()
    }
  })
})

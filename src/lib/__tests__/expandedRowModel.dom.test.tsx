// @vitest-environment happy-dom
/**
 * Инкрементальная модель раскрытия (ADR 0070; XM1–XM4): после прихода ответов, кликов
 * раскрытия и смены входа модель совпадает с фабрикой TanStack в гриде с теми же
 * плагинами.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { createExpandedRowModel } from '@tanstack/react-table'
import { act, createElement, Fragment } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readPluginHooks } from '../core/definePlugin'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnFiltering,
  columnSorting,
  rowExpanding,
  rowGrouping,
} from '../plugins'
import { toggleRowExpanded } from '../plugins/rowExpanding/toggleRowExpanded'
import type { RowExpandingHooks } from '../plugins/rowExpanding'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Node {
  id: string
  name: string
  group: string
  kids?: number
  subRows?: Node[]
}

const node = (id: string, kids = 0, subRows?: Node[]): Node => ({
  id,
  name: id,
  group: `g${id.length % 2}`,
  kids,
  ...(subRows ? { subRows } : {}),
})
// 20 корней: каждый третий — ленивый, r5 — с детьми в данных.
const ROWS: Node[] = Array.from({ length: 20 }, (_, i) =>
  i === 5
    ? node('r5', 0, [node('r5a', 0, [node('r5ax')]), node('r5b')])
    : node(`r${i}`, i % 3 === 0 ? 1 : 0),
)
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'group', accessorKey: 'group', header: 'Group' },
]
const kids = (parent: string, tag = 'k') =>
  [1, 2].map(i => node(`${parent}-${tag}${i}`, i === 1 ? 1 : 0))

type Answers = Record<string, Node[] | Promise<Node[]>>
type Entry = { features?: Record<string, unknown> }

const tables: Record<'ours' | 'stock', any> = { ours: null, stock: null }
let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.useRealTimers()
})

const Grid = (props: {
  which: 'ours' | 'stock'
  answers: Answers
  data: Node[]
}) => {
  const expanding = rowExpanding({
    maxDepth: 4,
    hasChildren: (row: { original: Node }) => (row.original.kids ?? 0) > 0,
    loadChildren: (row: { id: string }) => props.answers[row.id] ?? [],
  }) as Entry
  tables[props.which] = useCreateTable({
    columns: COLUMNS as never,
    data: props.data,
    plugins: [
      columnFiltering(),
      columnSorting(),
      rowGrouping(),
      props.which === 'ours'
        ? expanding
        : {
            ...expanding,
            features: {
              ...expanding.features,
              expandedRowModel: createExpandedRowModel(),
            },
          },
    ] as never,
  })
  return null
}

const render = (answers: Answers, data = ROWS) => {
  root ??= createRoot(document.createElement('div'))
  act(() =>
    root!.render(
      createElement(
        Fragment,
        null,
        createElement(Grid, { which: 'ours', answers, data }),
        createElement(Grid, { which: 'stock', answers, data }),
      ),
    ),
  )
}

/** Одно действие над обоими гридами. */
const both = (apply: (table: any) => void) =>
  act(() => {
    apply(tables.ours)
    apply(tables.stock)
  })
const toggle = (id: string) =>
  both(table =>
    toggleRowExpanded(
      table.getPreExpandedRowModel().rowsById[id],
      readPluginHooks<Partial<RowExpandingHooks>>(table, 'rowExpanding'),
    ),
  )
const shape = (table: any) =>
  table.getExpandedRowModel().rows.map((row: any) => `${row.id}@${row.depth}`)
const expectParity = (step: string) =>
  expect(shape(tables.ours), step).toEqual(shape(tables.stock))

describe('Инкрементальная модель раскрытия (ADR 0070)', () => {
  it('XM1: после прихода ответа модель совпадает с TanStack; flatRows и rowsById — входные', () => {
    render({ r0: kids('r0'), r9: kids('r9') })
    toggle('r9')
    expectParity('первый приход')
    toggle('r0')
    expectParity('второй приход')
    // Замена ответа раскрытой строки меняет только вход — срез expanded прежний.
    both(table => table.setLoadedChildren('r9', kids('r9', 'z')))
    expect(shape(tables.ours)).toContain('r9-z1@1')
    expectParity('замена ответа')
    const model = tables.ours.getExpandedRowModel()
    const input = tables.ours.getPreExpandedRowModel()
    expect(model.rows.map((row: any) => row.id)).toContain('r0-k1')
    expect(model.flatRows).toBe(input.flatRows)
    expect(model.rowsById).toBe(input.rowsById)
  })

  it('XM2: паритет при раскрытии и свёртывании строки — корня и вложенной', () => {
    render({ r0: kids('r0'), 'r0-k1': kids('r0-k1', 'n') })
    toggle('r0')
    toggle('r0-k1')
    expectParity('вложенный приход')
    both(table => table.getRow('r5').toggleExpanded(true))
    expectParity('раскрыт корень с детьми в данных')
    both(table => table.getRow('r5a').toggleExpanded(true))
    expectParity('раскрыта вложенная')
    both(table => table.getRow('r0-k1').toggleExpanded(false))
    expectParity('свёрнута вложенная')
    both(table => table.getRow('r0').toggleExpanded(false))
    expectParity('свёрнут корень')
  })

  it('XM3: паритет при «раскрыть всё», «свернуть всё», смене data, сортировке, фильтре и группировке', () => {
    const answers: Answers = { r3: kids('r3'), r6: kids('r6') }
    render(answers)
    toggle('r3')
    toggle('r6')
    const steps: [string, (table: any) => void][] = [
      ['раскрыть всё', t => t.toggleAllRowsExpanded(true)],
      ['свернуть всё', t => t.toggleAllRowsExpanded(false)],
      ['раскрыть r5', t => t.getRow('r5').toggleExpanded(true)],
      ['сортировка', t => t.setSorting([{ id: 'name', desc: true }])],
      ['раскрыть r3', t => t.getRow('r3').toggleExpanded(true)],
      ['без сортировки', t => t.setSorting([])],
      [
        'фильтр',
        t =>
          t.setColumnFilters([
            { id: 'name', value: { operator: 'contains', value: 'r5' } },
          ]),
      ],
      ['без фильтра', t => t.setColumnFilters([])],
      ['группировка', t => t.setGrouping(['group'])],
      ['без группировки', t => t.setGrouping([])],
    ]
    for (const [step, apply] of steps) {
      both(apply)
      expectParity(step)
    }
    render(answers, [...ROWS])
    expectParity('смена data')
    render(answers, ROWS.slice(0, 15))
    expectParity('меньше корней')
  })

  it('XM4: паритет для пачки ответов и нескольких изменений expanded за один пересчёт', async () => {
    vi.useFakeTimers()
    render({
      r3: Promise.resolve(kids('r3')),
      r12: Promise.resolve(kids('r12')),
      r18: Promise.resolve(kids('r18')),
    })
    toggle('r3')
    toggle('r12')
    toggle('r18')
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(shape(tables.ours)).toContain('r12-k1@1')
    expectParity('пачка ответов')
    both(table =>
      table.setExpanded({ r5: true, r5a: true, r12: true, 'r18-k1': true }),
    )
    expectParity('несколько изменений expanded')
  })
})

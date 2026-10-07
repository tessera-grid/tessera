/**
 * Сортировка колонок с вариантами по подписи (ADR 0063, OS1–OS7, OS10): порядок
 * `options`, алфавит подписи вне них, значения без подписи и пустые — в конце.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { rememberOptionLabels } from '../core/columnOptions'
import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { columnSorting } from '../plugins/columnSorting'

interface Item {
  id: string
  status?: string | null
  tags?: string[] | null
  manager?: string | null
}

// Порядок options (New, Contacted, Won) не совпадает ни с алфавитом значений, ни с
// алфавитом подписей.
const STATUS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'won', label: 'Won' },
]
const TAGS = [
  { value: 'vip', label: 'VIP' },
  { value: 'partner', label: 'Partner' },
]
const MANAGERS: Record<string, string> = {
  m1: 'Zoe Hart',
  m2: 'Alice Moss',
  m3: 'Bob Reed',
}

const columns = (extra: Record<string, object> = {}) => [
  { id: 'status', accessorKey: 'status', options: STATUS, ...extra.status },
  { id: 'tags', accessorKey: 'tags', options: TAGS },
  {
    id: 'manager',
    accessorKey: 'manager',
    getOptionLabel: (id: string) => MANAGERS[id],
    ...extra.manager,
  },
]

const build = (
  data: Item[],
  {
    server = false,
    extra = {},
  }: { server?: boolean; extra?: Record<string, object> } = {},
) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnSorting({ server }),
  ]
  const folded = foldEntries(entries as never)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data,
    columns: injectServiceColumns(columns(extra) as any[], []),
    getRowId: (row: Item) => row.id,
    ...folded.options,
    hooks: resolveHooks(foldHooks(entries as never)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
  } as never) as any
}

const sortedIds = (table: any, id: string, desc = false) => {
  table.setSorting([{ id, desc }])
  return table.getRowModel().rows.map((row: { id: string }) => row.id)
}

describe('columnSorting — подписи вариантов', () => {
  it('OS1: колонка с options — в порядке options; по убыванию — в обратном', () => {
    const table = build([
      { id: 'a', status: 'won' },
      { id: 'b', status: 'contacted' },
      { id: 'c', status: 'new' },
    ])
    expect(sortedIds(table, 'status')).toEqual(['c', 'b', 'a'])
    expect(sortedIds(table, 'status', true)).toEqual(['a', 'b', 'c'])
  })

  it('OS2: колонка с getOptionLabel — по алфавиту подписи, а не по значению', () => {
    const table = build([
      { id: 'a', manager: 'm1' },
      { id: 'b', manager: 'm2' },
      { id: 'c', manager: 'm3' },
    ])
    // Zoe Hart (m1), Alice Moss (m2), Bob Reed (m3) → Alice, Bob, Zoe.
    expect(sortedIds(table, 'manager')).toEqual(['b', 'c', 'a'])
  })

  it('OS3: подписи из кэша loadOptions участвуют в сортировке lookup', () => {
    const table = build([
      { id: 'a', manager: 'x1' },
      { id: 'b', manager: 'x2' },
    ])
    rememberOptionLabels(table, 'manager', [
      { value: 'x1', label: 'Yuri' },
      { value: 'x2', label: 'Anna' },
    ])
    expect(sortedIds(table, 'manager')).toEqual(['b', 'a'])
  })

  it('OS4: значение без подписи — после значений с подписью; между собой — по строке значения', () => {
    const table = build([
      { id: 'a', status: 'zz-unknown' },
      { id: 'b', status: 'won' },
      { id: 'c', status: 'aa-unknown' },
      { id: 'd', status: 'new' },
    ])
    expect(sortedIds(table, 'status')).toEqual(['d', 'b', 'c', 'a'])

    const lookup = build([
      { id: 'a', manager: 'm9' },
      { id: 'b', manager: 'm1' },
      { id: 'c', manager: 'm0' },
    ])
    // m1 → Zoe Hart (с подписью), затем m0, m9 без подписи.
    expect(sortedIds(lookup, 'manager')).toEqual(['b', 'c', 'a'])
  })

  it('OS5: массив — поэлементно по ключам; массив-префикс — раньше более длинного', () => {
    const table = build([
      { id: 'a', tags: ['partner'] },
      { id: 'b', tags: ['vip', 'partner'] },
      { id: 'c', tags: ['vip'] },
    ])
    expect(sortedIds(table, 'tags')).toEqual(['c', 'b', 'a'])
  })

  it("OS6: пустые значения (null, '', []) по возрастанию — последними", () => {
    const table = build([
      { id: 'a', status: null, tags: [] },
      { id: 'b', status: 'won', tags: ['vip'] },
      { id: 'c', status: '', tags: null },
      { id: 'd', status: 'new', tags: ['partner'] },
    ])
    expect(sortedIds(table, 'status').slice(0, 2)).toEqual(['d', 'b'])
    expect(sortedIds(table, 'tags').slice(0, 2)).toEqual(['b', 'd'])
  })

  it('OS7: свой sortFn колонки перекрывает сортировку по подписи', () => {
    const data = [
      { id: 'a', manager: 'm1' },
      { id: 'b', manager: 'm2' },
      { id: 'c', manager: 'm3' },
    ]
    // По подписи было бы b, c, a; 'basic' — по id менеджера.
    const basic = build(data, { extra: { manager: { sortFn: 'basic' } } })
    expect(sortedIds(basic, 'manager')).toEqual(['a', 'b', 'c'])
    const own = build(data, {
      extra: {
        manager: { sortFn: (a: any, b: any) => (a.id < b.id ? 1 : -1) },
      },
    })
    expect(sortedIds(own, 'manager')).toEqual(['c', 'b', 'a'])
  })

  it('OS10: при серверной сортировке порядок строк не меняется', () => {
    const table = build(
      [
        { id: 'a', status: 'won' },
        { id: 'b', status: 'new' },
      ],
      { server: true },
    )
    expect(sortedIds(table, 'status')).toEqual(['a', 'b'])
  })
})

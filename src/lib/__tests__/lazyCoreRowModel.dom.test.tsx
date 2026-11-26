// @vitest-environment happy-dom
/**
 * Инкрементальная исходная модель ленивых детей (ADR 0067; IM1–IM7): после смены
 * ответов модель грида совпадает с полной сборкой TanStack на тех же данных и ответах;
 * неизменённые строки — прежние объекты. Словарь `rowsById` переходит новой модели
 * (ADR 0069; IM9–IM11).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import {
  constructTable,
  rowExpandingFeature,
  tableFeatures,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readPluginHooks } from '../core/definePlugin'
import { useCreateTable } from '../core/useCreateTable'
import { rowExpanding } from '../plugins'
import {
  type LoadedChildren,
  readLoadedChildren,
} from '../plugins/rowExpanding/lazyChildrenFeature'
import { toggleRowExpanded } from '../plugins/rowExpanding/toggleRowExpanded'
import type { RowExpandingHooks } from '../plugins/rowExpanding'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Node {
  id: string
  name: string
  kids?: number
  subRows?: Node[]
}

interface ModelRow {
  id: string
  index: number
  depth: number
  parentId?: string
  original: unknown
  subRows: ModelRow[]
}
interface CoreModel {
  rows: ModelRow[]
  flatRows: ModelRow[]
  rowsById: Record<string, ModelRow>
}

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const node = (id: string, kids = 0, subRows?: Node[]): Node => ({
  id,
  name: id,
  kids,
  ...(subRows ? { subRows } : {}),
})
const ROWS: Node[] = [
  node('a', 2),
  node('b', 1),
  node('c', 0, [node('c1', 0, [node('c1x')])]),
  node('d'),
]
const hasChildren = (row: { original: Node }) => (row.original.kids ?? 0) > 0

let captured: any
let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.useRealTimers()
})

const Host = (props: { answers: Record<string, unknown>; data: Node[] }) => {
  captured = useCreateTable({
    columns: columns as never,
    data: props.data,
    plugins: [
      rowExpanding({
        maxDepth: 3,
        hasChildren,
        loadChildren: (row: { id: string }) =>
          props.answers[row.id] as Node[] | Promise<Node[]>,
      }),
    ],
  })
  return null
}

const render = (answers: Record<string, unknown>, data = ROWS) => {
  if (!root) {
    root = createRoot(document.createElement('div'))
  }
  act(() => root!.render(createElement(Host, { answers, data })))
}

const model = (): CoreModel => captured.getCoreRowModel()
const toggle = (id: string) =>
  act(() =>
    toggleRowExpanded(
      model().rowsById[id] as never,
      readPluginHooks<Partial<RowExpandingHooks>>(captured, 'rowExpanding'),
    ),
  )

/** Полная сборка TanStack на тех же данных и ответах грида. */
const reference = (data: Node[], answers: LoadedChildren): CoreModel =>
  constructTable({
    features: tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
    } as never),
    data,
    columns: columns as never,
    getRowId: (row: Node) => row.id,
    getSubRows: (row: Node) =>
      row.subRows?.length ? row.subRows : (answers[row.id] as Node[]),
  } as never).getCoreRowModel() as unknown as CoreModel

/** Строение модели: порядок, словарь и поля каждой строки. */
const shape = (m: CoreModel) => ({
  rows: m.rows.map(row => row.id),
  flatRows: m.flatRows.map(row => ({
    id: row.id,
    index: row.index,
    depth: row.depth,
    parentId: row.parentId,
    original: row.original,
    subRows: row.subRows.map(child => child.id),
  })),
  rowsById: Object.keys(m.rowsById).sort(),
  rowsByIdConsistent: m.flatRows.every(row => m.rowsById[row.id] === row),
})

const expectParity = (data = ROWS) =>
  expect(shape(model())).toEqual(
    shape(reference(data, readLoadedChildren(captured))),
  )

describe('Инкрементальная исходная модель ленивых детей (ADR 0067)', () => {
  it('IM1: после прихода ответа модель совпадает с полной сборкой TanStack', () => {
    render({ a: [node('a1'), node('a2')] })
    toggle('a')
    expect(model().rowsById.a!.subRows).toHaveLength(2)
    expectParity()
  })

  it('IM2: паритет и при замене ответа строки — повторным раскрытием и setLoadedChildren', () => {
    const answers: Record<string, unknown> = { a: [node('a1')] }
    render(answers)
    toggle('a')
    toggle('a')
    answers.a = [node('a2'), node('a3')]
    toggle('a')
    expect(model().rowsById.a!.subRows.map(row => row.id)).toEqual(['a2', 'a3'])
    expectParity()
    act(() => captured.setLoadedChildren('a', [node('a9')]))
    expect(model().rowsById.a9).toBeDefined()
    expectParity()
  })

  it('IM3: паритет и при удалении ответа — resetLoadedChildren и пустой ответ', () => {
    render({ a: [node('a1')], b: [] })
    toggle('a')
    toggle('b')
    expectParity()
    act(() => captured.resetLoadedChildren('a'))
    expect(model().rowsById.a1).toBeUndefined()
    expectParity()
  })

  it('IM4: паритет для пачки ответов нескольких строк', async () => {
    vi.useFakeTimers()
    render({
      a: Promise.resolve([node('a1')]),
      b: Promise.resolve([node('b1'), node('b2')]),
    })
    toggle('a')
    toggle('b')
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(Object.keys(readLoadedChildren(captured)).sort()).toEqual(['a', 'b'])
    expectParity()
  })

  it('IM5: паритет для вложенной ленивой строки и для детей ответа со своими subRows', () => {
    render({
      a: [node('a1', 1), node('a2', 0, [node('a2x')])],
      a1: [node('a1x'), node('a1y')],
    })
    toggle('a')
    toggle('a1')
    expect(model().rowsById.a1x!.depth).toBe(2)
    expect(model().rowsById.a2x!.depth).toBe(2)
    expectParity()
  })

  it('IM6: строки вне изменённых поддеревьев — прежние объекты; прежняя модель не меняется; изменённая строка и предки — новые', () => {
    render({ a: [node('a1', 1)], a1: [node('a1x')] })
    toggle('a')
    const before = model()
    const flatBefore = [...before.flatRows]
    toggle('a1')
    const after = model()
    for (const id of ['b', 'c', 'c1', 'c1x', 'd']) {
      expect(after.rowsById[id], id).toBe(before.rowsById[id])
    }
    expect(after.rowsById.a1).not.toBe(before.rowsById.a1)
    expect(after.rowsById.a).not.toBe(before.rowsById.a)
    expect(before.flatRows).toEqual(flatBefore)
    expect(before.rowsById.a1!.subRows).toEqual([])
  })

  it('IM7: смена data — модель из прежней по тождеству строк: прежние объекты и загруженные дети, новая заменённая строка, паритет с полной сборкой', () => {
    render({ a: [node('a1')] })
    toggle('a')
    const before = model()
    render({ a: [node('a1')] }, [...ROWS])
    for (const id of ['a', 'a1', 'b', 'c', 'd']) {
      expect(model().rowsById[id], id).toBe(before.rowsById[id])
    }
    const data = ROWS.map(row =>
      row.id === 'b' ? { ...row, name: 'b*' } : row,
    )
    render({ a: [node('a1')] }, data)
    const after = model()
    expect(after.rowsById.b).not.toBe(before.rowsById.b)
    for (const id of ['a', 'a1', 'c', 'c1', 'c1x', 'd']) {
      expect(after.rowsById[id], id).toBe(before.rowsById[id])
    }
    expectParity(data)
  })

  it('приход ответа заменяет корень на текущей позиции после вставки перед ним', () => {
    const answers = { b: [node('b1')] }
    render(answers)
    const oldRoot = model().rowsById.b!
    render(answers, [node('new'), ...ROWS])
    const shifted = model()
    expect(shifted.rows[2]).toBe(oldRoot)
    expect(oldRoot.index).toBe(1)

    toggle('b')
    const after = model()
    expect(after.rows.map(row => row.id)).toEqual(['new', 'a', 'b', 'c', 'd'])
    expect(after.rows[2]).toBe(after.rowsById.b)
    expect(after.rows[2]!.subRows).toEqual([after.rowsById.b1])
    expect(shifted.rows[2]).toBe(oldRoot)
    expect(oldRoot.subRows).toEqual([])
  })
})

/** Словарь модели: ключи и объекты строк. */
const entries = (m: CoreModel) =>
  Object.keys(m.rowsById)
    .sort()
    .map(id => [id, m.rowsById[id]] as const)

describe('Словарь rowsById переходит новой модели (ADR 0069)', () => {
  it('IM9: после прихода, замены и удаления ответа rowsById совпадает с полной сборкой', () => {
    const answers: Record<string, unknown> = {
      a: [node('a1', 1), node('a2')],
      a1: [node('a1x')],
    }
    render(answers)
    const expectIndex = () => {
      const m = model()
      expect(Object.keys(m.rowsById).sort()).toEqual(
        Object.keys(
          reference(ROWS, readLoadedChildren(captured)).rowsById,
        ).sort(),
      )
      expect(Object.keys(m.rowsById)).toHaveLength(m.flatRows.length)
      expect(m.flatRows.every(row => m.rowsById[row.id] === row)).toBe(true)
    }
    toggle('a')
    toggle('a1')
    expectIndex()
    act(() => captured.setLoadedChildren('a', [node('a3')]))
    expect(model().rowsById.a1x).toBeUndefined()
    expectIndex()
    act(() => captured.resetLoadedChildren('a'))
    expect(model().rowsById.a3).toBeUndefined()
    expectIndex()
  })

  it('IM10: прежняя модель после прихода не меняется — и после нескольких приходов подряд', () => {
    render({ a: [node('a1', 1)], a1: [node('a1x')], b: [node('b1')] })
    const first = model()
    const firstEntries = entries(first)
    toggle('a')
    const second = model()
    const secondEntries = entries(second)
    toggle('a1')
    toggle('b')
    expect(entries(first)).toEqual(firstEntries)
    expect(entries(second)).toEqual(secondEntries)
    expect(first.rowsById.a1).toBeUndefined()
    expect(second.rowsById.a1x).toBeUndefined()
    expect(model().rowsById.a1x).toBeDefined()
  })

  it('IM11: свёртывание строки из «раскрыто всё» переносит в срез все раскрываемые строки, включая детей ответа', () => {
    render({ a: [node('a1', 1)], a1: [node('a1x')] })
    toggle('a')
    toggle('a1')
    // Обход TanStack — `Object.values(getRowModel().rowsById)`. Эталон — полная сборка
    // TanStack с раскрытием на тех же ответах; срез грида — состояние React, поэтому
    // действия разделены перерисовкой.
    const answers = readLoadedChildren(captured)
    const full = constructTable({
      features: tableFeatures({
        coreReactivityFeature: storeReactivityBindings(),
        rowExpandingFeature,
      } as never),
      data: ROWS,
      columns: columns as never,
      getRowId: (row: Node) => row.id,
      getSubRows: (row: Node) =>
        row.subRows?.length ? row.subRows : (answers[row.id] as Node[]),
    } as never) as any
    full.setExpanded(true)
    full.getRow('c1').toggleExpanded(false)
    const expected = Object.keys(full.atoms.expanded.get()).sort()
    expect(expected).toContain('a1')
    act(() => captured.setExpanded(true))
    act(() => captured.getRow('c1').toggleExpanded(false))
    expect(Object.keys(captured.atoms.expanded.get()).sort()).toEqual(expected)
  })
})

// @vitest-environment happy-dom
/**
 * Модель дерева `rowExpandingModel` и интерфейс `rowExpanding` (ADR 0119; TD4, TD5, TD9): модель
 * в наборе одна, выключенный интерфейс её не гасит, старых опций нет.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import {
  resolveSkeletonOptions,
  type SkeletonOptions,
} from '../core/skeletonOptions'
import { useCreateTable } from '../core/useCreateTable'
import { rowExpanding, rowExpandingModel } from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Node {
  id: string
  name: string
  subRows?: Node[]
}

const node = (id: string, subRows?: Node[]): Node => ({
  id,
  name: id,
  ...(subRows ? { subRows } : {}),
})
const DATA: Node[] = [
  node('a', [node('a1', [node('a1x')]), node('a2')]),
  node('b'),
  node('c', [node('c1')]),
]
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

type Entry = ReturnType<typeof rowExpandingModel>

let root: Root | undefined
let table: any
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const Grid = ({ plugins }: { plugins: Entry[] }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Node) => row.id,
    plugins: plugins as never,
  })
  return null
}

/** Видимые строки грида с этими плагинами и `expanded: true`. */
const visibleRows = (plugins: Entry[]) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Grid, { plugins })))
  return (table.getRowModel().rows as { id: string }[]).map(row => row.id)
}

describe('Модель дерева и интерфейс раскрытия (ADR 0119)', () => {
  it('TD4: rowExpanding() рядом с rowExpandingModel() — модель раскрытия в наборе одна, строки модели те же, что у rowExpanding() одного', () => {
    const features = buildTesseraFeatures([
      rowExpandingModel(),
      rowExpanding(),
    ] as never)
    const keys = Object.keys(features)
    expect(keys.filter(key => key === 'expandedRowModel')).toHaveLength(1)
    expect(keys.filter(key => key === 'rowExpandingFeature')).toHaveLength(1)

    const alone = visibleRows([
      rowExpanding({ maxDepth: 4, expanded: true }) as Entry,
    ])
    act(() => root?.unmount())
    root = undefined
    const both = visibleRows([
      rowExpandingModel({ expanded: true }),
      rowExpanding({ maxDepth: 4, expanded: true }) as Entry,
    ])
    expect(both).toEqual(alone)
    expect(alone).toEqual(['a', 'a1', 'a1x', 'a2', 'b', 'c', 'c1'])
  })

  it('TD5: выключенный rowExpanding рядом с rowExpandingModel убирает колонку и переключатель, дерево остаётся; выключенный rowExpandingModel дерево rowExpanding не гасит; порядок плагинов не важен', () => {
    const off = rowExpanding({ enabled: false }) as Entry
    for (const plugins of [
      [rowExpandingModel(), off],
      [off, rowExpandingModel()],
    ]) {
      const folded = foldEntries(plugins as never)
      expect(folded.options.enableExpanding).toBe(true)
      expect(folded.options.getRowCanExpand).toBeUndefined()
      expect(folded.serviceColumns).toHaveLength(0)
      expect(folded.keyboardActions.some(action => action.expands)).toBe(false)
    }
    expect(visibleRows([rowExpandingModel({ expanded: true }), off])).toEqual([
      'a',
      'a1',
      'a1x',
      'a2',
      'b',
      'c',
      'c1',
    ])

    const on = rowExpanding() as Entry
    for (const plugins of [
      [rowExpandingModel({ enabled: false }), on],
      [on, rowExpandingModel({ enabled: false })],
    ]) {
      const folded = foldEntries(plugins as never)
      expect(folded.options.enableExpanding).toBe(true)
      expect(folded.serviceColumns).toHaveLength(1)
      expect(folded.keyboardActions.some(action => action.expands)).toBe(true)
    }
    expect(
      foldEntries([rowExpandingModel({ enabled: false }), off] as never).options
        .enableExpanding,
    ).toBe(false)
  })

  it('TD9: у rowExpanding нет опции treeLines, у skeletonOptions — опции tree', () => {
    // @ts-expect-error — линии — плагин treeLines (ADR 0119)
    const entry = rowExpanding({ treeLines: true }) as Entry
    expect(
      foldEntries([entry] as never).options.enableTreeLines,
    ).toBeUndefined()
    // @ts-expect-error — дерево в скелете — по состоянию expanded (ADR 0119)
    const options: SkeletonOptions = { tree: true }
    expect(resolveSkeletonOptions(options)).not.toHaveProperty('tree')
  })
})

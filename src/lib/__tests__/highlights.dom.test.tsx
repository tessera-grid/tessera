// @vitest-environment happy-dom
/**
 * Публичная подсветка (ADR 0080; HL5, HL6, HL16, HL18, HL20): время жизни по промису,
 * ключи, уход цели из данных, перерисовка только цели, доступ из плагина.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, createElement, Profiler, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, describe, expect, it } from 'vitest'

import { definePlugin } from '../core/definePlugin'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import {
  cellHighlightKey,
  columnHighlightKey,
  type HighlightOptions,
  type HighlightTarget,
  readHighlights,
  rowHighlightKey,
  visibleHighlight,
} from '../core/highlights/highlightFeature'
import { useCreateTable } from '../core/useCreateTable'
import { BodyCell } from '../grid/BodyCell'
import { BodyRow } from '../grid/BodyRow'
import { columnSizing } from '../plugins/columnSizing'
import type { HighlightOptions as PublicHighlightOptions } from '../../index'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  a: string
  b: string
}

const ROWS: Item[] = [
  { id: 'r1', a: 'A1', b: 'B1' },
  { id: 'r2', a: 'A2', b: 'B2' },
]
const columns = [
  { id: 'a', accessorKey: 'a', size: 100, cell: (i: any) => i.getValue() },
  { id: 'b', accessorKey: 'b', size: 100, cell: (i: any) => i.getValue() },
]

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  captured = undefined
})

const Host = ({
  data = ROWS,
  cols = columns,
  plugins = [],
}: {
  data?: Item[]
  cols?: typeof columns
  plugins?: unknown[]
}) => {
  captured = useCreateTable({
    columns: cols as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: plugins as never,
  } as never)
  return null
}

const mount = (props: Parameters<typeof Host>[0] = {}) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host, props)))
}

type Api = {
  highlight: (
    target: HighlightTarget,
    options?: HighlightOptions,
  ) => { clear: () => void }
  clearHighlights: (key?: string) => void
}
const api = () => captured as Api
const visible = (key: string) =>
  visibleHighlight(readHighlights(captured)[key]).entry
const shown = (key: string) => {
  const state = visibleHighlight(readHighlights(captured)[key])
  return state.entry && !state.out ? state.entry.tone : undefined
}
const tick = () => act(() => new Promise(resolve => setTimeout(resolve, 0)))

const deferred = () => {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Подсветка: время жизни и ключи', () => {
  it('HL5: until снимает подсветку, когда промис выполнен, и когда отклонён', async () => {
    mount()
    const ok = deferred()
    const fail = deferred()
    act(() => {
      api().highlight({ row: 'r1' }, { tone: 'danger', until: ok.promise })
      api().highlight({ row: 'r2' }, { tone: 'danger', until: fail.promise })
    })
    expect(shown(rowHighlightKey('r1'))).toBe('danger')
    expect(shown(rowHighlightKey('r2'))).toBe('danger')

    ok.resolve()
    await tick()
    expect(shown(rowHighlightKey('r1'))).toBeUndefined()
    expect(shown(rowHighlightKey('r2'))).toBe('danger')

    fail.reject(new Error('no'))
    await tick()
    expect(shown(rowHighlightKey('r2'))).toBeUndefined()
  })

  it('HL6: тот же ключ заменяет, разные — видна последняя, снятие открывает предыдущую; clearHighlights по ключу и все; повторный clear пуст', () => {
    mount()
    const key = cellHighlightKey('r1', 'a')
    const target = { cell: ['r1', 'a'] } as const
    let search!: { clear: () => void }
    let first!: { clear: () => void }
    act(() => {
      first = api().highlight(target, { key: 'search', tone: 'warning' })
      search = api().highlight(target, { key: 'search', tone: 'success' })
    })
    // Та же группа — замена, а не вторая запись.
    expect(readHighlights(captured)[key]!.list).toHaveLength(1)
    expect(shown(key)).toBe('success')

    let error!: { clear: () => void }
    act(() => {
      error = api().highlight(target, { key: 'error', tone: 'danger' })
    })
    expect(shown(key)).toBe('danger')
    act(() => error.clear())
    expect(shown(key)).toBe('success')

    // Заменённая подсветка своим clear ничего не снимает.
    act(() => first.clear())
    expect(shown(key)).toBe('success')

    act(() => {
      api().highlight({ row: 'r2' }, { key: 'search' })
      api().highlight({ column: 'b' }, { key: 'other', tone: 'danger' })
      api().clearHighlights('search')
    })
    expect(shown(key)).toBeUndefined()
    expect(shown(rowHighlightKey('r2'))).toBeUndefined()
    expect(shown(columnHighlightKey('b'))).toBe('danger')

    act(() => api().clearHighlights())
    expect(shown(columnHighlightKey('b'))).toBeUndefined()

    const before = readHighlights(captured)
    act(() => search.clear())
    act(() => search.clear())
    expect(readHighlights(captured)).toBe(before)
  })

  it('HL16: строка, ушедшая из данных, и колонка, ушедшая из columns, теряют подсветку; clear после этого пуст', () => {
    mount()
    let row!: { clear: () => void }
    act(() => {
      row = api().highlight({ row: 'r2' })
      api().highlight({ cell: ['r2', 'a'] })
      api().highlight({ column: 'b' })
      api().highlight({ row: 'r1' })
    })
    mount({ data: [ROWS[0]!], cols: [columns[0]!] })
    const keys = Object.keys(readHighlights(captured))
    expect(keys).toEqual([rowHighlightKey('r1')])
    expect(visible(rowHighlightKey('r2'))).toBeUndefined()

    const before = readHighlights(captured)
    act(() => row.clear())
    expect(readHighlights(captured)).toBe(before)
  })

  it('HL20: таблица в setup плагина definePlugin даёт highlight; типы экспортированы', () => {
    let fromSetup: Api | undefined
    const probe = definePlugin()({
      id: 'highlightProbe',
      setup: () => table => {
        fromSetup = table as Api
      },
    })
    mount({ plugins: [probe()] })
    expect(fromSetup).toBeDefined()
    const options: PublicHighlightOptions = { tone: 'success', key: 'probe' }
    act(() => {
      fromSetup!.highlight({ row: 'r1' }, options)
    })
    expect(shown(rowHighlightKey('r1'))).toBe('success')
  })
})

/* ------------------------------ HL18: перерисовки ------------------------------ */

const virtualRow = (index: number) =>
  ({
    index,
    start: index * 40,
    size: 40,
    end: index * 40 + 40,
    key: index,
    lane: 0,
  }) as any

const makeTable = () => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: ROWS,
    columns,
    getRowId: (row: Item) => row.id,
    ...folded.options,
  } as never) as any
}

describe('Подсветка: перерисовка только цели', () => {
  it('HL18: подсветка строки перерисовывает только её; ячейки — только эту ячейку; колонки — только её ячейки', () => {
    const table = makeTable()
    const renders: string[] = []
    const track = (id: string, node: ReactNode) =>
      createElement(
        Profiler,
        { id, onRender: (name: string) => renders.push(name), key: id },
        node,
      )
    const rows = table.getRowModel().rows
    const rowsRoot = createRoot(document.createElement('div'))
    const cellsRoot = createRoot(document.createElement('div'))
    act(() => {
      rowsRoot.render(
        rows.map((row: any, index: number) =>
          track(
            `row:${row.id}`,
            <BodyRow
              layout="flex"
              row={row}
              visibleCells={row.getVisibleCells()}
              virtualRow={virtualRow(index)}
              virtualColumns={[]}
              leafColumns={table.getAllLeafColumns()}
              ariaRowIndexBase={1}
              isVirtualColumns={false}
            />,
          ),
        ),
      )
      cellsRoot.render(
        rows.flatMap((row: any, index: number) =>
          row
            .getVisibleCells()
            .map((cell: any) =>
              track(
                `cell:${row.id}:${cell.column.id}`,
                <BodyCell layout="flex" cell={cell} rowIndex={index} />,
              ),
            ),
        ),
      )
    })

    const after = (run: () => void) => {
      renders.length = 0
      act(run)
      return [...new Set(renders)].sort()
    }

    expect(after(() => table.highlight({ row: 'r1' }))).toEqual(['row:r1'])
    expect(after(() => table.highlight({ cell: ['r2', 'b'] }))).toEqual([
      'cell:r2:b',
      'row:r2',
    ])
    expect(after(() => table.highlight({ column: 'a' }))).toEqual([
      'cell:r1:a',
      'cell:r2:a',
      'row:r1',
      'row:r2',
    ])

    act(() => {
      rowsRoot.unmount()
      cellsRoot.unmount()
    })
  })
})

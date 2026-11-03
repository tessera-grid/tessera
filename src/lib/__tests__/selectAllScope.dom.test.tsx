// @vitest-environment happy-dom
/**
 * Охват «Выбрать всё» (ADR 0179; SE1, SE5, SE12): аргумент `selectAll` и его смена на лету,
 * строки охвата в дереве, колбэк флажка шапки в каждом режиме.
 * Запуск: npx vitest run --config vitest.node.config.ts selectAllScope
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readPluginHooks } from '../core/definePlugin'
import type { TesseraFeatureEntry } from '../core/features'
import { isPlaceholderRow } from '../core/lazyPlaceholder'
import { useCreateTable } from '../core/useCreateTable'
import { rowExpanding, rowSelection, serverRowModel } from '../plugins'
import { HeadSelectionComponent } from '../plugins/rowSelection/HeadSelectionComponent'
import { scopeRowsOf } from '../plugins/rowSelection/selectAllScope'
import { toggleRowExpanded } from '../plugins/rowExpanding/toggleRowExpanded'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  kids?: number
  subRows?: Item[]
}

const columns = [{ id: 'name', accessorKey: 'name' }]
const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  name: id,
  ...extra,
})
const TREE: Item[] = [
  item('a', { subRows: [item('a1'), item('a2', { subRows: [item('a21')] })] }),
  item('b'),
  item('lazy', { kids: 2 }),
]

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const Host = ({
  plugins,
  data = TREE,
  head = false,
}: {
  plugins: readonly unknown[]
  data?: Item[]
  head?: boolean
}) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    plugins: plugins as TesseraFeatureEntry[],
  })
  return head
    ? createElement(HeadSelectionComponent, {
        table: captured,
        hooks: readPluginHooks(captured, 'rowSelection'),
      } as never)
    : null
}

const container = document.createElement('div')
const mount = (props: Parameters<typeof Host>[0]) => {
  root ??= createRoot(container)
  act(() => root!.render(createElement(Host, props)))
}

const ids = (rows: readonly { id: string }[]) => rows.map(row => row.id).sort()

const clickHead = () =>
  act(() => {
    container
      .querySelector<HTMLElement>('[role="checkbox"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })

describe('охват «Выбрать всё» (ADR 0179)', () => {
  it("SE1: аргумент selectAll — 'filtered' по умолчанию; смена на лету не пересоздаёт таблицу и выбор не сбрасывает", () => {
    mount({ plugins: [rowSelection()] })
    expect(captured.options.rowSelectionSelectAll).toBe('filtered')
    const store = captured.store
    act(() => captured.setRowSelection({ b: true }))

    for (const scope of ['currentPage', 'all'] as const) {
      mount({ plugins: [rowSelection({ selectAll: scope })] })
      expect(captured.options.rowSelectionSelectAll).toBe(scope)
      expect(captured.store).toBe(store)
      expect(captured.store.get().rowSelection).toEqual({ b: true })
    }
  })

  it('SE5: в дереве охват берёт корни, с subRows — и вложенные строки; строки-заглушки ленивых детей не выбираются', () => {
    const loadChildren = vi.fn(() => new Promise<Item[]>(() => {}))
    const hasChildren = (row: { original: Item }) =>
      (row.original.kids ?? 0) > 0
    for (const subRows of [undefined, true, 'self'] as const) {
      mount({
        plugins: [
          rowSelection({ subRows }),
          rowExpanding({ hasChildren, loadChildren, maxDepth: 3 }),
        ],
      })
      act(() => captured.setExpanded(true))
      act(() =>
        toggleRowExpanded(
          captured.getCoreRowModel().rowsById.lazy,
          readPluginHooks(captured, 'rowExpanding') as never,
        ),
      )
      const lazy = captured.getCoreRowModel().rowsById.lazy
      expect(lazy.subRows.some(isPlaceholderRow), String(subRows)).toBe(true)

      for (const scope of ['filtered', 'currentPage', 'all'] as const) {
        const rows = scopeRowsOf(captured, scope)
        const where = `${String(subRows)} ${scope}`
        expect(ids(rows), where).toEqual(
          subRows ? ['a', 'a1', 'a2', 'a21', 'b', 'lazy'] : ['a', 'b', 'lazy'],
        )
        expect(rows.some(isPlaceholderRow), where).toBe(false)
      }
      act(() => root?.unmount())
      root = undefined
    }
  })

  it("SE12: флажок шапки зовёт onSelectAllRows(selected, scope) с действующим охватом — в клиентском режиме по selectAll, в серверной модели строк — 'all'", () => {
    for (const scope of ['filtered', 'currentPage', 'all'] as const) {
      const onSelectAllRows = vi.fn()
      mount({
        plugins: [rowSelection({ selectAll: scope, onSelectAllRows })],
        head: true,
      })
      clickHead()
      clickHead()
      expect(onSelectAllRows.mock.calls, scope).toEqual([
        [true, scope],
        [false, scope],
      ])
      act(() => root?.unmount())
      root = undefined
    }

    const onSelectAllRows = vi.fn()
    mount({
      data: [],
      plugins: [
        serverRowModel({ getRows: () => new Promise<never>(() => {}) }),
        rowSelection({ selectAll: 'currentPage', onSelectAllRows }),
      ],
      head: true,
    })
    clickHead()
    expect(onSelectAllRows.mock.calls).toEqual([[true, 'all']])
    expect(readPluginHooks(captured, 'rowSelection')).not.toHaveProperty(
      'onSelectAllRowsOnPage',
    )
  })
})

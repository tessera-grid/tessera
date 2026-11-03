// @vitest-environment happy-dom
/**
 * Охват «Выбрать всё» (ADR 0179; SE1, SE5, SE8–SE13): аргумент `selectAll` и его смена на
 * лету, строки охвата в дереве, страница с сервера и лента, серверная модель строк, колбэк
 * флажка шапки в каждом режиме, удалённый `isAllRowsSelected`, серверная выгрузка.
 * Запуск: npx vitest run --config vitest.node.config.ts selectAllScope
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DataMode } from '../core/dataMode'

import { readPluginHooks } from '../core/definePlugin'
import type { TesseraFeatureEntry } from '../core/features'
import { isPlaceholderRow } from '../core/lazyPlaceholder'
import { useCreateTable } from '../core/useCreateTable'
import { rowSelectionValueOf } from '../core/rowSelectionAll'
import { __resetLogger } from '../util/logger'
import {
  columnFiltering,
  columnSorting,
  dataExport,
  infiniteScroll,
  pagination,
  quickSearch,
  rowExpanding,
  rowSelection,
  serverRowModel,
} from '../plugins'
import { HeadSelectionComponent } from '../plugins/rowSelection/HeadSelectionComponent'
import {
  scopeRowsOf,
  selectAllScopeOf,
} from '../plugins/rowSelection/selectAllScope'
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
  dataMode,
  rowCount,
}: {
  plugins: readonly unknown[]
  data?: Item[]
  head?: boolean
  dataMode?: DataMode
  rowCount?: number
}) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    dataMode,
    rowCount,
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
    expect(selectAllScopeOf(captured)).toBe('filtered')
    const store = captured.store
    act(() => captured.setRowSelection({ b: true }))

    for (const scope of ['currentPage', 'all'] as const) {
      mount({ plugins: [rowSelection({ selectAll: scope })] })
      expect(selectAllScopeOf(captured)).toBe(scope)
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

  // Страница с сервера: в `data` — строки страницы, итог — `rowCount` таблицы.
  const PAGE = [item('p1'), item('p2'), item('p3')]
  const SERVER_PAGE = {
    data: PAGE,
    dataMode: { pagination: 'server', export: 'server' } as DataMode,
    rowCount: 30,
  }
  const FEED = {
    data: PAGE,
    rowCount: 30,
  }
  const feed = () =>
    infiniteScroll({
      onLoadMore: () => new Promise<void>(() => {}),
      hasMore: true,
    })

  it("SE8: страница с сервера и лента, охват 'currentPage' — флажок шапки выбирает id загруженных строк", () => {
    for (const [mode, props, plugin] of [
      ['страница', SERVER_PAGE, pagination()],
      ['лента', FEED, feed()],
    ] as const) {
      mount({
        ...props,
        plugins: [plugin, rowSelection({ selectAll: 'currentPage' })],
        head: true,
      })
      clickHead()
      expect(rowSelectionValueOf(captured), mode).toEqual({
        p1: true,
        p2: true,
        p3: true,
      })
      act(() => root?.unmount())
      root = undefined
    }
  })

  it('SE9: страница с сервера и лента — смена фильтра, поиска и сортировки сохраняет «всё, кроме» с исключениями', () => {
    for (const [mode, props, plugin] of [
      ['страница', SERVER_PAGE, pagination()],
      ['лента', FEED, feed()],
    ] as const) {
      mount({
        ...props,
        plugins: [
          plugin,
          columnSorting(),
          columnFiltering(),
          quickSearch(),
          rowSelection(),
        ],
        head: true,
      })
      clickHead()
      expect(rowSelectionValueOf(captured), mode).toEqual({
        all: true,
        except: [],
      })
      const kept = { all: true, except: ['p2'] }
      act(() => captured.setRowSelection(kept))
      act(() => captured.setGlobalFilter('p'))
      act(() => captured.setColumnFilters([{ id: 'name', value: 'p' }]))
      act(() => captured.setSorting([{ id: 'name', desc: true }]))
      expect(rowSelectionValueOf(captured), mode).toEqual(kept)
      expect(captured.getRow('p1').getIsSelected(), mode).toBe(true)
      expect(captured.getRow('p2').getIsSelected(), mode).toBe(false)
      act(() => root?.unmount())
      root = undefined
    }
  })

  it("SE10: серверная модель строк — любой охват выбирает весь итог выборки; 'currentPage' — с dev-warn о серверной модели, без selectAll, с 'filtered' и 'all' предупреждения нет", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const getRows = () => new Promise<never>(() => {})
      for (const selectAll of [
        undefined,
        'all',
        'filtered',
        'currentPage',
      ] as const) {
        warn.mockClear()
        __resetLogger()
        const onSelectAllRows = vi.fn()
        mount({
          data: [],
          plugins: [
            serverRowModel({ getRows }),
            rowSelection({ selectAll, onSelectAllRows }),
          ],
          head: true,
        })
        clickHead()
        expect(rowSelectionValueOf(captured), String(selectAll)).toEqual({
          all: true,
          except: [],
        })
        expect(onSelectAllRows.mock.calls, String(selectAll)).toEqual([
          [true, 'all'],
        ])
        const warned = warn.mock.calls.some(call =>
          call.some(
            part =>
              String(part).includes('rowSelection') &&
              String(part).includes('server row model'),
          ),
        )
        expect(warned, String(selectAll)).toBe(selectAll === 'currentPage')
        act(() => root?.unmount())
        root = undefined
      }
    } finally {
      warn.mockRestore()
    }
  })

  it('SE11: isAllRowsSelected удалён из типов и кода', () => {
    mount({ plugins: [rowSelection()] })
    expect(readPluginHooks(captured, 'rowSelection')).not.toHaveProperty(
      'isAllRowsSelected',
    )
    // @ts-expect-error — аргумента больше нет.
    rowSelection({ isAllRowsSelected: true })
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        if (statSync(path).isDirectory())
          return name === '__tests__' ? [] : files(path)
        return /.tsx?$/.test(name) ? [path] : []
      })
    const offenders = files(join(__dirname, '..')).filter(path =>
      readFileSync(path, 'utf8').includes('isAllRowsSelected'),
    )
    expect(offenders).toEqual([])
  })

  it('SE13: страница с сервера — серверная выгрузка получает срез «всё, кроме»', async () => {
    const onExport = vi.fn()
    mount({
      ...SERVER_PAGE,
      plugins: [pagination(), rowSelection(), dataExport({ onExport })],
      head: true,
    })
    clickHead()
    act(() => captured.setRowSelection({ all: true, except: ['p2'] }))
    await act(() => captured.exportData({ rows: 'selected', columns: 'all' }))
    expect(onExport.mock.calls[0][0].selection).toEqual({
      all: true,
      except: ['p2'],
    })
  })
})

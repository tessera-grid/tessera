// @vitest-environment happy-dom
/**
 * Канал вклада плагинов в тело грида (ADR 0170, §3–§4): вклад в ячейку, строку и корень по
 * выбору из состояния, одна подписка ячейки, хук корня, канал клавиш навигации.
 * Запуск: npx vitest run --config vitest.node.config.ts bodyContributions
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type BodyContributions,
  bodyEventHandlers,
  RootHooks,
  rootAttrsOf,
  useWindowData,
  type WindowData,
  withBody,
} from '../core/bodyContributions'
import {
  definePlugin,
  pluginStateKey,
  setPluginState,
} from '../core/definePlugin'
import { handleGridKeyDown } from '../core/keyboardNavigation/gridKeyDown'
import { NAV_CELL_ATTR, resolveActive } from '../core/keyboardNavigation/model'
import { neverInert } from '../core/pluginDiagnostics'
import { useCreateTable } from '../core/useCreateTable'
import { BodyCell } from '../grid/BodyCell'
import { BodyRow } from '../grid/BodyRow'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type ProbeState = Record<string, string>

/** Свой плагин с локальным срезом: вклад — значение среза у своей цели. */
const probe = (id: string, extra: BodyContributions = {}) => {
  const key = pluginStateKey(id)
  const of = (state: Record<string, unknown>) =>
    (state[key] as ProbeState | undefined) ?? {}
  return withBody(
    definePlugin<object>()({
      id,
      diagnose: neverInert,
      state: (): ProbeState => ({}),
    }),
    {
      cell: {
        id,
        select: (state, { cell }) => of(state)[cell.id],
        render: (value: string | undefined) =>
          value
            ? {
                attrs: { [`data-${id}`]: value },
                style: { [`--${id}`]: value },
                tabIndex: 0,
              }
            : null,
      },
      row: {
        id,
        select: (state, { row }) => of(state)[`row:${row.id}`],
        render: (value: string | undefined) =>
          value ? { attrs: { [`data-${id}`]: value } } : null,
      },
      root: {
        id,
        attrs: ({ state }) => {
          const value = of(state).root
          return value ? { [`data-${id}`]: value } : undefined
        },
      },
      ...extra,
    },
  )()
}

const ROWS = [
  { id: 'r1', a: 'A1', b: 'B1' },
  { id: 'r2', a: 'A2', b: 'B2' },
]
const COLUMNS = [
  { id: 'a', accessorKey: 'a' },
  { id: 'b', accessorKey: 'b' },
]

let table: any
let roots: Root[] = []

afterEach(() => {
  act(() => roots.forEach(root => root.unmount()))
  roots = []
  table = undefined
})

const Host = ({
  plugins,
  options,
}: {
  plugins: unknown[]
  options?: object
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: { id: string }) => row.id,
    plugins: plugins as never,
    ...options,
  } as never)
  return null
}

const render = (node: React.ReactNode) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => root.render(node))
  return container
}

const mountTable = (plugins: unknown[], options?: object) =>
  render(<Host plugins={plugins} options={options} />)

const virtualRow = (index: number) =>
  ({
    index,
    start: index * 40,
    size: 40,
    end: index * 40 + 40,
    key: index,
    lane: 0,
  }) as any

const renderCells = () =>
  render(
    table
      .getRowModel()
      .rows.flatMap((row: any, index: number) =>
        row
          .getVisibleCells()
          .map((cell: any) => (
            <BodyCell
              key={cell.id}
              layout="flex"
              cell={cell}
              rowIndex={index}
            />
          )),
      ),
  )

const renderRows = () =>
  render(
    table
      .getRowModel()
      .rows.map((row: any, index: number) => (
        <BodyRow
          key={row.id}
          layout="flex"
          row={row}
          visibleCells={row.getVisibleCells()}
          virtualRow={virtualRow(index)}
          virtualColumns={[]}
          leafColumns={table.getAllLeafColumns()}
          ariaRowIndexBase={1}
          isVirtualColumns={false}
        />
      )),
  )

const cellOf = (container: HTMLElement, rowId: string, columnId: string) =>
  container.querySelectorAll<HTMLElement>(`[data-column-id="${columnId}"]`)[
    rowId === 'r1' ? 0 : 1
  ]

describe('вклад плагинов в тело (ADR 0170)', () => {
  it('CH4: запись плагина объявляет вклад в ячейку тела, строку тела и корень грида — атрибуты, переменные стиля и tabIndex по выбору из состояния таблицы; смена выбора меняет вклад у своей цели', () => {
    mountTable([probe('probe')])
    const cells = renderCells()
    const rows = renderRows()

    act(() =>
      setPluginState(table, 'probe', {
        r1_a: 'one',
        'row:r2': 'two',
        root: 'three',
      }),
    )
    const target = cellOf(cells, 'r1', 'a')
    expect(target.dataset.probe).toBe('one')
    expect(target.style.getPropertyValue('--probe')).toBe('one')
    expect(target.tabIndex).toBe(0)
    expect(cellOf(cells, 'r1', 'b').dataset.probe).toBeUndefined()
    expect(cellOf(cells, 'r2', 'a').hasAttribute('tabindex')).toBe(false)

    const rowElements = rows.querySelectorAll<HTMLElement>('[role="row"]')
    expect(rowElements[0].dataset.probe).toBeUndefined()
    expect(rowElements[1].dataset.probe).toBe('two')
    expect(rootAttrsOf({ table, navigation: false })).toEqual({
      'data-probe': 'three',
    })

    act(() =>
      setPluginState(table, 'probe', { r2_b: 'four', 'row:r1': 'five' }),
    )
    expect(target.dataset.probe).toBeUndefined()
    expect(cellOf(cells, 'r2', 'b').dataset.probe).toBe('four')
    expect(rowElements[0].dataset.probe).toBe('five')
    expect(rowElements[1].dataset.probe).toBeUndefined()
    expect(rootAttrsOf({ table, navigation: false })).toEqual({})
  })

  it('CH5: ячейка тела подписана на store одним узлом: число её подписок не растёт с числом вкладчиков — ядра (подсветка, вспышка, ожидание, навигация) и плагинов', () => {
    const subscriptionsOfCell = (plugins: unknown[]) => {
      mountTable(plugins, { enableKeyboardNavigation: true })
      const store = table.store
      const subscribe = store.subscribe.bind(store)
      let count = 0
      store.subscribe = (...args: unknown[]) => {
        count++
        return subscribe(...(args as [never]))
      }
      const cell = table.getRowModel().rows[0].getVisibleCells()[0]
      render(<BodyCell layout="flex" cell={cell} rowIndex={0} />)
      store.subscribe = subscribe
      return count
    }
    expect(subscriptionsOfCell([])).toBe(1)
    expect(subscriptionsOfCell([probe('p1'), probe('p2'), probe('p3')])).toBe(1)
  })

  it('CH8: хук вклада корня получает элемент прокрутки и ставит атрибуты корня; без вкладчиков корень прежний', () => {
    mountTable([])
    expect(rootAttrsOf({ table, navigation: true })).toEqual({})
    expect(Object.values(bodyEventHandlers(table)).every(h => !h)).toBe(true)
    expect(
      render(<RootHooks table={table} getScrollElement={() => null} />)
        .innerHTML,
    ).toBe('')

    const seen: (HTMLElement | null)[] = []
    const scroller = document.createElement('div')
    mountTable([
      probe('probe', {
        root: {
          id: 'probe',
          attrs: ({ navigation }) => ({ 'data-root-nav': navigation }),
          useRoot: ({ getScrollElement }) => {
            seen.push(getScrollElement())
          },
        },
      }),
    ])
    render(<RootHooks table={table} getScrollElement={() => scroller} />)
    expect(seen.at(-1)).toBe(scroller)
    expect(rootAttrsOf({ table, navigation: true })).toEqual({
      'data-root-nav': true,
    })
  })

  it('CH9: плагин берёт клавишу навигации до хода активной ячейки и узнаёт о смене активной ячейки; навигация ядра не знает, какие плагины берут клавиши', () => {
    const moves: unknown[] = []
    mountTable(
      [
        probe('probe', {
          keys: {
            id: 'probe',
            onKey: event => event.key === 'ArrowDown',
            onActiveCellChange: (_table, next) => moves.push(next),
          },
        }),
      ],
      { enableKeyboardNavigation: true },
    )
    const grid = document.createElement('div')
    const cell = document.createElement('div')
    cell.setAttribute(NAV_CELL_ATTR, '')
    grid.appendChild(cell)
    const press = (key: string) => {
      const event = {
        key,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: cell,
        currentTarget: grid,
        defaultPrevented: false,
        preventDefault: vi.fn(),
      }
      act(() =>
        handleGridKeyDown(event as never, {
          table,
          getScrollElement: () => grid,
          guardBeforeRef: { current: null },
          guardAfterRef: { current: null },
        }),
      )
      return event
    }
    const active = () => resolveActive(table, table.store.get())
    const start = active()

    const taken = press('ArrowDown')
    expect(taken.preventDefault).toHaveBeenCalled()
    expect(active()).toEqual(start)
    expect(moves).toEqual([])

    press('ArrowRight')
    const next = {
      rowIndex: start.rowIndex,
      columnIndex: start.columnIndex + 1,
    }
    expect(active()).toEqual(next)
    expect(moves).toEqual([next])

    // Навигация ядра — без знания плагинов выделения и их методов.
    const dir = resolve(process.cwd(), 'src/lib/core/keyboardNavigation')
    for (const file of readdirSync(dir)) {
      const source = readFileSync(resolve(dir, file), 'utf8')
      expect(source, file).not.toMatch(/cellSelection|CellSelection|plugins\//)
    }
  })
})

describe('данные строк окна (ADR 0170)', () => {
  it('CH11: данные строк окна плагин считает по модели строк, источнику строк и превью броска один раз на их смену, а не на строку', () => {
    let computed = 0
    const rowsSeen: number[] = []
    mountTable([
      probe('lines', {
        window: {
          id: 'lines',
          compute: ({ rows, drop }) => {
            computed++
            return { count: rows.length, shift: drop?.depth ?? 0 }
          },
          row: (data: { count: number; shift: number }, index) => {
            rowsSeen.push(index)
            return { at: index + data.shift, of: data.count }
          },
        },
      }),
    ])
    const rowSource = table.getRowSource()
    let data: WindowData | undefined
    const Probe = (props: {
      rows: readonly unknown[]
      drop: unknown
      first: number
    }) => {
      data = useWindowData(
        {
          table,
          rows: props.rows as never,
          rowSource,
          rowCount: props.rows.length,
          drop: props.drop as never,
        },
        { first: props.first, last: props.first + 1 },
      )
      return null
    }
    const rows = table.getRowModel().rows
    const drop = { activeId: 'r1', from: 0, to: 1, depth: 2, acceptable: true }
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    act(() => root.render(<Probe rows={rows} drop={null} first={0} />))
    expect(computed).toBe(1)
    expect(data!.rowOf(1)).toEqual({ lines: { at: 1, of: 2 } })

    // Окно и перерисовка без смены строк, источника и превью — без пересчёта.
    act(() => root.render(<Probe rows={rows} drop={null} first={1} />))
    act(() => root.render(<Probe rows={rows} drop={null} first={1} />))
    expect(computed).toBe(1)

    act(() => root.render(<Probe rows={[...rows]} drop={null} first={1} />))
    expect(computed).toBe(2)
    act(() => root.render(<Probe rows={rows} drop={drop} first={1} />))
    expect(computed).toBe(3)
    expect(data!.rowOf(0)).toEqual({ lines: { at: 2, of: 2 } })

    // Значение строки, совпавшее по полям, — тот же объект: строка под memo не рисуется.
    const before = data!.rowOf(0)
    act(() => root.render(<Probe rows={[...rows]} drop={drop} first={0} />))
    expect(data!.rowOf(0)).toBe(before)
    expect(rowsSeen.length).toBeGreaterThan(0)
  })
})

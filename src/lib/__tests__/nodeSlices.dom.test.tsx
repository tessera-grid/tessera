// @vitest-environment happy-dom
/**
 * Подписки узла ячейки и строки по объявленным срезам (ADR 0195; CD1–CD4): узел будят только
 * его срезы и срезы вкладчиков, поле `slices` обязательно, свой срез плагина входит сам,
 * необъявленный срез ловит dev-проверка.
 * Запуск: npx vitest run --config vitest.node.config.ts nodeSlices
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { definePlugin, setPluginState } from '../core/definePlugin'
import { neverInert } from '../core/pluginDiagnostics'
import { useCreateTable } from '../core/useCreateTable'
import { BodyCell } from '../grid/BodyCell'
import { BodyRow } from '../grid/BodyRow'
import { columnSortingModel, rowSelectionModel } from '../plugins'
import { __resetLogger, __setLoggerProduction } from '../util/logger'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const ROWS = [
  { id: 'r1', a: 'A1' },
  { id: 'r2', a: 'A2' },
]
const COLUMNS = [{ id: 'a', accessorKey: 'a' }]

let table: any
let roots: Root[] = []
let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  __resetLogger()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  act(() => roots.forEach(root => root.unmount()))
  roots = []
  table = undefined
  warn.mockRestore()
  error.mockRestore()
  __setLoggerProduction(undefined)
  __resetLogger()
})

const Host = ({ plugins }: { plugins: unknown[] }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: { id: string }) => row.id,
    plugins: plugins as never,
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

const virtualRow = (index: number) =>
  ({
    index,
    start: index * 40,
    size: 40,
    end: index * 40 + 40,
    key: index,
    lane: 0,
  }) as any

const renderCells = (offset = 0) =>
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
              rowIndex={index + offset}
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

/** Плагин автора со своим срезом: выборы считают вызовы, вклад — значение своего среза. */
const counting = (slices: readonly string[] = []) => {
  const calls = { cell: 0, row: 0 }
  const plugin = definePlugin<{ enabled?: boolean }>()({
    id: 'counted',
    diagnose: neverInert,
    state: () => '',
    body: () => ({
      cell: {
        slices,
        select: state => {
          calls.cell++
          return state['plugin:counted'] as string
        },
        render: (value: string) =>
          value ? { attrs: { 'data-counted-value': value } } : null,
      },
      row: {
        slices,
        select: state => {
          calls.row++
          return state['plugin:counted'] as string
        },
        render: () => null,
      },
    }),
  })
  return { calls, plugin }
}

describe('Подписки узла по объявленным срезам (ADR 0195)', () => {
  it('CD1: узел ячейки и строки пересчитывает выборы только на смену своих срезов — ядра и вкладчиков — и на новую отрисовку; смена другого среза выборы не будит', () => {
    __setLoggerProduction(true)
    const { calls, plugin } = counting()
    render(
      <Host plugins={[plugin(), rowSelectionModel(), columnSortingModel()]} />,
    )
    renderCells()
    renderRows()
    const reset = () => {
      calls.cell = 0
      calls.row = 0
    }

    // Выбор строк — срез строки, не ячейки.
    reset()
    act(() => table.setRowSelection({ r1: true }))
    expect(calls.cell).toBe(0)
    expect(calls.row).toBeGreaterThan(0)

    // Срез, которого нет ни у ядра, ни у вкладчиков, не будит никого.
    reset()
    act(() => table.setGlobalFilter?.('x'))
    act(() => table.setColumnFilters?.([]))
    act(() => table.setSorting([{ id: 'a', desc: true }]))
    expect(calls).toEqual({ cell: 0, row: 0 })

    // Срез ядра ячейки (подсветка) и свой срез вкладчика будят узел.
    reset()
    act(() => table.highlight({ cell: { rowId: 'r1', columnId: 'a' } }))
    expect(calls.cell).toBeGreaterThan(0)
    reset()
    act(() => setPluginState(table, 'counted', 'on'))
    expect(calls.cell).toBeGreaterThan(0)
    expect(calls.row).toBeGreaterThan(0)

    // Новая отрисовка цели — пересчёт выбора.
    reset()
    renderCells(5)
    expect(calls.cell).toBeGreaterThan(0)
  })

  it('CD2: вклад автора в ячейку и строку без поля slices — ошибка типов и dev-ошибка при сборке записи с id плагина', () => {
    const plugin = definePlugin<{ enabled?: boolean }>()({
      id: 'noSlices',
      diagnose: neverInert,
      // @ts-expect-error -- поле slices обязательно (ADR 0195)
      body: () => ({ cell: { select: () => 1, render: () => null } }),
    })
    render(<Host plugins={[plugin()]} />)
    expect(
      error.mock.calls.some(([text]: unknown[]) =>
        String(text).includes('noSlices: body.cell and body.row need slices'),
      ),
    ).toBe(true)
  })

  it('CD3: свой срез плагина автора входит в подписку его вклада без объявления', () => {
    __setLoggerProduction(true)
    const { plugin } = counting([])
    render(<Host plugins={[plugin()]} />)
    const cells = renderCells()
    act(() => setPluginState(table, 'counted', 'seen'))
    expect(
      cells
        .querySelector('[data-column-id="a"]')!
        .getAttribute('data-counted-value'),
    ).toBe('seen')
  })

  it('CD4: в dev смена необъявленного среза пересчитывает выбор и предупреждает с id вкладчика и ключом среза, одно на пару; в production проверки нет', () => {
    const reading = (id: string) =>
      definePlugin<{ enabled?: boolean }>()({
        id,
        diagnose: neverInert,
        body: () => ({
          cell: {
            slices: [],
            select: state => JSON.stringify(state.sorting ?? []),
            render: () => null,
          },
        }),
      })
    const warned = (id: string) =>
      warn.mock.calls.filter(([text]: unknown[]) =>
        String(text).includes(`${id}: body select reads sorting`),
      ).length

    __setLoggerProduction(false)
    render(<Host plugins={[reading('devReader')(), columnSortingModel()]} />)
    renderCells()
    act(() => table.setSorting([{ id: 'a', desc: true }]))
    act(() => table.setSorting([{ id: 'a', desc: false }]))
    expect(warned('devReader')).toBe(1)

    act(() => roots.forEach(root => root.unmount()))
    roots = []
    __setLoggerProduction(true)
    render(<Host plugins={[reading('prodReader')(), columnSortingModel()]} />)
    renderCells()
    act(() => table.setSorting([{ id: 'a', desc: true }]))
    expect(warned('prodReader')).toBe(0)
  })
})

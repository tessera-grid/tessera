// @vitest-environment happy-dom
/**
 * Единая форма диапазона выделения (ADR 0180; UR1–UR2, UR4–UR7, UR9): индексы углов и их `id`
 * в срезе во всех режимах, одна реализация по индексам с итогом стоковой фичи, диапазон от
 * приложения, сброс при смене `data`, чтение без режима, цель `range` подсветки, ячейка без
 * диапазонов.
 * Запуск: npx vitest run --config vitest.node.config.ts unifiedRange
 */
import {
  cellSelectionFeature,
  constructTable,
  tableFeatures,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { rangeHighlightAt } from '../core/highlights/highlightFeature'
import { rangeHighlightKey } from '../core/highlights/targetRanges'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import type { RangeTarget } from '../../index'
import { cellEditing, cellSelectionModel, serverRowModel } from '../plugins'
import { __resetLogger } from '../util/logger'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  a: string
  b: string
  c: string
}

const COLUMNS = ['a', 'b', 'c'].map(id => ({ id, accessorKey: id }))
const itemsOf = (count: number, from = 0): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${from + i}`,
    a: `a${from + i}`,
    b: `b${from + i}`,
    c: `c${from + i}`,
  }))
const DATA = itemsOf(10)

let table: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const Host = ({
  plugins,
  data = DATA,
}: {
  plugins: readonly unknown[]
  data?: Item[]
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: plugins as never,
  })
  return null
}

const mount = (plugins: readonly unknown[], data?: Item[]) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host, { plugins, data })))
}

/** Серверная модель: блоки по 10 строк, ответ сразу; окно — строки 0–9. */
const mountServer = async () => {
  const getRows = ({ start, end }: { start: number; end: number }) =>
    Promise.resolve({ rows: itemsOf(end - start, start), rowCount: 100 })
  mount([serverRowModel({ getRows, blockSize: 10 }), cellSelectionModel()], [])
  act(() =>
    (table.getRowSource() as RowSource).observe!({
      first: 0,
      last: 9,
      fast: false,
    }),
  )
  await act(async () => {})
  await act(async () => {})
}

const slice = () => table.store.get().cellSelection as Record<string, unknown>[]

describe('единая форма диапазона выделения (ADR 0180)', () => {
  it('UR1: срез во всех режимах — индексы строк-углов и id колонок; грид дописывает id строк-углов, где строка известна', async () => {
    mount([cellSelectionModel()])
    act(() =>
      table.selectCellRange({
        anchorRowId: 'r1',
        focusRowId: 'r3',
        anchorColumnId: 'a',
        focusColumnId: 'b',
      }),
    )
    expect(slice()).toEqual([
      {
        anchorRowIndex: 1,
        focusRowIndex: 3,
        anchorRowId: 'r1',
        focusRowId: 'r3',
        anchorColumnId: 'a',
        focusColumnId: 'b',
      },
    ])
    act(() => root?.unmount())
    root = undefined

    await mountServer()
    act(() =>
      table.selectCellRange({
        anchorRowIndex: 2,
        focusRowIndex: 50,
        anchorColumnId: 'a',
        focusColumnId: 'c',
      }),
    )
    // Строка 50 не загружена: её id неизвестен.
    expect(slice()).toEqual([
      {
        anchorRowIndex: 2,
        focusRowIndex: 50,
        anchorRowId: 'r2',
        anchorColumnId: 'a',
        focusColumnId: 'c',
      },
    ])
  })

  it('UR2: на клиенте одна реализация по индексам — на тех же действиях мышью, клавишами, Ctrl+A и исключением диапазона итог тот же, что у стоковой фичи', () => {
    mount([cellSelectionModel()])
    const stock = constructTable({
      features: tableFeatures({
        coreReactivityFeature: storeReactivityBindings(),
        cellSelectionFeature,
      } as never),
      data: DATA,
      columns: COLUMNS,
      getRowId: (row: Item) => row.id,
      enableCellSelection: true,
    } as never) as any
    const both = (act_: (t: any) => void) => {
      act(() => act_(table))
      act_(stock)
    }
    const compare = (step: string) => {
      expect([...table.getSelectedCellIds()].sort(), step).toEqual(
        [...stock.getSelectedCellIds()].sort(),
      )
      expect(table.getSelectedCellCount(), step).toBe(
        stock.getSelectedCellCount(),
      )
      expect(table.getSelectedCellRangesData(), step).toEqual(
        stock.getSelectedCellRangesData(),
      )
      expect(table.getFocusedCell()?.id, step).toBe(stock.getFocusedCell()?.id)
    }
    const cellOf = (t: any, rowId: string, columnId: string) =>
      t.getRow(rowId).getAllCellsByColumnId()[columnId]
    const press = (rowId: string, columnId: string, event: object) =>
      both(t => cellOf(t, rowId, columnId).getSelectionStartHandler()(event))

    both(t =>
      t.selectCellRange({
        anchorRowId: 'r1',
        focusRowId: 'r3',
        anchorColumnId: 'a',
        focusColumnId: 'b',
      }),
    )
    compare('диапазон')
    both(t => t.extendCellSelection('down'))
    both(t => t.extendCellSelection('right'))
    compare('расширение')
    both(t =>
      t.selectCellRange(
        {
          anchorRowId: 'r2',
          focusRowId: 'r2',
          anchorColumnId: 'b',
          focusColumnId: 'b',
        },
        { mode: 'exclude' },
      ),
    )
    compare('исключение')
    both(t =>
      t.selectCellRange(
        {
          anchorRowId: 'r6',
          focusRowId: 'r7',
          anchorColumnId: 'a',
          focusColumnId: 'a',
        },
        { mode: 'include' },
      ),
    )
    compare('ещё диапазон')
    both(t => t.moveCellSelection('down'))
    compare('шаг')
    both(t => t.selectAllCells())
    compare('Ctrl+A')
    press('r4', 'a', {})
    press('r6', 'c', { shiftKey: true })
    compare('нажатие и Shift')
    press('r5', 'b', { ctrlKey: true })
    compare('Ctrl по выделенному')
    press('r9', 'a', { ctrlKey: true })
    compare('Ctrl по невыделенному')
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('UR4: диапазон от приложения применяется, если в нём только id (клиент) или только индексы (любой режим); в серверной модели диапазон только с id незагруженных строк не применяется, с одним dev-warn', async () => {
    mount([cellSelectionModel()])
    const range = (corners: object) => [
      { ...corners, anchorColumnId: 'a', focusColumnId: 'b' },
    ]
    act(() =>
      table.setCellSelection(() =>
        range({ anchorRowId: 'r1', focusRowId: 'r2' }),
      ),
    )
    expect(table.getSelectedCellCount()).toBe(4)
    act(() =>
      table.setCellSelection(() =>
        range({ anchorRowIndex: 3, focusRowIndex: 5 }),
      ),
    )
    expect(table.getSelectedCellCount()).toBe(6)
    act(() => root?.unmount())
    root = undefined

    __resetLogger()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await mountServer()
      act(() =>
        table.setCellSelection(() =>
          range({ anchorRowIndex: 0, focusRowIndex: 40 }),
        ),
      )
      expect(table.getSelectedCellCount()).toBe(82)
      act(() =>
        table.setCellSelection(() =>
          range({ anchorRowId: 'r1', focusRowId: 'r3' }),
        ),
      )
      expect(table.getSelectedCellCount()).toBe(6)
      for (let i = 0; i < 2; i++) {
        act(() =>
          table.setCellSelection(() =>
            range({ anchorRowId: 'r70', focusRowId: 'r80' }),
          ),
        )
        expect(table.getSelectedCellCount()).toBe(0)
      }
      expect(
        warn.mock.calls.filter(([message]) =>
          String(message).includes('cellSelection'),
        ),
      ).toHaveLength(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('UR5: смена data не сбрасывает выделение — углы следуют за своими строками, угол, ушедший из данных, снимает диапазон; строки до сохранения — по видимому списку, как прежде', async () => {
    mount([cellSelectionModel()])
    act(() =>
      table.selectCellRange({
        anchorRowIndex: 1,
        focusRowIndex: 3,
        anchorColumnId: 'a',
        focusColumnId: 'a',
      }),
    )
    expect(slice()[0]).toMatchObject({ anchorRowId: 'r1', focusRowId: 'r3' })
    // Строка вставлена выше — углы едут со своими строками (ADR 0194).
    const added = { id: 'x', a: 'x', b: 'x', c: 'x' }
    mount([cellSelectionModel()], [added, ...DATA])
    await act(async () => {})
    expect(slice()).toEqual([
      expect.objectContaining({
        anchorRowId: 'r1',
        focusRowId: 'r3',
        anchorRowIndex: 2,
        focusRowIndex: 4,
      }),
    ])
    // Угол ушёл из данных — диапазон снят.
    mount(
      [cellSelectionModel()],
      [added, ...DATA.filter(row => row.id !== 'r3')],
    )
    await act(async () => {})
    expect(slice()).toEqual([])
    act(() => root?.unmount())
    root = undefined

    mount([cellEditing({ saveMode: 'manual' }), cellSelectionModel()])
    let id: string | undefined
    act(() => {
      id = table.addRow({ a: 'new', b: 'new', c: 'new' }, { index: 1 })
    })
    act(() =>
      table.selectCellRange({
        anchorRowIndex: 1,
        focusRowIndex: 2,
        anchorColumnId: 'a',
        focusColumnId: 'a',
      }),
    )
    expect(table.getSelectedCellRangesData()).toEqual([[['new'], ['a1']]])
    expect(slice()[0]).toMatchObject({ anchorRowId: id, focusRowId: 'r1' })
  })

  it('UR6: getCellSelectionRanges — одна форма во всех режимах: границы строк индексами, id углов, где известны, колонки по id, операция', async () => {
    mount([cellSelectionModel()])
    act(() =>
      table.selectCellRange({
        anchorRowId: 'r3',
        focusRowId: 'r1',
        anchorColumnId: 'c',
        focusColumnId: 'a',
      }),
    )
    act(() =>
      table.selectCellRange(
        {
          anchorRowId: 'r2',
          focusRowId: 'r2',
          anchorColumnId: 'b',
          focusColumnId: 'b',
        },
        { mode: 'exclude' },
      ),
    )
    expect(table.getCellSelectionRanges()).toEqual([
      {
        minRowIndex: 1,
        maxRowIndex: 3,
        anchorRowId: 'r3',
        focusRowId: 'r1',
        columnIds: ['a', 'b', 'c'],
        operation: 'include',
      },
      {
        minRowIndex: 2,
        maxRowIndex: 2,
        anchorRowId: 'r2',
        focusRowId: 'r2',
        columnIds: ['b'],
        operation: 'exclude',
      },
    ])
    act(() => root?.unmount())
    root = undefined

    await mountServer()
    act(() =>
      table.selectCellRange({
        anchorRowIndex: 5,
        focusRowIndex: 60,
        anchorColumnId: 'a',
        focusColumnId: 'b',
      }),
    )
    expect(table.getCellSelectionRanges()).toEqual([
      {
        minRowIndex: 5,
        maxRowIndex: 60,
        anchorRowId: 'r5',
        columnIds: ['a', 'b'],
        operation: 'include',
      },
    ])
  })

  it('UR7: цель подсветки и вспышки range — той же формы, что диапазон выделения: углы строк индексами или id, колонки по id', () => {
    mount([cellSelectionModel()])
    const byId: RangeTarget = {
      range: {
        anchorRowId: 'r1',
        focusRowId: 'r2',
        anchorColumnId: 'a',
        focusColumnId: 'b',
      },
    }
    const byIndex: RangeTarget = {
      range: {
        anchorRowIndex: 4,
        focusRowIndex: 5,
        anchorColumnId: 'b',
        focusColumnId: 'c',
      },
    }
    act(() => {
      table.highlight(byId, { key: 'id' })
      table.highlight(byIndex, { key: 'index' })
    })
    expect(Object.keys(table.store.get().highlights).sort()).toEqual(
      [rangeHighlightKey(byId), rangeHighlightKey(byIndex)].sort(),
    )
    const lit = (rowId: string, columnId: string) =>
      rangeHighlightAt(
        table,
        table.store.get().highlights,
        rowId,
        columnId,
      )?.list.at(-1)?.key
    expect(lit('r1', 'a')).toBe('id')
    expect(lit('r2', 'b')).toBe('id')
    expect(lit('r5', 'c')).toBe('index')
    expect(lit('r3', 'a')).toBeUndefined()
    // Прежней формы нет: углы строк — только полями диапазона выделения.
    const legacy = {
      range: { rows: ['r1', 'r2'], columns: ['a', 'b'] },
    }
    // @ts-expect-error — форма `rows`/`columns` удалена.
    const typed: RangeTarget = legacy
    void typed
  })
})

describe('Ячейка без диапазонов (ADR 0180, §2)', () => {
  it('UR9: без диапазонов ячейка не выбрана, не в фокусе и без краёв, не спрашивая источник строк', () => {
    mount([cellSelectionModel()])
    const cells = table
      .getRowModel()
      .rows.flatMap((row: any) => row.getAllCells())
    // Выделение держит таблицу ядра, а не копию рендера из `useCreateTable`.
    const asked = vi.spyOn(cells[0].table, 'getRowSource')
    for (const cell of cells) {
      expect(cell.getIsSelected()).toBe(false)
      expect(cell.getIsFocused()).toBe(false)
      expect(cell.getTabIndex()).toBe(-1)
      expect(cell.getSelectionEdges()).toEqual({
        top: false,
        right: false,
        bottom: false,
        left: false,
      })
    }
    expect(asked).not.toHaveBeenCalled()
    asked.mockRestore()
  })
})

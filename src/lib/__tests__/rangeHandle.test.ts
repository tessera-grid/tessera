import { describe, expect, it } from 'vitest'

import { cellSelection, serverRowModel } from '../plugins'
import {
  type HandleCell,
  type HandleMode,
  rangeMode,
} from '../plugins/cellSelection/rangeHandle'
import { MODEL_PARITY } from './modelParity.baseline'
import { hostTable } from './tableHost'

// Маркер угла выделения (ADR 0198): режим диапазона и аргумент `handle` фабрики.

type Range = Record<string, unknown>

/** Таблица режима: срез выделения и его запись. */
const selectionTable = (initial: Range[]) => {
  let ranges = initial
  return {
    ranges: () => ranges,
    table: {
      atoms: { cellSelection: { get: () => ranges } },
      setCellSelection: (updater: (old: Range[]) => Range[]) => {
        ranges = updater(ranges)
      },
    },
  }
}

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const handleOf = (params: Record<string, unknown>) =>
  (
    hostTable({ columns, ...params }).options as {
      cellSelectionHandle?: { mouse: boolean; touch: boolean }
    }
  ).cellSelectionHandle

describe('маркер угла выделения (ADR 0198)', () => {
  it('HN18: жест отделён от режима — режим получает ячейку, конец и отмену; режим диапазона двигает угол фокуса последнего диапазона', () => {
    const other = { anchorColumnId: 'a', focusColumnId: 'a' }
    const last = {
      anchorRowIndex: 4,
      anchorColumnId: 'c',
      focusRowIndex: 6,
      focusColumnId: 'd',
      operation: 'include',
    }
    const host = selectionTable([other, last])
    const fixed: HandleCell = { row: 4, column: 'c' }
    const mode: HandleMode = rangeMode(host.table, fixed)
    expect(Object.keys(mode).sort()).toEqual(['cancel', 'end', 'move'])

    // Ячейка под указателем — угол фокуса; неподвижный угол — опорный.
    mode.move({ row: 9, column: 'e' })
    expect(host.ranges()).toEqual([
      other,
      {
        anchorRowIndex: 4,
        anchorColumnId: 'c',
        focusRowIndex: 9,
        focusColumnId: 'e',
        operation: 'include',
      },
    ])
    // Указатель ушёл за неподвижный угол — диапазон переворачивается.
    mode.move({ row: 1, column: 'a' })
    expect(host.ranges().at(-1)).toMatchObject({
      anchorRowIndex: 4,
      anchorColumnId: 'c',
      focusRowIndex: 1,
      focusColumnId: 'a',
    })
    // Конец оставляет диапазон; отмена возвращает бывший до нажатия.
    mode.end()
    expect(host.ranges().at(-1)).toMatchObject({ focusRowIndex: 1 })
    mode.cancel()
    expect(host.ranges()).toEqual([other, last])
  })

  it('HN19: аргумент handle на клиентской и серверной модели строк одинаков; запись в базе паритета', () => {
    const server = serverRowModel({ getRows: () => new Promise(() => {}) })
    const cases = [
      [undefined, { mouse: true, touch: true }],
      [{ touch: false }, { mouse: true, touch: false }],
      [{ mouse: false }, { mouse: false, touch: true }],
      [false, { mouse: false, touch: false }],
    ] as const
    for (const [handle, expected] of cases) {
      const plugin = () => cellSelection(handle === undefined ? {} : { handle })
      expect(handleOf({ plugins: [plugin()] })).toEqual(expected)
      expect(handleOf({ plugins: [plugin(), server] })).toEqual(expected)
    }
    expect(MODEL_PARITY.cellSelection?.same).toContain('handle')
  })
})

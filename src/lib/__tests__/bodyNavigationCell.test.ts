import { describe, expect, it, vi } from 'vitest'

import { pluginStateKey } from '../core/definePlugin'
import { selectNavigationCell } from '../core/keyboardNavigation/useKeyboardNavigationCell'
import {
  KEYBOARD_NAVIGATION,
  resolveActive,
  type ActiveCell,
  type NavTable,
} from '../core/keyboardNavigation/model'

const stateOf = (active?: ActiveCell) => ({
  [pluginStateKey(KEYBOARD_NAVIGATION)]: active,
})
const fixture = () => {
  let rows = 8
  let headers = 2
  let columns = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const table = {
    options: { enableFooter: false, treeRows: false },
    getRowSource: vi.fn(() => ({ count: () => rows })),
    getHeaderGroups: vi.fn(() =>
      Array.from({ length: headers }, () => ({ headers: [] })),
    ),
    getVisibleLeafColumns: vi.fn(() => columns),
  }
  return {
    table,
    read: table as unknown as NavTable,
    update: (nextRows: number, nextHeaders: number, ids: string[]) => {
      rows = nextRows
      headers = nextHeaders
      columns = ids.map(id => ({ id }))
    },
  }
}

describe('Быстрая проверка активной ячейки (ADR 0239)', () => {
  it('NBJ1: чужая строка не читает модели строк и колонок', () => {
    const { table } = fixture()
    expect(
      selectNavigationCell(table, stateOf(), {
        rowIndex: 2,
        columnId: 'a',
        participates: true,
      }),
    ).toBe(false)
    expect(table.getRowSource).not.toHaveBeenCalled()
    expect(table.getVisibleLeafColumns).not.toHaveBeenCalled()
    expect(table.getHeaderGroups).not.toHaveBeenCalled()
  })

  it('NBJ2: проверка совпадает с полной после смены геометрии и режима фокуса', () => {
    const { table, read, update } = fixture()
    const active: (ActiveCell | undefined)[] = [
      undefined,
      { rowIndex: -5, columnIndex: 9 },
      { rowIndex: 1, columnIndex: -1 },
      { rowIndex: 50, columnIndex: 50 },
      { rowIndex: 0, columnIndex: 0 },
    ]
    for (const [rows, headers, ids] of [
      [8, 2, ['a', 'b', 'c']],
      [2, 1, ['c', 'a']],
      [2, 0, ['b']],
      [0, 0, []],
    ] as const) {
      update(rows, headers, [...ids])
      for (const treeRows of [false, true])
        for (const enableFooter of [false, true]) {
          table.options.treeRows = treeRows
          table.options.enableFooter = enableFooter
          for (const raw of active) {
            const state = stateOf(raw)
            const expected = resolveActive(read, state)
            for (let rowIndex = 0; rowIndex <= rows; rowIndex++)
              for (const columnId of ['a', 'b', 'c']) {
                expect(
                  selectNavigationCell(table, state, {
                    rowIndex,
                    columnId,
                    participates: true,
                  }),
                ).toBe(
                  expected.rowIndex === rowIndex &&
                    ids[expected.columnIndex] === columnId,
                )
              }
          }
        }
    }
  })
})

import { Table } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'

import { ROW_NESTING_INDENT_PX } from '../../core/rowNesting'
import { getRowDraggableOffsetLeft } from './getRowDraggableOffsetLeft'

type ColumnStub = { isActions: boolean; size: number }

const makeTable = (columns: ColumnStub[]) =>
  ({
    getVisibleLeafColumns: () =>
      columns.map(column => ({
        getIsActionsColumn: () => column.isActions,
        getSize: () => column.size,
      })),
  }) as unknown as Table

const service = (size: number): ColumnStub => ({ isActions: true, size })
const user = (size: number): ColumnStub => ({ isActions: false, size })

describe('getRowDraggableOffsetLeft', () => {
  it('A3: шаг = сумма реальных ширин лидирующих сервисных колонок + шаг вложенности', () => {
    // drag-ручка (24) + раскрытие (40) → база 64.
    const table = makeTable([service(24), service(40), user(200), user(200)])

    expect(getRowDraggableOffsetLeft({ table })).toBe(
      64 + ROW_NESTING_INDENT_PX,
    )
  })

  it('A3: ширины берутся по факту, а не по предполагаемой константе', () => {
    // Нестандартная ширина сервисной колонки (50) должна учитываться как есть.
    const table = makeTable([service(50), user(120)])

    expect(getRowDraggableOffsetLeft({ table })).toBe(
      50 + ROW_NESTING_INDENT_PX,
    )
  })

  it('A3: без сервисных колонок база 0 — остаётся только шаг вложенности', () => {
    const table = makeTable([user(120), user(120)])

    expect(getRowDraggableOffsetLeft({ table })).toBe(ROW_NESTING_INDENT_PX)
  })

  it('A3: только сервисные колонки (нет пользовательских) — суммируются все', () => {
    const table = makeTable([service(24), service(40)])

    expect(getRowDraggableOffsetLeft({ table })).toBe(
      64 + ROW_NESTING_INDENT_PX,
    )
  })
})

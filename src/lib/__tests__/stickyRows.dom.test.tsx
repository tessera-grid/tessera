// @vitest-environment happy-dom
/**
 * Липкие строки (ADR 0160, EA8): включает аргумент `stickyRows` фабрик `rowGrouping` и
 * `rowExpanding`, по умолчанию выключены; выключенный плагин их не включает.
 * Запуск: npx vitest run --config vitest.node.config.ts stickyRows
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { hasStickyRows } from '../grid/StickyRows'
import { rowExpanding, rowGrouping } from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const COLUMNS = [{ id: 'city', accessorKey: 'city' }]
const DATA = [{ id: 'a', city: 'A' }]

/** Таблица с этими плагинами — её опции липких строк. */
const stickyOf = (plugins: unknown[]) => {
  let table: any
  const Grid = () => {
    table = useCreateTable({
      columns: COLUMNS as never,
      data: DATA,
      getRowId: (row: { id: string }) => row.id,
      plugins: plugins as never,
    })
    return null
  }
  const view = createRoot(document.createElement('div'))
  act(() => view.render(<Grid />))
  const result = {
    groups: !!table.options.stickyGroupRows,
    branches: !!table.options.stickyBranchRows,
    any: hasStickyRows(table),
  }
  act(() => view.unmount())
  return result
}

describe('липкие строки — аргумент фабрик (ADR 0160)', () => {
  it('EA8: липкие строки включает аргумент stickyRows у rowGrouping и rowExpanding; по умолчанию и у выключенного плагина — нет', () => {
    const off = { groups: false, branches: false, any: false }
    expect(stickyOf([rowGrouping(), rowExpanding()])).toEqual(off)
    expect(
      stickyOf([rowGrouping({ stickyRows: true }), rowExpanding()]),
    ).toEqual({ groups: true, branches: false, any: true })
    expect(
      stickyOf([rowGrouping(), rowExpanding({ stickyRows: true })]),
    ).toEqual({ groups: false, branches: true, any: true })
    expect(
      stickyOf([
        rowGrouping({ stickyRows: true, enabled: false }),
        rowExpanding({ stickyRows: true, enabled: false }),
      ]),
    ).toEqual(off)
  })
})

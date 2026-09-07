import { Table } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetDevWarn } from '../../core/devWarn'
import { columnDraggingPlugin } from './columnDraggingPlugin'

const makeTable = (headerGroups: number, enableColumnDragging: boolean) =>
  ({
    getHeaderGroups: () => new Array(headerGroups).fill({}),
    options: { enableColumnDragging },
  }) as unknown as Table

const makeColumn = (enableDragging: boolean) =>
  ({ columnDef: { enableDragging } }) as never

const setup = (headerGroups: number, enableColumnDragging: boolean) => {
  const table = makeTable(headerGroups, enableColumnDragging)
  const column = makeColumn(true) as { getCanDrag: () => boolean }
  columnDraggingPlugin.createColumn!(column as never, table)
  return column
}

describe('columnDraggingPlugin · getCanDrag', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetDevWarn()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => warn.mockRestore())

  it('PC1: многоуровневая шапка делает columnDragging инертным и предупреждает', () => {
    const column = setup(2, true)

    expect(column.getCanDrag()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('columnDragging')

    // Одноуровневая шапка — фича работает и молчит.
    __resetDevWarn()
    warn.mockClear()
    const ok = setup(1, true)
    expect(ok.getCanDrag()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC1: не предупреждает, когда columnDragging не включён потребителем', () => {
    const column = setup(2, false)

    expect(column.getCanDrag()).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })
})

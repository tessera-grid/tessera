import { Table } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../../core/logger'
import { columnPinningPlugin } from './columnPinningPlugin'

const makeTable = (headerGroups: number, enableLeafPinning = false) =>
  ({
    getHeaderGroups: () => new Array(headerGroups).fill({}),
    options: { enableLeafPinning },
  }) as unknown as Table

interface SetupParams {
  canPin: boolean
  depth?: number
  enablePinning?: boolean
  id?: string
}

const setup = (
  headerGroups: number,
  { canPin, depth = 0, enablePinning, id = 'c' }: SetupParams,
) => {
  const table = makeTable(headerGroups)
  const column = {
    id,
    depth,
    columnDef: { enablePinning },
    getCanPin: () => canPin,
  } as {
    getCanPin: () => boolean
  }
  columnPinningPlugin.createColumn!(column as never, table)
  return column
}

describe('columnPinningPlugin · getCanPin', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetLogger()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => warn.mockRestore())

  it('PC2: плоская шапка — закрепление работает и молчит', () => {
    const ok = setup(1, { canPin: true, depth: 0 })
    expect(ok.getCanPin()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC2: под вложенной шапкой закрепляется группа верхнего уровня (depth 0)', () => {
    const top = setup(2, { canPin: true, depth: 0 })

    expect(top.getCanPin()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC2: под вложенной шапкой лист под группой не закрепляем; при явном enablePinning предупреждает', () => {
    const leaf = setup(2, {
      canPin: true,
      depth: 2,
      enablePinning: true,
      id: 'leaf',
    })

    expect(leaf.getCanPin()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('columnPinning')
  })

  it('PC2: лист под группой без явного enablePinning молчит', () => {
    const leaf = setup(2, { canPin: true, depth: 2, id: 'leaf' })

    expect(leaf.getCanPin()).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC2: не закрепляем и молчим, когда столбец и так не закрепляем', () => {
    const column = setup(2, { canPin: false, depth: 0 })

    expect(column.getCanPin()).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })
})

import { Table } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetDevWarn } from '../../core/devWarn'
import { columnPinningPlugin } from './columnPinningPlugin'

const makeTable = (headerGroups: number) =>
  ({
    getHeaderGroups: () => new Array(headerGroups).fill({}),
  }) as unknown as Table

const setup = (headerGroups: number, canPin: boolean) => {
  const table = makeTable(headerGroups)
  const column = { getCanPin: () => canPin } as {
    getCanPin: () => boolean
  }
  columnPinningPlugin.createColumn!(column as never, table)
  return column
}

describe('columnPinningPlugin · getCanPin', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetDevWarn()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => warn.mockRestore())

  it('PC2: многоуровневая шапка делает columnPinning инертным и предупреждает', () => {
    const column = setup(2, true)

    expect(column.getCanPin()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('columnPinning')

    // Одноуровневая шапка — закрепление работает и молчит.
    __resetDevWarn()
    warn.mockClear()
    const ok = setup(1, true)
    expect(ok.getCanPin()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC2: не предупреждает, когда столбец и так не закрепляем', () => {
    const column = setup(2, false)

    expect(column.getCanPin()).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })
})

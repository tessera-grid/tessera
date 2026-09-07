import { Table } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetDevWarn } from '../../core/devWarn'
import { rowExpandingPlugin } from './rowExpandingPlugin'

type TableStub = {
  enableGrouping?: boolean
  enableRowExpanding?: boolean
  maxExpandingDepth?: number
}

const makeTable = ({
  enableGrouping = false,
  enableRowExpanding = true,
  maxExpandingDepth = 1,
}: TableStub = {}) =>
  ({
    options: { enableGrouping, enableRowExpanding, maxExpandingDepth },
  }) as unknown as Table

const setup = (stub: TableStub, depth: number, originalCanExpand: boolean) => {
  const table = makeTable(stub)
  const row = { depth, getCanExpand: () => originalCanExpand } as {
    depth: number
    getCanExpand: () => boolean
  }
  rowExpandingPlugin.createRow!(row as never, table)
  return row
}

describe('rowExpandingPlugin · getCanExpand', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetDevWarn()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => warn.mockRestore())

  it('PC5: при группировке раскрытие делегируется TanStack, настройки игнорируются, предупреждаем', () => {
    // maxExpandingDepth=0 отсёк бы корень, но при группировке не действует:
    // возвращается штатный getCanExpand (true).
    const row = setup({ enableGrouping: true, maxExpandingDepth: 0 }, 0, true)

    expect(row.getCanExpand()).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('rowExpanding')
    expect(warn.mock.calls[0][0]).toContain('группировке')
  })

  it('PC5: без группировки работает семантика rowExpanding и без предупреждения', () => {
    const row = setup({ enableGrouping: false, maxExpandingDepth: 1 }, 0, false)

    // depth 0 < maxExpandingDepth 1 → корень раскрываем, не спрашивая TanStack.
    expect(row.getCanExpand()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })
})

import { Table } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../../core/logger'
import { rowExpandingPlugin } from './rowExpandingPlugin'

type TableStub = {
  grouping?: unknown[]
  enableRowExpanding?: boolean
  maxExpandingDepth?: number
}

const makeTable = ({
  grouping = [],
  enableRowExpanding = true,
  maxExpandingDepth = 1,
}: TableStub = {}) =>
  ({
    getState: () => ({ grouping }),
    options: { enableRowExpanding, maxExpandingDepth },
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
    __resetLogger()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => warn.mockRestore())

  it('PC5: при активной группировке раскрытие делегируется TanStack, настройки игнорируются, предупреждаем', () => {
    // maxExpandingDepth=0 отсёк бы корень, но при активной группировке не
    // действует: возвращается штатный getCanExpand (true).
    const row = setup({ grouping: ['gender'], maxExpandingDepth: 0 }, 0, true)

    expect(row.getCanExpand()).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('rowExpanding')
    expect(warn.mock.calls[0][0]).toContain('активной группировке')
  })

  it('PC5: без активной группировки работает семантика rowExpanding и без предупреждения', () => {
    // grouping-состояние пусто (плагин группировки может быть включён) → работает
    // собственная семантика rowExpanding: depth 0 < maxExpandingDepth 1 → корень
    // раскрываем, не спрашивая TanStack.
    const row = setup({ grouping: [], maxExpandingDepth: 1 }, 0, false)

    expect(row.getCanExpand()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })
})

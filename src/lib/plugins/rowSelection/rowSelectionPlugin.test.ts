import { Table } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../../core/logger'
import { rowSelectionPlugin } from './rowSelectionPlugin'

// PC11 (ADR 0022): активная группировка делает rowSelection инертным. Стык —
// чистая логика (обёртка getCanSelect + диспатч предупреждения), поэтому покрытие
// модульное, co-located рядом с исходником (ADR 0009).

type TableStub = {
  grouping?: unknown[]
}

const makeTable = ({ grouping = [] }: TableStub = {}) =>
  ({
    getState: () => ({ grouping }),
  }) as unknown as Table

const setup = (stub: TableStub, originalCanSelect: boolean) => {
  const table = makeTable(stub)
  const row = { getCanSelect: () => originalCanSelect } as {
    getCanSelect: () => boolean
  }
  rowSelectionPlugin.createRow!(row as never, table)
  return row
}

describe('rowSelectionPlugin · getCanSelect', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetLogger()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => warn.mockRestore())

  it('PC11: активная группировка делает rowSelection инертным и предупреждает', () => {
    const row = setup({ grouping: ['gender'] }, true)

    expect(row.getCanSelect()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('активной группировке')
  })

  it('PC11: само включение группировки (без применения) выбор не трогает', () => {
    // grouping-состояние пусто → плагин группировки может быть включён, но выбор
    // работает: инертность гейтится на активную группировку, а не на опцию.
    const row = setup({ grouping: [] }, true)

    expect(row.getCanSelect()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC11: при активной группировке не «оживляет» изначально невыбираемую строку', () => {
    // Обёртка не должна делать getCanSelect=true там, где базовый вернул false.
    const row = setup({ grouping: [] }, false)

    expect(row.getCanSelect()).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })
})

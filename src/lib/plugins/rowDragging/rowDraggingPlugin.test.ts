import { Table } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../../core/logger'
import { rowDraggingPlugin } from './rowDraggingPlugin'

type TableStub = {
  headerGroups?: number
  grouping?: unknown[]
  enableRowDragging?: boolean | ((row: never) => boolean)
  sorting?: unknown[]
}

const makeTable = ({
  headerGroups = 1,
  grouping = [],
  enableRowDragging = true,
  sorting = [],
}: TableStub = {}) =>
  ({
    getHeaderGroups: () => new Array(headerGroups).fill({}),
    getState: () => ({ sorting, grouping }),
    options: { enableRowDragging },
  }) as unknown as Table

const setup = (stub?: TableStub) => {
  const table = makeTable(stub)
  const row = {} as { getCanDrag: () => boolean }
  rowDraggingPlugin.createRow!(row as never, table)
  return row
}

describe('rowDraggingPlugin · getCanDrag', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetLogger()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => warn.mockRestore())

  it('PC3: многоуровневая шапка делает rowDragging инертным и предупреждает', () => {
    const row = setup({ headerGroups: 2 })

    expect(row.getCanDrag()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('многоуровневой шапке')
  })

  it('PC4: активная группировка делает rowDragging инертным и предупреждает', () => {
    const row = setup({ grouping: ['gender'] })

    expect(row.getCanDrag()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('активной группиров')
  })

  it('PC4: само включение группировки (без применения) drag не трогает', () => {
    // grouping-состояние пусто → плагин группировки может быть включён, но drag
    // работает: инертность гейтится на активную группировку, а не на опцию.
    const row = setup({ grouping: [] })

    expect(row.getCanDrag()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC6: активная сортировка делает rowDragging инертным и предупреждает', () => {
    const row = setup({ sorting: [{ id: 'name', desc: false }] })

    expect(row.getCanDrag()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('сортировкой')
  })

  it('PC3/PC4/PC6: чистое состояние — drag работает и молчит', () => {
    const row = setup()

    expect(row.getCanDrag()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC3/PC4/PC6: не предупреждает, когда drag не включён потребителем', () => {
    const row = setup({ headerGroups: 2, enableRowDragging: false })

    expect(row.getCanDrag()).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })
})

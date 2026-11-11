/**
 * Ранний переход к полной сборке при смене `data` (ADR 0212, EB1–EB2): новых объектов больше бюджета
 * — полная сборка без сборки по уровням; разнесённые вставки — сборка по уровням из прежней модели.
 * Запуск: npx vitest run --project unit earlyFullBuild
 */
import { describe, expect, it } from 'vitest'

import { rowModelChangeOf } from '../core/dataChanges'
import { hostTable } from './tableHost'

interface Item {
  id: string
  name: string
}

const items = (from: number, count: number): Item[] =>
  Array.from({ length: count }, (_, k) => ({
    id: `r${from + k}`,
    name: `Name ${from + k}`,
  }))

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const N = 1000

const tableOf = (data: Item[]) => {
  let ids = 0
  const table = hostTable({
    columns: COLUMNS,
    data,
    getRowId: (row: Item) => {
      ids++
      return row.id
    },
  }) as any
  table.getCoreRowModel()
  return {
    table,
    /** Число вызовов `getRowId` за смену `data`. */
    change: (next: Item[]) => {
      ids = 0
      table.setOptions((prev: any) => ({ ...prev, data: next }))
      const model = table.getCoreRowModel()
      return { model, ids }
    },
  }
}

describe('Ранний переход к полной сборке (ADR 0212)', () => {
  it('EB1: data новыми объектами, которых больше бюджета инкремента, после отказа сдвига собирается полной сборкой без сборки по уровням; модель — как у полной сборки', () => {
    const base = items(0, N)
    const { change } = tableOf(base)
    // Перенос строки и копия всех объектов — как ответ сервера с новым порядком.
    const moved = base.slice()
    const [row] = moved.splice(10, 1)
    moved.splice(600, 0, row!)
    const next = moved.map(item => ({ ...item }))
    const { model, ids } = change(next)
    expect(rowModelChangeOf(model)).toBeUndefined()
    expect(model.rows.map((r: { id: string }) => r.id)).toEqual(
      next.map(item => item.id),
    )
    expect(
      model.rows.every(
        (r: { original: Item }, i: number) => r.original === next[i],
      ),
    ).toBe(true)
    // Полная сборка считает id каждой строки один раз; сборка по уровням — ещё раз.
    expect(ids).toBeLessThan(N * 1.1)
  })

  it('EB2: разнесённые вставки и перенос, на которых сдвиг отказывает, а новых объектов не больше бюджета, собираются по уровням из прежней модели: прежние объекты строк сохраняются', () => {
    const base = items(0, N)
    const { table, change } = tableOf(base)
    const before = table.getCoreRowModel().rows
    // Пары вставок в разных местах сбивают шаг сдвига вперёд на одну строку.
    const next = [
      ...base.slice(0, 10),
      ...items(5000, 2),
      ...base.slice(10, 400),
      ...items(5010, 2),
      ...base.slice(400, 800),
      ...items(5020, 2),
      ...base.slice(800),
    ]
    const { model } = change(next)
    expect(rowModelChangeOf(model)).toBeDefined()
    expect(model.rows.map((r: { id: string }) => r.id)).toEqual(
      next.map(item => item.id),
    )
    const kept = new Set(before)
    const survivors = model.rows.filter((r: object) => kept.has(r))
    expect(survivors).toHaveLength(N)
  })
})

/**
 * Отложенная запись мест сдвинутых строк (ADR 0211, PD1–PD4): смена `data` сдвигом откладывает
 * места, первое обращение дописывает их; поиск уходящей строки при сортировке — по значениям.
 * Запуск: npx vitest run --project unit rowPositionDefer
 */
import { describe, expect, it } from 'vitest'

import {
  hasDeferredPositions,
  positionOf,
  setPosition,
} from '../core/rowPosition'
import { columnSortingModel } from '../plugins'
import { hostTable } from './tableHost'

interface Item {
  id: string
  name: string
  group: number
}

const items = (from: number, count: number, groups = 7): Item[] =>
  Array.from({ length: count }, (_, k) => ({
    id: `r${from + k}`,
    name: `Name ${from + k}`,
    group: (from + k) % groups,
  }))

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'group', accessorKey: 'group', header: 'Group' },
]

const tableOf = (data: Item[], plugins: unknown[] = []) => {
  const table = hostTable({
    columns: COLUMNS,
    data,
    getRowId: (row: Item) => row.id,
    plugins,
  }) as any
  table.getRowModel()
  return table
}

const setData = (table: any, data: Item[]) => {
  table.setOptions((prev: any) => ({ ...prev, data }))
  table.getRowModel()
}

/** Места строк ядра против их индексов в `data`. */
const placesOf = (table: any, data: Item[]) => {
  const rows = table.getCoreRowModel().rows as { id: string; index: number }[]
  return {
    actual: rows.map(row => [row.id, positionOf(row)]),
    expected: data.map((item, index) => [item.id, index]),
  }
}

const BASE = items(0, 1000)
const removeMiddle = (data: Item[]) => [
  ...data.slice(0, 400),
  ...data.slice(420),
]
const insertMiddle = (data: Item[]) => [
  ...data.slice(0, 300),
  ...items(5000, 10),
  ...data.slice(300),
]
const moveRow = (data: Item[]) => {
  const next = data.slice()
  const [row] = next.splice(10, 1)
  next.splice(700, 0, row!)
  return next
}

describe('Отложенная запись мест строк (ADR 0211)', () => {
  it('PD1: смена data сдвигом — удаление, вставка, перенос в середине — откладывает места; чтение даёт места строк в новом data, строка на прежнем месте или со сдвигом конца читается без записи отложенного', () => {
    for (const [label, step, settles] of [
      ['удаление', removeMiddle, false],
      ['вставка', insertMiddle, false],
      // Строки между прежним и новым местом перенесённой сдвинуты не так, как конец списка.
      ['перенос', moveRow, true],
    ] as const) {
      const table = tableOf(BASE)
      const data = step(BASE)
      setData(table, data)
      expect(hasDeferredPositions(table), label).toBe(true)
      const { actual, expected } = placesOf(table, data)
      expect(actual, label).toEqual(expected)
      expect(hasDeferredPositions(table), label).toBe(!settles)
    }
  })

  it('PD2: две смены сдвигом подряд без чтения сливаются, места — по последнему data; запись места строки сначала дописывает отложенное и не перекрывается им', () => {
    const table = tableOf(BASE)
    const first = removeMiddle(BASE)
    setData(table, first)
    const second = insertMiddle(first)
    setData(table, second)
    expect(hasDeferredPositions(table)).toBe(true)
    const { actual, expected } = placesOf(table, second)
    expect(actual).toEqual(expected)

    const third = removeMiddle(second)
    setData(table, third)
    expect(hasDeferredPositions(table)).toBe(true)
    const rows = table.getCoreRowModel().rows
    const tail = rows[rows.length - 1]
    setPosition(tail, 5)
    expect(hasDeferredPositions(table)).toBe(false)
    expect(positionOf(tail)).toBe(5)
    expect(positionOf(rows[rows.length - 2])).toBe(rows.length - 2)
  })

  it('PD3: смена data полной сборкой дописывает отложенные места', () => {
    const table = tableOf(BASE)
    setData(table, removeMiddle(BASE))
    expect(hasDeferredPositions(table)).toBe(true)
    // Новые объекты всех строк — больше доли инкремента: полная сборка.
    const fresh = BASE.map(item => ({ ...item }))
    setData(table, fresh)
    expect(hasDeferredPositions(table)).toBe(false)
    const { actual, expected } = placesOf(table, fresh)
    expect(actual).toEqual(expected)
  })

  it('PD4: удаление строк при сортировке с малыми блоками равных значений не читает места строк, с большим блоком — читает; порядок совпадает с полной сортировкой', () => {
    const sorted = () => [
      columnSortingModel({ initialSorting: [{ id: 'group', desc: false }] }),
    ]
    for (const [groups, deferred] of [
      [7, true],
      [1, false],
    ] as const) {
      const base = items(0, 1000, groups)
      const table = tableOf(base, sorted())
      const data = removeMiddle(base)
      setData(table, data)
      expect(hasDeferredPositions(table), `${groups}`).toBe(deferred)
      const ids = table.getRowModel().rows.map((row: Item) => row.id)
      const full = tableOf(data, sorted())
        .getRowModel()
        .rows.map((row: Item) => row.id)
      expect(ids, `${groups}`).toEqual(full)
    }
  })
})

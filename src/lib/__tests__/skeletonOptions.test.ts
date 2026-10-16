import { describe, expect, test } from 'vitest'

import {
  SKELETON_ROWS_COUNT,
  getSkeletonRowCount,
  getSkeletonTreeRows,
} from '../core/skeletonOptions'

// SL13 (ADR 0060): число строк скелета при `rowsCount: 'auto'`.
describe('Скелет первой загрузки — число строк', () => {
  test('SL13: число строк при rowsCount auto считается из высоты области, высоты строки и размера страницы; у грида без высоты — размер страницы при пагинации, без неё 12', () => {
    const auto = { rowsCount: 'auto' as const, rowHeight: 50 }
    // Неполная последняя строка тоже рисуется — область заполнена до низа.
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 440 })).toBe(9)
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 450 })).toBe(9)
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 451 })).toBe(10)
    // Высота строки из темы.
    expect(
      getSkeletonRowCount({ ...auto, bodyHeight: 440, rowHeight: 40 }),
    ).toBe(11)
    // Пагинация ограничивает число строк размером страницы.
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 440, pageSize: 5 })).toBe(
      5,
    )
    expect(
      getSkeletonRowCount({ ...auto, bodyHeight: 440, pageSize: 100 }),
    ).toBe(9)
    // Область растёт по содержимому — высоты нет: размер страницы, без пагинации —
    // запасное число.
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 0 })).toBe(
      SKELETON_ROWS_COUNT,
    )
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 0, pageSize: 25 })).toBe(
      25,
    )
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 0, pageSize: 5 })).toBe(5)
    // Число в rowsCount переопределяет расчёт.
    expect(
      getSkeletonRowCount({ rowsCount: 3, bodyHeight: 440, rowHeight: 50 }),
    ).toBe(3)
  })
})

describe('Скелет первой загрузки — дерево', () => {
  test('SL22: план строк дерева скелета — у части строк псевдослучайно по номеру одна или две подстроки на уровень глубже, у части ни одной; план одинаков при каждом расчёте; строк ровно столько, сколько нужно', () => {
    const plan = getSkeletonTreeRows(60)
    expect(plan).toHaveLength(60)
    expect(getSkeletonTreeRows(60)).toEqual(plan)
    expect(getSkeletonTreeRows(7)).toHaveLength(7)
    expect(plan[0]!.depth).toBe(0)

    // Подстроки у каждой строки верхнего уровня; последнюю могли обрезать.
    const children: number[] = []
    for (const row of plan) {
      expect([0, 1]).toContain(row.depth)
      if (row.depth === 0) children.push(0)
      else children[children.length - 1]! += 1
    }
    const whole = children.slice(0, -1)
    expect(new Set(whole)).toEqual(new Set([0, 1, 2]))

    // Ветки и отростки сходятся с числом подстрок.
    let at = 0
    for (const count of whole) {
      const parent = plan[at]!
      expect(parent.open).toBe(count > 0)
      expect(parent.parent).toBe(count > 0)
      const kids = plan.slice(at + 1, at + 1 + count)
      expect(kids.map(kid => kid.branch)).toEqual(
        kids.map((_, index) => (index < count - 1 ? '1' : '0')),
      )
      at += count + 1
    }
    // Продолжение последней строки отрезано — линии не уходят в пустоту.
    const last = plan.at(-1)!
    expect(last.open).toBe(false)
    expect(['', '0']).toContain(last.branch)
  })
})

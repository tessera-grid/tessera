/**
 * Деление свободной ширины между флекс-колонками (ADR 0216, FX1).
 * Запуск: npx vitest run --config vitest.node.config.ts flexColumns
 */
import { describe, expect, it } from 'vitest'

import { computeFlexSizing, distributeFlex } from '../core/flexColumns'

const col = (id: string, flex: number, min = 0, max = Infinity) => ({
  id,
  flex,
  min,
  max,
})

const sum = (widths: Record<string, number>) =>
  Object.values(widths).reduce((a, b) => a + b, 0)

describe('Флекс-колонки (ADR 0216)', () => {
  it('FX1: флекс-колонки делят ширину области без нефлекс-колонок по весам flex в пределах minSize/maxSize; упёршаяся в предел выходит из деления', () => {
    // По весам 1:2, ширины целые, сумма — свободная ширина.
    const plain = distributeFlex([col('a', 1), col('b', 2)], 301)
    expect(plain).toEqual({ a: 100, b: 201 })
    expect(sum(plain)).toBe(301)

    // Упёршаяся в максимум выходит из деления, остаток — остальным.
    expect(distributeFlex([col('a', 1, 0, 50), col('b', 1)], 300)).toEqual({
      a: 50,
      b: 250,
    })
    // Упёршаяся в минимум — так же.
    expect(distributeFlex([col('a', 1, 200), col('b', 3)], 300)).toEqual({
      a: 200,
      b: 100,
    })
    // Места нет — все на минимуме.
    expect(distributeFlex([col('a', 1, 80), col('b', 1, 90)], 100)).toEqual({
      a: 80,
      b: 90,
    })

    // Нефлекс-колонки, служебные и протянутые пользователем вычитаются по своей ширине.
    const leaf = (
      id: string,
      size: number,
      def: { flex?: number; minSize?: number; maxSize?: number } = {},
      service = false,
    ) => ({
      id,
      columnDef: def,
      getSize: () => size,
      getIsActionsColumn: () => service,
    })
    const leaves = [
      leaf('select', 36, { flex: 1 }, true),
      leaf('fixed', 120),
      leaf('resized', 90, { flex: 1 }),
      leaf('flex1', 150, { flex: 1 }),
      leaf('flex2', 150, { flex: 3, maxSize: 600 }),
    ]
    const table = {
      store: {},
      getVisibleLeafColumns: () => leaves,
      getAllLeafColumns: () => leaves,
      options: { columnUserSizing: { resized: 90 } },
    }
    expect(computeFlexSizing(table, 1000)).toEqual({
      flex1: 188,
      flex2: 566,
    })
  })
})

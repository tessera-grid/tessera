import { describe, expect, it } from 'vitest'

import {
  againstBase,
  ceilingOver,
  medianAxes,
  medianRun,
} from '../stories/__tests__/performance/baseline'

// Кейс фичи против базы внутри прогона (ADR 0099, PF22).

describe('Сравнение с базой внутри прогона', () => {
  it('PF22: база и вариант по три раза вперемешку (B, V, V, B, B, V); в отчёт — замер с медианным значением на каждой стороне', async () => {
    const order: string[] = []
    let tick = 0
    const { base, variant } = await againstBase(async isVariant => {
      order.push(isVariant ? 'V' : 'B')
      tick += 1
      return {
        side: isVariant ? 'V' : 'B',
        tick,
        ms: isVariant ? 30 - tick : tick,
      }
    })
    expect(order).toEqual(['B', 'V', 'V', 'B', 'B', 'V'])
    expect(base.map(run => run.tick)).toEqual([1, 4, 5])
    expect(variant.map(run => run.tick)).toEqual([2, 3, 6])

    // Медиана — сам замер, а не среднее: значения 1, 4, 5 → замер со значением 4.
    expect(medianRun(base, run => run.ms)).toBe(base[1])
    expect(medianRun(variant, run => run.ms).ms).toBe(27)

    const axes = medianAxes([
      { y: { p95Ms: 9 }, x: { p95Ms: 1 } },
      { y: { p95Ms: 7 }, x: { p95Ms: 3 } },
      { y: { p95Ms: 8 }, x: { p95Ms: 2 } },
    ])
    expect([axes.y.p95Ms, axes.x.p95Ms]).toEqual([8, 2])

    expect(ceilingOver(10, { ratio: 1.3, plusMs: 4 })).toBe(14)
    expect(ceilingOver(100, { ratio: 1.3, plusMs: 4 })).toBe(130)
  })
})

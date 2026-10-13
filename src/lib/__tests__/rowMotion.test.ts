/**
 * План движения строк (ADR 0107): сдвиги по видимым позициям, строка издалека и вдаль,
 * появления, призраки и правило замены.
 * Запуск: npx vitest run --config vitest.node.config.ts rowMotion
 */
import { existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { type MotionRow, planRowMotion } from '../grid/rowMotion/planRowMotion'
import { REACT18_EXCLUSIONS } from '../stories/__tests__/react18'

const SIZE = 50
const rowsAt = (ids: string[], firstIndex: number): MotionRow[] =>
  ids.map((id, i) => ({
    id,
    index: firstIndex + i,
    start: (firstIndex + i) * SIZE,
  }))
const indexIn = (ids: string[]) => (id: string) => {
  const index = ids.indexOf(id)
  return index === -1 ? undefined : index
}

describe('план движения строк (ADR 0107)', () => {
  it('RM18: сдвиг от видимой позиции, издалека от края окна, вдаль к краю, появления, призраки, замена без плана', () => {
    // Окно — строки 0…3. До смены: a b c d (b — на середине своего переезда).
    const before = new Map([
      ['a', 0],
      ['b', 70],
      ['c', 100],
      ['d', 150],
    ])
    // После сортировки: b a z far — z новая, far пришла с индекса 1000, c ушла вдаль,
    // d ушла из модели.
    const prevModel = ['a', 'b', 'c', 'd', ...Array(996).fill('x'), 'far']
    const nextModel = ['b', 'a', 'z', 'far', ...Array(996).fill('y'), 'c']
    const plan = planRowMotion({
      before,
      after: rowsAt(['b', 'a', 'z', 'far'], 0),
      rowSize: SIZE,
      startOf: index => index * SIZE,
      prevIndexOf: indexIn(prevModel),
      nextIndexOf: indexIn(nextModel),
    })!

    // b стартует с видимого 70 (а не логического 50), a — с 0 на 50.
    expect(plan.moves.get('b')).toBe(70)
    expect(plan.moves.get('a')).toBe(-50)
    // far с индекса 1000 въезжает от нижнего края окна (200), а не с 50 000.
    expect(plan.moves.get('far')).toBe(200 - 150)
    expect(plan.enters).toEqual(['z'])
    // c уезжает вдаль к нижнему краю, d гаснет на месте.
    expect(plan.exits).toEqual([
      { id: 'c', from: 100, to: 200 },
      { id: 'd', from: 150, to: null },
    ])

    // Строка на месте не двигается.
    const still = planRowMotion({
      before: new Map([['a', 0]]),
      after: rowsAt(['a'], 0),
      rowSize: SIZE,
      startOf: index => index * SIZE,
      prevIndexOf: () => 0,
      nextIndexOf: () => 0,
    })!
    expect(still.moves.size).toBe(0)

    // Замена: ни одна строка окна не уцелела — плана нет; до смены строк не было — тоже.
    const replaced = {
      after: rowsAt(['p', 'q'], 0),
      rowSize: SIZE,
      startOf: (index: number) => index * SIZE,
      prevIndexOf: () => undefined,
      nextIndexOf: () => undefined,
    }
    expect(
      planRowMotion({ ...replaced, before: new Map([['a', 0]]) }),
    ).toBeNull()
    expect(planRowMotion({ ...replaced, before: new Map() })).toBeNull()
  })
})

describe('движение строк на React 18 (ADR 0107)', () => {
  it('RM23: набор движения строк идёт в test:react18 без исключений', () => {
    const suite = 'src/lib/stories/__tests__/visual/row-motion.test.tsx'
    expect(existsSync(suite)).toBe(true)
    expect(REACT18_EXCLUSIONS.map(exclusion => exclusion.file)).not.toContain(
      suite,
    )
  })
})

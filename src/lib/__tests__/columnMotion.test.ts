/**
 * План движения колонок (ADR 0115): сдвиги по видимым позициям, край окна для колонок
 * издалека и призраков, замена целиком без движения.
 */
import { describe, expect, it } from 'vitest'

import { planColumnMotion } from '../grid/columnMotion/planColumnMotion'

const W = 100

/** Колонки окна после смены: `id` по порядку с левого края `from`. */
const windowOf = (ids: string[], from = 0) =>
  ids.map((id, i) => ({ id, left: from + i * W, width: W }))

const lefts = (entries: [string, number][]) => new Map(entries)

describe('planColumnMotion (ADR 0115)', () => {
  it('CN12: сдвиг — от видимой позиции до новой, колонка на месте не едет; колонка издалека стартует не дальше края окна; призрак уходящей едет не дальше края; ни одна не уцелела — без движения', () => {
    // a и b поменялись местами, c стоит; b посреди прошлого движения — видимая позиция.
    const swap = planColumnMotion({
      before: lefts([
        ['a', 0],
        ['b', 130],
        ['c', 200],
      ]),
      after: windowOf(['b', 'a', 'c']),
      prevLeftOf: () => undefined,
      nextLeftOf: () => undefined,
      widthOf: () => W,
    })!
    expect([...swap.moves]).toEqual([
      ['b', 130],
      ['a', -100],
    ])
    expect(swap.exits).toEqual([])

    // z была далеко справа (x = 5000) и встала второй: старт — правый край окна.
    // a ушла далеко вправо (x = 9000): призрак едет к правому краю, а не до 9000.
    const far = planColumnMotion({
      before: lefts([
        ['a', 0],
        ['b', 100],
        ['c', 200],
      ]),
      after: windowOf(['b', 'z', 'c']),
      prevLeftOf: id => (id === 'z' ? 5000 : undefined),
      nextLeftOf: id => (id === 'a' ? 9000 : undefined),
      widthOf: () => W,
    })!
    expect(far.moves.get('z')).toBe(300 - 100)
    expect(far.moves.has('c')).toBe(false)
    expect(far.exits).toEqual([{ id: 'a', from: 0, to: 300 }])

    // Влево — до левого края минус ширина колонки.
    const left = planColumnMotion({
      before: lefts([['b', 1000]]),
      after: [
        { id: 'b', left: 1000, width: W },
        { id: 'z', left: 1100, width: W },
      ],
      prevLeftOf: () => -4000,
      nextLeftOf: () => undefined,
      widthOf: () => W,
    })!
    expect(left.moves.get('z')).toBe(900 - 1100)

    // Новой колонки не было и в прошлой раскладке — не едет.
    const fresh = planColumnMotion({
      before: lefts([['b', 0]]),
      after: windowOf(['b', 'n']),
      prevLeftOf: () => undefined,
      nextLeftOf: () => undefined,
      widthOf: () => W,
    })!
    expect(fresh.moves.size).toBe(0)

    // Замена целиком.
    expect(
      planColumnMotion({
        before: lefts([['a', 0]]),
        after: windowOf(['x', 'y']),
        prevLeftOf: () => 0,
        nextLeftOf: () => 0,
        widthOf: () => W,
      }),
    ).toBeNull()
  })
})

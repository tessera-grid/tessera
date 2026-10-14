/**
 * Будущий родитель слота (ADR 0109, §4): поиск по строкам окна в порядке после
 * переноса. Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import { findDropParent, indexBeforeMove } from '../grid/dnd/dropParent'

/** Родитель полным проходом: строки в порядке после переноса, глубина слота — `depth`. */
const naiveParent = (
  depths: number[],
  { from, to, depth }: { from: number; to: number; depth: number },
) => {
  if (depth <= 0) return -1
  const order = depths.map((_, index) => index)
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved)
  for (let position = to - 1; position >= 0; position--) {
    const index = order[position]
    if (depths[index] < depth) return depths[index] === depth - 1 ? index : -1
  }
  return -1
}

/** Глубины дерева: корни и дети до глубины `maxDepth`, порядок обхода. */
const randomTree = (size: number, maxDepth: number, seed: number) => {
  let state = seed
  const random = () =>
    (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  const depths = [0]
  while (depths.length < size) {
    const last = depths[depths.length - 1]
    const next = Math.floor(random() * (last + 2))
    depths.push(Math.min(next, maxDepth))
  }
  return depths
}

describe('findDropParent — родитель слота (ADR 0109)', () => {
  it('NX8: поиск родителя читает строки только от места броска до начала окна — на дереве из 100 000 строк без прохода по модели; паритет с полным проходом на случайных деревьях', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const depths = randomTree(60, 3, seed)
      const rows = depths.map(depth => ({ depth }))
      for (let from = 0; from < depths.length; from += 7) {
        for (let to = 0; to < depths.length; to += 3) {
          for (const depth of [0, 1, 2, 3]) {
            const drop = { from, to, depth }
            expect(
              findDropParent(rows, drop, 0),
              `seed ${seed}, ${from}→${to} @${depth}`,
            ).toBe(naiveParent(depths, drop))
          }
        }
      }
    }

    // Одна группа на 100 000 детей, слот в её середине, окно — 30 строк над ним.
    let reads = 0
    const size = 100_000
    const rows = Array.from({ length: size }, (_, index) => ({
      get depth() {
        reads++
        return index === 0 ? 0 : 1
      },
    }))
    const to = 50_000
    const lowest = to - 30
    // Родитель за окном не ищется.
    expect(findDropParent(rows, { from: size - 1, to, depth: 1 }, lowest)).toBe(
      -1,
    )
    expect(reads).toBeLessThanOrEqual(to - lowest)
  })

  it('indexBeforeMove — обратное к переносу `arrayMove`', () => {
    for (const [from, to] of [
      [2, 7],
      [7, 2],
      [4, 4],
    ]) {
      const order = Array.from({ length: 10 }, (_, index) => index)
      const [moved] = order.splice(from, 1)
      order.splice(to, 0, moved)
      order.forEach((index, position) =>
        expect(indexBeforeMove(position, from, to)).toBe(index),
      )
    }
  })
})

/**
 * Проекция линий дерева на бросок строки (ADR 0108, PV6): ветки окна по строкам «как
 * после броска» — без прохода по всей модели.
 */
import { describe, expect, it } from 'vitest'

import { getTreeLines, projectTreeLines } from '../grid/treeBranches'

/** Детерминированный генератор: тест воспроизводим. */
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/** Дерево в порядке обхода: глубина следующей строки — не больше глубины текущей + 1. */
const tree = (count: number, next: () => number) => {
  const rows = [{ depth: 0 }]
  while (rows.length < count) {
    const prev = rows[rows.length - 1].depth
    const roll = next()
    const depth =
      roll < 0.35
        ? prev + 1
        : roll < 0.7
          ? prev
          : Math.floor(next() * (prev + 1))
    rows.push({ depth: Math.min(depth, 6) })
  }
  return rows
}

const moved = (
  rows: { depth: number }[],
  from: number,
  to: number,
  depth: number,
) => {
  const next = rows.slice()
  next.splice(from, 1)
  next.splice(to, 0, { depth })
  return next
}

describe('Проекция линий дерева на бросок (ADR 0108)', () => {
  it('PV6: ветки окна по проекции совпадают с полным проходом по строкам после броска на случайных деревьях, переносах и окнах; на 100 000 строк читаются только строки у окна и переноса', () => {
    const next = random(7)
    for (let round = 0; round < 400; round++) {
      const rows = tree(5 + Math.floor(next() * 60), next)
      const from = Math.floor(next() * rows.length)
      const to = Math.floor(next() * rows.length)
      const depth = Math.floor(next() * 4)
      const start = Math.floor(next() * rows.length)
      const end = Math.min(rows.length - 1, start + Math.floor(next() * 12))
      const projected = projectTreeLines(
        getTreeLines(rows),
        { from, to, depth },
        start,
        end,
      )
      const after = moved(rows, from, to, depth)
      const full = getTreeLines(after)
      for (let p = start; p <= end; p++) {
        const where = `round ${round}, from ${from} → ${to} at depth ${depth}, position ${p}`
        expect(projected.branch(p), where).toBe(full.branch(p))
        expect(projected.open(p), where).toBe(full.open(p))
      }
    }

    // Большая модель: строки читаются только между окном и концами переноса.
    const big = tree(100_000, random(11))
    const lines = getTreeLines(big)
    let reads = 0
    const counted = {
      ...lines,
      depth: (index: number) => {
        reads++
        return lines.depth(index)
      },
    }
    const view = projectTreeLines(
      counted,
      { from: 50_010, to: 50_004, depth: 1 },
      50_000,
      50_020,
    )
    for (let p = 50_000; p <= 50_020; p++) {
      view.branch(p)
      view.open(p)
    }
    expect(reads).toBeLessThan(200)
  })
})

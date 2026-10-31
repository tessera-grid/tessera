/**
 * Линии дерева в серверной модели (ADR 0161, TL9): маска строки — из её места и размера
 * ветки у неё и предков, без прохода по строкам списка; на одинаковом дереве — паритет с
 * клиентским проходом.
 */
import { describe, expect, it } from 'vitest'

import { getTreeLines } from '../plugins/treeLines/branches'
import { BlockStore } from '../plugins/serverRowModel/blockStore'
import { BlockTree } from '../plugins/serverRowModel/tree'

interface Item {
  id: string
}

/** Детерминированный генератор: тест воспроизводим. */
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/** Дети узла по id: у корней — ключ `''`; глубина — до четырёх уровней. */
const spec = (next: () => number) => {
  const children = new Map<string, number>()
  const grow = (id: string, depth: number) => {
    const count =
      depth === 0 ? 3 + Math.floor(next() * 8) : Math.floor(next() * 6)
    if (depth > 0 && (count === 0 || depth > 3)) return
    children.set(id, count)
    for (let k = 0; k < count; k++) {
      if (next() < 0.5) grow(depth === 0 ? `n${k}` : `${id}.${k}`, depth + 1)
    }
  }
  grow('', 0)
  return children
}

/** Ответы «сервера» — промисы: дождаться их цепочки микрозадач. */
const settle = async () => {
  for (let tick = 0; tick < 20; tick++) await Promise.resolve()
}

describe('линии дерева в серверной модели (ADR 0161)', () => {
  it('TL9: маска строки — из её места и размера ветки у неё и предков, без чтения строк списка; на случайных деревьях совпадает с клиентским проходом', async () => {
    const next = random(5)
    for (let round = 0; round < 150; round++) {
      const children = spec(next)
      const idOf = (parent: string | undefined, k: number) =>
        parent === undefined ? `n${k}` : `${parent}.${k}`
      const tree = new BlockTree<Item, Item, string>({
        blockSize: 4,
        maxBlocks: Number.POSITIVE_INFINITY,
        rowCount: children.get(''),
        query: () => 'q',
        getRows: ({ start, end, parentId }) => {
          const total = children.get(parentId ?? '') ?? 0
          return {
            rows: Array.from(
              { length: Math.max(0, Math.min(end, total) - start) },
              (_, i) => ({ id: idOf(parentId, start + i) }),
            ),
            rowCount: total,
          }
        },
        toRows: data => data,
        idOf: row => row.id,
        // Раскрыты все строки с детьми.
        expanded: () => expanded,
        onChange: () => {},
      })
      const expanded = new Set([...children.keys()].filter(id => id !== ''))
      // Окно на весь список, пока раскладка растёт по мере прихода веток.
      for (let pass = 0, size = -1; size !== tree.count(); pass++) {
        size = tree.count()
        tree.setWindow(0, size - 1)
        await settle()
        if (pass > 200) throw new Error('раскладка не устоялась')
      }

      const count = tree.count()
      const depths = Array.from({ length: count }, (_, index) => ({
        depth: tree.ariaAt(index)!.level - 1,
      }))
      const full = getTreeLines(depths)
      // Счёт линий строки строк не читает.
      const rowAt = BlockStore.prototype.rowAt
      let reads = 0
      BlockStore.prototype.rowAt = function (this: unknown, ...args) {
        reads++
        return rowAt.apply(this as never, args)
      }
      try {
        for (let index = 0; index < count; index++) {
          const lines = tree.linesAt(index)!
          const where = `round ${round}, index ${index}`
          expect(lines.depth, where).toBe(depths[index]!.depth)
          expect(lines.branch, where).toBe(full.branch(index))
          expect(lines.open, where).toBe(full.open(index))
        }
      } finally {
        BlockStore.prototype.rowAt = rowAt
      }
      expect(reads).toBe(0)
    }
  })
})

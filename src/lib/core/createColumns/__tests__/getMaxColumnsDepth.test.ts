import type { ColumnDef } from '@tanstack/react-table'
import { describe, expect, test } from 'vitest'

import { getMaxColumnsDepth } from '../getMaxColumnsDepth'

// Сеть безопасности под инверсию ядра (docs/decisions/0010-invert-core-plugins-registry.md).
// Глубина колонок определяет форму сервисных колонок (плоская vs group-обёртка) и
// читается на этапе сборки, до useReactTable. Чистая функция — долговечный оракул
// (сигнатура при инверсии не меняется). Один инвариант — один тест.

const cols = (defs: ColumnDef<any, any>[]) => defs

describe('getMaxColumnsDepth — глубина дерева колонок', () => {
  test('пустой список даёт 0', () => {
    expect(getMaxColumnsDepth([])).toBe(0)
  })

  test('плоские колонки имеют глубину 1', () => {
    expect(
      getMaxColumnsDepth(cols([{ id: 'a' }, { id: 'b' }] as ColumnDef<any>[])),
    ).toBe(1)
  })

  test('один уровень группировки даёт глубину 2', () => {
    expect(
      getMaxColumnsDepth(
        cols([
          { id: 'g', columns: [{ id: 'a' }, { id: 'b' }] },
        ] as ColumnDef<any>[]),
      ),
    ).toBe(2)
  })

  test('вложенные группы дают глубину по самой глубокой ветке', () => {
    expect(
      getMaxColumnsDepth(
        cols([
          {
            id: 'g1',
            columns: [{ id: 'g2', columns: [{ id: 'leaf' }] }],
          },
        ] as ColumnDef<any>[]),
      ),
    ).toBe(3)
  })

  test('глубина берётся по максимальной, а не по последней ветке', () => {
    // Мелкая ветка идёт после глубокой — максимум не должен «сбрасываться».
    expect(
      getMaxColumnsDepth(
        cols([
          {
            id: 'deep',
            columns: [{ id: 'mid', columns: [{ id: 'leaf' }] }],
          },
          { id: 'shallow' },
        ] as ColumnDef<any>[]),
      ),
    ).toBe(3)
  })
})

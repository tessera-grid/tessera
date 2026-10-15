/**
 * Длина полоски скелета (ADR 0060, SL19): одно правило для всех скелетов ячеек —
 * от id колонки, 40–90 %, одинаковая в каждой строке; без колонок — от номера.
 * Запуск: npx vitest run --config vitest.node.config.ts skeletonCell
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import {
  getSkeletonBarWidth,
  getSkeletonColumnId,
} from '../core/skeletonOptions'
import { renderSkeletonCell } from '../grid/skeletonCell'

/** Ширина полоски в разметке ячейки скелета, %. */
const barWidth = (columnId: string, wave: boolean) =>
  Number(
    /width:(\d+)%/.exec(
      renderToStaticMarkup(renderSkeletonCell(columnId, 'bar', wave)),
    )?.[1],
  )

describe('Скелет ячейки — длина полоски', () => {
  test('SL19: длина полоски — от id колонки (40–90 %), одинаковая во всех строках, в первой загрузке, хвосте ленты, быстрой прокрутке и слоте броска; без колонок — от номера колонки', () => {
    const ids = ['firstName', 'lastName', 'age', 'visits', 'status', 'progress']
    for (const id of ids) {
      const width = getSkeletonBarWidth(id)
      expect(width).toBeGreaterThanOrEqual(40)
      expect(width).toBeLessThanOrEqual(90)
      // Первая загрузка рисует с волной, хвост, быстрая прокрутка и слот — без неё:
      // длина одна и та же, сколько бы строк ни рисовалось.
      expect(barWidth(id, true)).toBe(width)
      expect(barWidth(id, false)).toBe(width)
    }
    expect(new Set(ids.map(getSkeletonBarWidth)).size).toBeGreaterThan(1)

    // Без колонок у грида — своя длина у каждой по номеру, а не одна на всех.
    const generated = Array.from({ length: 8 }, (_, index) =>
      barWidth(getSkeletonColumnId(index), true),
    )
    expect(generated.every(width => width >= 40 && width <= 90)).toBe(true)
    expect(new Set(generated).size).toBeGreaterThan(1)
  })
})

/**
 * Высота строк и ширина колонок по умолчанию (ADR 0077): прижатие высоты к минимуму
 * (RH7) и слияние `defaultColumn` с умолчаниями (CW1).
 */
import { describe, expect, it } from 'vitest'

import { DEFAULT_COLUMN, resolveDefaultColumn } from '../core/defaultColumn'
import {
  MIN_HEADER_HEIGHT,
  MIN_ROW_HEIGHT,
  resolveRowHeights,
} from '../core/rowHeights'

describe('rowHeights / defaultColumn', () => {
  it('RH7: высота ниже минимума (тело 40px, шапка 36px) прижимается к минимуму с предупреждением', () => {
    expect(MIN_ROW_HEIGHT).toBe(40)
    expect(MIN_HEADER_HEIGHT).toBe(36)

    const low = resolveRowHeights({ rowHeight: 30, headerHeight: 20 })
    expect(low.row).toBe(40)
    expect(low.head).toBe(36)
    expect(low.warnings).toHaveLength(2)
    expect(low.warnings[0]).toContain('rowHeight')
    expect(low.warnings[1]).toContain('headerHeight')

    const ok = resolveRowHeights({ rowHeight: 40, headerHeight: 36 })
    expect(ok).toEqual({ row: 40, head: 36, warnings: [] })

    expect(resolveRowHeights({})).toEqual({
      row: undefined,
      head: undefined,
      warnings: [],
    })
  })

  it('CW1: defaultColumn дополняет умолчания: { size: 200 } сохраняет minSize 48 и maxSize 750', () => {
    expect(resolveDefaultColumn({ size: 200 })).toEqual({
      size: 200,
      minSize: 48,
      maxSize: 750,
    })
    expect(
      resolveDefaultColumn({ size: 200, minSize: undefined, maxSize: 400 }),
    ).toEqual({ size: 200, minSize: 48, maxSize: 400 })
    expect(resolveDefaultColumn(undefined)).toBe(DEFAULT_COLUMN)
  })
})

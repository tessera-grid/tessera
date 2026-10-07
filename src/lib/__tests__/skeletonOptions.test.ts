import { describe, expect, test } from 'vitest'

import {
  SKELETON_ROWS_COUNT,
  getSkeletonRowCount,
} from '../core/skeletonOptions'

// SL13 (ADR 0060): число строк скелета при `rowsCount: 'auto'`.
describe('Скелет первой загрузки — число строк', () => {
  test('SL13: число строк при rowsCount auto считается из высоты области, высоты строки и размера страницы', () => {
    const auto = { rowsCount: 'auto' as const, rowHeight: 50 }
    // Неполная последняя строка тоже рисуется — область заполнена до низа.
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 440 })).toBe(9)
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 450 })).toBe(9)
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 451 })).toBe(10)
    // Высота строки из темы.
    expect(
      getSkeletonRowCount({ ...auto, bodyHeight: 440, rowHeight: 40 }),
    ).toBe(11)
    // Пагинация ограничивает число строк размером страницы.
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 440, pageSize: 5 })).toBe(
      5,
    )
    expect(
      getSkeletonRowCount({ ...auto, bodyHeight: 440, pageSize: 100 }),
    ).toBe(9)
    // Область растёт по содержимому — высоты нет, запасное число.
    expect(getSkeletonRowCount({ ...auto, bodyHeight: 0 })).toBe(
      SKELETON_ROWS_COUNT,
    )
    // Число в rowsCount переопределяет расчёт.
    expect(
      getSkeletonRowCount({ rowsCount: 3, bodyHeight: 440, rowHeight: 50 }),
    ).toBe(3)
  })
})

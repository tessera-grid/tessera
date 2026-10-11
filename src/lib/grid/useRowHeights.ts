// Высота строк тела и шапки (ADR 0077): пропы выставляют токены на корне грида; без
// пропов числа для раскладки читаются из токенов темы до первой отрисовки.
import { type CSSProperties, type RefObject, useEffect, useState } from 'react'

import { logWarn } from '../core/logger'
import {
  DEFAULT_ROW_HEIGHT,
  HEAD_ROW_HEIGHT_VAR,
  ROW_HEIGHT_VAR,
  readHeightVar,
  resolveRowHeights,
} from '../core/rowHeights'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'

export interface RowHeights {
  row: number
  head: number
  /** Токены высоты для инлайн-стиля корня: только заданные приложением. */
  vars: CSSProperties
}

export const useRowHeights = (
  table: unknown,
  wrapperRef: RefObject<HTMLElement | null>,
  /** Смена ключа перечитывает токены: тема, появление корня грида. */
  remeasureKey: string,
): RowHeights => {
  const options = (
    table as { options: { rowHeight?: number; headerHeight?: number } }
  ).options
  const resolved = resolveRowHeights(options)
  const [themed, setThemed] = useState({
    row: DEFAULT_ROW_HEIGHT,
    head: DEFAULT_ROW_HEIGHT,
  })

  const warningsKey = resolved.warnings.join('|')
  useEffect(() => {
    for (const warning of resolved.warnings) {
      logWarn(table as Parameters<typeof logWarn>[0], warning, warning)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- по составу предупреждений
  }, [warningsKey])

  // Токены корня — с учётом пропов и CSS темы; до отрисовки, без кадра со старой высотой.
  useIsomorphicLayoutEffect(() => {
    const node = wrapperRef.current
    if (!node) {
      return
    }
    const style = getComputedStyle(node)
    const row = readHeightVar(style, ROW_HEIGHT_VAR, DEFAULT_ROW_HEIGHT)
    const head = readHeightVar(style, HEAD_ROW_HEIGHT_VAR, row)
    setThemed(prev =>
      prev.row === row && prev.head === head ? prev : { row, head },
    )
  }, [wrapperRef, resolved.row, resolved.head, remeasureKey])

  return {
    row: resolved.row ?? themed.row,
    head: resolved.head ?? themed.head,
    vars: {
      ...(resolved.row !== undefined && {
        [ROW_HEIGHT_VAR]: `${resolved.row}px`,
      }),
      ...(resolved.head !== undefined && {
        [HEAD_ROW_HEIGHT_VAR]: `${resolved.head}px`,
      }),
    } as CSSProperties,
  }
}

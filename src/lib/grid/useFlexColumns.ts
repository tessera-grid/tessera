/**
 * Флекс-колонки (ADR 0216, §4): ширина области прокрутки без вертикальной полосы — в деление
 * между флекс-колонками. Пересчёт до отрисовки при монтировании, смене видимости, порядка,
 * закрепления и ширин других колонок; при смене ширины области — в следующем кадре.
 */
import {
  computeFlexSizing,
  hasFlexColumns,
  useFlexContentMins,
} from '../core/flexColumns'
import { useTableState } from '../core/reactivity'
import type { Table } from '../types'
import { useRef } from 'react'

import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'

const NONE = {}

type FlexTable = {
  setColumnFlexSizing: (next: Record<string, number>) => void
}

export const useFlexColumns = (
  table: Table<any, any>,
  getScrollElement: () => HTMLElement | null,
) => {
  const flex = hasFlexColumns(table)
  // Входы деления: срезы, от которых зависят ширины нефлекс-колонок и набор флекс-колонок.
  const inputs = useTableState(table, state => {
    const s = state as unknown as Record<string, unknown>
    return [s.columnSizing, s.columnVisibility, s.columnOrder, s.columnPinning]
  })
  // Нижние границы по содержимому (ADR 0217, §3) — хранилище ядра, а не срез.
  const contentMin = useFlexContentMins(table)
  // Слой флекс-ширин записан: без флекс-колонок его снимают один раз, а не на каждую смену срезов.
  const written = useRef(false)

  useIsomorphicLayoutEffect(() => {
    const target = table as unknown as FlexTable
    if (!flex) {
      if (written.current) target.setColumnFlexSizing(NONE)
      written.current = false
      return
    }
    written.current = true
    const scroller = getScrollElement()
    if (!scroller) return
    const apply = () =>
      target.setColumnFlexSizing(computeFlexSizing(table, scroller.clientWidth))
    apply()
    // Ширина области сменилась — флекс-ширины в следующем кадре: запись внутри ResizeObserver
    // меняет полосы прокрутки области, и браузер сообщил бы о петле наблюдателя.
    let frame = 0
    let last = scroller.clientWidth
    const observer = new ResizeObserver(() => {
      if (scroller.clientWidth === last) return
      last = scroller.clientWidth
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(apply)
    })
    observer.observe(scroller)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [table, flex, getScrollElement, inputs, contentMin])
}

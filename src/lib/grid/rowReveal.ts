// Строки, у которых видны значки скрытых кнопок (ADR 0149, §4): под указателем, с фокусом
// внутри, тронутая пальцем последней и с открытым меню своей кнопки. Слушатели DOM на
// контейнере — смена строки перерисовывает значки двух строк, а не грид.
import { createContext } from 'react'

import type { IconReveal } from '../ui/IconButton/iconReveal'

type Reason = 'hover' | 'focus' | 'touch'

export interface RowReveal {
  /** Место показа значков строки для её ячеек. */
  of: (rowId: string) => IconReveal
  set: (reason: Reason, rowId: string | undefined) => void
}

export const RowRevealContext = createContext<RowReveal | null>(null)

export const createRowReveal = (): RowReveal => {
  const reasons: Record<Reason, string | undefined> = {
    hover: undefined,
    focus: undefined,
    touch: undefined,
  }
  const holds = new Map<string, number>()
  const listeners = new Map<string, Set<() => void>>()

  const shown = (rowId: string) =>
    reasons.hover === rowId ||
    reasons.focus === rowId ||
    reasons.touch === rowId ||
    holds.has(rowId)
  const notify = (rowId: string | undefined) => {
    if (rowId !== undefined)
      listeners.get(rowId)?.forEach(listener => listener())
  }

  return {
    set: (reason, rowId) => {
      const previous = reasons[reason]
      if (previous === rowId) return
      reasons[reason] = rowId
      notify(previous)
      notify(rowId)
    },
    of: rowId => ({
      shown: () => shown(rowId),
      subscribe: listener => {
        const set = listeners.get(rowId) ?? new Set()
        set.add(listener)
        listeners.set(rowId, set)
        return () => {
          set.delete(listener)
          if (set.size === 0) listeners.delete(rowId)
        }
      },
      hold: () => {
        holds.set(rowId, (holds.get(rowId) ?? 0) + 1)
        notify(rowId)
        return () => {
          const count = (holds.get(rowId) ?? 1) - 1
          if (count > 0) holds.set(rowId, count)
          else holds.delete(rowId)
          notify(rowId)
        }
      },
    }),
  }
}

const ROW = '.data-grid__body-row'

/**
 * Наведение, фокус и касание строк тела контейнера — в `reveal`. Слушатели на документе:
 * контейнер монтируется позже грида (заглушка первой загрузки) и меняется.
 */
export const trackRowReveal = (
  getScroller: () => HTMLElement | null,
  reveal: RowReveal,
) => {
  /** Строка контейнера под целью события; вне контейнера — никакой. */
  const rowIdOf = (target: EventTarget | null) => {
    const scroller = getScroller()
    if (!scroller || !(target instanceof Element) || !scroller.contains(target))
      return undefined
    return target.closest(ROW)?.getAttribute('data-row-id') ?? undefined
  }
  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType !== 'touch')
      reveal.set('hover', rowIdOf(event.target))
  }
  const onPointerOut = (event: PointerEvent) => {
    // Указатель ушёл из окна браузера: следующего `pointerover` не будет.
    if (event.relatedTarget === null && event.pointerType !== 'touch')
      reveal.set('hover', undefined)
  }
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch')
      reveal.set('touch', rowIdOf(event.target))
  }
  const onFocusIn = (event: FocusEvent) =>
    reveal.set('focus', rowIdOf(event.target))
  const onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget === null) reveal.set('focus', undefined)
  }
  const options = { capture: true, passive: true }
  document.addEventListener('pointerover', onPointerOver, options)
  document.addEventListener('pointerout', onPointerOut, options)
  document.addEventListener('pointerdown', onPointerDown, options)
  document.addEventListener('focusin', onFocusIn, options)
  document.addEventListener('focusout', onFocusOut, options)
  return () => {
    document.removeEventListener('pointerover', onPointerOver, options)
    document.removeEventListener('pointerout', onPointerOut, options)
    document.removeEventListener('pointerdown', onPointerDown, options)
    document.removeEventListener('focusin', onFocusIn, options)
    document.removeEventListener('focusout', onFocusOut, options)
  }
}

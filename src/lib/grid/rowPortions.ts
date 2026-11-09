import {
  startTransition,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'

/** Бюджет порции, мс: рендер и коммит её строк (ADR 0203, §2). */
const PORTION_BUDGET_MS = 24
/** Ячеек в первой порции: цена строки до замера не известна. */
const FIRST_PORTION_CELLS = 72

type Key = VirtualItem['key']
interface Range {
  startIndex: number
  endIndex: number
}

const subscribeNothing = () => () => {}
/** Серверный рендер и гидратация берут снимок сервера: окно целиком (WS4). */
const useServerSnapshot = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => false,
    () => true,
  )

/** Порядок порций: активная строка, видимые сверху вниз, затем запас — ближние раньше. */
const byPriority = (
  rows: VirtualItem[],
  visible: Range | null,
  activeIndex: number | undefined,
) => {
  const distance = (index: number) => {
    if (index === activeIndex) return -1
    if (!visible) return index
    if (index < visible.startIndex) return visible.startIndex - index
    if (index > visible.endIndex) return index - visible.endIndex
    return 0
  }
  return [...rows].sort(
    (a, b) => distance(a.index) - distance(b.index) || a.index - b.index,
  )
}

interface Portions {
  rows: VirtualItem[]
  /** Строки окна, ещё не нарисованные. */
  pending: ReadonlySet<Key>
}

/**
 * Строки окна, которые рисуются сейчас (ADR 0203). Окно, сменившееся целиком — ни одна видимая
 * строка не была нарисована, — рисуется порциями по кадрам; иначе — целиком.
 */
export const useRowPortions = ({
  rows,
  visible,
  activeIndex,
  cellsPerRow,
  enabled,
}: {
  rows: VirtualItem[]
  visible: Range | null
  activeIndex: number | undefined
  cellsPerRow: number
  /** Нарезка включена (`enableIncrementalRender`). */
  enabled: boolean
}): VirtualItem[] => {
  const server = useServerSnapshot()
  const [state, setState] = useState<Portions>(() => ({
    rows: [],
    pending: new Set(),
  }))

  let pending = state.pending
  if (state.rows !== rows) {
    const drawn = new Set(
      state.rows.filter(row => !state.pending.has(row.key)).map(row => row.key),
    )
    const shown = visible
      ? rows.filter(
          row =>
            row.index >= visible.startIndex && row.index <= visible.endIndex,
        )
      : []
    const whole =
      enabled &&
      !server &&
      shown.length > 0 &&
      shown.every(row => !drawn.has(row.key))
    if (whole) {
      // Монтирование — порциями с первой; прыжок — видимые сразу, запас порциями (§2).
      const first = Math.max(
        1,
        Math.floor(FIRST_PORTION_CELLS / Math.max(1, cellsPerRow)),
        drawn.size > 0 ? shown.length + 1 : 0,
      )
      const ordered = byPriority(rows, visible, activeIndex)
      pending = new Set(ordered.slice(first).map(row => row.key))
    } else if (state.pending.size > 0) {
      // Окно сдвинулось не целиком: недорисованные строки, что остались в нём, ждут.
      const keys = new Set(rows.map(row => row.key))
      pending = new Set([...state.pending].filter(key => keys.has(key)))
    }
    setState({ rows, pending })
  }

  // Цена строки — от кадра, что поставил порцию, до её коммита.
  const queuedAt = useRef<{ at: number; count: number } | undefined>(undefined)
  const rowCost = useRef<number | undefined>(undefined)
  useIsomorphicLayoutEffect(() => {
    const queued = queuedAt.current
    if (!queued) return
    queuedAt.current = undefined
    rowCost.current = (performance.now() - queued.at) / queued.count
  })

  useEffect(() => {
    if (pending.size === 0) return
    const frame = requestAnimationFrame(() => {
      const count = Math.max(
        1,
        rowCost.current
          ? Math.floor(PORTION_BUDGET_MS / rowCost.current)
          : Math.floor(FIRST_PORTION_CELLS / Math.max(1, cellsPerRow)),
      )
      queuedAt.current = { at: performance.now(), count }
      // Переходом: рендер порции React режет на куски, целиком идёт только её коммит.
      startTransition(() =>
        setState(current => {
          if (current.pending.size === 0) return current
          const ordered = byPriority(
            current.rows.filter(row => current.pending.has(row.key)),
            visible,
            activeIndex,
          )
          return {
            rows: current.rows,
            pending: new Set(ordered.slice(count).map(row => row.key)),
          }
        }),
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [pending, visible, activeIndex, cellsPerRow])

  return pending.size === 0 ? rows : rows.filter(row => !pending.has(row.key))
}

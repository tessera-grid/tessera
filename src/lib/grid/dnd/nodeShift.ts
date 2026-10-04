/**
 * Сдвиг блока ячеек при перетаскивании группы (ADR 0052, ND4). Сортируется только
 * ячейка узла; ячейки под группой — в других строках CSS grid и обёрткой не
 * охватываются, поэтому берут сдвиг и скрытие своего предка отсюда.
 */
import { createContext } from 'react'

export interface NodeShiftStore {
  /** Сдвиг узла-группы (`translateX`), публикует его ячейка. */
  set: (nodeId: string, x: number) => void
  setActive: (nodeId: string | null) => void
  /** `"<сдвиг>|<скрыт>"` по предкам — примитив для `useSyncExternalStore`. */
  snapshot: (ancestors: readonly string[]) => string
  subscribe: (listener: () => void) => () => void
}

export const createNodeShiftStore = (): NodeShiftStore => {
  const shifts = new Map<string, number>()
  let active: string | null = null
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())

  return {
    set: (nodeId, x) => {
      if ((shifts.get(nodeId) ?? 0) === x) return
      shifts.set(nodeId, x)
      notify()
    },
    setActive: nodeId => {
      if (active === nodeId) return
      active = nodeId
      notify()
    },
    snapshot: ancestors => {
      const shift = ancestors.map(id => shifts.get(id) ?? 0).find(x => x !== 0)
      const hidden = active !== null && ancestors.includes(active)
      return `${shift ?? 0}|${hidden}`
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const NodeShiftContext = createContext<NodeShiftStore | null>(null)

export const noopSubscribe = () => () => {}

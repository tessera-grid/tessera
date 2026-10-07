import type { Ref } from 'react'

/** Передаёт узел в ref любого вида: callback-ref или объект. */
export const assignRef = <T>(ref: Ref<T> | undefined, node: T | null) => {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}

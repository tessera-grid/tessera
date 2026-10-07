import { type RefObject, useLayoutEffect, useRef } from 'react'

/**
 * Ref на последнее значение для эффектов и обработчиков: пишется после коммита, а не
 * во время рендера — прерванный рендер не оставляет в нём своё значение.
 */
export const useLatest = <T>(value: T): RefObject<T> => {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

import { useEffect, useRef, useState } from 'react'

import {
  createLoadingDisplay,
  type LoadingDisplay,
  type LoadingOptions,
  resolveLoadingOptions,
} from '../core/loadingDisplay'
import { useLatest } from '../core/useLatest'

/** Показано ли обновление данных: с задержкой и минимумом (ADR 0094, §3). */
export const useLoadingDisplay = (
  loading: boolean,
  options: LoadingOptions | undefined,
) => {
  const [shown, setShown] = useState(false)
  const resolved = useLatest(resolveLoadingOptions(options))
  const display = useRef<LoadingDisplay | null>(null)

  useEffect(() => {
    const current = createLoadingDisplay(() => resolved.current, setShown)
    display.current = current
    return () => {
      current.dispose()
      display.current = null
      setShown(false)
    }
  }, [resolved])

  useEffect(() => {
    display.current?.set(loading)
  }, [loading])

  return shown
}

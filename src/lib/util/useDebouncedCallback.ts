/**
 * Отложенный вызов (ADR 0045, §4): `schedule` откладывает вызов на `delayMs` после
 * последнего обращения, `flush` выполняет отложенный сразу. При размонтировании
 * отложенный вызов выполняется — ввод, сделанный перед закрытием, не теряется.
 */
import { useEffect, useRef, useState } from 'react'

import { useLatest } from './useLatest'

export const useDebouncedCallback = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
) => {
  const latest = useLatest({ callback, delayMs })
  const pendingRef = useRef<{
    timer: ReturnType<typeof setTimeout>
    args: TArgs
  } | null>(null)

  const [controls] = useState(() => {
    const flush = () => {
      const pending = pendingRef.current
      if (!pending) return
      clearTimeout(pending.timer)
      pendingRef.current = null
      latest.current.callback(...pending.args)
    }
    return {
      schedule: (...args: TArgs) => {
        if (pendingRef.current) clearTimeout(pendingRef.current.timer)
        pendingRef.current = {
          args,
          timer: setTimeout(flush, latest.current.delayMs),
        }
      },
      flush,
      cancel: () => {
        if (pendingRef.current) clearTimeout(pendingRef.current.timer)
        pendingRef.current = null
      },
    }
  })
  useEffect(() => () => controls.flush(), [controls])

  return controls
}

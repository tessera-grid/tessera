/**
 * Отложенный вызов (ADR 0045, §4): `schedule` откладывает вызов на `delayMs` после
 * последнего обращения, `flush` выполняет отложенный сразу. При размонтировании
 * отложенный вызов выполняется — ввод, сделанный перед закрытием, не теряется.
 */
import { useEffect, useRef } from 'react'

export const useDebouncedCallback = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
) => {
  const callbackRef = useRef(callback)
  const delayRef = useRef(delayMs)
  const pendingRef = useRef<{
    timer: ReturnType<typeof setTimeout>
    args: TArgs
  } | null>(null)

  useEffect(() => {
    callbackRef.current = callback
    delayRef.current = delayMs
  })

  const controls = useRef({
    schedule: (...args: TArgs) => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timer)
      pendingRef.current = {
        args,
        timer: setTimeout(() => controls.current.flush(), delayRef.current),
      }
    },
    flush: () => {
      const pending = pendingRef.current
      if (!pending) return
      clearTimeout(pending.timer)
      pendingRef.current = null
      callbackRef.current(...pending.args)
    },
    cancel: () => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timer)
      pendingRef.current = null
    },
  })
  useEffect(() => () => controls.current.flush(), [])

  return controls.current
}

// Сессия проверки доступности пунктов меню (ADR 0078): начинается намерением открыть
// (наведение, фокус) или открытием, живёт до закрытия; `stop` прерывает `signal`, а
// итоги остаются до следующей сессии — закрывающееся меню не мигает ожиданием.
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  type AvailabilityCheck,
  type AvailabilityChecks,
  checkAvailability,
  startAvailabilityChecks,
} from './actionStatus'
import type { MenuAction } from './types'

export const useAvailabilityChecks = () => {
  const [checks, setChecks] = useState<AvailabilityChecks | null>(null)
  const session = useRef<AbortController | null>(null)
  // Действия, уже проверенные в сессии: раздел при повторном входе не проверяется заново.
  const checked = useRef(new Set<string>())

  const start = useCallback((actions: MenuAction[], context: unknown) => {
    if (session.current) return
    const controller = new AbortController()
    session.current = controller
    checked.current = new Set(actions.map(action => action.id))
    setChecks(
      startAvailabilityChecks(
        actions,
        context,
        controller.signal,
        (id, check) => setChecks(prev => prev && { ...prev, [id]: check }),
      ),
    )
  }, [])

  const stop = useCallback(() => {
    if (!session.current) return
    session.current.abort()
    session.current = null
  }, [])

  /**
   * Проверить одно действие заново в открытой сессии (проверка не удалась, ADR 0078):
   * `onSettled` получает итог, пока сессия жива.
   */
  const recheck = useCallback(
    (
      action: MenuAction,
      context: unknown,
      onSettled: (check: AvailabilityCheck) => void,
    ) => {
      const controller = session.current
      if (!controller) return
      const settle = (check: AvailabilityCheck) => {
        setChecks(prev => prev && { ...prev, [action.id]: check })
        onSettled(check)
      }
      const check = checkAvailability(
        action,
        context,
        controller.signal,
        settle,
      )
      if (check?.status === 'pending') {
        setChecks(prev => prev && { ...prev, [action.id]: check })
      } else {
        settle(check ?? { status: 'done', result: false })
      }
    },
    [],
  )

  /** Проверить пункты раздела, вошедшего в открытую сессию (ADR 0079). */
  const extend = useCallback((actions: MenuAction[], context: unknown) => {
    const controller = session.current
    if (!controller) return
    const fresh = actions.filter(action => !checked.current.has(action.id))
    if (fresh.length === 0) return
    fresh.forEach(action => checked.current.add(action.id))
    const started = startAvailabilityChecks(
      fresh,
      context,
      controller.signal,
      (id, check) => setChecks(now => now && { ...now, [id]: check }),
    )
    setChecks(prev => prev && { ...prev, ...started })
  }, [])

  useEffect(() => () => session.current?.abort(), [])

  return { checks, start, stop, recheck, extend }
}

export type AvailabilitySession = ReturnType<typeof useAvailabilityChecks>

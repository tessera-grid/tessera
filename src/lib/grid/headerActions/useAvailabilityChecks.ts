// Сессия проверки доступности пунктов меню (ADR 0078): начинается намерением открыть
// (наведение, фокус) или открытием, живёт до закрытия; `stop` прерывает `signal`, а
// итоги остаются до следующей сессии — закрывающееся меню не мигает ожиданием.
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  type AvailabilityCheck,
  type AvailabilityChecks,
  type MenuAction,
  checkAvailability,
  startAvailabilityChecks,
} from '../../core/headerActions'

export const useAvailabilityChecks = () => {
  const [checks, setChecks] = useState<AvailabilityChecks | null>(null)
  const session = useRef<AbortController | null>(null)

  const start = useCallback((actions: MenuAction[], context: unknown) => {
    if (session.current) return
    const controller = new AbortController()
    session.current = controller
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

  useEffect(() => () => session.current?.abort(), [])

  return { checks, start, stop, recheck }
}

export type AvailabilitySession = ReturnType<typeof useAvailabilityChecks>

import { useCallback, useState } from 'react'

/**
 * Видимость триггера меню: пока меню открыто и до завершения закрытия — к нему фокус
 * уже вернулся на триггер. Открытие запоминается само: `onOpenChangeComplete(true)`
 * Base UI приходит не всегда (ADR 0024, AM25–AM27).
 */
export const useClosingVisible = (open: boolean) => {
  const [wasOpen, setWasOpen] = useState(open)

  if (open && !wasOpen) {
    setWasOpen(true)
  }

  const onOpenChangeComplete = useCallback((next: boolean) => {
    if (!next) {
      setWasOpen(false)
    }
  }, [])

  return [open || wasOpen, onOpenChangeComplete] as const
}

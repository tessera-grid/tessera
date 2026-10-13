import { useEffect, useRef, useState } from 'react'

import { useLatest } from '../useLatest'
import {
  type FastScrollDetectorOptions,
  attachFastScrollDetector,
} from './fastScrollDetector'

export interface FastScrollState {
  isFastScrolling: boolean
  /**
   * Порядковый номер итерации скроллинга. Увеличивается при каждом входе в режим быстрого скроллинга.
   *
   * Нужен ячейке, чтобы отличить "смонтирована в текущей итерации" от "смонтирована когда-то раннее и находилась в видимой части".
   * Существует для того, чтобы не триггерить лишние перерисовки содеримое->заглушка->содержимое при быстром скроллинге.
   */
  sessionId: number
}

export const INITIAL_STATE: FastScrollState = {
  isFastScrolling: false,
  sessionId: 0,
}

export interface FastScrollOptions extends FastScrollDetectorOptions {
  getScrollElement: () => HTMLDivElement | null
}

/**
 * Внешнее хранилище состояния быстрого скролла. Ячейки подписываются на него
 * через `useSyncExternalStore` с селектором и перерисовываются только когда
 * меняется именно их производное значение (подавлена/нет), а не при каждом
 * переключении режима. Это убирает массовый ре-рендер всех видимых ячеек в
 * кадре входа в fast-scroll.
 */
export interface FastScrollStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => FastScrollState
}

export const useFastScroll = ({
  getScrollElement,
  forceFast,
}: FastScrollOptions): FastScrollStore => {
  const forceFastRef = useLatest(forceFast)
  const stateRef = useRef<FastScrollState>(INITIAL_STATE)
  const listenersRef = useRef<Set<() => void>>(new Set())

  const [store] = useState<FastScrollStore>(() => ({
    subscribe: listener => {
      listenersRef.current.add(listener)

      return () => {
        listenersRef.current.delete(listener)
      }
    },
    getSnapshot: () => stateRef.current,
  }))

  const listen = (element: HTMLDivElement) => {
    const detach = attachFastScrollDetector(
      element,
      value => {
        const prev = stateRef.current
        stateRef.current = {
          isFastScrolling: value,
          sessionId: value ? prev.sessionId + 1 : prev.sessionId,
        }
        // Атрибут — для CSS без перерисовки грида: слот перетаскивания (ADR 0107, RM25).
        element.toggleAttribute('data-fast-scrolling', value)
        listenersRef.current.forEach(listener => listener())
      },
      { forceFast: () => forceFastRef.current?.() ?? false },
    )
    return () => {
      detach()
      element.removeAttribute('data-fast-scrolling')
    }
  }

  // Узел скролла может смениться без размонтирования DataGrid: после каждого рендера
  // подписка перевешивается, если узел другой.
  const subscription = useRef<{
    element: HTMLDivElement
    unsubscribe: () => void
  } | null>(null)
  useEffect(() => {
    const element = getScrollElement()
    if (subscription.current?.element === element) {
      return
    }
    subscription.current?.unsubscribe()
    subscription.current = element
      ? { element, unsubscribe: listen(element) }
      : null
  })
  useEffect(() => {
    const current = subscription
    return () => {
      current.current?.unsubscribe()
      current.current = null
    }
  }, [])

  return store
}

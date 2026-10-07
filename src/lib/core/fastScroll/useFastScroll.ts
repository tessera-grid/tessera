import { useEffect, useRef, useState } from 'react'

export const FAST_SCROLL_ENTER_VELOCITY_Y = 2000
export const FAST_SCROLL_ENTER_VELOCITY_X = 4500

const EXIT_VELOCITY_RATIO = 0.25
export const FAST_SCROLL_EXIT_VELOCITY_Y =
  FAST_SCROLL_ENTER_VELOCITY_Y * EXIT_VELOCITY_RATIO
export const FAST_SCROLL_EXIT_VELOCITY_X =
  FAST_SCROLL_ENTER_VELOCITY_X * EXIT_VELOCITY_RATIO

export const IDLE_DELAY = 300
export const MIN_DURATION = 250

const VELOCITY_WINDOW = 250

// Нижняя граница интервала, по которому считается скорость. Пока окно ещё не
// заполнилось (первые кадры скролла), делим накопленный путь на реально
// прошедшее время, а не на весь `VELOCITY_WINDOW` — иначе скорость занижается и
// быстрый скролл распознаётся с задержкой в несколько кадров. Флор гасит
// всплески при слишком коротком интервале между двумя первыми событиями.
const MIN_VELOCITY_SPAN = 16

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

interface ScrollSample {
  time: number
  deltaX: number
  deltaY: number
}

export interface FastScrollOptions {
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
}: FastScrollOptions): FastScrollStore => {
  const stateRef = useRef<FastScrollState>(INITIAL_STATE)
  const listenersRef = useRef<Set<() => void>>(new Set())
  const isFastScrollingRef = useRef(false)

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
    let lastTop = element.scrollTop
    let lastLeft = element.scrollLeft
    let enteredAt = 0
    let samples: ScrollSample[] = []
    let idleTimer: ReturnType<typeof setTimeout>
    let exitTimer: ReturnType<typeof setTimeout>

    const setFastScrolling = (value: boolean) => {
      if (isFastScrollingRef.current === value) {
        return
      }

      if (value) {
        enteredAt = performance.now()
        clearTimeout(exitTimer)
      }

      isFastScrollingRef.current = value

      const prev = stateRef.current
      stateRef.current = {
        isFastScrolling: value,
        sessionId: value ? prev.sessionId + 1 : prev.sessionId,
      }
      listenersRef.current.forEach(listener => listener())
    }

    const requestExit = () => {
      if (!isFastScrollingRef.current) {
        return
      }

      const remaining = MIN_DURATION - (performance.now() - enteredAt)

      clearTimeout(exitTimer)

      if (remaining > 0) {
        exitTimer = setTimeout(() => setFastScrolling(false), remaining)

        return
      }

      setFastScrolling(false)
    }

    const handleScroll = () => {
      const now = performance.now()

      samples.push({
        time: now,
        deltaX: Math.abs(element.scrollLeft - lastLeft),
        deltaY: Math.abs(element.scrollTop - lastTop),
      })

      samples = samples.filter(sample => now - sample.time <= VELOCITY_WINDOW)

      lastTop = element.scrollTop
      lastLeft = element.scrollLeft

      const elapsed = Math.max(now - samples[0].time, MIN_VELOCITY_SPAN)
      const toVelocity = (travelled: number) => (travelled / elapsed) * 1000

      const velocityX = toVelocity(
        samples.reduce((sum, sample) => sum + sample.deltaX, 0),
      )
      const velocityY = toVelocity(
        samples.reduce((sum, sample) => sum + sample.deltaY, 0),
      )

      const shouldEnter =
        velocityX >= FAST_SCROLL_ENTER_VELOCITY_X ||
        velocityY >= FAST_SCROLL_ENTER_VELOCITY_Y

      const shouldExit =
        velocityX <= FAST_SCROLL_EXIT_VELOCITY_X ||
        velocityY <= FAST_SCROLL_EXIT_VELOCITY_Y

      if (shouldEnter) {
        setFastScrolling(true)
      } else if (shouldExit) {
        requestExit()
      }

      clearTimeout(idleTimer)
      idleTimer = setTimeout(requestExit, IDLE_DELAY)
    }

    element.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      element.removeEventListener('scroll', handleScroll)
      clearTimeout(idleTimer)
      clearTimeout(exitTimer)
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

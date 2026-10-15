/**
 * Детектор быстрой прокрутки (ADR 0008): скорость по скользящему окну событий
 * `scroll`, вход и выход с гистерезисом, минимальное время в режиме и выход по простою.
 */
export const FAST_SCROLL_ENTER_VELOCITY_Y = 2000
export const FAST_SCROLL_ENTER_VELOCITY_X = 4500

export const EXIT_VELOCITY_RATIO = 0.25
export const FAST_SCROLL_EXIT_VELOCITY_Y =
  FAST_SCROLL_ENTER_VELOCITY_Y * EXIT_VELOCITY_RATIO
export const FAST_SCROLL_EXIT_VELOCITY_X =
  FAST_SCROLL_ENTER_VELOCITY_X * EXIT_VELOCITY_RATIO

export const IDLE_DELAY = 300
export const MIN_DURATION = 250

export const VELOCITY_WINDOW = 250

// Длительность первого события нового жеста — один кадр: рывок с места распознаётся
// с первого события. Она же — нижняя граница интервала скорости.
const FRAME_SPAN = 16

// Пауза между событиями жеста дольше STALL_GAP — главный поток стоял: следующие события
// несут путь, накопленный за паузу (пачка приходит не сразу и может перемежаться
// спокойными событиями), и в скорость не входят — не меньше STALL_GAP, затем до события
// со скоростью ниже порога входа, но не дольше окна скорости.
const STALL_GAP = 100

// Таймер простоя, опоздавший больше чем на STALL_GAP, сработал после паузы главного
// потока, а не после остановки: жест продолжается.

interface ScrollSample {
  time: number
  /** Время предыдущего события жеста: путь сэмпла пройден с этого момента. */
  since: number
  /** Догоняющее событие после паузы главного потока — в скорость не входит. */
  catchUp: boolean
  deltaX: number
  deltaY: number
}

export interface ScrollSource {
  scrollTop: number
  scrollLeft: number
  addEventListener: (
    type: 'scroll',
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void
  removeEventListener: (type: 'scroll', listener: () => void) => void
}

/**
 * Скорость по осям, px/s: путь событий окна / время от события перед первым из них.
 * Догоняющие события после паузы главного потока не считаются (FS1).
 */
const velocityOf = (all: readonly ScrollSample[]) => {
  const samples = all.filter(sample => !sample.catchUp)
  if (samples.length === 0) {
    return { x: 0, y: 0 }
  }
  const last = samples[samples.length - 1]!
  const span = Math.max(last.time - samples[0]!.since, FRAME_SPAN)
  let x = 0
  let y = 0
  for (const sample of samples) {
    x += sample.deltaX
    y += sample.deltaY
  }
  return { x: (x / span) * 1000, y: (y / span) * 1000 }
}

/**
 * Элементы, чью прокрутку делает сам грид (ADR 0105, FS8): время последней программной
 * активности. Пометка живёт `IDLE_DELAY` после неё — прокрутка без событий (цель уже на
 * месте) не съедает следующий жест человека.
 */
const programmatic = new WeakMap<object, number>()

const isProgrammatic = (element: object, now: number) => {
  const at = programmatic.get(element)
  return at !== undefined && now - at <= IDLE_DELAY
}

/**
 * Пометить прокрутку элемента как программную: кнопки и `scrollToRow`. Её события до
 * простоя не идут в скорость и быструю прокрутку не включают — режим нужен жестам
 * человека.
 */
export const markProgrammaticScroll = (element: object) => {
  programmatic.set(element, performance.now())
}

export interface FastScrollDetectorOptions {
  /**
   * Прокрутка быстрая при любой скорости — спрашивается на каждое событие: автопрокрутка
   * перетаскивания у самого края (ADR 0107, RM25). Выход — по скорости или простою.
   */
  forceFast?: () => boolean
}

/** Подписать детектор на элемент прокрутки; `onChange` — смена режима. Возвращает отписку. */
export const attachFastScrollDetector = (
  element: ScrollSource,
  onChange: (fast: boolean) => void,
  { forceFast }: FastScrollDetectorOptions = {},
): (() => void) => {
  let fast = false
  let lastTop = element.scrollTop
  let lastLeft = element.scrollLeft
  let enteredAt = 0
  let samples: ScrollSample[] = []
  /** Время последнего события текущего жеста; `undefined` — жеста нет. */
  let lastEventAt: number | undefined
  /** Начало догоняющей пачки после паузы; `undefined` — пачки нет. */
  let catchUpFrom: number | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let exitTimer: ReturnType<typeof setTimeout> | undefined

  const setFast = (value: boolean) => {
    if (fast === value) {
      return
    }
    if (value) {
      enteredAt = performance.now()
      clearTimeout(exitTimer)
    }
    fast = value
    onChange(value)
  }

  const requestExit = () => {
    if (!fast) {
      return
    }
    const remaining = MIN_DURATION - (performance.now() - enteredAt)
    clearTimeout(exitTimer)
    if (remaining > 0) {
      exitTimer = setTimeout(() => setFast(false), remaining)
      return
    }
    setFast(false)
  }

  const armIdle = () => {
    const armedAt = performance.now()
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      if (performance.now() - armedAt - IDLE_DELAY > STALL_GAP) {
        armIdle()
        return
      }
      lastEventAt = undefined
      requestExit()
    }, IDLE_DELAY)
  }

  const handleScroll = () => {
    const now = performance.now()
    if (isProgrammatic(element, now)) {
      programmatic.set(element, now)
      lastTop = element.scrollTop
      lastLeft = element.scrollLeft
      lastEventAt = now
      samples = []
      armIdle()
      return
    }
    const since = lastEventAt ?? now - FRAME_SPAN
    const deltaX = Math.abs(element.scrollLeft - lastLeft)
    const deltaY = Math.abs(element.scrollTop - lastTop)
    if (now - since > STALL_GAP) {
      catchUpFrom = now
    } else if (catchUpFrom !== undefined) {
      const span = Math.max(now - since, FRAME_SPAN) / 1000
      const calm =
        deltaX / span < FAST_SCROLL_ENTER_VELOCITY_X &&
        deltaY / span < FAST_SCROLL_ENTER_VELOCITY_Y
      const elapsed = now - catchUpFrom
      if ((calm && elapsed >= STALL_GAP) || elapsed > VELOCITY_WINDOW) {
        catchUpFrom = undefined
      }
    }
    samples.push({
      time: now,
      since,
      catchUp: catchUpFrom !== undefined,
      deltaX,
      deltaY,
    })
    lastEventAt = now
    samples = samples.filter(sample => now - sample.time <= VELOCITY_WINDOW)
    lastTop = element.scrollTop
    lastLeft = element.scrollLeft

    const velocity = velocityOf(samples)
    if (
      forceFast?.() ||
      velocity.x >= FAST_SCROLL_ENTER_VELOCITY_X ||
      velocity.y >= FAST_SCROLL_ENTER_VELOCITY_Y
    ) {
      setFast(true)
    } else if (
      velocity.x <= FAST_SCROLL_EXIT_VELOCITY_X &&
      velocity.y <= FAST_SCROLL_EXIT_VELOCITY_Y
    ) {
      requestExit()
    }

    armIdle()
  }

  element.addEventListener('scroll', handleScroll, { passive: true })
  return () => {
    element.removeEventListener('scroll', handleScroll)
    clearTimeout(idleTimer)
    clearTimeout(exitTimer)
  }
}

/**
 * Детектор быстрой прокрутки (ADR 0008, ADR 0147; FS1–FS5, FS12–FS13): скорость по жесту, вход и выход с
 * гистерезисом, минимальное время в режиме, выход по простою.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EXIT_VELOCITY_RATIO,
  FAST_SCROLL_ENTER_VELOCITY_X,
  FAST_SCROLL_ENTER_VELOCITY_Y,
  type FastScrollDetectorOptions,
  IDLE_DELAY,
  MIN_DURATION,
  VELOCITY_WINDOW,
  attachFastScrollDetector,
  markProgrammaticScroll,
} from '../core/fastScroll/fastScrollDetector'

const FRAME = 16
/** Кадр тяжёлого грида под ×4 CPU — дольше `STALL_GAP` (P8). */
const HEAVY_FRAME = 150

/** Элемент прокрутки: `scrollTo` сдвигает позицию и шлёт событие `scroll`. */
const scroller = () => {
  let listener: (() => void) | undefined
  const element = {
    scrollTop: 0,
    scrollLeft: 0,
    addEventListener: (_: 'scroll', l: () => void) => {
      listener = l
    },
    removeEventListener: () => {
      listener = undefined
    },
  }
  const scrollBy = (dx: number, dy: number) => {
    element.scrollLeft += dx
    element.scrollTop += dy
    listener?.()
  }
  return { element, scrollBy }
}

const setup = (options?: FastScrollDetectorOptions) => {
  const { element, scrollBy } = scroller()
  const changes: boolean[] = []
  const mark = () => markProgrammaticScroll(element)
  const detach = attachFastScrollDetector(
    element,
    fast => changes.push(fast),
    options,
  )
  /** Кадр прокрутки: время идёт `ms`, затем событие со сдвигом. */
  const frame = (dx: number, dy: number, ms = FRAME) => {
    vi.advanceTimersByTime(ms)
    scrollBy(dx, dy)
  }
  return { changes, frame, detach, mark }
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1000 })
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Детектор быстрой прокрутки (ADR 0008)', () => {
  it('FS1: после паузы главного потока при медленной прокрутке режим не включается — сдвиг за паузу делится на всё время от последнего события до паузы', () => {
    const { changes, frame } = setup()
    // 1000 px/s по Y: 16 px за кадр.
    for (let i = 0; i < 10; i++) frame(0, 16)
    // Пауза 400 мс: часы идут, таймеры не срабатывают — главный поток стоит. Путь за
    // паузу приходит не сразу: после почти пустых событий, когда главный поток ещё
    // занят, — со всем остальным.
    vi.setSystemTime(Date.now() + 400)
    frame(0, 12, 0)
    frame(0, 12, 9)
    frame(0, 390, 70)
    for (let i = 0; i < 20; i++) frame(0, 16)
    // Таймер простоя, опоздавший из-за паузы, срабатывает раньше события с путём за паузу.
    vi.setSystemTime(Date.now() + 400)
    vi.advanceTimersByTime(IDLE_DELAY)
    frame(0, 156, 0)
    for (let i = 0; i < 20; i++) frame(0, 16)
    expect(changes).toEqual([])
  })

  it('FS12: когда каждый кадр дольше STALL_GAP, прокрутка выше порога входа включает режим и после медленного начала жеста', () => {
    const { changes, frame } = setup()
    // Тяжёлый грид: событие раз в 150 мс. Начало жеста — 200 px/s, затем 2500 px/s.
    for (let i = 0; i < 6; i++) frame(0, 30, HEAVY_FRAME)
    expect(changes).toEqual([])
    for (let i = 0; i < 3; i++) frame(0, 375, HEAVY_FRAME)
    expect(changes).toEqual([true])
  })

  it('FS13: когда каждый кадр дольше STALL_GAP, режим держится, пока скорость жеста выше порога выхода, и выключается, когда она падает до порога выхода', () => {
    const { changes, frame } = setup()
    for (let i = 0; i < 3; i++) frame(0, 30, HEAVY_FRAME)
    // 2500 px/s — режим включился.
    for (let i = 0; i < 2; i++) frame(0, 375, HEAVY_FRAME)
    expect(changes).toEqual([true])
    // 1000 px/s целую секунду — между порогами выхода и входа: режим не гаснет.
    for (let i = 0; i < 7; i++) frame(0, 150, HEAVY_FRAME)
    expect(changes).toEqual([true])
    // 200 px/s — ниже порога выхода 500 px/s: режим выключается.
    for (let i = 0; i < 4; i++) frame(0, 30, HEAVY_FRAME)
    expect(changes).toEqual([true, false])
  })

  it('FS2: рывок выше порога входа включает режим с первого события рывка', () => {
    const { changes, frame } = setup()
    // 6000 px/s по Y с места.
    frame(0, 100)
    expect(changes).toEqual([true])
  })

  it('FS3: ровная прокрутка ниже порога входа не включает режим ни по X, ни по Y', () => {
    const { changes, frame } = setup()
    // X: 4000 px/s при пороге 4500; Y: 1875 px/s при пороге 2000.
    for (let i = 0; i < 60; i++) frame(64, 0)
    vi.advanceTimersByTime(IDLE_DELAY)
    for (let i = 0; i < 60; i++) frame(0, 30)
    expect(changes).toEqual([])
  })

  it('FS4: падение скорости до порога выхода выключает режим, но не раньше MIN_DURATION от входа', () => {
    const { changes, frame } = setup()
    frame(0, 100)
    expect(changes).toEqual([true])
    // Медленная прокрутка: окно заполняется медленными событиями, скорость падает.
    let elapsed = 0
    while (changes.length === 1 && elapsed < MIN_DURATION * 2) {
      frame(0, 1)
      elapsed += FRAME
    }
    expect(changes).toEqual([true, false])
    expect(elapsed).toBeGreaterThanOrEqual(MIN_DURATION)
  })

  it('FS5: без событий прокрутки в течение IDLE_DELAY режим выключается', () => {
    const { changes, frame } = setup()
    for (let i = 0; i < 20; i++) frame(0, 100)
    expect(changes).toEqual([true])
    vi.advanceTimersByTime(IDLE_DELAY - 1)
    expect(changes).toEqual([true])
    vi.advanceTimersByTime(1)
    expect(changes).toEqual([true, false])
  })

  it('FS8: помеченная программной прокрутка не включает режим до простоя; следующий жест после простоя считается как обычно', () => {
    const { changes, frame, mark } = setup()
    // Прыжок на 100 000 px и плавная доводка — режим не включается.
    mark()
    frame(0, 100_000)
    for (let i = 0; i < 10; i++) frame(0, -40)
    expect(changes).toEqual([])
    // Простой снимает пометку: рывок человека включает режим.
    vi.advanceTimersByTime(IDLE_DELAY + 50)
    frame(0, 5000)
    expect(changes).toEqual([true])
    // Пометка без событий (цель уже на месте) истекает и не съедает жест.
    vi.advanceTimersByTime(IDLE_DELAY + MIN_DURATION + 50)
    expect(changes).toEqual([true, false])
    mark()
    vi.advanceTimersByTime(IDLE_DELAY + 50)
    frame(0, 5000)
    expect(changes).toEqual([true, false, true])
  })

  it('FS9: пороги — вход от 2000 px/s по Y или 4500 px/s по X, выход — 25 % входа, не меньше 250 мс в режиме, выход после 300 мс без событий, скорость по окну 250 мс', () => {
    expect(FAST_SCROLL_ENTER_VELOCITY_Y).toBe(2000)
    expect(FAST_SCROLL_ENTER_VELOCITY_X).toBe(4500)
    expect(EXIT_VELOCITY_RATIO).toBe(0.25)
    expect(MIN_DURATION).toBe(250)
    expect(IDLE_DELAY).toBe(300)
    expect(VELOCITY_WINDOW).toBe(250)

    // Ровно у порога входа: 31 px за кадр — 1937 px/s, 33 px — 2062 px/s.
    const below = setup()
    for (let i = 0; i < 30; i++) below.frame(0, 31)
    expect(below.changes).toEqual([])
    below.detach()
    const above = setup()
    for (let i = 0; i < 30; i++) above.frame(0, 33)
    expect(above.changes).toEqual([true])
    above.detach()
    // По X порог выше: 70 px за кадр — 4375 px/s, 74 px — 4625 px/s.
    const belowX = setup()
    for (let i = 0; i < 30; i++) belowX.frame(70, 0)
    expect(belowX.changes).toEqual([])
    belowX.detach()
    const aboveX = setup()
    for (let i = 0; i < 30; i++) aboveX.frame(74, 0)
    expect(aboveX.changes).toEqual([true])
    aboveX.detach()

    // Выход — при 25 % порога входа: 562 px/s режим держит, 437 px/s снимает.
    const exit = setup()
    for (let i = 0; i < 20; i++) exit.frame(0, 80)
    for (let i = 0; i < 30; i++) exit.frame(0, 9)
    expect(exit.changes).toEqual([true])
    for (let i = 0; i < 30; i++) exit.frame(0, 7)
    expect(exit.changes).toEqual([true, false])
    exit.detach()

    // Простой: выход ровно через 300 мс после последнего события.
    const idle = setup()
    for (let i = 0; i < 20; i++) idle.frame(0, 80)
    vi.advanceTimersByTime(IDLE_DELAY - 1)
    expect(idle.changes).toEqual([true])
    vi.advanceTimersByTime(1)
    expect(idle.changes).toEqual([true, false])
  })

  it('RM26: внешний признак включает режим на медленной прокрутке, пока он держится; без него та же прокрутка режим не включает, выход — по простою', () => {
    // 500 px/s по Y: 8 px за кадр.
    let near = false
    const { changes, frame } = setup({ forceFast: () => near })
    for (let i = 0; i < 30; i++) frame(0, 8)
    expect(changes).toEqual([])
    near = true
    frame(0, 8)
    expect(changes).toEqual([true])
    for (let i = 0; i < 30; i++) frame(0, 8)
    expect(changes).toEqual([true])
    vi.advanceTimersByTime(IDLE_DELAY + MIN_DURATION)
    expect(changes).toEqual([true, false])
  })
})

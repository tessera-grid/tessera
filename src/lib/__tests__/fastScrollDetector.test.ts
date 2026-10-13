/**
 * Детектор быстрой прокрутки (ADR 0008; FS1–FS5): скорость по жесту, вход и выход с
 * гистерезисом, минимальное время в режиме, выход по простою.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type FastScrollDetectorOptions,
  IDLE_DELAY,
  MIN_DURATION,
  attachFastScrollDetector,
  markProgrammaticScroll,
} from '../core/fastScroll/fastScrollDetector'

const FRAME = 16

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
  it('FS1: после паузы главного потока при медленной прокрутке режим не включается — сдвиг за паузу в скорость не входит', () => {
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

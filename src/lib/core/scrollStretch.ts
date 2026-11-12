/**
 * Слой вертикальных координат области прокрутки грида (ADR 0142). Тело выше границы
 * браузера растянуто: физический `scrollTop` — виртуальная позиция / `scale`, ползунок
 * пропорционален итогу, колесо сдвигает строки 1:1. Без растяжки слой — тождество.
 */
import { parseDuration } from '../util/cssTime'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'

export interface ScrollTarget {
  top?: number
  left?: number
}

type Listener = (top: number, isScrolling: boolean) => void

/** Дельта колеса не меньше — щелчок мыши, а не тачпад (XS12). */
const NOTCH_DELTA = 50
/** Строка `deltaMode` колеса в px. */
const LINE_DELTA = 20
/** Пауза после прокрутки, после которой она считается законченной. */
const IDLE_MS = 150
/**
 * Сдвиг строк растянутой области — база (строки перерисовывает React) и остаток до неё
 * (`translate` строк, без React). База догоняет сдвиг, когда остаток больше этого.
 */
const BASE_STEP = 100_000

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

const areas = new WeakMap<object, ScrollLayer>()
const layerOf = (area: object) => areas.get(area)!

class ScrollLayer {
  /** Насколько виртуальная прокрутка длиннее физической. */
  private extra = 0
  private virtual = 0
  /** Последний `scrollTop`, записанный слоем: его событие `scroll` — не новый ввод. */
  private written: number | null = null
  private listeners = new Set<Listener>()
  private idle: ReturnType<typeof setTimeout> | undefined
  private animation: {
    to: number
    effect: KeyframeEffect
    from: number
  } | null = null
  private frame = 0

  constructor(readonly scroller: HTMLElement) {
    scroller.addEventListener('scroll', this.onScroll, { passive: true })
    areas.set(this.area, this)
  }

  private subscriptions = new Map<() => void, () => void>()

  /**
   * Область для тех, кто следит за прокруткой: `scrollTop` — виртуальный, событие
   * `scroll` — на каждый сдвиг слоя, даже без сдвига физического `scrollTop`.
   */
  readonly area = {
    get owner() {
      return layerOf(this).scroller
    },
    get scrollTop() {
      return layerOf(this).top()
    },
    get scrollLeft() {
      return layerOf(this).scroller.scrollLeft
    },
    get clientHeight() {
      return layerOf(this).scroller.clientHeight
    },
    get clientWidth() {
      return layerOf(this).scroller.clientWidth
    },
    addEventListener: (_type: 'scroll', listener: () => void) => {
      if (this.subscriptions.has(listener)) return
      this.subscriptions.set(
        listener,
        this.subscribe(() => listener()),
      )
    },
    removeEventListener: (_type: 'scroll', listener: () => void) => {
      this.subscriptions.get(listener)?.()
      this.subscriptions.delete(listener)
    },
  }

  /** Растянута ли область. */
  get stretched() {
    return this.extra > 0
  }

  /** Физический предел прокрутки; чтение размеров форсирует раскладку — кешируется. */
  private max: number | null = null
  private resize: ResizeObserver | undefined

  private physicalMax() {
    this.max ??= Math.max(
      this.scroller.scrollHeight - this.scroller.clientHeight,
      0,
    )
    return this.max
  }

  /** Во сколько раз виртуальная прокрутка длиннее физической. */
  scale() {
    const physical = this.physicalMax()
    return this.extra > 0 && physical > 0
      ? (physical + this.extra) / physical
      : 1
  }

  /** Виртуальная позиция по вертикали. */
  top() {
    return this.extra > 0 ? this.virtual : this.scroller.scrollTop
  }

  /** Наибольшая виртуальная позиция. */
  maxTop() {
    return this.physicalMax() + this.extra
  }

  /** Экранное место строки в теле — её виртуальное начало минус сдвиг. */
  shift() {
    return this.extra > 0 ? this.virtual - this.physical : 0
  }

  /** Физический `scrollTop` растянутой области на момент последнего сдвига. */
  private physical = 0
  /** Горизонталь при последнем событии `scroll`: своё событие без её сдвига — не новость. */
  private left = 0

  /** Сдвиг, от которого React ставит строки; остаток до `shift()` — их `translate`. */
  private base = 0
  /** База, с которой строки на экране отрисованы. */
  private rendered = 0
  private baseListeners = new Set<() => void>()
  /** У строк стоит `translate` остатка. */
  private stamped = false

  rowShift() {
    return this.base
  }

  onBase = (listener: () => void) => {
    this.baseListeners.add(listener)
    return () => {
      this.baseListeners.delete(listener)
    }
  }

  /** Строки отрисованы от базы `base`: остаток — от неё. */
  commitBase(base: number) {
    this.rendered = base
    this.applyOffset()
  }

  private moveBase(base: number) {
    if (base === this.base) return
    this.base = base
    for (const listener of this.baseListeners) listener()
  }

  private applyOffset() {
    if (!this.stretched && !this.stamped) return
    const shift = this.shift()
    if (this.stretched && Math.abs(shift - this.base) > BASE_STEP) {
      this.moveBase(Math.round(shift))
    }
    const residual = this.stretched ? shift - this.rendered : 0
    const body = this.scroller.querySelector('.data-grid__body')
    if (!body) return
    const value = residual === 0 ? '' : `0 ${-residual}px`
    for (const child of body.children) {
      ;(child as HTMLElement).style.translate = value
    }
    this.stamped = residual !== 0
  }

  /** Новая разница виртуальной и физической прокрутки: позиция сохраняется. */
  configure(extra: number) {
    const next = Math.max(extra, 0)
    this.max = null
    if (next === this.extra) return
    const top = this.top()
    const was = this.stretched
    this.extra = next
    // Слушатель колеса не пассивный — только у растянутой области (XS1).
    if (next > 0 && !was) {
      this.scroller.addEventListener('wheel', this.onWheel, { passive: false })
      // Позицией владеет слой: привязка прокрутки Firefox двигала бы `scrollTop` сама.
      this.scroller.style.overflowAnchor = 'none'
      this.resize ??= new ResizeObserver(() => {
        this.max = null
      })
      this.resize.observe(this.scroller)
    } else if (next === 0 && was) {
      this.scroller.removeEventListener('wheel', this.onWheel)
      this.scroller.style.overflowAnchor = ''
      this.resize?.disconnect()
    }
    if (next > 0) this.write(top, false)
    else {
      this.stopAnimation()
      this.scroller.scrollTop = top
      this.moveBase(0)
      this.applyOffset()
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Поправка места на разницу высот строк выше экрана (ADR 0218, AH15): в растянутой области
   * идущий щелчок колеса продолжается со сдвигом, а не обрывается.
   */
  adjustTo(top: number) {
    const animation = this.animation
    if (!this.stretched || !animation) {
      this.scrollTo({ top })
      return
    }
    const delta = top - this.virtual
    animation.from += delta
    animation.to = this.clamp(animation.to + delta)
    this.write(top)
  }

  scrollTo(target: ScrollTarget, behavior: 'instant' | 'smooth' = 'instant') {
    if (!this.stretched) {
      this.scroller.scrollTo({ ...target, behavior })
      return
    }
    if (target.left !== undefined) {
      this.scroller.scrollTo({ left: target.left, behavior })
    }
    if (target.top === undefined) return
    if (behavior === 'smooth' && !prefersReducedMotion()) {
      this.animate(target.top)
      return
    }
    this.stopAnimation()
    this.write(target.top, false)
  }

  scrollBy(dy: number, dx = 0) {
    if (dx !== 0) this.scroller.scrollLeft += dx
    if (dy !== 0) this.scrollTo({ top: this.top() + dy })
  }

  /** Колесо в растянутой области (XS3, XS12); `false` — событие не наше. */
  wheel(event: WheelEvent) {
    if (!this.stretched || event.ctrlKey) return false
    const unit =
      event.deltaMode === 1
        ? LINE_DELTA
        : event.deltaMode === 2
          ? this.scroller.clientHeight
          : 1
    const dy = event.deltaY * unit
    const dx = event.deltaX * unit
    const top = this.animation?.to ?? this.virtual
    const atEdge = dy < 0 ? top <= 0 : top >= this.maxTop()
    if (dx === 0 && (dy === 0 || atEdge)) return false
    event.preventDefault()
    if (dx !== 0) this.scroller.scrollLeft += dx
    if (dy === 0) return true
    const notch = event.deltaMode !== 0 || Math.abs(dy) >= NOTCH_DELTA
    if (notch && !prefersReducedMotion()) this.animate(top + dy)
    else {
      this.stopAnimation()
      this.write(this.virtual + dy)
    }
    return true
  }

  private onWheel = (event: WheelEvent) => {
    this.wheel(event)
  }

  private clamp(top: number) {
    return Math.min(Math.max(top, 0), this.maxTop())
  }

  /**
   * `scrolling` — колесо и кадр анимации: виртуализатор перерисуется синхронно. Программный
   * переход зовут и из эффектов React, где синхронная перерисовка запрещена, — он
   * сообщает позицию как конец прокрутки.
   */
  private write(top: number, scrolling = true) {
    this.virtual = this.clamp(top)
    this.scroller.scrollTop = this.virtual / this.scale()
    // Движок хранит прокрутку на своей сетке: место строк — от фактической.
    this.physical = this.scroller.scrollTop
    this.written = this.physical
    this.emit(scrolling)
  }

  private emit(scrolling = true) {
    this.applyOffset()
    const top = this.top()
    for (const listener of this.listeners) listener(top, scrolling)
    clearTimeout(this.idle)
    if (!scrolling) return
    this.idle = setTimeout(() => {
      for (const listener of this.listeners) listener(this.top(), false)
    }, IDLE_MS)
  }

  private onScroll = () => {
    if (!this.stretched) {
      this.emit()
      return
    }
    const physical = this.scroller.scrollTop
    const left = this.scroller.scrollLeft
    const moved = left !== this.left
    this.left = left
    // Своя запись: виртуальная позиция прежняя, сообщать — только сдвиг горизонтали.
    if (this.written !== null && Math.abs(physical - this.written) < 1) {
      if (moved) this.emit()
      return
    }
    this.physical = physical
    this.stopAnimation()
    if (this.followed !== null) {
      this.followDelta(physical)
      return
    }
    // Ползунок, касание, нативные клавиши: позиция — доля физической.
    this.written = null
    this.virtual = this.clamp(physical * this.scale())
    this.emit()
  }

  /** Последний физический `scrollTop` при перетаскивании строки; `null` — его нет. */
  private followed: number | null = null

  /**
   * Перетаскивание строки (XS6): автопрокрутка dnd-kit двигает `scrollTop` — сдвиг
   * идёт 1:1, а не в `scale` раз быстрее. После броска ползунок возвращается к доле.
   */
  followDrag(active: boolean) {
    if (active === (this.followed !== null)) return
    if (active) {
      this.followed = this.physical
      // Места строк dnd-kit меряет без `translate`: остаток — в базу.
      if (this.stretched) this.moveBase(Math.round(this.shift()))
      return
    }
    this.followed = null
    if (this.stretched) this.write(this.virtual, false)
  }

  private followDelta(physical: number) {
    this.virtual = this.clamp(this.virtual + physical - this.followed!)
    this.followed = physical
    this.written = null
    // Физическая прокрутка упёрлась в край раньше виртуальной — ползунок к доле.
    const edge =
      (physical <= 0 && this.virtual > 0) ||
      (physical >= this.physicalMax() - 1 && this.virtual < this.maxTop())
    if (edge) {
      this.write(this.virtual)
      this.followed = this.physical
      return
    }
    this.emit()
  }

  /** Плавно к цели за длительность и кривой токенов движения (XS12). */
  private animate(to: number) {
    const style = getComputedStyle(this.scroller)
    const duration = parseDuration(
      style.getPropertyValue('--tsr-comp-motion-duration'),
    )
    const easing =
      style.getPropertyValue('--tsr-comp-motion-easing').trim() || 'linear'
    if (duration <= 0) {
      this.stopAnimation()
      this.write(to)
      return
    }
    // Кривая токена — от Web Animations: свой расчёт кривой не нужен.
    const effect = new KeyframeEffect(null, [], {
      duration,
      easing,
      fill: 'both',
    })
    const clock = new Animation(effect, null)
    this.animation = { from: this.virtual, to: this.clamp(to), effect }
    const start = performance.now()
    const step = (now: number) => {
      const animation = this.animation
      if (!animation || animation.effect !== effect) return
      const elapsed = Math.min(now - start, duration)
      clock.currentTime = elapsed
      const progress = effect.getComputedTiming().progress ?? 1
      this.write(animation.from + (animation.to - animation.from) * progress)
      if (elapsed >= duration) this.animation = null
      else this.frame = requestAnimationFrame(step)
    }
    cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(step)
  }

  private stopAnimation() {
    this.animation = null
    cancelAnimationFrame(this.frame)
  }
}

const layers = new WeakMap<HTMLElement, ScrollLayer>()

/** Слой координат области прокрутки грида — один на элемент. */
export const scrollLayer = (scroller: HTMLElement): ScrollLayer => {
  let layer = layers.get(scroller)
  if (!layer) {
    layer = new ScrollLayer(scroller)
    layers.set(scroller, layer)
  }
  return layer
}

export type { ScrollLayer }

/** Растяжка области прокрутки: `extra` — насколько итог тела выше его высоты на экране. */
export const useScrollStretch = (
  getScrollElement: () => HTMLElement | null,
  extra: number,
) => {
  useIsomorphicLayoutEffect(() => {
    const scroller = getScrollElement()
    if (scroller) scrollLayer(scroller).configure(extra)
  }, [getScrollElement, extra])
}

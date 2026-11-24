import { type RefObject } from 'react'

import { scrollLayer } from '../core/scrollStretch'
import { parseDuration } from '../util/cssTime'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'
export {
  SKELETON_WAVE_ANIMATION,
  useSkeletonWave,
} from './useSkeletonWaveLayer'

/**
 * Сколько досчитывать положения после события, мс: виртуализатор колонок сдвигает
 * ячейки после прокрутки без вставки узлов, раскладка колонок встаёт после монтирования.
 */
const SETTLE_MS = 200

const numberOf = (
  style: CSSStyleDeclaration,
  name: string,
  fallback: number,
) => {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

/**
 * Проход и задержка волны из токенов темы — через `transition` пробы в рамке: под
 * `prefers-reduced-motion` тема обнуляет переходы, и волны нет.
 */
const timingProbe = (frame: HTMLElement) => {
  const probe = frame.ownerDocument.createElement('span')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;transition-property:transform;' +
    'transition-duration:var(--tsr-comp-pending-wave-duration)'
  frame.append(probe)
  return probe
}

const timingOf = (probe: HTMLElement) => {
  const style = getComputedStyle(probe)
  return {
    duration: parseDuration(style.transitionDuration),
    delay: parseDuration(style.transitionDelay),
  }
}

export const PENDING_WAVE_ANIMATION = 'tsr-pending-wave'

const PENDING =
  '.data-grid__body-cell[data-pending-wave], .data-grid__body-filler[data-pending-wave]'
const STILL = 'data-pending-wave-still'
const ANIMATED = 'data-pending-wave-animated'
const PINNED = '[data-cell-pinned="left"], [data-cell-pinned="right"]'

/** Волна ожидания под содержимым видимых ячеек цели действия (ADR 0152, §3). */
export const usePendingWave = (
  frameRef: RefObject<HTMLElement | null>,
  active: boolean,
) => {
  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current
    if (!active || !frame) return
    const probe = timingProbe(frame)
    let start: number | undefined
    const animations = new Map<HTMLElement, Animation>()
    const written = new WeakMap<HTMLElement, string>()
    let timingKey = ''
    let request = 0
    let settleUntil = 0
    let measuredAt = 0
    let scroller: HTMLElement | null = null
    let scrollLeft = 0
    let scrollTop = 0
    let horizontal = false
    let hasPinnedTargets = false
    let hasStickyRows = false
    let bodyScrolledAt = -Infinity

    const stopAll = () => {
      animations.forEach(animation => animation.cancel())
      animations.clear()
      frame.removeAttribute(ANIMATED)
    }

    const measure = () => {
      measuredAt = performance.now()
      const root = frame.querySelector<HTMLElement>('.data-grid__container')
      const resetScroll = scroller !== root || frame.hasAttribute(STILL)
      scroller = root
      const targets = frame.querySelectorAll<HTMLElement>(PENDING)
      const style = getComputedStyle(frame)
      const limit = numberOf(style, '--tsr-comp-pending-wave-limit', Infinity)
      if (targets.length > limit) {
        // Учитываем всё смонтированное окно, включая запас виртуализации.
        frame.toggleAttribute(STILL, true)
        stopAll()
        return
      }
      const timing = timingOf(probe)
      // В высокой контрастности волны нет: знак ожидания — контур на том же слое.
      if (timing.duration <= 0 || forced.matches) {
        frame.toggleAttribute(STILL, true)
        stopAll()
        return
      }
      const key = `${timing.duration} ${timing.delay}`
      if (key !== timingKey) {
        timingKey = key
        animations.forEach(animation => animation.effect?.updateTiming(timing))
      }

      const origin = frame.getBoundingClientRect()
      const view = scroller?.getBoundingClientRect() ?? origin
      const left = scroller?.scrollLeft ?? 0
      const top = scroller ? scrollLayer(scroller).physicalTop() : 0
      if (resetScroll) {
        scrollLeft = left
        scrollTop = top
        horizontal = false
      }
      hasStickyRows = !!frame.querySelector('[data-sticky-rows]')
      const band = numberOf(style, '--tsr-comp-skeleton-wave-width', 0)
      const tilt = numberOf(style, '--tsr-comp-skeleton-wave-tilt', 0)
      const period = origin.width + band + origin.height * tilt
      const shifts = new Map<HTMLElement, number>()
      hasPinnedTargets = false
      for (const target of targets) {
        const box = target.getBoundingClientRect()
        // При горизонтальной прокрутке запас колонок уже в фазе до входа в экран.
        if (
          box.bottom <= view.top ||
          box.top >= view.bottom ||
          (!horizontal && (box.right <= view.left || box.left >= view.right))
        )
          continue
        hasPinnedTargets ||= target.matches(PINNED)
        const x = box.left - origin.left + left
        const y = box.top - origin.top + top
        const offset = Math.round(x) + Math.round(y) * tilt
        shifts.set(
          target,
          period > 0 ? ((offset % period) + period) % period : offset,
        )
      }
      // Передаём эффекты ушедших из видимой области ячеек вошедшим в неё.
      const recycled: Animation[] = []
      animations.forEach((animation, target) => {
        if (shifts.has(target)) return
        recycled.push(animation)
        animations.delete(target)
      })
      frame.removeAttribute(STILL)
      frame.toggleAttribute(ANIMATED, shifts.size > 0)
      const from = -band
      const to = period - band
      shifts.forEach((shift, target) => {
        const path = `${from - shift} ${to - shift}`
        const current = animations.get(target)
        if (current && written.get(target) === path) return
        written.set(target, path)
        const keyframes = [
          { transform: `translateX(${from - shift}px)` },
          { transform: `translateX(${to - shift}px)` },
        ]
        if (current) {
          ;(current.effect as KeyframeEffect).setKeyframes(keyframes)
          return
        }
        const spare = recycled.pop()
        if (spare) {
          const effect = spare.effect as KeyframeEffect
          // Прежняя цель уже ушла, а время анимации остаётся общей фазой рамки.
          effect.setKeyframes(keyframes)
          effect.target = target
          animations.set(target, spare)
          return
        }
        const effect = new KeyframeEffect(target, keyframes, {
          ...timing,
          iterations: Infinity,
          easing: 'linear',
          pseudoElement: '::before',
        })
        const timeline = frame.ownerDocument.timeline
        const animation = new Animation(effect, timeline)
        animation.id = PENDING_WAVE_ANIMATION
        // Проигрывание начнётся сразу с общей фазы: отдельный play() поставил бы
        // каждый блик в очередь старта и сразу отменился бы присвоением startTime.
        start ??= (timeline.currentTime as number | null) ?? 0
        animation.startTime = start
        animations.set(target, animation)
      })
      recycled.forEach(animation => animation.cancel())
    }

    // Кадр, в котором коммит уже замерен (MutationObserver после прокрутки), — без
    // повтора.
    const loop = (frameStart: number) => {
      if (measuredAt < frameStart) measure()
      request =
        performance.now() < settleUntil ? requestAnimationFrame(loop) : 0
    }
    const settle = () => {
      settleUntil = performance.now() + SETTLE_MS
      if (!request) request = requestAnimationFrame(loop)
    }
    const onMutation = () => {
      measure()
      if (measuredAt - bodyScrolledAt >= SETTLE_MS) settle()
    }
    const onScroll = (event: Event) => {
      if (scroller && event.target === scroller) {
        if (frame.hasAttribute(STILL)) {
          bodyScrolledAt = performance.now()
          return
        }
        const left = scroller.scrollLeft
        const top = scrollLayer(scroller).physicalTop()
        const movedHorizontally = left !== scrollLeft
        const movedVertically = top !== scrollTop
        const wasHorizontal = horizontal
        horizontal = movedHorizontally || (horizontal && !movedVertically)
        scrollLeft = left
        scrollTop = top
        if (!hasStickyRows && (!movedHorizontally || !hasPinnedTargets)) {
          bodyScrolledAt = performance.now()
          if ((horizontal !== wasHorizontal || movedVertically) && !request)
            request = requestAnimationFrame(loop)
          return
        }
      }
      bodyScrolledAt = -Infinity
      settle()
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const forced = window.matchMedia('(forced-colors: active)')
    measure()
    settle()
    const resize = new ResizeObserver(settle)
    resize.observe(frame)
    const mutations = new MutationObserver(onMutation)
    mutations.observe(frame, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-pending-wave'],
    })
    // Прокрутка не всплывает: слушаем все области рамки на погружении.
    frame.addEventListener('scroll', onScroll, { capture: true, passive: true })
    motion.addEventListener('change', settle)
    forced.addEventListener('change', settle)
    return () => {
      cancelAnimationFrame(request)
      resize.disconnect()
      mutations.disconnect()
      frame.removeEventListener('scroll', onScroll, { capture: true })
      motion.removeEventListener('change', settle)
      forced.removeEventListener('change', settle)
      probe.remove()
      stopAll()
      frame.removeAttribute(STILL)
    }
  }, [active, frameRef])
}

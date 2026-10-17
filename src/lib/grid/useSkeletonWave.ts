import { type RefObject } from 'react'

import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'
import { SKELETON_WAVE_ATTRIBUTE } from '../ui/Skeleton/Skeleton'

/**
 * Сколько досчитывать положения после события, мс: виртуализатор колонок сдвигает
 * ячейки после прокрутки без вставки узлов, раскладка колонок встаёт после монтирования.
 */
const SETTLE_MS = 200

const SKELETONS = `[${SKELETON_WAVE_ATTRIBUTE}]`

/** `id` анимаций блика общей волны. */
export const SKELETON_WAVE_ANIMATION = 'tsr-skeleton-wave'

const numberOf = (
  style: CSSStyleDeclaration,
  name: string,
  fallback: number,
) => {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

/** Время из CSS (`2.4s`, `500ms`) в мс. */
const msOf = (value: string) => {
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return 0
  return value.trim().endsWith('ms') ? number : number * 1000
}

/**
 * Проход и задержка волны из токенов темы — через `transition` пробы в рамке: под
 * `prefers-reduced-motion` тема обнуляет переходы, и волны нет.
 */
const PROBE_ATTRIBUTE = 'data-tsr-skeleton-wave-probe'

const timingOf = (frame: HTMLElement) => {
  const probe = document.createElement('span')
  probe.setAttribute(PROBE_ATTRIBUTE, '')
  probe.style.cssText =
    'position:absolute;visibility:hidden;transition-property:transform;' +
    'transition-duration:var(--tsr-comp-skeleton-frame-wave-duration);' +
    'transition-delay:var(--tsr-comp-skeleton-wave-delay)'
  frame.append(probe)
  const style = getComputedStyle(probe)
  const timing = {
    duration: msOf(style.transitionDuration),
    delay: msOf(style.transitionDelay),
  }
  probe.remove()
  return timing
}

/**
 * Общая волна скелетов рамки (ADR 0121). Блик каждого скелета — своя анимация WAAPI с
 * числовыми кадрами: путь полосы в координатах содержимого тела (смещение в рамке плюс
 * горизонтальная прокрутка, по модулю периода прохода) минус смещение скелета; у всех
 * анимаций — один `startTime`, поэтому на экране одна наклонная полоса. Переменные в
 * общих `@keyframes` композитор Chrome не подставляет — кадры числовые. Прокрутка не
 * меняет смещений прокручиваемых скелетов — их анимации не пересобираются. Работа — по
 * событиям: новые скелеты, смена размера, прокрутка; в покое главный поток свободен.
 */
export const useSkeletonWave = (
  frameRef: RefObject<HTMLElement | null>,
  active: boolean,
) => {
  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current
    if (!active || !frame) return
    let start: number | undefined
    const animations = new Map<HTMLElement, Animation>()
    const written = new WeakMap<HTMLElement, string>()
    let timingKey = ''
    let request = 0
    let settleUntil = 0
    let measuredAt = 0

    const stopAll = () => {
      animations.forEach(animation => animation.cancel())
      animations.clear()
    }

    const measure = () => {
      measuredAt = performance.now()
      const timing = timingOf(frame)
      if (timing.duration <= 0) {
        stopAll()
        return
      }
      const key = `${timing.duration} ${timing.delay}`
      if (key !== timingKey) {
        timingKey = key
        animations.forEach(animation => animation.effect?.updateTiming(timing))
      }

      const origin = frame.getBoundingClientRect()
      const scroll =
        frame.querySelector<HTMLElement>('.data-grid__container')?.scrollLeft ??
        0
      const style = getComputedStyle(frame)
      const band = numberOf(style, '--tsr-comp-skeleton-wave-width', 0)
      const tilt = numberOf(style, '--tsr-comp-skeleton-wave-tilt', 0)
      const period = origin.width + band + origin.height * tilt
      // Ушедшие из рамки скелеты — без анимаций: рамка не держит их узлы.
      animations.forEach((animation, skeleton) => {
        if (skeleton.isConnected) return
        animation.cancel()
        animations.delete(skeleton)
      })
      const skeletons = [...frame.querySelectorAll<HTMLElement>(SKELETONS)]
      // Сначала все чтения, затем записи: одна раскладка на замер.
      const shifts = skeletons.map(skeleton => {
        const box = skeleton.getBoundingClientRect()
        const x = box.left - origin.left + scroll
        const wrapped = period > 0 ? ((x % period) + period) % period : x
        return Math.round(wrapped) + Math.round(box.top - origin.top) * tilt
      })
      const from = -band
      const to = period - band
      skeletons.forEach((skeleton, index) => {
        const shift = shifts[index]!
        const path = `${from - shift} ${to - shift}`
        const current = animations.get(skeleton)
        if (current && written.get(skeleton) === path) return
        written.set(skeleton, path)
        const keyframes = [
          { transform: `translateX(${from - shift}px)` },
          { transform: `translateX(${to - shift}px)` },
        ]
        if (current) {
          ;(current.effect as KeyframeEffect).setKeyframes(keyframes)
          return
        }
        const animation = skeleton.animate(keyframes, {
          ...timing,
          iterations: Infinity,
          easing: 'linear',
          pseudoElement: '::after',
        })
        animation.id = SKELETON_WAVE_ANIMATION
        start ??= (document.timeline.currentTime as number | null) ?? 0
        animation.startTime = start
        animations.set(skeleton, animation)
      })
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
    // Проба замера сама меняет рамку — её записи не повод замерять снова.
    const isProbe = (node: Node) =>
      node instanceof Element && node.hasAttribute(PROBE_ATTRIBUTE)
    const onMutation = (records: MutationRecord[]) => {
      const real = records.some(
        record =>
          ![...record.addedNodes, ...record.removedNodes].every(isProbe),
      )
      if (!real) return
      measure()
      settle()
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    measure()
    settle()
    const resize = new ResizeObserver(settle)
    resize.observe(frame)
    const mutations = new MutationObserver(onMutation)
    mutations.observe(frame, { childList: true, subtree: true })
    // Прокрутка не всплывает: слушаем все области рамки на погружении.
    frame.addEventListener('scroll', settle, { capture: true, passive: true })
    motion.addEventListener('change', settle)
    return () => {
      cancelAnimationFrame(request)
      resize.disconnect()
      mutations.disconnect()
      frame.removeEventListener('scroll', settle, { capture: true })
      motion.removeEventListener('change', settle)
      stopAll()
    }
  }, [active, frameRef])
}

import { type RefObject } from 'react'

import { parseDuration } from '../util/cssTime'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'
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

/**
 * Проход и задержка волны из токенов темы — через `transition` пробы в рамке: под
 * `prefers-reduced-motion` тема обнуляет переходы, и волны нет.
 */
const PROBE_ATTRIBUTE = 'data-tsr-skeleton-wave-probe'

const timingOf = (
  frame: HTMLElement,
  durationToken: string,
  delayToken: string | undefined,
) => {
  const probe = document.createElement('span')
  probe.setAttribute(PROBE_ATTRIBUTE, '')
  probe.style.cssText =
    'position:absolute;visibility:hidden;transition-property:transform;' +
    `transition-duration:var(${durationToken});` +
    `transition-delay:${delayToken ? `var(${delayToken})` : '0ms'}`
  frame.append(probe)
  const style = getComputedStyle(probe)
  const timing = {
    duration: parseDuration(style.transitionDuration),
    delay: parseDuration(style.transitionDelay),
  }
  probe.remove()
  return timing
}

/** Узлы общей волны: чьи псевдоэлементы светятся и как зовутся их анимации. */
export interface FrameWave {
  /** Селектор узлов волны в рамке. */
  selector: string
  /** Псевдоэлемент с полосой света. */
  pseudoElement: '::before' | '::after'
  /** `id` анимаций блика. */
  id: string
  /** Токен прохода; по умолчанию — проход волны скелетов. */
  durationToken?: string
  /** Токен паузы до первого прохода; без него волна идёт сразу. */
  delayToken?: string
  /** Атрибут, сменой которого узел входит в волну и выходит из неё. */
  attribute?: string
  /**
   * Неподвижный свет вместо волны: признак рамки ставится при уменьшенном движении и когда
   * узлов в рамке больше порога из токена `limitToken`.
   */
  still?: { attribute: string; limitToken: string }
}

/**
 * Общая волна рамки (ADR 0121; ADR 0152 — волна ожидания на цели действия меню). Блик каждого скелета — своя анимация WAAPI с
 * числовыми кадрами: путь полосы в координатах содержимого тела (смещение в рамке плюс
 * горизонтальная прокрутка, по модулю периода прохода) минус смещение скелета; у всех
 * анимаций — один `startTime`, поэтому на экране одна наклонная полоса. Переменные в
 * общих `@keyframes` композитор Chrome не подставляет — кадры числовые. Прокрутка не
 * меняет смещений прокручиваемых скелетов — их анимации не пересобираются. Работа — по
 * событиям: новые скелеты, смена размера, прокрутка; в покое главный поток свободен.
 */
export const useFrameWave = (
  frameRef: RefObject<HTMLElement | null>,
  active: boolean,
  {
    selector,
    pseudoElement,
    id,
    durationToken = '--tsr-comp-skeleton-frame-wave-duration',
    delayToken,
    attribute,
    still,
  }: FrameWave,
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
      const timing = timingOf(frame, durationToken, delayToken)
      // В высокой контрастности волны нет: знак ожидания — контур на том же слое.
      if (timing.duration <= 0 || (still && forced.matches)) {
        if (still) frame.setAttribute(still.attribute, '')
        stopAll()
        return
      }
      const key = `${timing.duration} ${timing.delay}`
      if (key !== timingKey) {
        timingKey = key
        animations.forEach(animation => animation.effect?.updateTiming(timing))
      }

      const origin = frame.getBoundingClientRect()
      const container = frame.querySelector<HTMLElement>(
        '.data-grid__container',
      )
      const scroll = container?.scrollLeft ?? 0
      const scrollTop = container?.scrollTop ?? 0
      const style = getComputedStyle(frame)
      const band = numberOf(style, '--tsr-comp-skeleton-wave-width', 0)
      const tilt = numberOf(style, '--tsr-comp-skeleton-wave-tilt', 0)
      const period = origin.width + band + origin.height * tilt
      // Ушедшие из рамки и из волны узлы — без анимаций: рамка не держит их узлы.
      animations.forEach((animation, skeleton) => {
        if (skeleton.isConnected && skeleton.matches(selector)) return
        animation.cancel()
        animations.delete(skeleton)
      })
      const skeletons = [...frame.querySelectorAll<HTMLElement>(selector)]
      if (still) {
        const limit = numberOf(style, still.limitToken, Infinity)
        const over = skeletons.length > limit
        frame.toggleAttribute(still.attribute, over)
        if (over) {
          stopAll()
          return
        }
      }
      // Сначала все чтения, затем записи: одна раскладка на замер. Смещение — в координатах
      // содержимого по обеим осям: у прокручиваемых узлов прокрутка его не меняет, и их
      // анимации не пересобираются.
      const shifts = skeletons.map(skeleton => {
        const box = skeleton.getBoundingClientRect()
        const x = box.left - origin.left + scroll
        const y = box.top - origin.top + scrollTop
        const offset = Math.round(x) + Math.round(y) * tilt
        return period > 0 ? ((offset % period) + period) % period : offset
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
          pseudoElement,
        })
        animation.id = id
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
          record.type === 'attributes' ||
          ![...record.addedNodes, ...record.removedNodes].every(isProbe),
      )
      if (!real) return
      measure()
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
      ...(attribute && { attributes: true, attributeFilter: [attribute] }),
    })
    // Прокрутка не всплывает: слушаем все области рамки на погружении.
    frame.addEventListener('scroll', settle, { capture: true, passive: true })
    motion.addEventListener('change', settle)
    forced.addEventListener('change', settle)
    return () => {
      cancelAnimationFrame(request)
      resize.disconnect()
      mutations.disconnect()
      frame.removeEventListener('scroll', settle, { capture: true })
      motion.removeEventListener('change', settle)
      forced.removeEventListener('change', settle)
      stopAll()
      if (still) frame.removeAttribute(still.attribute)
    }
  }, [
    active,
    frameRef,
    selector,
    pseudoElement,
    id,
    durationToken,
    delayToken,
    attribute,
    still,
  ])
}

const SKELETON_WAVE: FrameWave = {
  selector: SKELETONS,
  pseudoElement: '::after',
  id: SKELETON_WAVE_ANIMATION,
  delayToken: '--tsr-comp-skeleton-wave-delay',
}

/** Общая волна скелетов рамки на время первой загрузки (ADR 0121). */
export const useSkeletonWave = (
  frameRef: RefObject<HTMLElement | null>,
  active: boolean,
) => useFrameWave(frameRef, active, SKELETON_WAVE)

/** `id` анимаций волны ожидания на цели действия меню. */
export const PENDING_WAVE_ANIMATION = 'tsr-pending-wave'

const PENDING_WAVE: FrameWave = {
  selector:
    '.data-grid__body-cell[data-pending-wave], .data-grid__body-filler[data-pending-wave]',
  pseudoElement: '::before',
  id: PENDING_WAVE_ANIMATION,
  durationToken: '--tsr-comp-pending-wave-duration',
  attribute: 'aria-busy',
  still: {
    attribute: 'data-pending-wave-still',
    limitToken: '--tsr-comp-pending-wave-limit',
  },
}

/** Волна ожидания по ячейкам цели действия меню, пока оно ждёт (ADR 0152, §3). */
export const usePendingWave = (
  frameRef: RefObject<HTMLElement | null>,
  active: boolean,
) => useFrameWave(frameRef, active, PENDING_WAVE)

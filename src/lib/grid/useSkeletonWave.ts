import { type RefObject } from 'react'

import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'
import { SKELETON_WAVE_ATTRIBUTE } from '../ui/Skeleton/Skeleton'

/**
 * Сколько досчитывать положения после события, мс: виртуализатор колонок сдвигает
 * ячейки после прокрутки без вставки узлов, раскладка колонок встаёт после монтирования.
 */
const SETTLE_MS = 200

const SKELETONS = `[${SKELETON_WAVE_ATTRIBUTE}]`

const numberOf = (
  style: CSSStyleDeclaration,
  name: string,
  fallback: number,
) => {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

/**
 * Общая волна скелетов рамки (ADR 0121). Блик каждого скелета едет на композиторе, у
 * всех — с одного момента (`startTime`); его путь — в координатах содержимого тела
 * (смещение в рамке плюс горизонтальная прокрутка), повторяясь с периодом прохода
 * рамки: на экране одна полоса при любой ширине таблицы, а прокрутка не меняет
 * переменных у прокручиваемых скелетов — их анимации не пересобираются. Работа — по
 * событиям: новые скелеты, смена размера, прокрутка; в покое главный поток свободен.
 */
export const useSkeletonWave = (
  frameRef: RefObject<HTMLElement | null>,
  active: boolean,
) => {
  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current
    if (!active || !frame) return
    // Начало волны — первый кадр синхронизации: в задержке до первого прохода полоса за
    // краем, и подстройка первых скелетов не видна.
    let start: number | undefined
    const written = new WeakMap<HTMLElement, string>()
    const synced = new WeakSet<Element>()
    let fresh: Element[] = []
    let size = ''
    let request = 0
    let settleUntil = 0
    let measuredAt = 0

    const measure = () => {
      measuredAt = performance.now()
      const origin = frame.getBoundingClientRect()
      const scroll =
        frame.querySelector<HTMLElement>('.data-grid__container')?.scrollLeft ??
        0
      const style = getComputedStyle(frame)
      const period =
        origin.width +
        numberOf(style, '--tsr-comp-skeleton-wave-width', 0) +
        origin.height * numberOf(style, '--tsr-comp-skeleton-wave-tilt', 0)
      const skeletons = [...frame.querySelectorAll<HTMLElement>(SKELETONS)]
      // Сначала все чтения, затем записи: одна раскладка на замер.
      const offsets = skeletons.map(skeleton => {
        const box = skeleton.getBoundingClientRect()
        const x = box.left - origin.left + scroll
        const wrapped = period > 0 ? ((x % period) + period) % period : x
        return `${Math.round(wrapped)}px ${Math.round(box.top - origin.top)}px`
      })
      const frameSize = `${origin.width}px ${origin.height}px`
      if (frameSize !== size) {
        size = frameSize
        frame.style.setProperty(
          '--tsr-skeleton-frame-width',
          `${origin.width}px`,
        )
        frame.style.setProperty(
          '--tsr-skeleton-frame-height',
          `${origin.height}px`,
        )
      }
      skeletons.forEach((skeleton, index) => {
        if (!synced.has(skeleton)) {
          synced.add(skeleton)
          fresh.push(skeleton)
        }
        const offset = offsets[index]!
        if (written.get(skeleton) === offset) return
        written.set(skeleton, offset)
        const [x, y] = offset.split(' ')
        skeleton.style.setProperty('--tsr-skeleton-x', x!)
        skeleton.style.setProperty('--tsr-skeleton-y', y!)
      })
    }

    // Новый скелет — в фазе: его анимации задаётся общий `startTime`. CSS-задержкой
    // точно не выйдет — Chrome назначает старт анимации в одном из следующих кадров.
    // Анимации документа — одним списком: вызов на скелет пересчитывал бы стили.
    const sync = (frameStart: number) => {
      if (!fresh.length) return
      start ??= frameStart
      const targets = new Set(fresh)
      fresh = []
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target
        if (target && targets.has(target)) animation.startTime = start
      }
    }

    // Кадр, в котором коммит уже замерен (MutationObserver после прокрутки), — без
    // повтора.
    const loop = (frameStart: number) => {
      if (measuredAt < frameStart) measure()
      sync(frameStart)
      request =
        performance.now() < settleUntil ? requestAnimationFrame(loop) : 0
    }
    const settle = () => {
      settleUntil = performance.now() + SETTLE_MS
      if (!request) request = requestAnimationFrame(loop)
    }
    const onMutation = () => {
      measure()
      settle()
    }

    measure()
    settle()
    const resize = new ResizeObserver(settle)
    resize.observe(frame)
    const mutations = new MutationObserver(onMutation)
    mutations.observe(frame, { childList: true, subtree: true })
    // Прокрутка не всплывает: слушаем все области рамки на погружении.
    frame.addEventListener('scroll', settle, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(request)
      resize.disconnect()
      mutations.disconnect()
      frame.removeEventListener('scroll', settle, { capture: true })
      frame.style.removeProperty('--tsr-skeleton-frame-width')
      frame.style.removeProperty('--tsr-skeleton-frame-height')
    }
  }, [active, frameRef])
}

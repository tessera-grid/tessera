/**
 * Общая волна загрузки (ADR 0121): градиент движется одним слоем, маска оставляет
 * свет только на видимых полосках скелета.
 */
import { type RefObject, useId } from 'react'

import { scrollLayer } from '../core/scrollStretch'
import { parseDuration } from '../util/cssTime'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'
import { SKELETON_WAVE_ATTRIBUTE } from '../ui/Skeleton/Skeleton'

export const SKELETON_WAVE_ANIMATION = 'tsr-skeleton-wave'

const SVG = 'http://www.w3.org/2000/svg'
const SKELETONS = `[${SKELETON_WAVE_ATTRIBUTE}]`
const PINNED = '[data-cell-pinned="left"], [data-cell-pinned="right"]'
const CELL =
  '.data-grid__body-cell--skeleton, .data-grid__head-cell, .data-grid__footer-cell--skeleton'
const OPACITY = [0, 0.1, 0.32, 0.62, 0.88, 1, 0.88, 0.62, 0.32, 0.1, 0]

type Bounds = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>

const intersection = (box: Bounds, bounds: Bounds): Bounds => ({
  left: Math.max(box.left, bounds.left),
  top: Math.max(box.top, bounds.top),
  right: Math.min(box.right, bounds.right),
  bottom: Math.min(box.bottom, bounds.bottom),
})

const visibleScroller = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  const left = rect.left + element.clientLeft
  const top = rect.top + element.clientTop
  return {
    left,
    top,
    right: left + element.clientWidth,
    bottom: top + element.clientHeight,
  }
}

const roundedRect = (box: Bounds, origin: Bounds, radius: number) => {
  const left = box.left - origin.left
  const top = box.top - origin.top
  const right = box.right - origin.left
  const bottom = box.bottom - origin.top
  const r = Math.min(radius, (right - left) / 2, (bottom - top) / 2)
  return (
    `M${left + r} ${top}H${right - r}Q${right} ${top} ${right} ${top + r}` +
    `V${bottom - r}Q${right} ${bottom} ${right - r} ${bottom}` +
    `H${left + r}Q${left} ${bottom} ${left} ${bottom - r}` +
    `V${top + r}Q${left} ${top} ${left + r} ${top}Z`
  )
}

const numberOf = (
  style: CSSStyleDeclaration,
  token: string,
  fallback: number,
) => {
  const value = Number.parseFloat(style.getPropertyValue(token))
  return Number.isFinite(value) ? value : fallback
}

export const useSkeletonWave = (
  frameRef: RefObject<HTMLElement | null>,
  active: boolean,
) => {
  const id = useId()
  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current
    if (!active || !frame) return
    const doc = frame.ownerDocument
    const element = <K extends keyof SVGElementTagNameMap>(tag: K) =>
      doc.createElementNS(SVG, tag)
    const layer = element('svg')
    layer.setAttribute('aria-hidden', 'true')
    layer.setAttribute('data-skeleton-wave-layer', '')
    layer.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:10'

    const defs = element('defs')
    const clip = element('clipPath')
    const mask = element('path')
    const gradient = element('linearGradient')
    clip.id = `tsr-wave-clip-${id}`
    gradient.id = `tsr-wave-light-${id}`
    clip.append(mask)
    OPACITY.forEach((opacity, index) => {
      const stop = element('stop')
      stop.setAttribute('offset', String(index / (OPACITY.length - 1)))
      stop.setAttribute('stop-opacity', String(opacity))
      stop.style.setProperty(
        'stop-color',
        'var(--tsr-comp-skeleton-frame-wave)',
      )
      gradient.append(stop)
    })
    defs.append(clip, gradient)

    const cropped = element('g')
    const offset = element('g')
    const moving = element('g')
    cropped.setAttribute('clip-path', `url(#${clip.id})`)
    moving.setAttribute('data-skeleton-wave-band', '')
    moving.style.willChange = 'transform'
    // Три копии держат один проход в видимой рамке и при прокрутке в обе стороны.
    const bands = [-1, 0, 1].map(() => {
      const band = element('rect')
      band.setAttribute('fill', `url(#${gradient.id})`)
      return band
    })
    moving.append(...bands)
    offset.append(moving)
    cropped.append(offset)
    layer.append(defs, cropped)

    const timing = doc.createElement('span')
    timing.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;' +
      'transition-duration:var(--tsr-comp-skeleton-frame-wave-duration);' +
      'transition-delay:var(--tsr-comp-skeleton-wave-delay)'
    frame.append(timing, layer)

    let animation: Animation | undefined
    let start: number | undefined
    let layout = ''
    let path = ''
    let request = 0
    const measure = () => {
      const timingStyle = getComputedStyle(timing)
      const duration = parseDuration(timingStyle.transitionDuration)
      const delay = parseDuration(timingStyle.transitionDelay)
      if (duration <= 0) {
        animation?.cancel()
        animation = undefined
        layer.style.visibility = 'hidden'
        return
      }
      layer.style.visibility = ''
      const origin = layer.getBoundingClientRect()
      if (!(origin.width > 0 && origin.height > 0)) return
      const style = getComputedStyle(frame)
      const bandWidth = numberOf(style, '--tsr-comp-skeleton-wave-width', 0)
      const tilt = numberOf(style, '--tsr-comp-skeleton-wave-tilt', 0)
      const radius = numberOf(style, '--tsr-comp-skeleton-radius', 4)
      const period = origin.width + bandWidth + origin.height * tilt
      if (period <= 0) return
      const scroller = frame.querySelector<HTMLElement>('.data-grid__container')
      const viewport = scroller ? visibleScroller(scroller) : origin
      const center = { ...viewport }
      const header = scroller?.querySelector('.data-grid__head')
      const headerBottom =
        header?.getBoundingClientRect().bottom ?? viewport.top
      const pinnedFooter = scroller?.querySelector(
        '.data-grid__footer--skeleton[data-position="pinned"]',
      )
      const footerTop =
        pinnedFooter?.getBoundingClientRect().top ?? viewport.bottom
      for (const cell of header?.querySelectorAll(PINNED) ?? []) {
        const rect = cell.getBoundingClientRect()
        if (cell.getAttribute('data-cell-pinned') === 'left')
          center.left = Math.max(center.left, rect.right)
        else center.right = Math.min(center.right, rect.left)
      }
      const shapes: string[] = []
      for (const bar of frame.querySelectorAll<HTMLElement>(SKELETONS)) {
        const cell = bar.closest(CELL)
        const inside = scroller?.contains(bar)
        let bounds = inside ? viewport : origin
        if (inside && cell) {
          if (!cell.matches(PINNED)) bounds = center
          if (cell.classList.contains('data-grid__body-cell--skeleton'))
            bounds = {
              ...bounds,
              top: Math.max(bounds.top, headerBottom),
              bottom: Math.min(bounds.bottom, footerTop),
            }
        }
        const box = intersection(bar.getBoundingClientRect(), bounds)
        if (box.right <= box.left || box.bottom <= box.top) continue
        shapes.push(roundedRect(box, origin, radius))
      }
      // Все измерения выше, записи ниже.
      const nextPath = shapes.join('')
      if (path !== nextPath) mask.setAttribute('d', (path = nextPath))
      const nextLayout = [
        origin.width,
        origin.height,
        bandWidth,
        tilt,
        duration,
        delay,
      ].join(' ')
      if (!animation || nextLayout !== layout) {
        layer.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`)
        const skew = (-Math.atan(tilt) * 180) / Math.PI
        bands.forEach((band, index) => {
          band.setAttribute('x', String((index - 1) * period))
          band.setAttribute('width', String(bandWidth))
          band.setAttribute('height', String(origin.height))
          band.setAttribute('transform', `skewX(${skew})`)
        })
        const keyframes = [
          { transform: `translateX(${-bandWidth}px)` },
          { transform: `translateX(${period - bandWidth}px)` },
        ]
        if (!animation) {
          const effect = new KeyframeEffect(moving, keyframes, {
            duration,
            delay,
            easing: 'linear',
            iterations: Infinity,
            fill: 'backwards',
          })
          animation = new Animation(effect, doc.timeline)
          animation.id = SKELETON_WAVE_ANIMATION
          start ??= Number(doc.timeline.currentTime)
          animation.startTime = start
        } else {
          ;(animation.effect as KeyframeEffect).setKeyframes(keyframes)
          animation.effect?.updateTiming({ duration, delay })
        }
        layout = nextLayout
      }
      const shift = scroller
        ? (scroller.scrollLeft + scrollLayer(scroller).physicalTop() * tilt) %
          period
        : 0
      offset.setAttribute('transform', `translate(${-shift} 0)`)
    }
    const schedule = () => {
      if (request) return
      request = requestAnimationFrame(() => {
        request = 0
        measure()
      })
    }
    const measureCommit = () => {
      if (request) cancelAnimationFrame(request)
      request = 0
      measure()
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const resize = new ResizeObserver(schedule)
    const mutations = new MutationObserver(measureCommit)
    measure()
    resize.observe(frame)
    mutations.observe(frame, { childList: true, subtree: true })
    frame.addEventListener('scroll', schedule, { capture: true, passive: true })
    motion.addEventListener('change', schedule)
    return () => {
      cancelAnimationFrame(request)
      resize.disconnect()
      mutations.disconnect()
      motion.removeEventListener('change', schedule)
      frame.removeEventListener('scroll', schedule, true)
      animation?.cancel()
      layer.remove()
      timing.remove()
    }
  }, [active, frameRef, id])
}

/**
 * Длительность (мс) и кривая движения строк (ADR 0107) — из токенов темы у узла грида:
 * вычисленный переход учитывает переопределения темы и уменьшенное движение (MO3).
 */
export const rowMotionTiming = (node: HTMLElement) => {
  const probe = document.createElement('span')
  probe.style.transition =
    'opacity var(--tsr-comp-row-motion-duration) var(--tsr-comp-motion-easing)'
  node.append(probe)
  const { transitionDuration, transitionTimingFunction } =
    getComputedStyle(probe)
  probe.remove()
  const value = parseFloat(transitionDuration)
  return {
    duration: transitionDuration.endsWith('ms') ? value : value * 1000,
    easing: transitionTimingFunction,
  }
}

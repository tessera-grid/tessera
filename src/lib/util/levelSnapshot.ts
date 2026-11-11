/**
 * Снимок уходящего уровня поповера (ADR 0079): разметка без обработчиков, ролей и фокуса уезжает
 * в сторону на слое снимков, пока новый уровень въезжает. Классы снимка задаёт вид на слое
 * снимков: `data-leave-forward` и `data-leave-back`. Общий для разделов меню и уровней поповера.
 */
export type LevelDirection = 'forward' | 'back'

export const snapshotLevel = (
  current: HTMLElement | null,
  host: HTMLElement | null,
  towards: LevelDirection,
) => {
  if (!current || !host) return
  const ghost = current.cloneNode(true) as HTMLElement
  ghost.querySelectorAll('[id], [role], [tabindex]').forEach(node => {
    node.removeAttribute('id')
    node.removeAttribute('role')
    node.removeAttribute('tabindex')
  })
  ghost.removeAttribute('data-menu-level')
  ghost.removeAttribute('data-popup-level')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.setAttribute('inert', '')
  ghost.className =
    (towards === 'forward'
      ? host.dataset.leaveForward
      : host.dataset.leaveBack) ?? ''
  ghost.style.width = `${current.offsetWidth}px`
  host.replaceChildren(ghost)
  void Promise.all(
    ghost.getAnimations().map(animation => animation.finished),
  ).then(
    () => ghost.remove(),
    () => ghost.remove(),
  )
}

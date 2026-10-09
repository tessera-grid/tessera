// Одна фаза блика подсветки на все элементы цели (ADR 0080, §5): строка, ячейки колонки,
// её заголовок и футер монтируются в разное время, а виртуализация пересоздаёт ячейки.
// Каждая анимация блика при старте получает начало — момент постановки подсветки.
import { useEffect } from 'react'

const SHIMMER = /highlight-shimmer/

export const ShimmerSync = ({
  getScrollElement,
}: {
  getScrollElement: () => HTMLElement | null
}) => {
  useEffect(() => {
    const root = getScrollElement()
    if (!root) {
      return
    }
    const onStart = (event: AnimationEvent) => {
      if (!SHIMMER.test(event.animationName)) {
        return
      }
      const target = event.target as HTMLElement
      const start = Number(target.dataset.highlightStart)
      if (!Number.isFinite(start)) {
        return
      }
      for (const animation of target.getAnimations({ subtree: true })) {
        if (
          (animation as CSSAnimation).animationName === event.animationName &&
          (animation.effect as KeyframeEffect | null)?.target === target
        ) {
          animation.startTime = start
        }
      }
    }
    root.addEventListener('animationstart', onStart)
    return () => root.removeEventListener('animationstart', onStart)
  }, [getScrollElement])
  return null
}

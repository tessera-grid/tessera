import {
  type AutoScrollOptions,
  type DropAnimation,
  type DropAnimationFunction,
  type MeasuringConfiguration,
  MeasuringStrategy,
  type Modifier,
  defaultDropAnimation,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { rowMotionTiming } from '../rowMotion/rowMotionTiming'

const ADJUST_OVERLAY_POSITION_Y = 10
const AUTOSCROLL_THRESHOLD = 0.2
const ACCELERATION_SCROLL_Y = 20
const ACCELERATION_SCROLL_X = 10

export const adjustOverlayPosition: Modifier = ({ transform }) => {
  return {
    ...transform,
    y: transform.y - ADJUST_OVERLAY_POSITION_Y,
  }
}

// Live region и инструкции dnd-kit — в body: внутри role="table" axe допускает
// только строки (ADR 0036, PQ4).
export const dndAccessibility = {
  container: typeof document === 'undefined' ? undefined : document.body,
}

export const measuring: MeasuringConfiguration = {
  droppable: {
    strategy: MeasuringStrategy.WhileDragging,
  },
}

export const dropAnimationConfig: DropAnimation = {
  keyframes({ transform }) {
    return [
      { opacity: 1, transform: CSS.Transform.toString(transform.initial) },
      {
        opacity: 0,
        transform: CSS.Transform.toString({
          ...transform.final,
          x: transform.final.x + 5,
          y: transform.final.y + 5,
        }),
      },
    ]
  },
  easing: 'ease-out',
  sideEffects({ active }) {
    active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: defaultDropAnimation.duration,
      easing: defaultDropAnimation.easing,
    })
  },
}

/**
 * Бросок строки с движением (ADR 0107, RM10): облако долетает до слота, слот
 * проявляется строкой; темп — токены движения строк, без них — мгновенно.
 */
export const rowDropAnimation: DropAnimationFunction = ({
  active,
  dragOverlay,
  transform,
}) => {
  const { duration, easing } = rowMotionTiming(active.node)
  if (!duration) return
  const final = {
    ...transform,
    x: transform.x - (dragOverlay.rect.left - active.rect.left),
    y: transform.y - (dragOverlay.rect.top - active.rect.top),
  }
  active.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing })
  return dragOverlay.node
    .animate(
      [
        { transform: CSS.Transform.toString(transform) },
        { transform: CSS.Transform.toString(final) },
      ],
      { duration, easing, fill: 'forwards' },
    )
    .finished.then(() => undefined)
}

/**
 * Указатель в ближней к краю половине зоны автопрокрутки: dnd-kit крутит быстрее, чем
 * успевает отрисоваться содержимое, — быстрая прокрутка (ADR 0107, RM25). Скорость не
 * годится в признак: частота шагов автопрокрутки зависит от движка и загрузки машины.
 */
export const isNearAutoScrollEdge = (
  rect: { top: number; bottom: number; height: number },
  y: number,
) => {
  const zone = rect.height * AUTOSCROLL_THRESHOLD
  return y >= rect.bottom - zone / 2 || y <= rect.top + zone / 2
}

export const autoScrollOnlyY: AutoScrollOptions = {
  acceleration: ACCELERATION_SCROLL_Y,
  threshold: {
    x: 0,
    y: AUTOSCROLL_THRESHOLD,
  },
}

export const autoScrollOnlyX: AutoScrollOptions = {
  acceleration: ACCELERATION_SCROLL_X,
  threshold: {
    x: AUTOSCROLL_THRESHOLD,
    y: 0,
  },
}

/**
 * Больше самого большого z-index MUI4, чтобы draggable-объекты ничем не
 * перекрывались.
 * @link https://v4.mui.com/ru/customization/z-index/
 */
export const Z_INDEX = 1501

/** Сдвиг указателя, после которого нажатие — перетаскивание, а не клик (px). */
export const DRAG_ACTIVATION_DISTANCE = 5

/** Опции сенсоров: короткое нажатие без сдвига — клик по ручке (меню, ADR 0034). */
export const sensorOptions = {
  activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE },
}

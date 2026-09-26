import {
  type AutoScrollOptions,
  type DropAnimation,
  type MeasuringConfiguration,
  MeasuringStrategy,
  type Modifier,
  defaultDropAnimation,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

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

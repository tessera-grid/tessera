import {
  type AutoScrollOptions,
  type MeasuringConfiguration,
  MeasuringStrategy,
  type Modifier,
} from '@dnd-kit/core'

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

const translationOf = (style: CSSStyleDeclaration) => {
  const matrix =
    style.transform === 'none'
      ? undefined
      : new DOMMatrixReadOnly(style.transform)
  const [x = '0', y = '0'] =
    style.translate === 'none' ? [] : style.translate.split(' ')
  return {
    x: (matrix?.m41 ?? 0) + parseFloat(x),
    y: (matrix?.m42 ?? 0) + parseFloat(y),
  }
}

/**
 * Место строки в раскладке: без `transform` dnd-kit и без `translate` движения строк
 * (ADR 0107). Группа, раскрытая посреди сессии, сдвигает строки переходом `translate`
 * (ADR 0109): замер с ним поставил бы слот под облако, и местом броска стал бы он сам.
 */
export const getLayoutRect = (element: Element) => {
  const rect = element.getBoundingClientRect()
  const shift = translationOf(getComputedStyle(element))
  const top = rect.top - shift.y
  const left = rect.left - shift.x
  return {
    top,
    left,
    width: rect.width,
    height: rect.height,
    bottom: top + rect.height,
    right: left + rect.width,
  }
}

export const measuring: MeasuringConfiguration = {
  draggable: { measure: getLayoutRect },
  droppable: {
    measure: getLayoutRect,
    strategy: MeasuringStrategy.WhileDragging,
  },
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

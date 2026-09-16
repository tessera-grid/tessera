import {
  cloneElement,
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  /** Текст подсказки */
  title: ReactNode
  /** Триггер подсказки (единственный элемент) */
  children: ReactElement
  /** Отключить подсказку (триггер рендерится без неё) */
  disabled?: boolean
  /** Сторона появления */
  side?: TooltipSide
  /** Задержка перед показом, мс */
  delayDuration?: number
}

// Base UI-попап тянет floating-ui-позиционирование — держим его в отдельном чанке
// и подгружаем при первом наведении. Триггер рендерится эагерно, открытием
// управляет обёртка (контролируемый `open`), поэтому догрузка чанка лишь
// задерживает появление попапа, но не теряет наведение.
const TooltipPopup = lazy(() => import('./TooltipImpl'))

const mergeRefs =
  <T,>(...refs: (Ref<T> | undefined)[]) =>
  (node: T) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as { current: T | null }).current = node
    }
  }

const compose =
  <E,>(...handlers: (((event: E) => void) | undefined)[]) =>
  (event: E) => {
    for (const handler of handlers) handler?.(event)
  }

/**
 * Подсказка на базе Base UI (фундамент shadcn). Нативная замена MUI Tooltip.
 * При `disabled`/пустом заголовке триггер рендерится без Base UI и без ленивого
 * чанка вовсе.
 */
export const Tooltip = ({
  title,
  children,
  disabled = false,
  side = 'top',
  delayDuration = 200,
}: TooltipProps) => {
  const anchorRef = useRef<HTMLElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Монтируем чанк попапа только после первого взаимодействия и держим смонтированным.
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  const show = useCallback(() => {
    setMounted(true)
    clearTimeout(timer.current)
    if (delayDuration > 0) {
      timer.current = setTimeout(() => setOpen(true), delayDuration)
    } else {
      setOpen(true)
    }
  }, [delayDuration])

  const hide = useCallback(() => {
    clearTimeout(timer.current)
    setOpen(false)
  }, [])

  if (disabled || !title) {
    return children
  }

  // В React 19 ref живёт в props (обращение к element.ref устарело и предупреждает).
  const childProps = children.props as {
    ref?: Ref<HTMLElement>
    onPointerEnter?: (event: PointerEvent) => void
    onPointerLeave?: (event: PointerEvent) => void
    onFocus?: (event: FocusEvent) => void
    onBlur?: (event: FocusEvent) => void
  }
  const childRef = childProps.ref

  const trigger = cloneElement(children, {
    ref: mergeRefs(anchorRef, childRef),
    onPointerEnter: compose(childProps.onPointerEnter, show),
    onPointerLeave: compose(childProps.onPointerLeave, hide),
    onFocus: compose(childProps.onFocus, show),
    onBlur: compose(childProps.onBlur, hide),
  } as Partial<typeof childProps> & { ref: Ref<HTMLElement> })

  return (
    <>
      {trigger}
      {mounted && (
        <Suspense fallback={null}>
          <TooltipPopup
            open={open}
            onOpenChange={setOpen}
            anchor={anchorRef}
            side={side}
            title={title}
          />
        </Suspense>
      )}
    </>
  )
}

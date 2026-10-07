import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  type ElementType,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'

import { assignRef } from '../assignRef'

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

/** Пауза перед закрытием: указатель успевает перейти с триггера на подсказку. */
const CLOSE_DELAY = 150

interface TriggerProps {
  ref?: Ref<HTMLElement>
  onPointerEnter?: (event: PointerEvent) => void
  onPointerLeave?: (event: PointerEvent) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
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

  // В React 19 ref живёт в props (обращение к element.ref устарело и предупреждает).
  const {
    ref: childRef,
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
  } = children.props as TriggerProps
  const setAnchor = useCallback(
    (node: HTMLElement | null) => {
      anchorRef.current = node
      assignRef(childRef, node)
    },
    [childRef],
  )

  const show = () => {
    setMounted(true)
    clearTimeout(timer.current)
    if (delayDuration > 0) {
      timer.current = setTimeout(() => setOpen(true), delayDuration)
    } else {
      setOpen(true)
    }
  }

  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
  }

  const hideSoon = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY)
  }

  const keepOpen = () => clearTimeout(timer.current)

  if (disabled || !title) {
    return children
  }

  const Trigger = children.type as ElementType

  return (
    <>
      <Trigger
        key={children.key}
        {...(children.props as object)}
        ref={setAnchor}
        onPointerEnter={(event: PointerEvent) => {
          onPointerEnter?.(event)
          show()
        }}
        onPointerLeave={(event: PointerEvent) => {
          onPointerLeave?.(event)
          hideSoon()
        }}
        onFocus={(event: FocusEvent) => {
          onFocus?.(event)
          show()
        }}
        onBlur={(event: FocusEvent) => {
          onBlur?.(event)
          hide()
        }}
      />
      {mounted && (
        <Suspense fallback={null}>
          <TooltipPopup
            open={open}
            onOpenChange={setOpen}
            anchor={anchorRef}
            side={side}
            title={title}
            onPointerEnter={keepOpen}
            onPointerLeave={hideSoon}
          />
        </Suspense>
      )}
    </>
  )
}

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type TouchEvent,
} from 'react'

import { assignRef } from '../assignRef'
import { LONG_PRESS_MS, LONG_PRESS_SLOP } from '../../util/longPress'
import { preloadable } from '../../util/preloadable'
import { REACT_MAJOR } from '../../util/reactVersion'

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
  /** Показывать, только когда текст триггера обрезан `…` (ADR 0083). */
  overflowOnly?: boolean
  /**
   * На касаниях подсказку показывает удержание пальца (ADR 0224, MH3); касание, открывшее её, не
   * нажимает триггер.
   */
  longPress?: boolean
  /**
   * Показать подсказку извне — фокусом с клавиатуры на её владельце (ADR 0232, KX9); наведение и
   * фокус триггера показывают её и без этого.
   */
  shown?: boolean
}

/**
 * Текст шире или выше своего блока. Ширина — по `Range`: Firefox округляет
 * `scrollWidth` вверх. Высота у `line-clamp` — по двум сигналам: Chromium и Firefox
 * дают скрытые строки в `scrollHeight`, WebKit — только в `Range`; допуск в полстроки
 * гасит разницу между высотой глифов и `line-height`.
 */
const isOverflowing = (element: HTMLElement | null) => {
  if (!element) return false
  const range = document.createRange()
  range.selectNodeContents(element)
  const text = range.getBoundingClientRect()
  const box = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
  return (
    text.width > box.width + 1 ||
    element.scrollHeight > element.clientHeight + 1 ||
    text.height > box.height + line / 2
  )
}

// Base UI-попап тянет floating-ui-позиционирование — держим его в отдельном чанке
// и подгружаем при первом наведении. Триггер рендерится эагерно, открытием
// управляет обёртка (контролируемый `open`), поэтому догрузка чанка лишь
// задерживает появление попапа, но не теряет наведение.
export const TooltipPopup = preloadable(() =>
  import('./TooltipImpl').then(module => module.default),
)

/**
 * Последний ввод — клавиатура или указатель. Фокус открывает подсказку только после
 * клавиатуры: меню возвращает фокус на свою кнопку и после выбора мышью, а браузерный
 * `:focus-visible` при переводе фокуса скриптом наследует признак предыдущего элемента.
 * Слушатели ставятся один раз, при первой подсказке, — импорт модуля их не ставит.
 */
let keyboardInput = false
let tracking = false
const trackInput = () => {
  if (tracking) return
  tracking = true
  document.addEventListener(
    'keydown',
    event => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey)
        keyboardInput = true
    },
    true,
  )
  document.addEventListener(
    'pointerdown',
    () => {
      keyboardInput = false
    },
    true,
  )
}

export const isKeyboardInput = () => keyboardInput

/** Пауза перед закрытием подсказки обрезанного текста: указатель успевает перейти на неё. */
const CLOSE_DELAY = 150

// React 19 кладёт ref элемента в props, React 18 — в `element.ref` (в 19 обращение к нему предупреждает).

const elementRef = (element: ReactElement): Ref<HTMLElement> | undefined =>
  REACT_MAJOR >= 19
    ? (element.props as TriggerProps).ref
    : (element as unknown as { ref?: Ref<HTMLElement> }).ref

interface TriggerProps {
  ref?: Ref<HTMLElement>
  onPointerEnter?: (event: PointerEvent) => void
  onPointerLeave?: (event: PointerEvent) => void
  onPointerDown?: (event: PointerEvent) => void
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerCancel?: (event: PointerEvent) => void
  onTouchEnd?: (event: TouchEvent) => void
  onContextMenu?: (event: MouseEvent) => void
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
  overflowOnly = false,
  longPress = false,
  shown,
}: TooltipProps) => {
  const anchorRef = useRef<HTMLElement | null>(null)
  useEffect(trackInput, [])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Монтируем чанк попапа только после первого взаимодействия и держим смонтированным.
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  // Показ извне — фокусом с клавиатуры на владельце; показанная однажды остаётся смонтированной
  // и доигрывает уход.
  if (shown && !mounted) setMounted(true)
  const visible = open || !!shown

  const childRef = elementRef(children)
  const {
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onTouchEnd,
    onContextMenu,
    onFocus,
    onBlur,
  } = children.props as TriggerProps
  // Удержание пальца: ждущее и открывшее подсказку.
  const press = useRef<{
    id: number
    x: number
    y: number
    timer: ReturnType<typeof setTimeout>
  } | null>(null)
  const [held, setHeld] = useState(false)
  const stopPress = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  const setAnchor = useCallback(
    (node: HTMLElement | null) => {
      anchorRef.current = node
      assignRef(childRef, node)
    },
    [childRef],
  )

  const show = () => {
    if (overflowOnly && !isOverflowing(anchorRef.current)) return
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
    setHeld(false)
  }

  // Подсказку, открытую удержанием, закрывают следующее касание и прокрутка.
  useEffect(() => {
    if (!held) return
    const close = (event: Event) => {
      if (
        event.type === 'pointerdown' &&
        anchorRef.current?.contains(event.target as Node)
      )
        return
      setOpen(false)
      setHeld(false)
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('scroll', close, true)
    }
  }, [held])
  useEffect(() => stopPress, [])

  const hideSoon = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY)
  }

  const keepOpen = () => clearTimeout(timer.current)

  const active = !disabled && !!title
  // Заголовок появился у триггера, уже сфокусированного с клавиатуры или под курсором
  // (причина пришла ответом), — событий focus и pointerenter больше не будет. Только
  // появление, не монтирование: строки, проезжающие под курсором, подсказку не открывают.
  const wasActive = useRef(active)
  useEffect(() => {
    const anchor = anchorRef.current
    const appeared = active && !wasActive.current
    wasActive.current = active
    if (!appeared || !anchor) {
      return
    }
    const focused = keyboardInput && anchor === document.activeElement
    const hovered =
      anchor.matches(':hover') && (!overflowOnly || isOverflowing(anchor))
    if (focused || hovered) {
      setMounted(true)
      setOpen(true)
    }
  }, [active, overflowOnly])

  const Trigger = children.type as ElementType
  const handlers = active && {
    onPointerEnter: (event: PointerEvent) => {
      onPointerEnter?.(event)
      show()
    },
    onPointerLeave: (event: PointerEvent) => {
      onPointerLeave?.(event)
      // Палец, открывший подсказку удержанием, уходит с триггера при отпускании.
      if (held && event.pointerType === 'touch') return
      // Подсказку без обрезки указатель проходит насквозь (ADR 0100) — ждать его нечего.
      if (overflowOnly) hideSoon()
      else hide()
    },
    onPointerDown: (event: PointerEvent) => {
      onPointerDown?.(event)
      hide()
      stopPress()
      if (!longPress || event.pointerType !== 'touch' || !event.isPrimary)
        return
      const { pointerId: id, clientX: x, clientY: y } = event
      press.current = {
        id,
        x,
        y,
        timer: setTimeout(() => {
          press.current = null
          setMounted(true)
          setOpen(true)
          setHeld(true)
        }, LONG_PRESS_MS),
      }
    },
    onPointerMove: (event: PointerEvent) => {
      onPointerMove?.(event)
      const at = press.current
      if (
        at?.id === event.pointerId &&
        Math.hypot(event.clientX - at.x, event.clientY - at.y) > LONG_PRESS_SLOP
      )
        stopPress()
    },
    onPointerUp: (event: PointerEvent) => {
      onPointerUp?.(event)
      stopPress()
    },
    onPointerCancel: (event: PointerEvent) => {
      onPointerCancel?.(event)
      stopPress()
    },
    // Отпускание после удержания — не нажатие: без отмены браузер пришлёт `click`.
    onTouchEnd: (event: TouchEvent) => {
      onTouchEnd?.(event)
      if (held && event.cancelable) event.preventDefault()
    },
    // Своё удержание вместо системного меню Android.
    onContextMenu: (event: MouseEvent) => {
      onContextMenu?.(event)
      if (longPress && (press.current || held)) event.preventDefault()
    },
    onFocus: (event: FocusEvent) => {
      onFocus?.(event)
      // Только фокус с клавиатуры: фокус от нажатия мышью или возвращённый после
      // закрытия меню подсказку не открывает — указатель может быть уже далеко.
      if (keyboardInput) show()
    },
    onBlur: (event: FocusEvent) => {
      onBlur?.(event)
      hide()
    },
  }

  // Один элемент триггера при любом заголовке: появление подсказки не перемонтирует
  // его — иначе фокус на нём теряется (Firefox, WebKit). Ключ — только заданный:
  // `key={null}` стал бы ключом «null».
  return (
    <>
      <Trigger
        {...(children.key === null ? {} : { key: children.key })}
        {...(children.props as object)}
        ref={setAnchor}
        {...handlers}
      />
      {active && mounted && (
        <TooltipPopup.Component
          fallback={null}
          open={visible}
          onOpenChange={setOpen}
          anchor={anchorRef}
          side={side}
          title={title}
          interactive={overflowOnly}
          onPointerEnter={keepOpen}
          onPointerLeave={hideSoon}
        />
      )}
    </>
  )
}

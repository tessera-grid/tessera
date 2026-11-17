// Тултип у обрезанного текста ячейки (ADR 0075): один на грид. Обработчики висят на
// контейнере прокрутки, обрезка проверяется у текста под указателем в момент наведения.
import { useEffect, useRef, useState } from 'react'

import { INPUT_MODALITY_ATTR } from '../core/inputModality'
import {
  OVERFLOW_TITLE as TITLE,
  SHOW_FULL_TEXT_EVENT,
  isTruncated,
} from '../core/overflowText'
import { TooltipPopup } from '../ui/Tooltip/Tooltip'
import { LONG_PRESS_MS, LONG_PRESS_SLOP } from '../util/longPress'
const INTERACTIVE =
  'button, a, input, select, textarea, [role="button"], [contenteditable="true"]'
const OPEN_DELAY = 200
const CLOSE_DELAY = 150

const titleUnder = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element) || target.closest(INTERACTIVE)) {
    return null
  }
  return target.closest<HTMLElement>(TITLE)
}

interface Controls {
  hide: () => void
  hideSoon: () => void
  keepOpen: () => void
}

interface OverflowTooltipProps {
  getScrollElement: () => HTMLElement | null
}

export const OverflowTooltip = ({ getScrollElement }: OverflowTooltipProps) => {
  // Якорь попапа меняется только при открытии: при закрытии попап доигрывает выход на месте.
  const anchorRef = useRef<HTMLElement | null>(null)
  const controls = useRef<Controls | null>(null)
  const [tip, setTip] = useState<{ text: string; open: boolean }>()

  useEffect(() => {
    const root = getScrollElement()
    if (!root) {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    // Текст, у которого тултип открыт или ждёт задержки.
    let current: HTMLElement | null = null
    let shown = false
    let pressed = false
    /** Удержание пальцем обрезанного текста без контекстного меню (ADR 0231, §6). */
    let press: {
      id: number
      x: number
      y: number
      timer: ReturnType<typeof setTimeout>
    } | null = null
    let held = false
    const stopPress = () => {
      if (press) clearTimeout(press.timer)
      press = null
    }

    const hide = () => {
      clearTimeout(timer)
      current = null
      if (shown) {
        shown = false
        setTip(prev => prev && { ...prev, open: false })
      }
    }
    const hideSoon = () => {
      clearTimeout(timer)
      timer = setTimeout(hide, CLOSE_DELAY)
    }
    const keepOpen = () => clearTimeout(timer)
    const show = (title: HTMLElement, delay = OPEN_DELAY) => {
      if (title === current) {
        keepOpen()
        return
      }
      hide()
      current = title
      void TooltipPopup.load()
      // Обрезка — на момент показа: кнопки ячейки к этому времени уже раскрылись.
      timer = setTimeout(() => {
        const text = title.textContent?.trim()
        if (text && title.isConnected && isTruncated(title)) {
          anchorRef.current = title
          shown = true
          setTip({ text, open: true })
        }
      }, delay)
    }
    controls.current = { hide, hideSoon, keepOpen }

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.buttons !== 0 || pressed) {
        return
      }
      const title = titleUnder(event.target)
      if (title) {
        show(title)
      } else if (current) {
        hideSoon()
      }
    }
    const onPointerLeave = () => {
      if (current) {
        hideSoon()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      pressed = true
      held = false
      hide()
      stopPress()
      // С контекстным меню удержание открывает его, а текст — его пункт (ADR 0231, §6).
      if (
        event.pointerType !== 'touch' ||
        !event.isPrimary ||
        root.hasAttribute('data-context-menu-touch')
      )
        return
      const title = titleUnder(event.target)
      if (!title) return
      press = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        timer: setTimeout(() => {
          press = null
          held = true
          show(title, 0)
        }, LONG_PRESS_MS),
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (
        press?.id === event.pointerId &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >
          LONG_PRESS_SLOP
      )
        stopPress()
    }
    const onPointerUp = () => {
      pressed = false
      stopPress()
    }
    // Отпускание после удержания — не нажатие на ячейку.
    const onTouchEnd = (event: TouchEvent) => {
      if (held && event.cancelable) event.preventDefault()
      held = false
    }
    const onShowFullText = (event: Event) => {
      const title = (event.target as Element | null)?.closest?.<HTMLElement>(
        TITLE,
      )
      if (title) show(title, 0)
    }
    const onScroll = () => {
      stopPress()
      hide()
    }
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (
        !(target instanceof HTMLElement) ||
        // Фокус от клавиатуры: `:focus-visible` или последний ввод — клавиша; фокусу от скрипта
        // после мыши браузер `:focus-visible` не даёт, как и кольцу фокуса (ADR 0084, CB5).
        !(
          target.matches(':focus-visible') ||
          document.documentElement.getAttribute(INPUT_MODALITY_ATTR) ===
            'keyboard'
        ) ||
        target.closest(INTERACTIVE)
      ) {
        return
      }
      const title = target.querySelector<HTMLElement>(TITLE)
      if (title) {
        show(title)
      }
    }

    root.addEventListener('pointerover', onPointerOver)
    root.addEventListener('pointerleave', onPointerLeave)
    root.addEventListener('pointerdown', onPointerDown, true)
    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('touchend', onTouchEnd)
    root.addEventListener(SHOW_FULL_TEXT_EVENT, onShowFullText)
    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', hide)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      clearTimeout(timer)
      stopPress()
      controls.current = null
      root.removeEventListener('pointerover', onPointerOver)
      root.removeEventListener('pointerleave', onPointerLeave)
      root.removeEventListener('pointerdown', onPointerDown, true)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener(SHOW_FULL_TEXT_EVENT, onShowFullText)
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', hide)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [getScrollElement])

  if (!tip) {
    return null
  }
  return (
    <TooltipPopup.Component
      fallback={null}
      open={tip.open}
      // Escape и нажатие вне тултипа закрывает сам Base UI.
      onOpenChange={next => {
        if (!next) {
          controls.current?.hide()
        }
      }}
      anchor={anchorRef}
      side="top"
      title={tip.text}
      interactive
      onPointerEnter={() => controls.current?.keepOpen()}
      onPointerLeave={() => controls.current?.hideSoon()}
    />
  )
}

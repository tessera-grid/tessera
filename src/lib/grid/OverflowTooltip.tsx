// Тултип у обрезанного текста ячейки (ADR 0075): один на грид. Обработчики висят на
// контейнере прокрутки, обрезка проверяется у текста под указателем в момент наведения.
import { useEffect, useRef, useState } from 'react'

import { TooltipPopup } from '../ui/Tooltip/Tooltip'

// Значение строки группы обрезается отдельно от числа строк (ADR 0184, §8).
const TITLE = '[data-group-value], .data-grid__cell-wrapper-title'
const INTERACTIVE =
  'button, a, input, select, textarea, [role="button"], [contenteditable="true"]'
const OPEN_DELAY = 200
const CLOSE_DELAY = 150

/** Текст не помещается в свой контейнер и обрезан многоточием. */
const isTruncated = (element: HTMLElement) =>
  element.scrollWidth > element.clientWidth

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
    const show = (title: HTMLElement) => {
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
      }, OPEN_DELAY)
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
    const onPointerDown = () => {
      pressed = true
      hide()
    }
    const onPointerUp = () => {
      pressed = false
    }
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (
        !(target instanceof HTMLElement) ||
        !target.matches(':focus-visible') ||
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
    root.addEventListener('scroll', hide, { passive: true })
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', hide)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      clearTimeout(timer)
      controls.current = null
      root.removeEventListener('pointerover', onPointerOver)
      root.removeEventListener('pointerleave', onPointerLeave)
      root.removeEventListener('pointerdown', onPointerDown, true)
      root.removeEventListener('scroll', hide)
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

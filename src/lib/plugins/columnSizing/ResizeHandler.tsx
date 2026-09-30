import {
  KeyboardEvent,
  MouseEvent,
  TouchEvent,
  memo,
  useCallback,
  useRef,
  useState,
} from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import {
  resizeCancelReason,
  type SessionCancelReason,
} from '../../core/cancelInteraction'
import { HandleMenu } from '../../grid/handleMenu/HandleMenu'
import styles from './ResizeHandler.module.css'
import '../../grid/cellControls/buttonVisibility.css'

/** Шаг изменения ширины стрелкой и Shift+стрелкой, px. */
const KEY_STEP = 10
const LARGE_KEY_STEP = 50
/** Сдвиг указателя, после которого нажатие — ресайз, а не клик (px). */
const CLICK_TOLERANCE = 3

export interface ResizeSplitterProps {
  isResizing: boolean
  onResize: (event: unknown) => void
  onResizeEnd: (event: unknown) => void
  /** Протяжка завершилась без результата (ADR 0040, §1). */
  onResizeCancel: (reason: SessionCancelReason) => void
  /** Escape во время протяжки — отменить её. */
  onEscape: () => void
  onResetSize: (event: unknown) => void
  /** Изменить ширину на `delta` px с клавиатуры или из меню. */
  onResizeBy: (delta: number) => void
  size: number
  minSize: number
  /** `undefined` — без верхней границы. */
  maxSize?: number
  disabled?: boolean
}

export const ResizeHandler = memo(
  ({
    isResizing,
    onResize,
    onResizeEnd,
    onResizeCancel,
    onEscape,
    onResetSize,
    onResizeBy,
    size,
    minSize,
    maxSize,
    disabled = false,
  }: ResizeSplitterProps) => {
    const labels = useLocalization()
    const wrapperRef = useRef<HTMLDivElement>(null)
    const separatorRef = useRef<HTMLSpanElement>(null)
    const pressedX = useRef<number | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)

    const onResizeStart = useCallback(
      (event: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
        pressedX.current = 'clientX' in event ? event.clientX : null
        document.body.style.cursor = 'col-resize'
        onResize(event)
        const onKey = (evt: globalThis.KeyboardEvent) => {
          if (evt.key === 'Escape') {
            onEscape()
          }
        }
        const listener = (evt: unknown) => {
          // Отмена — без бизнес-колбэка успеха (ADR 0040, §1).
          const reason = resizeCancelReason(evt)
          if (reason) {
            onResizeCancel(reason)
          } else {
            onResizeEnd(evt)
          }
          document.removeEventListener('mouseup', listener)
          document.removeEventListener('touchend', listener)
          document.removeEventListener('keydown', onKey)
          document.body.style.cursor = 'default'
        }
        document.addEventListener('mouseup', listener)
        document.addEventListener('touchend', listener)
        document.addEventListener('keydown', onKey)
      },
      [onResizeEnd, onResizeCancel, onEscape, onResize],
    )

    // Клик без сдвига — меню ширины (WCAG 2.5.7, ADR 0034); протяжка — ресайз.
    const onClick = (event: MouseEvent<HTMLDivElement>) => {
      const start = pressedX.current
      pressedX.current = null
      if (
        disabled ||
        (start !== null && Math.abs(event.clientX - start) >= CLICK_TOLERANCE)
      ) {
        return
      }
      setMenuOpen(true)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
      const step = event.shiftKey ? LARGE_KEY_STEP : KEY_STEP
      if (event.key === 'ArrowLeft') {
        onResizeBy(-step)
      } else if (event.key === 'ArrowRight') {
        onResizeBy(step)
      } else if (event.key === 'Home') {
        onResetSize(event)
      } else {
        return
      }
      event.preventDefault()
    }

    const getMenuItems = () => [
      {
        id: 'widen',
        label: labels.widenColumn,
        disabled: maxSize !== undefined && size >= maxSize,
        onSelect: () => onResizeBy(LARGE_KEY_STEP),
      },
      {
        id: 'narrow',
        label: labels.narrowColumn,
        disabled: size <= minSize,
        onSelect: () => onResizeBy(-LARGE_KEY_STEP),
      },
      {
        id: 'reset',
        label: labels.resetColumnWidth,
        onSelect: () => onResetSize(undefined),
      },
    ]

    return (
      <>
        <div
          ref={wrapperRef}
          onClick={onClick}
          onMouseDown={onResizeStart}
          onTouchStart={onResizeStart}
          aria-disabled={disabled}
          className={clsx(
            styles.wrapper,
            'cell__button',
            'cell__button--hidden',
            'resize__handler--column',
          )}
          data-button-active={isResizing || menuOpen}
        >
          <div
            className={clsx(
              'resize__handler--column--background',
              styles.background,
            )}
          >
            <span
              ref={separatorRef}
              role="separator"
              tabIndex={disabled ? -1 : 0}
              aria-label={labels.resizeColumn}
              aria-orientation="vertical"
              aria-valuenow={Math.round(size)}
              aria-valuemin={minSize}
              aria-valuemax={maxSize}
              aria-disabled={disabled}
              onKeyDown={disabled ? undefined : onKeyDown}
              className={styles.handler}
            />
          </div>
        </div>
        {menuOpen && (
          <HandleMenu
            anchor={wrapperRef}
            focusTarget={separatorRef}
            label={labels.columnWidth}
            getItems={getMenuItems}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </>
    )
  },
)

ResizeHandler.displayName = 'ResizeHandler'

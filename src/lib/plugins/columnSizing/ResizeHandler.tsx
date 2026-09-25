import { KeyboardEvent, MouseEvent, TouchEvent, memo, useCallback } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import styles from './ResizeHandler.module.css'
import '../../grid/cellControls/buttonVisibility.css'

/** Шаг изменения ширины стрелкой и Shift+стрелкой, px. */
const KEY_STEP = 10
const LARGE_KEY_STEP = 50

export interface ResizeSplitterProps {
  isResizing: boolean
  onResize: (event: unknown) => void
  onResizeEnd: (event: unknown) => void
  onResetSize: (event: unknown) => void
  /** Изменить ширину на `delta` px с клавиатуры. */
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
    onResetSize,
    onResizeBy,
    size,
    minSize,
    maxSize,
    disabled = false,
  }: ResizeSplitterProps) => {
    const labels = useLocalization()
    const onResizeStart = useCallback(
      (event: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
        document.body.style.cursor = 'col-resize'
        onResize(event)
        const listener = (evt: unknown) => {
          onResizeEnd(evt)
          document.removeEventListener('mouseup', listener)
          document.removeEventListener('touchend', listener)
          document.body.style.cursor = 'default'
        }
        document.addEventListener('mouseup', listener)
        document.addEventListener('touchend', listener)
      },
      [onResizeEnd, onResize],
    )

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

    return (
      <div
        onDoubleClick={onResetSize}
        onMouseDown={onResizeStart}
        onTouchStart={onResizeStart}
        aria-disabled={disabled}
        className={clsx(
          styles.wrapper,
          'cell__button',
          'cell__button--hidden',
          'resize__handler--column',
        )}
        data-button-active={isResizing}
      >
        <div
          className={clsx(
            'resize__handler--column--background',
            styles.background,
          )}
        >
          <span
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
    )
  },
)

ResizeHandler.displayName = 'ResizeHandler'

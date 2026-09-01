import { MouseEvent, TouchEvent, memo, useCallback } from 'react'

import clsx from 'clsx'

import styles from './ResizeHandler.module.css'
import '../../grid/cellControls/buttonVisibility.css'

export interface ResizeSplitterProps {
  isResizing: boolean
  onResize: (event: unknown) => void
  onResizeEnd: (event: unknown) => void
  onResetSize: (event: unknown) => void
  disabled?: boolean
}

export const ResizeHandler = memo(
  ({
    isResizing,
    onResize,
    onResizeEnd,
    onResetSize,
    disabled = false,
  }: ResizeSplitterProps) => {
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
            aria-disabled={disabled}
            className={styles.handler}
          />
        </div>
      </div>
    )
  },
)

ResizeHandler.displayName = 'ResizeHandler'

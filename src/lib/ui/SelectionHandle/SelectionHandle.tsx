import { forwardRef, type HTMLAttributes } from 'react'

import clsx from 'clsx'

import styles from './SelectionHandle.module.css'

export interface SelectionHandleProps extends HTMLAttributes<HTMLSpanElement> {
  /** `square` — маркер мыши, `circle` — маркер пальца (ADR 0198). */
  shape?: 'square' | 'circle'
}

/**
 * Маркер угла выделения (ADR 0198): зона нажатия с меткой по центру. Место задаёт
 * потребитель — центр зоны ставится в точку `left`/`top`. Для скринридера маркера нет:
 * его заменяют Shift+клик и Shift+стрелки.
 */
export const SelectionHandle = forwardRef<
  HTMLSpanElement,
  SelectionHandleProps
>(({ shape = 'square', className, ...rest }, ref) => (
  <span
    ref={ref}
    aria-hidden="true"
    data-selection-handle={shape}
    className={clsx(styles.handle, className)}
    {...rest}
  >
    <span className={clsx(styles.mark, styles[shape])} />
  </span>
))

SelectionHandle.displayName = 'SelectionHandle'

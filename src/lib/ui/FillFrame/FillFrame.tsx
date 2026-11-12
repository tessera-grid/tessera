import { forwardRef, type HTMLAttributes } from 'react'

import clsx from 'clsx'

import styles from './FillFrame.module.css'

/**
 * Рамка цели протяжки значения (ADR 0219, §4): прямоугольник ячеек, куда ляжет протяжка.
 * Место и размер задаёт потребитель через `left`/`top`/`width`/`height`; для скринридера рамки
 * нет — итог протяжки объявляет запись.
 */
export const FillFrame = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ className, ...rest }, ref) => (
  <span
    ref={ref}
    aria-hidden="true"
    data-fill-frame=""
    className={clsx(styles.frame, className)}
    {...rest}
  />
))

FillFrame.displayName = 'FillFrame'

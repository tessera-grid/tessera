import { HTMLAttributes, ReactNode, memo } from 'react'

import clsx from 'clsx'

import styles from './Bubble.module.css'

export interface BubbleProps extends HTMLAttributes<HTMLSpanElement> {
  /** `sm` — счётчик, `dot` — точка без содержимого. */
  size?: 'sm' | 'dot'
  /**
   * `active` — знак включённого состояния (ADR 0062), `draft` — неприменённое (ADR 0178),
   * `error` — отказ действия (ADR 0078), `accent` — прочие счётчики.
   */
  tone?: 'accent' | 'active' | 'draft' | 'error'
  children?: ReactNode
}

// Позиционирование задаёт потребитель через className — пузырёк только рисует себя.
export const Bubble = memo(
  ({
    size = 'sm',
    tone = 'accent',
    className,
    children,
    ...rest
  }: BubbleProps) => (
    <span
      className={clsx(styles.bubble, styles[size], styles[tone], className)}
      {...rest}
    >
      {children}
    </span>
  ),
)

Bubble.displayName = 'Bubble'

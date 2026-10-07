import { HTMLAttributes, ReactNode, memo } from 'react'

import clsx from 'clsx'

import styles from './Bubble.module.css'

export interface BubbleProps extends HTMLAttributes<HTMLSpanElement> {
  /** `dot` — точка без содержимого. */
  size?: 'sm' | 'md' | 'dot'
  /** `active` — знак включённого состояния (ADR 0062), `accent` — прочие счётчики. */
  tone?: 'accent' | 'active'
  children?: ReactNode
}

// Позиционирование задаёт потребитель через className — пузырёк только рисует себя.
export const Bubble = memo(
  ({
    size = 'md',
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

import { HTMLAttributes, ReactNode, memo } from 'react'

import clsx from 'clsx'

import styles from './Bubble.module.css'

export interface BubbleProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md'
  children?: ReactNode
}

// Позиционирование задаёт потребитель через className — пузырёк только рисует себя.
export const Bubble = memo(
  ({ size = 'md', className, children, ...rest }: BubbleProps) => (
    <span className={clsx(styles.bubble, styles[size], className)} {...rest}>
      {children}
    </span>
  ),
)

Bubble.displayName = 'Bubble'

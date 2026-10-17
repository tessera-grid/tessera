/**
 * Заглушка (ADR 0123, ES11): иллюстрация или иконка, заголовок, описание и действие по
 * центру. Встроенные заглушки грида рисуются ею; приложение собирает ею свои.
 */
import type { HTMLAttributes, ReactNode } from 'react'

import clsx from 'clsx'

import { Tooltip } from '../Tooltip'

import styles from './Stub.module.css'

export interface StubProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title' | 'children'
> {
  /** Иллюстрация или иконка; сжимается в низкой области, чтобы текст был виден. */
  media?: ReactNode
  title: string
  /** Подробности: не больше двух строк, полный текст в тултипе. */
  description?: string
  /** Действие — кнопка кита. */
  action?: ReactNode
}

export const Stub = ({
  media,
  title,
  description,
  action,
  className,
  ...rest
}: StubProps) => (
  <div className={clsx(styles.stub, className)} {...rest}>
    {media && (
      <span className={styles.media} aria-hidden="true">
        {media}
      </span>
    )}
    <p className={styles.title}>{title}</p>
    {description && (
      <Tooltip title={description} overflowOnly>
        <p className={styles.description}>{description}</p>
      </Tooltip>
    )}
    {action}
  </div>
)

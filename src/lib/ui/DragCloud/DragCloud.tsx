/**
 * Облачко перетаскивания кита (ADR 0183, PK21): визуальный клон того, что тянут, — строки или
 * колонки. Одно на обоих: скругление, тень, прозрачность и фон перетаскивания, тон ошибки там,
 * где бросить нельзя (ADR 0137), счётчик вложенных строк — `Bubble` кита в углу. Содержимое —
 * от грида: ручка и первая ячейка строки, заголовок с кнопками у колонки.
 */
import type { HTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

import clsx from 'clsx'

import { Bubble } from '../Bubble'

import styles from './DragCloud.module.css'

export interface DragCloudProps extends HTMLAttributes<HTMLDivElement> {
  /** Строка — карточка высотой строки; колонка — шириной заголовка из `style`. */
  kind: 'row' | 'column'
  /** Число вложенных строк — бабл в правом верхнем углу облачка строки. */
  count?: number
  /** Бросить сюда нельзя — тон ошибки. */
  invalid?: boolean
  /** Класс самого облачка; `className` — у его корня. */
  cloudClassName?: string
  children?: ReactNode
}

export const DragCloud = forwardRef<HTMLDivElement, DragCloudProps>(
  (
    { kind, count, invalid, className, cloudClassName, children, ...rest },
    ref,
  ) => {
    const cloud = (
      <div
        className={clsx(styles.cloud, cloudClassName)}
        data-drag-cloud=""
        data-invalid={invalid || undefined}
      >
        {children}
      </div>
    )
    if (kind === 'column') {
      return (
        <div
          {...rest}
          ref={ref}
          className={clsx(styles.cloud, className, cloudClassName)}
          data-drag-cloud=""
          data-invalid={invalid || undefined}
        >
          {children}
        </div>
      )
    }
    return (
      <div {...rest} ref={ref} className={clsx(styles.row, className)}>
        {cloud}
        {count !== undefined && (
          <Bubble className={styles.bubble}>{count}</Bubble>
        )}
      </div>
    )
  },
)
DragCloud.displayName = 'DragCloud'

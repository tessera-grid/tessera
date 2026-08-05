import { CSSProperties, memo } from 'react'

import clsx from 'clsx'

import styles from './Skeleton.module.css'

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  animation?: 'wave' | false
  className?: string
  style?: CSSProperties
}

/**
 * Плейсхолдер-скелетон для загрузки данных.
 * Заменяет прежний Skeleton из внешней UI-библиотеки.
 */
export const Skeleton = memo(
  ({ width, height, animation = 'wave', className, style }: SkeletonProps) => (
    <span
      className={clsx(
        styles.skeleton,
        animation === 'wave' && styles.wave,
        className,
      )}
      style={{ width, height, ...style }}
    />
  ),
)

Skeleton.displayName = 'Skeleton'

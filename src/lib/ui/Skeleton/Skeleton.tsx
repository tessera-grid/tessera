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

/** Скелет с волной: в рамке грида его блик — часть общей полосы (ADR 0121). */
export const SKELETON_WAVE_ATTRIBUTE = 'data-tsr-skeleton-wave'

/**
 * Плейсхолдер-скелетон для загрузки данных.
 */
export const Skeleton = memo(
  ({ width, height, animation = 'wave', className, style }: SkeletonProps) => (
    <span
      className={clsx(
        styles.skeleton,
        animation === 'wave' && styles.wave,
        className,
      )}
      {...(animation === 'wave' && { [SKELETON_WAVE_ATTRIBUTE]: '' })}
      style={{ width, height, ...style }}
    />
  ),
)

Skeleton.displayName = 'Skeleton'

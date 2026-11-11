/**
 * Строки-скелеты поповера (ADR 0183): высотой пункта, полоска — на поле пункта. Пока грузятся
 * пункты меню, панель раздела или список вариантов.
 */
import type { HTMLAttributes } from 'react'

import { Skeleton } from '../Skeleton'

import styles from './PopupSkeletonRows.module.css'

export interface PopupSkeletonRowsProps extends HTMLAttributes<HTMLDivElement> {
  count: number
  /** Длина полоски строки; по умолчанию — во всю строку. */
  width?: (index: number) => string
  height?: number | string
}

/** Атрибуты — каждой строке. */
export const PopupSkeletonRows = ({
  count,
  width = () => '100%',
  height = 'var(--tsr-comp-skeleton-menu-height)',
  ...rest
}: PopupSkeletonRowsProps) =>
  Array.from({ length: count }, (_, index) => (
    <div key={index} {...rest} className={styles.row}>
      <Skeleton width={width(index)} height={height} />
    </div>
  ))

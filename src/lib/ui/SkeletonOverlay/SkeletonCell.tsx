import { memo } from 'react'

import { Skeleton } from '../Skeleton'

/**
 * @description
 * Компонент скелетона для первой загрузки данных.
 */
export const SkeletonCell = memo(() => {
  return <Skeleton width="100%" height={16} animation="wave" />
})

SkeletonCell.displayName = 'SkeletonCell'

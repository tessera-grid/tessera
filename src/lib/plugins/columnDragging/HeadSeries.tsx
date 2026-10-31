/** Серия соседей в строке шапки — свой `SortableContext` (ADR 0052; ADR 0168, §2). */
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'

import type { HeadSeriesProps } from '../../core/pluginWrappers'

export const HeadSeries = ({ ids, children }: HeadSeriesProps) => (
  <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
    {children}
  </SortableContext>
)

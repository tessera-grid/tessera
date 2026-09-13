import type { DataGridProps } from './dataGridTypes'

export type GetTableHeightParams = Pick<DataGridProps, 'height' | 'maxHeight'>

export const getTableHeight = ({ height, maxHeight }: GetTableHeightParams) => {
  if (height === 'auto') {
    return {
      flex: 1,
      minHeight: 0,
      maxHeight,
    }
  }

  return {
    height,
    maxHeight,
  }
}

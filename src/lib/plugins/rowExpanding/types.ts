import type { Row } from '@tanstack/react-table'

export type RowExpandingPluginScope = 'rowExpanding'

export interface RowExpandingPluginParams {
  onExpandRow: (row: Row<any>, expanded: boolean) => void | Promise<any>
}

export type RowExpandingPlugin = Record<
  RowExpandingPluginScope,
  RowExpandingPluginParams
>

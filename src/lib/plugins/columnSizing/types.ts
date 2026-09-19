/** Hook-слайс плагина columnSizing. */
export type ColumnSizingPluginScope = 'columnSizing'

export interface ColumnSizingPluginParams {
  onColumnResizeEnd: (props: { id: string; width: number }) => void
}

export type ColumnSizingPlugin = Record<
  ColumnSizingPluginScope,
  ColumnSizingPluginParams
>

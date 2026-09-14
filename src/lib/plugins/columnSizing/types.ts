/** Фаза E — hook-слайс плагина columnSizing (v9). Идентичен v8-контракту. */
export type ColumnSizingPluginScope = 'columnSizing'

export interface ColumnSizingPluginParams {
  onColumnResizeEnd: (props: { id: string; width: number }) => void
}

export type ColumnSizingPlugin = Record<
  ColumnSizingPluginScope,
  ColumnSizingPluginParams
>

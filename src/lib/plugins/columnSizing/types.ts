/** Hook-слайс плагина columnSizing. */
export interface ColumnSizingHooks {
  onColumnResizeEnd: (props: { id: string; width: number }) => void
}

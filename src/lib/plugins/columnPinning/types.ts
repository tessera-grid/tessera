export type ColumnPinningPluginScope = 'columnPinning'

export interface ColumnPinningPluginParams {
  onTogglePin: (pinned: boolean) => void
}

export type ColumnPinningPlugin = Record<
  ColumnPinningPluginScope,
  ColumnPinningPluginParams
>

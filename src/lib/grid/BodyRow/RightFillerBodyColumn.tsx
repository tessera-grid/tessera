import { memo } from 'react'

export interface RightFillerBodyColumnProps {
  hasBorderTop?: boolean
  hasBorderBottom?: boolean
  hasBorderRight?: boolean
}

export const RightFillerBodyColumn = memo(
  ({
    hasBorderTop,
    hasBorderBottom,
    hasBorderRight,
  }: RightFillerBodyColumnProps) => {
    return (
      <div
        style={{
          flex: 1,
          borderTop: hasBorderTop
            ? '1px solid var(--data-grid-row-hovered-bg)'
            : undefined,
          borderBottom: hasBorderBottom
            ? '1px solid var(--data-grid-row-hovered-bg)'
            : undefined,
          borderRight: hasBorderRight
            ? '1px solid var(--data-grid-row-hovered-bg)'
            : undefined,
        }}
      />
    )
  },
)

RightFillerBodyColumn.displayName = 'RightFillerBodyColumn'

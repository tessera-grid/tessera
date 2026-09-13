import { memo } from 'react'

export interface RightFillerHeadColumnProps {
  gridRow: number
  hasBorderBottom?: boolean
  hasBorderRight?: boolean
}

export const RightFillerHeadColumn = memo(
  ({
    gridRow,
    hasBorderBottom,
    hasBorderRight,
  }: RightFillerHeadColumnProps) => {
    return (
      <div
        style={{
          gridRow,
          borderBottom: hasBorderBottom
            ? '1px solid var(--tsr-comp-row-hovered-bg)'
            : undefined,
          borderRight: hasBorderRight
            ? '1px solid var(--tsr-comp-row-hovered-bg)'
            : undefined,
        }}
      />
    )
  },
)

RightFillerHeadColumn.displayName = 'RightFillerHeadColumn'

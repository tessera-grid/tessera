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
            ? '1px solid var(--tsr-comp-cell-divider-color)'
            : undefined,
          borderBottom: hasBorderBottom
            ? '1px solid var(--tsr-comp-cell-divider-color)'
            : undefined,
          borderRight: hasBorderRight
            ? '1px solid var(--tsr-comp-cell-divider-color)'
            : undefined,
        }}
      />
    )
  },
)

RightFillerBodyColumn.displayName = 'RightFillerBodyColumn'

import { SVGProps } from 'react'

export type SvgIconProps = SVGProps<SVGSVGElement>

/**
 * Базовая обёртка для inline-SVG иконок таблицы.
 * Все иконки нарисованы на сетке 24×24 и используют currentColor,
 * поэтому цвет наследуется от родителя, а размер задаётся через width/height.
 */
export const SvgIcon = ({
  width = 24,
  height = 24,
  viewBox = '0 0 24 24',
  fill = 'currentColor',
  children,
  ...rest
}: SvgIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox={viewBox}
    fill={fill}
    aria-hidden
    {...rest}
  >
    {children}
  </svg>
)

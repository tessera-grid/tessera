import { EMPTY_STATE_SVG as emptyStateSvg } from './emptyStateSvg'

import type { IconComponent } from './IconsContext'

/**
 * Цвет картинки — доля текста грида на его фоне по светлоте исходного цвета: тёмные
 * детали темнее в светлой теме и светлее в тёмной. Исходные цвета почти белые, поэтому
 * шкала растянута, а белое чуть отходит от фона.
 */
const toThemeColor = (hex: string) => {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const lightness = (Math.max(...channels) + Math.min(...channels)) / 2 / 255
  const share = Math.min(100, Math.round(8 + (1 - lightness) * 200))
  return `color-mix(in oklab, var(--tsr-comp-control-color) ${share}%, var(--tsr-comp-bg))`
}

const viewBox = /viewBox="([^"]+)"/.exec(emptyStateSvg)![1]
const markup = emptyStateSvg
  .replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')
  .replace(
    /(fill|stroke|stop-color)="(#[0-9a-f]{6})"/gi,
    (_, property: string, hex: string) =>
      `style="${property}: ${toThemeColor(hex)}"`,
  )

/** Иллюстрация заглушек пустой таблицы (ADR 0123, ES9) в цветах темы. */
export const EmptyStateIllustration: IconComponent = ({
  width,
  height,
  className,
}) => (
  <svg
    viewBox={viewBox}
    width={width}
    height={height}
    className={className}
    aria-hidden
    dangerouslySetInnerHTML={{ __html: markup }}
  />
)

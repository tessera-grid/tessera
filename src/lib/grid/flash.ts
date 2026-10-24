/**
 * Вспышка итога в разметке грида (ADR 0134): атрибут итога и инлайн-переменная слоя
 * `var(--tsr-comp-flash-<итог>-bg)`. Пока вспышка гаснет, атрибут остаётся с
 * `-out`, а переменная снята — слой уходит переходом к прозрачному.
 */
import { useTableState } from '../core/reactivity'
import type { FlashEntry, Flashes } from '../core/flashes/flashFeature'
import { columnHighlightKey } from '../core/highlights/highlightFeature'

type Layer = 'row' | 'cell' | 'column'

const ATTR: Record<Layer, string> = {
  row: 'data-flash',
  cell: 'data-flash',
  column: 'data-column-flash',
}

export interface FlashRender {
  attrs: Record<string, string | boolean | undefined>
  style: Record<string, string> | undefined
}

const NONE: FlashRender = { attrs: {}, style: undefined }

export const flashRender = (
  layers: readonly { layer: Layer; entry: FlashEntry | undefined }[],
): FlashRender => {
  let attrs: FlashRender['attrs'] | undefined
  let style: Record<string, string> | undefined
  for (const { layer, entry } of layers) {
    if (!entry) {
      continue
    }
    attrs ??= {}
    attrs[ATTR[layer]] = entry.outcome
    if (entry.out) {
      attrs[`${ATTR[layer]}-out`] = true
      continue
    }
    style ??= {}
    style[`--tsr-flash-${layer}`] = `var(--tsr-comp-flash-${entry.outcome}-bg)`
  }
  return attrs ? { attrs, style } : NONE
}

/** Вспышка колонки — для ячеек заголовка и футера. */
export const useColumnFlash = (table: unknown, columnId: string) => {
  const key = columnHighlightKey(columnId)
  return useTableState(table as never, (state: unknown) => ({
    flash: (state as { flashes?: Flashes }).flashes?.[key],
  })).flash as FlashEntry | undefined
}

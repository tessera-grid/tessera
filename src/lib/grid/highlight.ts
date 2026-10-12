/**
 * Подсветка в разметке грида (ADR 0080): атрибуты и инлайн-переменные слоя. Цвет
 * передаётся переменной `var(--tsr-comp-highlight-<tone>-bg)` — тему по-прежнему
 * определяют токены, свой тон — токеном приложения.
 */
import type { CSSProperties } from 'react'

import { useTableState } from '../core/reactivity'
import {
  columnHighlightKey,
  type Highlights,
  type HighlightTargetState,
  visibleHighlight,
} from '../core/highlights/highlightFeature'

type Layer = 'row' | 'cell' | 'column'

const ATTR: Record<Layer, string> = {
  row: 'data-highlight',
  cell: 'data-highlight',
  column: 'data-column-highlight',
}

const fill = (tone: string) => `var(--tsr-comp-highlight-${tone}-bg)`

export interface HighlightRender {
  attrs: Record<string, string | boolean | undefined>
  style: CSSProperties | undefined
}

const NONE: HighlightRender = { attrs: {}, style: undefined }

/**
 * Атрибуты и стиль слоёв цели. `label` видимой подсветки — `aria-description`
 * (`describe: false` — слой его не несёт: колонку описывает только заголовок).
 */
export const highlightRender = (
  layers: readonly {
    layer: Layer
    state: HighlightTargetState | undefined
    describe?: boolean
  }[],
): HighlightRender => {
  let attrs: HighlightRender['attrs'] | undefined
  let style: Record<string, string> | undefined
  for (const { layer, state, describe = true } of layers) {
    const { entry, out } = visibleHighlight(state)
    if (!entry) {
      continue
    }
    attrs ??= {}
    style ??= {}
    attrs[ATTR[layer]] = entry.tone
    if (out) {
      attrs[`${ATTR[layer]}-out`] = true
      continue
    }
    style[`--tsr-highlight-${layer}`] = fill(entry.tone)
    if (describe && entry.label && !attrs['aria-description']) {
      attrs['aria-description'] = entry.label
    }
  }
  return attrs ? { attrs, style: style as CSSProperties } : NONE
}

/** Подсветка колонки — для ячеек заголовка и футера. */
export const useColumnHighlight = (table: unknown, columnId: string) => {
  const key = columnHighlightKey(columnId)
  return useTableState(table as never, (state: unknown) => ({
    highlight: (state as { highlights?: Highlights }).highlights?.[key],
  })).highlight as HighlightTargetState | undefined
}

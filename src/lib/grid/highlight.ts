/**
 * Подсветка в разметке грида (ADR 0080): атрибуты и инлайн-переменные слоя. Цвет
 * передаётся переменной `var(--tsr-comp-highlight-<tone>-bg)` — тему по-прежнему
 * определяют токены, свой тон — токеном приложения.
 */
import type { CSSProperties } from 'react'

import { useTableState } from '../core/reactivity'
import {
  columnHighlightKey,
  type HighlightEntry,
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

const shimmerVars = (entry: HighlightEntry) => {
  const { shimmer, tone } = entry
  if (!shimmer) {
    return undefined
  }
  return {
    '--tsr-highlight-shimmer': `var(--tsr-comp-highlight-${tone}-shimmer, ${fill(tone)})`,
    '--tsr-highlight-shimmer-repeat': String(shimmer.repeat),
    ...(shimmer.period !== undefined && {
      '--tsr-highlight-shimmer-period': `${shimmer.period}ms`,
    }),
  }
}

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
  let shimmerSet = false
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
    const shimmer = !shimmerSet && shimmerVars(entry)
    if (shimmer) {
      shimmerSet = true
      attrs['data-highlight-shimmer'] = true
      attrs['data-highlight-start'] = String(entry.start)
      Object.assign(style, shimmer)
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

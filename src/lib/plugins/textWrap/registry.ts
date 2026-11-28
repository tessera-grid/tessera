/**
 * Запись плагина textWrap на `definePlugin` (ADR 0218): перенос текста в ячейках и высота
 * строк по содержимому. Поля колонки — в карте фич, замер и атрибуты — вкладом в тело.
 */
import { withBody } from '../../core/bodyContributions'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { textWrapBody } from './body'
import { textWrapFeature } from './textWrapFeature'

/** Предел строк ячейки `autoHeight` по умолчанию. */
export const DEFAULT_MAX_LINES = 10
/** Предел строк заголовка `autoHeaderHeight` по умолчанию. */
export const DEFAULT_HEADER_MAX_LINES = 3

export interface TextWrapOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Estimated height of an unmeasured row, px; the row height by default. */
  estimatedRowHeight?: number
  /** Line limit of an `autoHeight` cell, then `…` with a tooltip; 10 by default. */
  maxLines?: number
  /** Line limit of an `autoHeaderHeight` header, then `…` with a tooltip; 3 by default. */
  headerMaxLines?: number
}

const textWrapEntry = definePlugin<TextWrapOptions>()({
  id: 'textWrap',
  features: { textWrapFeature },
  diagnose: neverInert,
  options: o =>
    o.enabled === false
      ? {}
      : {
          estimatedRowHeight: o.estimatedRowHeight,
          textWrapMaxLines: o.maxLines ?? DEFAULT_MAX_LINES,
          textWrapHeaderMaxLines: o.headerMaxLines ?? DEFAULT_HEADER_MAX_LINES,
        },
})

/** Cell attributes, the measurement probe and the root hook — as a body contribution (ADR 0170, §3). */
export const textWrap = withBody(textWrapEntry, textWrapBody)

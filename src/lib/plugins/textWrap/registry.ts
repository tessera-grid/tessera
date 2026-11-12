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
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Оценка высоты незамеренной строки, px; по умолчанию — высота строки. */
  estimatedRowHeight?: number
  /** Предел строк ячейки `autoHeight`, дальше `…` с тултипом; по умолчанию 10. */
  maxLines?: number
  /** Предел строк заголовка `autoHeaderHeight`, дальше `…` с тултипом; по умолчанию 3. */
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

/** Атрибуты ячеек, проба замера и хук корня — вкладом в тело (ADR 0170, §3). */
export const textWrap = withBody(textWrapEntry, textWrapBody)

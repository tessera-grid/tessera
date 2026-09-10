import { PluginOptions } from '../types'

/** Параметры плагина схлопывания действий СТРОКИ в кебаб-меню. */
export interface RowActionMenuOptions extends PluginOptions {
  /**
   * `auto` — схлопывать по порогу; `always` — схлопывать всегда, игнорируя
   * счётчик. По умолчанию `auto`.
   */
  mode?: 'auto' | 'always'
  /**
   * Порог схлопывания для `auto`. По умолчанию `2` — overflow-меню строки
   * схлопывают агрессивнее заголовков (одна-две кнопки инлайн, дальше в меню).
   */
  threshold?: number
}

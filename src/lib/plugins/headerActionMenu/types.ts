import { HeaderActionSlot } from '../../core/headerActions'
import { PluginOptions } from '../types'

/** Параметры плагина схлопывания кнопок заголовка в кебаб-меню. */
export interface HeaderActionMenuOptions extends PluginOptions {
  /**
   * `auto` — схлопывать по порогу; `always` — схлопывать всегда, игнорируя
   * счётчик (форс). По умолчанию `auto`.
   */
  mode?: 'auto' | 'always'
  /**
   * Порог схлопывания для `auto`: если суммарное число действий в слоте
   * (применимые дескрипторы + опаковые кнопки) достигает порога — схлопываем.
   * По умолчанию `3` (две кнопки инлайн, с третьей — всё в меню).
   */
  threshold?: number
  /** Слоты заголовка, на которые распространяется схлопывание. По умолчанию `['rightHeaderSlot']`. */
  slots?: HeaderActionSlot[]
}

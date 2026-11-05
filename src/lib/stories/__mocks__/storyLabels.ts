import {
  DEFAULT_LOCALE,
  ENGLISH_LABELS,
  resolveLabels,
} from '../../core/localization/resolveLabels'
import { RU_LABELS } from './localization.ru'

/** Язык чисел и дат таблицы по языку истории — как в `DataGridStory`. */
export const storyGridLocale = (locale?: string) =>
  locale === 'ru' ? 'ru-RU' : DEFAULT_LOCALE

/**
 * Подписи таблицы на языке истории (аргумент `locale` из тулбара): `play` сверяет текст
 * с ними, а не с английской строкой, — проверка не зависит от языка.
 */
export const storyLabels = (locale?: string) =>
  locale === 'ru'
    ? resolveLabels(RU_LABELS, storyGridLocale(locale))
    : ENGLISH_LABELS

const MARKER = 424242

/**
 * Шаблон подписи с любым числом для `toMatch`: `render` получает число-метку, на её
 * месте в шаблоне — `number`.
 */
export const labelPattern = (
  locale: string | undefined,
  render: (n: number) => string,
  number = '\\d+',
) =>
  new RegExp(
    `^${render(MARKER)
      .split(new Intl.NumberFormat(storyGridLocale(locale)).format(MARKER))
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join(number)}$`,
  )

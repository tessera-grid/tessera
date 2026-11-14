// Текст истории на двух языках (ADR 0225): гайд, консоль и свои подписи истории — пара
// `{ ru, en }` рядом с местом, а не ключ словаря таблицы.

export type StoryLocale = 'en' | 'ru'

/** Текст истории: русский пишется первым и идёт на ревью, английский — его перевод. */
export interface StoryText {
  readonly ru: string
  readonly en: string
}

/** Язык истории по аргументу `locale` или глобалу тулбара: всё, кроме `ru`, — английский. */
export const storyLocaleOf = (locale: string | undefined): StoryLocale =>
  locale === 'ru' ? 'ru' : 'en'

/** Текст на языке истории; строка — имя API или данные, она не переводится. */
export const textOf = (
  text: StoryText | string,
  locale: string | undefined,
): string => (typeof text === 'string' ? text : text[storyLocaleOf(locale)])

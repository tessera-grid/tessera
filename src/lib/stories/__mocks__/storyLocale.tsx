// Язык историй из тулбара Storybook для историй без аргумента `locale` — кита `/ui`:
// примитивы словаря не знают (ADR 0166), их тексты история берёт из словаря таблицы.
// Он же — язык гайда, консоли и своих подписей историй (ADR 0225).
import { createContext, useCallback, useContext, useMemo } from 'react'

import { ru as ruDateLocale } from '@daypicker/react/locale/ru'

import { storyGridLocale, storyLabels } from './storyLabels'
import { type StoryLocale, type StoryText, textOf } from './storyText'

export type { StoryLocale }

const StoryLocaleContext = createContext<StoryLocale>('en')

/** Язык тулбара для дерева истории — ставит декоратор `preview`. */
export const StoryLocaleProvider = StoryLocaleContext.Provider

export const useStoryLocale = () => useContext(StoryLocaleContext)

/** Подписи таблицы на языке тулбара: тексты, которые в таблице идут из словаря. */
export const useStoryLabels = () => {
  const locale = useStoryLocale()
  return useMemo(() => storyLabels(locale), [locale])
}

/** Язык чисел и дат таблицы на языке тулбара: `en-US` или `ru-RU`. */
export const useStoryGridLocale = () => storyGridLocale(useStoryLocale())

/** Язык календаря на языке тулбара — как `dateLocale` таблицы историй. */
export const useStoryDateLocale = () =>
  useStoryLocale() === 'ru' ? ruDateLocale : undefined

/** Свой текст истории на языке тулбара (ADR 0225). */
export const useStoryText = () => {
  const locale = useStoryLocale()
  return useCallback(
    (text: StoryText | string) => textOf(text, locale),
    [locale],
  )
}

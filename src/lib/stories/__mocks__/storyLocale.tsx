// Язык историй из тулбара Storybook для историй без аргумента `locale` — кита `/ui`:
// примитивы словаря не знают (ADR 0166), их тексты история берёт из словаря таблицы.
import { createContext, useContext, useMemo } from 'react'

import { ru as ruDateLocale } from '@daypicker/react/locale/ru'

import { storyGridLocale, storyLabels } from './storyLabels'

export type StoryLocale = 'en' | 'ru'

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

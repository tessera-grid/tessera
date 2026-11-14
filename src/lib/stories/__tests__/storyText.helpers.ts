import type { StoryText } from '../__mocks__/storyText'

/** Текст стенда теста на обоих языках одинаковый: язык стенда проверке не важен. */
export const both = (text: string): StoryText => ({ ru: text, en: text })

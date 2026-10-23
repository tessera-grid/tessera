import { storyLabels } from '../__mocks__/storyLabels'

/**
 * Подписи таблицы на языке, в котором тесты рендерят истории: тест ищет и сверяет
 * подпись по её ключу словаря, а не по английской строке.
 */
export const tableLabels = storyLabels()

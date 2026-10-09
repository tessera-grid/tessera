import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  InfiniteScrollDemo,
  type InfiniteScrollDemoProps,
} from './demos/infiniteScrollDemos'

/**
 * Кнопка «наверх» (ADR 0082): справа в нижней панели, видна после прокрутки на два
 * экрана. Панель сама не вызывает — выключите пагинацию, и кнопки не станет.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Back to top',
} satisfies Meta<StoryProps>

export default meta

export const BackToTopPagination: StoryObj<StoryProps> = {
  name: 'Pagination',
  // Страница по 100 строк: прокрутите вниз — кнопка вернёт в начало страницы.
  // Включите enableKeyboardNavigation — активная ячейка перейдёт в первую строку.
  args: {
    containerHeight: 600,
    height: 480,
    maxHeight: 480,
    enableBackToTop: true,
    enablePagination: true,
    paginationPageSize: 100,
    dataCount: 1000,
  },
}

export const BackToTopInfiniteScroll: StoryObj<InfiniteScrollDemoProps> = {
  name: 'Infinite scroll',
  // Лента со счётчиком загруженных строк: кнопка встаёт в его панель.
  args: {
    containerHeight: 600,
    height: 480,
    maxHeight: 480,
    serverDelayMs: 300,
    blockSize: 100,
    enableBackToTop: true,
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
    blockSize: { control: { type: 'range', min: 5, max: 200, step: 5 } },
  },
  render: args => <InfiniteScrollDemo {...normalizeArgs(args)} />,
}

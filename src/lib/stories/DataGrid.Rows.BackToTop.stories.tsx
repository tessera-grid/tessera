import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  InfiniteScrollDemo,
  type InfiniteScrollDemoProps,
} from './demos/infiniteScrollDemos'
import { expect, userEvent } from 'storybook/test'
import { byTestId, settle, until, waitForRows } from './__mocks__/catalogPlay'

/** Прокрутка на два экрана показывает кнопку, нажатие возвращает в начало. */
const backToTop = async (canvas: HTMLElement) => {
  await waitForRows(canvas)
  const scroller = canvas.querySelector<HTMLElement>('.data-grid__container')!
  const button = () => byTestId('back-to-top')
  scroller.scrollTo({
    top: scroller.clientHeight * 2 + 200,
    behavior: 'instant',
  })
  await until(() => expect(button()).toBeVisible())
  await userEvent.click(button()!)
  await until(() => expect(scroller.scrollTop).toBe(0))
  await settle()
}

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
  play: ({ canvasElement }) => backToTop(canvasElement),
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
  // Дымовой тест ленты (ADR 0082, BT15): кнопка после прокрутки возвращает в начало.
  parameters: { requirements: ['BT15'] },
  play: async ({ canvasElement }) => {
    await until(() =>
      expect(byTestId('loaded-rows-count')).toHaveTextContent(
        'Loaded 100 of 1,000',
      ),
    )
    await backToTop(canvasElement)
  },
}

export const BackToTopWide: StoryObj<StoryProps> = {
  name: 'Wide table',
  // Широкая таблица (ADR 0105): прокрутите вправо — кнопка «к первой колонке» слева от
  // «наверх» вернёт к первой колонке, не трогая вертикаль. Одна ось — `axes` в
  // backToTopOptions.
  args: {
    containerHeight: 600,
    height: 480,
    maxHeight: 480,
    enableBackToTop: true,
    enablePagination: true,
    paginationPageSize: 100,
    dataCount: 1000,
    columnCount: 40,
  },
  // Дымовой сценарий (ADR 0105, BT24): обе кнопки возвращают к краю.
  parameters: { requirements: ['BT24'] },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const scroller = canvasElement.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    const start = () => byTestId('back-to-start')
    scroller.scrollTo({
      left: scroller.clientWidth * 2 + 200,
      behavior: 'instant',
    })
    await until(() => expect(start()).toBeVisible())
    const top = scroller.scrollTop
    await userEvent.click(start()!)
    await until(() => expect(scroller.scrollLeft).toBe(0))
    expect(scroller.scrollTop).toBe(top)
    await backToTop(canvasElement)
  },
}
